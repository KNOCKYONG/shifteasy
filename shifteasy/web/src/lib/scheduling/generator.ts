/**
 * Shifteasy 스케줄 자동 생성 엔진
 * 제약조건을 만족하면서 직원 선호도와 공정성을 고려한 스케줄 생성
 */

import { format, parseISO, eachDayOfInterval, isWeekend } from 'date-fns'
import type { 
  Staff, 
  ShiftType, 
  Assignment,
  Preference,
  Role,
  ScheduleGenerationConfig  // types.ts에서 import
} from '../types'
import { ConstraintEngine } from './constraints'

// 생성 결과
export type ScheduleGenerationResult = {
  assignments: Assignment[]
  analysis: {
    score: number
    hardViolations: number
    softScore: number
    generationTime: number
    iterations: number
  }
  warnings: string[]
  success: boolean
}

// 후보자 평가 점수
type CandidateScore = {
  staff: Staff
  score: number
  reasons: string[]
  penalties: number[]
}

/**
 * 그리디 + 백트래킹 스케줄 생성기
 */
export class ScheduleGenerator {
  private config: ScheduleGenerationConfig
  private assignments: Assignment[] = []
  private staffWorkload: Map<string, number> = new Map() // 주간 근무시간
  private staffConsecutiveNights: Map<string, number> = new Map()
  private staffLastShift: Map<string, { date: string; shiftType: ShiftType }> = new Map()
  private constraintEngine: ConstraintEngine

  constructor(config: ScheduleGenerationConfig) {
    this.config = config
    this.constraintEngine = new ConstraintEngine(
      config.hardConstraints,
      config.softConstraints,
      config.staff,
      config.shifts.map(s => ({ id: s.id, type: s.type }))
    )
  }

  /**
   * 메인 생성 메서드
   */
  async generate(): Promise<ScheduleGenerationResult> {
    const startTime = Date.now()
    this.reset()

    try {
      // 1단계: 그리디 알고리즘으로 초기 배치
      const initialSuccess = this.generateGreedy()
      
      if (!initialSuccess) {
        return {
          assignments: [],
          analysis: {
            score: 0,
            hardViolations: -1,
            softScore: 0,
            generationTime: Date.now() - startTime,
            iterations: 0
          },
          warnings: ['초기 배치 실패: 제약조건을 만족하는 해를 찾을 수 없습니다.'],
          success: false
        }
      }

      // 2단계: 최적화 (옵션)
      let iterations = 1
      if (this.config.enableOptimization) {
        iterations = this.optimize()
      }

      // 최종 분석
      const analysis = this.constraintEngine.analyzeSchedule(this.assignments)
      const generationTime = Date.now() - startTime

      return {
        assignments: [...this.assignments],
        analysis: {
          score: analysis.qualityMetrics.overallScore,
          hardViolations: analysis.hardViolations.length,
          softScore: analysis.qualityMetrics.softConstraintScore,
          generationTime,
          iterations
        },
        warnings: analysis.hardViolations.map(v => v.description),
        success: analysis.hardViolations.length === 0
      }

    } catch (error) {
      console.error('Schedule generation failed:', error)
      return {
        assignments: [],
        analysis: {
          score: 0,
          hardViolations: -1,
          softScore: 0,
          generationTime: Date.now() - startTime,
          iterations: 0
        },
        warnings: [`생성 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`],
        success: false
      }
    }
  }

  /**
   * 그리디 알고리즘 기반 초기 배치
   */
  private generateGreedy(): boolean {
    const dates = eachDayOfInterval({
      start: parseISO(this.config.dateRange.startDate),
      end: parseISO(this.config.dateRange.endDate)
    })

    // 날짜별로 순차 배치
    for (const date of dates) {
      const dateStr = format(date, 'yyyy-MM-dd')
      
      // 근무조별로 우선순위 정렬 (필요 인원이 많은 순서)
      const shiftsByPriority = this.getShiftsByPriority(dateStr)
      
      for (const shift of shiftsByPriority) {
        const success = this.assignShift(dateStr, shift)
        if (!success) {
          console.warn(`Failed to assign ${shift.type} shift on ${dateStr}`)
          // 실패해도 다음 시프트 계속 시도
        }
      }
    }

    return true // 부분적 실패도 허용
  }

