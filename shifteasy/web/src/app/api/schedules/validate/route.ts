import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { HardConstraintValidator } from '@/lib/scheduling/constraints'
import type { HardConstraints, Staff, ShiftType, Role } from '@/lib/types'

const ValidateRequestSchema = z.object({
  scheduleId: z.string(),
  assignments: z.array(z.object({
    id: z.string(),
    staffId: z.string(),
    shiftId: z.string(),
    date: z.string()
  }))
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scheduleId, assignments } = ValidateRequestSchema.parse(body)

    // 스케줄 및 제약조건 정보 조회
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        ward: {
          include: {
            staff: true,
            shifts: true
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

    // 제약조건 설정
    const hardRules = schedule.ward.hardRules as Record<string, unknown>
    const hardConstraints: HardConstraints = {
      maxConsecutiveNights: (hardRules.maxConsecutiveNights as number) || 2,
      minRestHours: (hardRules.minRestHours as number) || 10,
      noPatterns: (hardRules.noPatterns as string[]) || [],
      maxWeeklyHours: (hardRules.maxWeeklyHours as number) || 40,
      minStaffPerShift: (hardRules.minStaffPerShift as Record<ShiftType, number>) || { D: 0, E: 0, N: 0, O: 0 },
      roleMixRequirements: (hardRules.roleMixRequirements as Partial<Record<ShiftType, Partial<Record<Role, number>>>>) || {}
    }

    // 직원 및 시프트 정보
    const staff: Staff[] = schedule.ward.staff.map(s => ({
      id: s.id,
      name: s.name,
      role: s.role as Role,
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

    const shifts = schedule.ward.shifts.map(shift => ({
      id: shift.id,
      type: shift.type as 'D' | 'E' | 'N' | 'O'
    }))

    // 하드 제약조건 검증
    const validator = new HardConstraintValidator(hardConstraints, staff, shifts)
    const violations = validator.validateAll(assignments as Parameters<typeof validator.validateAll>[0])

    // 경고와 오류로 분류
    const warnings = violations.filter(v => v.severity === 'LOW' || v.severity === 'MEDIUM')
    const errors = violations.filter(v => v.severity === 'HIGH' || v.severity === 'CRITICAL')

    return NextResponse.json({
      ok: errors.length === 0,
      valid: errors.length === 0,
      violations: {
        errors: errors.map(e => ({
          type: e.type,
          description: e.description,
          severity: e.severity,
          affectedStaff: e.affectedStaff,
          affectedDates: e.affectedDates,
          suggestion: e.suggestion
        })),
        warnings: warnings.map(w => ({
          type: w.type,
          description: w.description,
          severity: w.severity,
          affectedStaff: w.affectedStaff,
          affectedDates: w.affectedDates,
          suggestion: w.suggestion
        }))
      },
      summary: {
        totalViolations: violations.length,
        criticalErrors: errors.filter(e => e.severity === 'CRITICAL').length,
        warnings: warnings.length,
        canConfirm: errors.length === 0
      }
    })

  } catch (error) {
    console.error('Validation error:', error)
    
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

