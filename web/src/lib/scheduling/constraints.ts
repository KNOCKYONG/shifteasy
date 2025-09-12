/**
 * Shifteasy 제약조건 검증 엔진
 * 하드 제약조건과 소프트 제약조건을 검증하는 시스템
 */

import { format, parseISO, addDays, differenceInHours, isSameDay, getDay, isWeekend } from 'date-fns'
import type { 
  Staff, 
  ShiftType, 
  Assignment, 
  HardConstraints, 
  SoftConstraints, 
  ScheduleAnalysis,
  Role 
} from '../types'

// 제약조건 위반 결과
export type ConstraintViolation = {
  type: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  affectedStaff: string[]
  affectedDates?: string[]
  suggestion?: string
  impact?: number // 0-1 for soft constraints
}

// 시프트 시간 정보
const SHIFT_DURATIONS: Record<ShiftType, number> = {
  'D': 8,   // Day: 8시간
  'E': 8,   // Evening: 8시간  
  'N': 8,   // Night: 8시간
  'O': 0    // Off: 0시간
}

const SHIFT_START_HOURS: Record<ShiftType, number> = {
  'D': 7,   // 07:00
  'E': 15,  // 15:00
  'N': 23,  // 23:00
  'O': 0    // Off
}

/**
 * 하드 제약조건 검증기
 */
export class HardConstraintValidator {
  constructor(
    private constraints: HardConstraints,
    private staff: Staff[],
    private shifts: { id: string; type: ShiftType }[]
  ) {}