  /**
   * 특정 날짜의 특정 시프트에 직원 배치
   */
  private assignShift(date: string, shift: { id: string; type: ShiftType }): boolean {
    const minRequired = this.config.hardConstraints.minStaffPerShift[shift.type] || 0
    const roleMixReq = this.config.hardConstraints.roleMixRequirements[shift.type] || {}

    // 1단계: 직급별 필수 인원 먼저 배치
    for (const [role, requiredCount] of Object.entries(roleMixReq)) {
      const required = typeof requiredCount === 'number' ? requiredCount : 0
      
      for (let i = 0; i < required; i++) {
        const candidate = this.findBestCandidate(date, shift, role as Role)
        if (candidate) {
          this.makeAssignment(date, shift, candidate.staff)
        }
      }
    }

    // 2단계: 나머지 인원 배치
    const currentAssigned = this.getAssignmentsForDateShift(date, shift.type).length
    const remainingNeeded = Math.max(0, minRequired - currentAssigned)

    for (let i = 0; i < remainingNeeded; i++) {
      const candidate = this.findBestCandidate(date, shift)
      if (candidate) {
        this.makeAssignment(date, shift, candidate.staff)
      }
    }

    return this.getAssignmentsForDateShift(date, shift.type).length >= minRequired
  }

  /**
   * 최적 후보자 찾기
   */
  private findBestCandidate(
    date: string, 
    shift: { id: string; type: ShiftType }, 
    requiredRole?: Role
  ): CandidateScore | null {
    const availableStaff = this.getAvailableStaff(date, shift.type)
      .filter(staff => !requiredRole || staff.role === requiredRole)

    if (availableStaff.length === 0) return null

    // 후보자들 점수 계산
    const candidates: CandidateScore[] = availableStaff.map(staff => {
      const score = this.calculateCandidateScore(staff, date, shift.type)
      return score
    })

    // 최고 점수 후보자 선택
    candidates.sort((a, b) => b.score - a.score)
    
    return candidates.length > 0 ? candidates[0] : null
  }

  /**
   * 후보자 점수 계산
   */
  private calculateCandidateScore(staff: Staff, date: string, shiftType: ShiftType): CandidateScore {
    let score = 100 // 기본 점수
    const reasons: string[] = []
    const penalties: number[] = []

    // 1. 개인 선호도 반영 (+30 ~ -30)
    const preference = this.getStaffPreference(staff.id, date, shiftType)
    if (preference) {
      const prefScore = preference.score * 6 // -30 ~ +30
      score += prefScore
      reasons.push(`선호도: ${preference.score > 0 ? '+' : ''}${prefScore}점`)
    }

    // 2. 근무량 균형 (-0 ~ -20)
    const workload = this.staffWorkload.get(staff.id) || 0
    const avgWorkload = this.getAverageWorkload()
    if (workload > avgWorkload) {
      const penalty = Math.min(20, (workload - avgWorkload) / 8 * 10)
      score -= penalty
      penalties.push(penalty)
      reasons.push(`과중근무 패널티: -${penalty.toFixed(1)}점`)
    }

    // 3. 연속 야간근무 회피 (-0 ~ -15)
    if (shiftType === 'N') {
      const consecutiveNights = this.staffConsecutiveNights.get(staff.id) || 0
      if (consecutiveNights > 0) {
        const penalty = consecutiveNights * 5
        score -= penalty
        penalties.push(penalty)
        reasons.push(`연속야간 패널티: -${penalty}점`)
      }
    }

    // 4. 경력/역량 보너스 (+0 ~ +15)
    const experienceBonus = this.getExperienceBonus(staff, shiftType)
    score += experienceBonus
    if (experienceBonus > 0) {
      reasons.push(`경력보너스: +${experienceBonus}점`)
    }

    // 5. 주말 근무 균형 (-5 ~ +5)
    const isWeekendShift = isWeekend(parseISO(date))
    if (isWeekendShift) {
      const weekendBalance = this.getWeekendBalance(staff.id)
      score += weekendBalance
      reasons.push(`주말균형: ${weekendBalance > 0 ? '+' : ''}${weekendBalance}점`)
    }

    return {
      staff,
      score: Math.max(0, score),
      reasons,
      penalties
    }
  }

