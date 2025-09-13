import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { wardService, staffService, preferenceService, scheduleService, assignmentService, shiftService, auditLogService } from '@/lib/memoryStorage'
import { generateSchedule } from '@/lib/scheduling/generator'
import type { 
  HardConstraints, 
  SoftConstraints, 
  Staff, 
  Preference,
  ScheduleGenerationConfig,
  ShiftType,
  Role
} from '@/lib/types'

const GenerateRequestSchema = z.object({
  wardId: z.string(),
  name: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  options: z.object({
    enableOptimization: z.boolean().optional().default(true),
    maxIterations: z.number().optional().default(100)
  }).optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { wardId, name, startDate, endDate, options } = GenerateRequestSchema.parse(body)

    // 병동 정보 및 관련 데이터 조회
    const ward = wardService.findUnique({ id: wardId })

    if (!ward) {
      return NextResponse.json(
        { error: 'Ward not found' },
        { status: 404 }
      )
    }

    const wardStaff = staffService.findMany({ wardId, active: true }).staff
    const shifts = shiftService.findMany({ active: true })
    const wardPreferences = preferenceService.findMany({
      wardId,
      dateRange: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    })

    // 직원 데이터 변환 (preferences를 별도로 조회한 것과 연결)
    const staff: Staff[] = wardStaff.map(s => {
      const staffPreferences = wardPreferences.filter(p => p.staffId === s.id)
      
      return {
        id: s.id,
        name: s.name,
        role: s.role as Role,
        employeeId: s.employeeId || undefined,
        hireDate: s.hireDate ? new Date(s.hireDate).toISOString() : undefined,
        maxWeeklyHours: s.maxWeeklyHours || 40,
        skills: s.skills,
        technicalSkill: s.technicalSkill,
        leadership: s.leadership,
        communication: s.communication,
        adaptability: s.adaptability,
        reliability: s.reliability,
        experienceLevel: s.experienceLevel as 'NEWBIE' | 'JUNIOR' | 'SENIOR' | 'EXPERT',
        active: s.active,
        preferences: staffPreferences.map(p => ({
          id: p.id,
          staffId: p.staffId,
          date: typeof p.date === 'string' ? p.date.split('T')[0] : new Date(p.date).toISOString().split('T')[0],
          shiftType: p.shiftType as 'D' | 'E' | 'N' | 'O',
          score: p.score,
          reason: p.reason || undefined
        }))
      }
    })

    // 선호도 데이터 평탄화
    const preferences: Preference[] = []
    staff.forEach(s => {
      if (s.preferences) {
        preferences.push(...s.preferences)
      }
    })

    // 시프트 데이터 변환
    const shiftsFormatted = shifts.map(shift => ({
      id: shift.id,
      type: shift.type as 'D' | 'E' | 'N' | 'O',
      label: shift.label,
      duration: shift.duration || 8
    }))

    // 제약조건 추출
    const hardRules = ward.hardRules as Record<string, unknown>
    const softRules = ward.softRules as Record<string, unknown>

    const hardConstraints: HardConstraints = {
      maxConsecutiveNights: (hardRules.maxConsecutiveNights as number) || 2,
      minRestHours: (hardRules.minRestHours as number) || 10,
      noPatterns: (hardRules.noPatterns as string[]) || ['D->N', 'N->D'],
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

    // 스케줄 생성 설정
    const config: ScheduleGenerationConfig = {
      dateRange: { startDate, endDate },
      hardConstraints,
      softConstraints,
      staff,
      shifts: shiftsFormatted,
      preferences,
      maxIterations: options?.maxIterations || 100,
      enableOptimization: options?.enableOptimization !== false
    }

    console.log('Generating schedule with config:', {
      wardId,
      dateRange: config.dateRange,
      staffCount: staff.length,
      shiftsCount: shiftsFormatted.length,
      preferencesCount: preferences.length
    })

    // 스케줄 생성 실행
    const result = await generateSchedule(config)

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: 'Schedule generation failed',
        warnings: result.warnings,
        analysis: result.analysis
      }, { status: 400 })
    }

    // DB에 스케줄 저장
    const scheduleData = {
      wardId,
      name: name || `${ward.name} 스케줄 ${new Date().toLocaleDateString('ko-KR')}`,
      startDate: startDate,  // string으로 유지
      endDate: endDate,      // string으로 유지
      status: 'DRAFT' as const,
      version: 'draft',
      rulesSnapshot: {
        hardConstraints,
        softConstraints,
        generatedAt: new Date().toISOString(),
        config: {
          maxIterations: config.maxIterations,
          enableOptimization: config.enableOptimization
        }
      },
      assignments: [],  // 초기 빈 배열, 나중에 추가됨
      createdBy: 'system' // TODO: 실제 사용자 ID로 교체
    }

    const schedule = scheduleService.create(scheduleData)

    // 배치 정보 저장
    const assignmentData = result.assignments.map(a => ({
      scheduleId: schedule.id,
      staffId: a.staffId,
      shiftId: a.shiftId,
      date: a.date,  // string으로 유지 (타입 정의와 일치)
      isOvertime: a.isOvertime || false,
      isReplacement: a.isReplacement || false,
      confidence: a.confidence
    }))

    assignmentService.createMany({
      data: assignmentData
    })

    // 감사 로그
    await auditLogService.create({
      userId: 'system',
      action: 'GENERATE_SCHEDULE',
      entityType: 'Schedule',
      entityId: schedule.id,
      newData: {
        scheduleId: schedule.id,
        wardId,
        assignmentCount: assignmentData.length,
        analysis: result.analysis
      },
      metadata: {
        generationConfig: config,
        generationResult: {
          success: result.success,
          warnings: result.warnings,
          analysis: result.analysis
        }
      }
    })

    return NextResponse.json({
      success: true,
      schedule: {
        id: schedule.id,
        name: schedule.name,
        status: schedule.status,
        startDate: new Date(schedule.startDate).toISOString(),
        endDate: new Date(schedule.endDate).toISOString(),
        assignmentCount: assignmentData.length
      },
      analysis: result.analysis,
      warnings: result.warnings,
      assignments: result.assignments.length // 개수만 반환
    })

  } catch (error) {
    console.error('Schedule generation error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: error.errors,
          success: false 
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        success: false
      },
      { status: 500 }
    )
  }
}