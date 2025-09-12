// 기본 열거형 타입들
export type Role = 'RN' | 'CN' | 'SN' | 'NA'
export type ShiftType = 'D' | 'E' | 'N' | 'O'
export type ShiftId = ShiftType // 호환성을 위한 별칭

export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF'
export type ScheduleStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'ARCHIVED'
export type RequestType = 'ANNUAL_LEAVE' | 'SICK_LEAVE' | 'SHIFT_PREFERENCE' | 'SHIFT_AVOIDANCE' | 'OVERTIME'
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
export type RequestPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

// 직원 타입 (확장됨)
export type Staff = {
  id: string
  name: string
  role: Role
  employeeId?: string
  hireDate?: string
  
  // 기본 정보
  maxWeeklyHours: number
  skills: string[]
  
  // 역량 평가 (1-5 척도)
  technicalSkill: number
  leadership: number
  communication: number
  adaptability: number
  reliability: number
  
  // 경력 레벨
  experienceLevel: 'NEWBIE' | 'JUNIOR' | 'SENIOR' | 'EXPERT'
  
  active: boolean
  
  // 관계형 데이터
  preferences?: Preference[]
  assignments?: Assignment[]
  requests?: Request[]
}

// 선호도 관리
export type Preference = {
  id: string
  staffId: string
  date: string // ISO date string
  shiftType?: ShiftType
  score: number // -5 ~ +5 (음수는 기피)
  reason?: string
}

// 요청 관리
export type Request = {
  id: string
  wardId: string
  staffId: string
  
  type: RequestType
  status: RequestStatus
  priority: RequestPriority
  
  startDate: string
  endDate?: string
  shiftType?: ShiftType
  
  reason?: string
  description?: string
  
  approvedBy?: string
  approvedAt?: string
  rejectedReason?: string
  
  createdAt: string
  updatedAt: string
}

// 스케줄 관련
export type CellId = `${string}:${ShiftType}` // e.g., '2025-09-15:D'

export type Assignment = { 
  id: string
  scheduleId: string
  staffId: string
  shiftId: string
  date: string
  
  isOvertime?: boolean
  isReplacement?: boolean
  confidence?: number
}

export type Schedule = { 
  id: string
  wardId: string
  name: string
  startDate: string
  endDate: string
  status: ScheduleStatus
  version: string
  
  rulesSnapshot: any // 생성 시 규칙 스냅샷
  assignments: Assignment[]
}

// 제약조건 관리
export type HardConstraints = {
  maxConsecutiveNights: number
  minRestHours: number
  noPatterns: string[] // 금지 패턴 (예: "D->N", "N->D")
  maxWeeklyHours: number
  minStaffPerShift: Record<ShiftType, number>
  roleMixRequirements: Partial<Record<ShiftType, Partial<Record<Role, number>>>>
}

export type SoftConstraints = {
  respectPreferencesWeight: number    // 개인 선호도 반영 가중치
  fairWeekendRotationWeight: number   // 주말 근무 공정성 가중치
  avoidSplitShiftsWeight: number      // 분할 근무 기피 가중치
  teamCompatibilityWeight: number     // 팀 궁합 가중치
  experienceBalanceWeight: number     // 경력 밸런스 가중치
}

// 병원 설정 (확장됨)
export type HospitalConfig = {
  hospital: {
    id: string
    name: string
    timeZone: string
    shifts: { id: ShiftType; label: string; start?: string; end?: string; duration?: number }[]
    roles: Role[]
  }
  ward: {
    id: string
    name: string
    code: string
    hardRules: HardConstraints
    softRules: SoftConstraints
  }
}

// 팀 궁합 매트릭스
export type StaffCompatibility = {
  id: string
  staff1Id: string
  staff2Id: string
  compatibilityScore: number // 1-5
  totalShiftsTogether: number
  successfulShifts: number
  
  communicationScore?: number
  workStyleScore?: number
  reliabilityScore?: number
}

// 스케줄링 결과 분석
export type ScheduleAnalysis = {
  scheduleId: string
  
  // 제약조건 위반 분석
  hardViolations: {
    type: string
    description: string
    affectedStaff: string[]
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  }[]
  
  softViolations: {
    type: string
    description: string
    impact: number // 0-1 (1이 최대 부정적 영향)
    suggestion?: string
  }[]
  
  // 품질 지표
  qualityMetrics: {
    hardConstraintScore: number     // 0-100 (100이 완벽)
    softConstraintScore: number     // 0-100
    fairnessScore: number          // 공정성 지수
    satisfactionScore: number      // 예상 만족도
    overallScore: number          // 종합 점수
  }
  
  // 개선 제안
  improvements: {
    type: 'STAFF_REALLOCATION' | 'CONSTRAINT_RELAXATION' | 'ADDITIONAL_STAFF'
    description: string
    expectedImprovement: number
    effort: 'LOW' | 'MEDIUM' | 'HIGH'
  }[]
}

// 유틸리티 타입들
export type RoleMixRule = Partial<Record<Role, string>>

export type DateRange = {
  startDate: string
  endDate: string
}

export type WeekViewData = {
  dates: string[]
  shifts: ShiftType[]
  assignments: Record<CellId, Assignment[]>
  warnings: Record<CellId, string[]>
}