  /**
   * 배치 실행
   */
  private makeAssignment(date: string, shift: { id: string; type: ShiftType }, staff: Staff): void {
    const assignment: Assignment = {
      id: `${date}-${shift.id}-${staff.id}`,
      scheduleId: 'temp',
      staffId: staff.id,
      shiftId: shift.id,
      date,
      isOvertime: false,
      isReplacement: false
    }

    this.assignments.push(assignment)

    // 상태 업데이트
    this.updateStaffState(staff, date, shift.type)
  }

  /**
   * 직원 상태 업데이트
   */
  private updateStaffState(staff: Staff, date: string, shiftType: ShiftType): void {
    // 근무시간 추가
    const shiftDuration = this.getShiftDuration(shiftType)
    const currentWorkload = this.staffWorkload.get(staff.id) || 0
    this.staffWorkload.set(staff.id, currentWorkload + shiftDuration)

    // 연속 야간 카운트 업데이트
    if (shiftType === 'N') {
      const current = this.staffConsecutiveNights.get(staff.id) || 0
      this.staffConsecutiveNights.set(staff.id, current + 1)
    } else if (shiftType !== 'O') {
      this.staffConsecutiveNights.set(staff.id, 0)
    }

    // 마지막 근무 기록
    this.staffLastShift.set(staff.id, { date, shiftType })
  }

  /**
   * 로컬 서치 최적화
   */
  private optimize(): number {
    const maxIterations = this.config.maxIterations || 100
    let bestScore = this.getCurrentScore()
    let iterations = 0

    for (let i = 0; i < maxIterations; i++) {
      iterations++
      
      // 스왑 시도
      const improved = this.tryImprovement()
      
      if (improved) {
        const currentScore = this.getCurrentScore()
        if (currentScore > bestScore) {
          bestScore = currentScore
        }
      } else {
        // 개선이 없으면 일정 확률로 조기 종료
        if (Math.random() < 0.3) break
      }
    }

    return iterations
  }

  /**
   * 개선 시도 (스왑, 재배치 등)
   */
  private tryImprovement(): boolean {
    // 랜덤하게 두 배치를 선택해서 스왑 시도
    if (this.assignments.length < 2) return false

    const idx1 = Math.floor(Math.random() * this.assignments.length)
    let idx2 = Math.floor(Math.random() * this.assignments.length)
    while (idx2 === idx1) {
      idx2 = Math.floor(Math.random() * this.assignments.length)
    }

    const assignment1 = this.assignments[idx1]
    const assignment2 = this.assignments[idx2]

    // 스왑 전 점수
    const beforeScore = this.getCurrentScore()

    // 스왑 실행
    const tempStaffId = assignment1.staffId
    assignment1.staffId = assignment2.staffId
    assignment2.staffId = tempStaffId

    // 스왑 후 점수
    const afterScore = this.getCurrentScore()

    // 개선되었으면 유지, 아니면 되돌리기
    if (afterScore > beforeScore) {
      return true
    } else {
      // 되돌리기
      assignment1.staffId = assignment2.staffId
      assignment2.staffId = tempStaffId
      return false
    }
  }

  // === 유틸리티 메서드들 ===

  private reset(): void {
    this.assignments = []
    this.staffWorkload.clear()
    this.staffConsecutiveNights.clear()
    this.staffLastShift.clear()
  }

  private getShiftsByPriority(_date: string): { id: string; type: ShiftType }[] {
    return this.config.shifts
      .filter(s => s.type !== 'O')
      .map(s => ({ id: s.id, type: s.type }))
      .sort((a, b) => {
        const aRequired = this.config.hardConstraints.minStaffPerShift[a.type] || 0
        const bRequired = this.config.hardConstraints.minStaffPerShift[b.type] || 0
        return bRequired - aRequired // 필요 인원 많은 순
      })
  }

