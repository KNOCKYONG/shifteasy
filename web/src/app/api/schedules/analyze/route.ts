import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ConstraintEngine } from '@/lib/scheduling/constraints'
import type { HardConstraints, SoftConstraints, Staff, Assignment, ShiftType, Role } from '@/lib/types'

const AnalyzeRequestSchema = z.object({
  scheduleId: z.string(),
  assignments: z.array(z.object({
    id: z.string(),
    scheduleId: z.string(),
    staffId: z.string(),
    shiftId: z.string(),
    date: z.string(),
    isOvertime: z.boolean().optional(),
    isReplacement: z.boolean().optional(),
    confidence: z.number().optional()
  })).optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scheduleId, assignments: providedAssignments } = AnalyzeRequestSchema.parse(body)

    // 스케줄 정보 조회
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        ward: {
          include: {
            staff: true,
            shifts: true
          }
        },
        assignments: {
          include: {
            staff: true,
            shift: true
          }
        }
      }
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // 제약조건 정보 추출
    const hardRules = schedule.ward.hardRules as Record<string, unknown>
    const softRules = schedule.ward.softRules as Record<string, unknown>

    const hardConstraints: HardConstraints = {
      maxConsecutiveNights: (hardRules.maxConsecutiveNights as number) || 2,
      minRestHours: (hardRules.minRestHours as number) || 10,
      noPatterns: (hardRules.noPatterns as string[]) || [],
      maxWeeklyHours: (hardRules.maxWeeklyHours as number) || 40,
      minStaffPerShift: (hardRules.minStaffPerShift as Record<ShiftType, number>) || { D: 0, E: 0, N: 0, O: 0 },
      roleMixRequirements: (hardRules.roleMixRequirements as Partial<Record<ShiftType, Partial<Record<Role, number>>>>) || {}
    }

    const softConstraints: SoftConstraints = {
      respectPreferencesWeight: (softRules.respectPreferencesWeight as number) || 3,
      fairWeekendRotationWeight: (softRules.fairWeekendRotationWeight as number) || 2,
      avoidSplitShiftsWeight: (softRules.avoidSplitShiftsWeight as number) || 1,
      teamCompatibilityWeight: (softRules.teamCompatibilityWeight as number) || 2,
      experienceBalanceWeight: (softRules.experienceBalanceWeight as number) || 2
    }

    // 직원 정보 변환
    const staff: Staff[] = schedule.ward.staff.map(s => ({
      id: s.id,
      name: s.name,
      role: s.role as Role,
      employeeId: s.employeeId || undefined,
      hireDate: s.hireDate?.toISOString(),
      maxWeeklyHours: s.maxWeeklyHours || 40,
      skills: s.skills,
      technicalSkill: s.technicalSkill,
      leadership: s.leadership,
      communication: s.communication,
      adaptability: s.adaptability,
      reliability: s.reliability,
      experienceLevel: s.experienceLevel as 'NEWBIE' | 'JUNIOR' | 'SENIOR' | 'EXPERT',
      active: s.active
    }))

    // 시프트 정보 변환
    const shifts = schedule.ward.shifts.map(shift => ({
      id: shift.id,
      type: shift.type as 'D' | 'E' | 'N' | 'O'
    }))

    // 배치 정보 (제공된 것이 있으면 사용, 아니면 DB에서)
    const assignments: Assignment[] = (providedAssignments || schedule.assignments).map(a => ({
      id: a.id,
      scheduleId: a.scheduleId,
      staffId: a.staffId,
      shiftId: a.shiftId,
      date: typeof a.date === 'string' ? a.date : a.date.toISOString().split('T')[0],
      isOvertime: a.isOvertime || false,
      isReplacement: a.isReplacement || false,
      confidence: a.confidence || undefined
    }))

    // 제약조건 엔진으로 분석
    const engine = new ConstraintEngine(hardConstraints, softConstraints, staff, shifts)
    const analysis = await engine.analyzeSchedule(assignments)

    // 분석 결과에 스케줄 ID 설정
    analysis.scheduleId = scheduleId

    return NextResponse.json({
      success: true,
      analysis
    })

  } catch (error) {
    console.error('Schedule analysis error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}