  /**
   * 모든 하드 제약조건 검증
   */
  validateAll(assignments: Assignment[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []

    // 1. 최소 인원 수 검증
    violations.push(...this.validateMinStaffing(assignments))

    // 2. 직급 믹스 요구사항 검증
    violations.push(...this.validateRoleMix(assignments))

    // 3. 연속 야간 근무 제한 검증
    violations.push(...this.validateConsecutiveNights(assignments))

    // 4. 최소 휴식시간 검증
    violations.push(...this.validateMinRestHours(assignments))

    // 5. 금지 패턴 검증
    violations.push(...this.validateForbiddenPatterns(assignments))

    // 6. 주간 최대 근무시간 검증
    violations.push(...this.validateWeeklyHours(assignments))

    return violations.filter(v => v !== null) as ConstraintViolation[]
  }

  /**
   * 최소 인원 수 검증
   */
  private validateMinStaffing(assignments: Assignment[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []
    const dailyAssignments = this.groupByDateAndShift(assignments)

    Object.entries(dailyAssignments).forEach(([dateShift, assigns]) => {
      const [date, shiftType] = dateShift.split(':') as [string, ShiftType]
      const minRequired = this.constraints.minStaffPerShift[shiftType] || 0
      
      if (assigns.length < minRequired) {
        violations.push({
          type: 'MIN_STAFFING',
          description: `${date} ${shiftType} 근무: 최소 ${minRequired}명 필요, 현재 ${assigns.length}명 배치`,
          severity: 'CRITICAL',
          affectedStaff: assigns.map(a => a.staffId),
          affectedDates: [date],
          suggestion: `${minRequired - assigns.length}명 추가 배치 필요`
        })
      }
    })

    return violations
  }

  /**
   * 직급 믹스 요구사항 검증
   */
  private validateRoleMix(assignments: Assignment[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []
    const dailyAssignments = this.groupByDateAndShift(assignments)

    Object.entries(dailyAssignments).forEach(([dateShift, assigns]) => {
      const [date, shiftType] = dateShift.split(':') as [string, ShiftType]
      const requirements = this.constraints.roleMixRequirements[shiftType]
      
      if (!requirements) return

      const roleCount = this.countRolesByAssignments(assigns)

      Object.entries(requirements).forEach(([role, required]) => {
        const current = roleCount[role as Role] || 0
        const requiredNum = typeof required === 'number' ? required : parseInt(required?.toString() || '0')
        
        if (current < requiredNum) {
          violations.push({
            type: 'ROLE_MIX',
            description: `${date} ${shiftType} 근무: ${role} 역할 최소 ${requiredNum}명 필요, 현재 ${current}명`,
            severity: 'HIGH',
            affectedStaff: assigns.map(a => a.staffId),
            affectedDates: [date],
            suggestion: `${role} 역할 직원 ${requiredNum - current}명 추가 배치 필요`
          })
        }
      })
    })

    return violations
  }

  /**
   * 연속 야간 근무 제한 검증
   */
  private validateConsecutiveNights(assignments: Assignment[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []
    const staffAssignments = this.groupByStaff(assignments)

    Object.entries(staffAssignments).forEach(([staffId, assigns]) => {
      const sortedAssigns = assigns
        .filter(a => this.getShiftType(a.shiftId) === 'N')
        .sort((a, b) => a.date.localeCompare(b.date))

      let consecutiveCount = 0
      let consecutiveDates: string[] = []

      for (let i = 0; i < sortedAssigns.length; i++) {
        const currentDate = sortedAssigns[i].date
        const prevDate = i > 0 ? sortedAssigns[i - 1].date : null

        // 연속된 날짜인지 확인
        if (prevDate && this.isConsecutiveDay(prevDate, currentDate)) {
          consecutiveCount++
          consecutiveDates.push(currentDate)
        } else {
          consecutiveCount = 1
          consecutiveDates = [currentDate]
        }

        // 제한 초과 검증
        if (consecutiveCount > this.constraints.maxConsecutiveNights) {
          violations.push({
            type: 'CONSECUTIVE_NIGHTS',
            description: `직원 ${staffId}: 연속 야간 근무 ${consecutiveCount}일 (최대 ${this.constraints.maxConsecutiveNights}일)`,
            severity: 'HIGH',
            affectedStaff: [staffId],
            affectedDates: consecutiveDates,
            suggestion: '야간 근무 사이에 휴무 또는 주간 근무 배치 필요'
          })
        }
      }
    })

    return violations
  }

  /**
   * 최소 휴식시간 검증
   */
  private validateMinRestHours(assignments: Assignment[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []
    const staffAssignments = this.groupByStaff(assignments)

    Object.entries(staffAssignments).forEach(([staffId, assigns]) => {
      const sortedAssigns = assigns
        .filter(a => this.getShiftType(a.shiftId) !== 'O')
        .sort((a, b) => a.date.localeCompare(b.date))

      for (let i = 1; i < sortedAssigns.length; i++) {
        const prev = sortedAssigns[i - 1]
        const current = sortedAssigns[i]
        
        const restHours = this.calculateRestHours(prev, current)
        
        if (restHours < this.constraints.minRestHours) {
          violations.push({
            type: 'MIN_REST_HOURS',
            description: `직원 ${staffId}: ${prev.date}~${current.date} 휴식시간 ${restHours}시간 (최소 ${this.constraints.minRestHours}시간)`,
            severity: 'HIGH',
            affectedStaff: [staffId],
            affectedDates: [prev.date, current.date],
            suggestion: '충분한 휴식시간 확보를 위한 스케줄 조정 필요'
          })
        }
      }
    })

    return violations
  }

  /**
   * 금지 패턴 검증 (예: D->N, N->D)
   */
  private validateForbiddenPatterns(assignments: Assignment[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []
    const staffAssignments = this.groupByStaff(assignments)

    Object.entries(staffAssignments).forEach(([staffId, assigns]) => {
      const sortedAssigns = assigns
        .filter(a => this.getShiftType(a.shiftId) !== 'O')
        .sort((a, b) => a.date.localeCompare(b.date))

      for (let i = 1; i < sortedAssigns.length; i++) {
        const prevShift = this.getShiftType(sortedAssigns[i - 1].shiftId)
        const currentShift = this.getShiftType(sortedAssigns[i].shiftId)
        const pattern = `${prevShift}->${currentShift}`

        if (this.constraints.noPatterns.includes(pattern)) {
          violations.push({
            type: 'FORBIDDEN_PATTERN',
            description: `직원 ${staffId}: 금지된 근무 패턴 ${pattern} (${sortedAssigns[i - 1].date} -> ${sortedAssigns[i].date})`,
            severity: 'MEDIUM',
            affectedStaff: [staffId],
            affectedDates: [sortedAssigns[i - 1].date, sortedAssigns[i].date],
            suggestion: `${pattern} 패턴을 피하도록 스케줄 수정 필요`
          })
        }
      }
    })

    return violations
  }

  /**
   * 주간 최대 근무시간 검증
   */
  private validateWeeklyHours(assignments: Assignment[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []
    const staffAssignments = this.groupByStaff(assignments)

    Object.entries(staffAssignments).forEach(([staffId, assigns]) => {
      const staff = this.staff.find(s => s.id === staffId)
      const maxHours = staff?.maxWeeklyHours || this.constraints.maxWeeklyHours

      const weeklyHours = this.calculateWeeklyHours(assigns)

      Object.entries(weeklyHours).forEach(([week, hours]) => {
        if (hours > maxHours) {
          violations.push({
            type: 'WEEKLY_HOURS',
            description: `직원 ${staffId}: ${week} 주간 근무시간 ${hours}시간 (최대 ${maxHours}시간)`,
            severity: 'MEDIUM',
            affectedStaff: [staffId],
            suggestion: `주간 근무시간을 ${maxHours}시간 이하로 조정 필요`
          })
        }
      })
    })

    return violations
  }

  // === 유틸리티 메서드들 ===

  private groupByDateAndShift(assignments: Assignment[]) {
    return assignments.reduce((acc, assignment) => {
      const key = `${assignment.date}:${this.getShiftType(assignment.shiftId)}`
      if (!acc[key]) acc[key] = []
      acc[key].push(assignment)
      return acc
    }, {} as Record<string, Assignment[]>)
  }

  private groupByStaff(assignments: Assignment[]) {
    return assignments.reduce((acc, assignment) => {
      if (!acc[assignment.staffId]) acc[assignment.staffId] = []
      acc[assignment.staffId].push(assignment)
      return acc
    }, {} as Record<string, Assignment[]>)
  }

  private getShiftType(shiftId: string): ShiftType {
    const shift = this.shifts.find(s => s.id === shiftId)
    return shift?.type || 'O'
  }

  private countRolesByAssignments(assignments: Assignment[]) {
    return assignments.reduce((acc, assignment) => {
      const staff = this.staff.find(s => s.id === assignment.staffId)
      if (staff) {
        acc[staff.role] = (acc[staff.role] || 0) + 1
      }
      return acc
    }, {} as Record<Role, number>)
  }

  private isConsecutiveDay(date1: string, date2: string): boolean {
    const d1 = parseISO(date1)
    const d2 = parseISO(date2)
    const nextDay = addDays(d1, 1)
    return isSameDay(nextDay, d2)
  }

  private calculateRestHours(prev: Assignment, current: Assignment): number {
    const prevShift = this.getShiftType(prev.shiftId)
    const currentShift = this.getShiftType(current.shiftId)
    
    const prevEndHour = SHIFT_START_HOURS[prevShift] + SHIFT_DURATIONS[prevShift]
    const currentStartHour = SHIFT_START_HOURS[currentShift]
    
    // 같은 날이면 단순 계산
    if (prev.date === current.date) {
      return Math.max(0, currentStartHour - prevEndHour)
    }
    
    // 다음 날이면 24시간 더해서 계산
    const restHours = (24 - prevEndHour) + currentStartHour
    return Math.max(0, restHours)
  }

  private calculateWeeklyHours(assignments: Assignment[]): Record<string, number> {
    const weeklyHours: Record<string, number> = {}
    
    assignments.forEach(assignment => {
      const date = parseISO(assignment.date)
      const weekStart = format(addDays(date, -getDay(date)), 'yyyy-MM-dd')
      const shiftType = this.getShiftType(assignment.shiftId)
      const hours = SHIFT_DURATIONS[shiftType]
      
      weeklyHours[weekStart] = (weeklyHours[weekStart] || 0) + hours
    })
    
    return weeklyHours
  }
}

/**
 * 소프트 제약조건 평가기
 */
export class SoftConstraintEvaluator {
  constructor(
    private constraints: SoftConstraints,
    private staff: Staff[]
  ) {}

  /**
   * 소프트 제약조건 평가 (점수 계산)
   */
  evaluate(assignments: Assignment[]): {
    score: number
    violations: ConstraintViolation[]
    breakdown: Record<string, number>
  } {
    const violations: ConstraintViolation[] = []
    const breakdown: Record<string, number> = {}

    // 1. 개인 선호도 반영 점수
    const preferenceScore = this.evaluatePreferences(assignments, violations)
    breakdown['preferences'] = preferenceScore

    // 2. 주말 근무 공정성 점수
    const weekendScore = this.evaluateWeekendFairness(assignments, violations)
    breakdown['weekendFairness'] = weekendScore

    // 3. 분할 근무 기피 점수
    const splitShiftScore = this.evaluateAvoidSplitShifts(assignments, violations)
    breakdown['avoidSplitShifts'] = splitShiftScore

    // 4. 팀 궁합 점수
    const teamCompatibilityScore = this.evaluateTeamCompatibility(assignments, violations)
    breakdown['teamCompatibility'] = teamCompatibilityScore

    // 5. 경력 밸런스 점수
    const experienceBalanceScore = this.evaluateExperienceBalance(assignments, violations)
    breakdown['experienceBalance'] = experienceBalanceScore

    // 가중평균으로 총 점수 계산
    const totalScore = 
      (preferenceScore * this.constraints.respectPreferencesWeight +
       weekendScore * this.constraints.fairWeekendRotationWeight +
       splitShiftScore * this.constraints.avoidSplitShiftsWeight +
       teamCompatibilityScore * this.constraints.teamCompatibilityWeight +
       experienceBalanceScore * this.constraints.experienceBalanceWeight) /
      (this.constraints.respectPreferencesWeight +
       this.constraints.fairWeekendRotationWeight +
       this.constraints.avoidSplitShiftsWeight +
       this.constraints.teamCompatibilityWeight +
       this.constraints.experienceBalanceWeight)

    return {
      score: Math.max(0, Math.min(100, totalScore)),
      violations,
      breakdown
    }
  }

  private evaluatePreferences(assignments: Assignment[], violations: ConstraintViolation[]): number {
    // 개인 선호도 반영 로직 구현
    // 임시로 80점 반환
    return 80
  }

  private evaluateWeekendFairness(assignments: Assignment[], violations: ConstraintViolation[]): number {
    // 주말 근무 공정성 로직 구현  
    // 임시로 75점 반환
    return 75
  }

  private evaluateAvoidSplitShifts(assignments: Assignment[], violations: ConstraintViolation[]): number {
    // 분할 근무 기피 로직 구현
    // 임시로 85점 반환
    return 85
  }

  private evaluateTeamCompatibility(assignments: Assignment[], violations: ConstraintViolation[]): number {
    // 팀 궁합 평가 로직 구현
    // 임시로 70점 반환
    return 70
  }

  private evaluateExperienceBalance(assignments: Assignment[], violations: ConstraintViolation[]): number {
    // 경력 밸런스 평가 로직 구현
    // 임시로 78점 반환
    return 78
  }
}

/**
 * 통합 제약조건 검증기
 */
export class ConstraintEngine {
  private hardValidator: HardConstraintValidator
  private softEvaluator: SoftConstraintEvaluator

  constructor(
    hardConstraints: HardConstraints,
    softConstraints: SoftConstraints,
    staff: Staff[],
    shifts: { id: string; type: ShiftType }[]
  ) {
    this.hardValidator = new HardConstraintValidator(hardConstraints, staff, shifts)
    this.softEvaluator = new SoftConstraintEvaluator(softConstraints, staff)
  }

  /**
   * 전체 스케줄 분석
   */
  analyzeSchedule(assignments: Assignment[]): ScheduleAnalysis {
    const hardViolations = this.hardValidator.validateAll(assignments)
    const softEvaluation = this.softEvaluator.evaluate(assignments)

    const hardConstraintScore = hardViolations.length === 0 ? 100 : 
      Math.max(0, 100 - (hardViolations.length * 10))

    return {
      scheduleId: 'temp',
      hardViolations: hardViolations.map(v => ({
        type: v.type,
        description: v.description,
        affectedStaff: v.affectedStaff,
        severity: v.severity
      })),
      softViolations: softEvaluation.violations.map(v => ({
        type: v.type,
        description: v.description,
        impact: v.impact || 0.5,
        suggestion: v.suggestion
      })),
      qualityMetrics: {
        hardConstraintScore,
        softConstraintScore: softEvaluation.score,
        fairnessScore: softEvaluation.breakdown['weekendFairness'] || 0,
        satisfactionScore: softEvaluation.breakdown['preferences'] || 0,
        overallScore: (hardConstraintScore * 0.7 + softEvaluation.score * 0.3)
      },
      improvements: this.generateImprovements(hardViolations, softEvaluation.violations)
    }
  }

  private generateImprovements(
    hardViolations: ConstraintViolation[], 
    softViolations: ConstraintViolation[]
  ) {
    const improvements: ScheduleAnalysis['improvements'] = []

    // 하드 제약조건 위반에 대한 개선 제안
    hardViolations.forEach(violation => {
      if (violation.type === 'MIN_STAFFING') {
        improvements.push({
          type: 'ADDITIONAL_STAFF',
          description: violation.suggestion || '추가 인력 배치 필요',
          expectedImprovement: 0.2,
          effort: 'MEDIUM'
        })
      } else {
        improvements.push({
          type: 'STAFF_REALLOCATION',
          description: violation.suggestion || '직원 재배치 필요',
          expectedImprovement: 0.15,
          effort: 'LOW'
        })
      }
    })

    return improvements
  }
}