  private getAvailableStaff(date: string, shiftType: ShiftType): Staff[] {
    return this.config.staff.filter(staff => {
      if (!staff.active) return false

      // 이미 해당 날짜에 배치되었는지 확인
      const alreadyAssigned = this.assignments.some(a => 
        a.date === date && a.staffId === staff.id
      )
      if (alreadyAssigned) return false

      // 하드 제약조건 확인 (간단 버전)
      if (!this.canAssignStaff(staff, date, shiftType)) return false

      return true
    })
  }

  private canAssignStaff(staff: Staff, date: string, shiftType: ShiftType): boolean {
    // 주간 근무시간 제한
    const currentWorkload = this.staffWorkload.get(staff.id) || 0
    const shiftDuration = this.getShiftDuration(shiftType)
    if (currentWorkload + shiftDuration > staff.maxWeeklyHours) {
      return false
    }

    // 연속 야간 제한
    if (shiftType === 'N') {
      const consecutiveNights = this.staffConsecutiveNights.get(staff.id) || 0
      if (consecutiveNights >= this.config.hardConstraints.maxConsecutiveNights) {
        return false
      }
    }

    // 최소 휴식시간 (간단 버전)
    const lastShift = this.staffLastShift.get(staff.id)
    if (lastShift && this.isConsecutiveDay(lastShift.date, date)) {
      // 실제로는 시간 계산해야 하지만 간단히 처리
      if (lastShift.shiftType === 'N' && shiftType === 'D') {
        return false // N->D 금지
      }
    }

    return true
  }

  private getAssignmentsForDateShift(date: string, shiftType: ShiftType): Assignment[] {
    return this.assignments.filter(a => {
      const shift = this.config.shifts.find(s => s.id === a.shiftId)
      return a.date === date && shift?.type === shiftType
    })
  }

  private getStaffPreference(staffId: string, date: string, shiftType: ShiftType): Preference | null {
    return this.config.preferences.find(p => 
      p.staffId === staffId && 
      p.date === date && 
      p.shiftType === shiftType
    ) || null
  }

  private getAverageWorkload(): number {
    if (this.staffWorkload.size === 0) return 0
    const total = Array.from(this.staffWorkload.values()).reduce((sum, w) => sum + w, 0)
    return total / this.staffWorkload.size
  }

  private getExperienceBonus(staff: Staff, shiftType: ShiftType): number {
    const experienceLevels = { 'NEWBIE': 0, 'JUNIOR': 5, 'SENIOR': 10, 'EXPERT': 15 }
    const baseBonus = experienceLevels[staff.experienceLevel] || 0
    
    // 야간근무는 시니어가 더 적합
    if (shiftType === 'N' && (staff.experienceLevel === 'SENIOR' || staff.experienceLevel === 'EXPERT')) {
      return baseBonus + 5
    }
    
    return baseBonus
  }

  private getWeekendBalance(_staffId: string): number {
    // 주말 근무 균형 점수 계산 (임시 구현)
    // 실제로는 과거 주말 근무 이력을 봐야 함
    return Math.floor(Math.random() * 11) - 5 // -5 ~ +5
  }

  private getShiftDuration(shiftType: ShiftType): number {
    const shift = this.config.shifts.find(s => s.type === shiftType)
    return shift?.duration || 8
  }

  private getCurrentScore(): number {
    const analysis = this.constraintEngine.analyzeSchedule(this.assignments)
    return analysis.qualityMetrics.overallScore
  }

  private isConsecutiveDay(date1: string, date2: string): boolean {
    const d1 = parseISO(date1)
    const d2 = parseISO(date2)
    const diff = Math.abs(d2.getTime() - d1.getTime())
    const dayInMs = 24 * 60 * 60 * 1000
    return diff === dayInMs
  }
}

/**
 * 편의 함수: 스케줄 생성
 */
export async function generateSchedule(config: ScheduleGenerationConfig): Promise<ScheduleGenerationResult> {
  const generator = new ScheduleGenerator(config)
  return await generator.generate()
}