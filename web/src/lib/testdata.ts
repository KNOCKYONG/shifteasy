import type { 
  HospitalConfig, 
  ShiftType, 
  Staff, 
  Request, 
  Preference, 
  HardConstraints, 
  SoftConstraints,
  Ward,
  Shift,
  Schedule,
  RequestType,
  RequestStatus,
  RequestPriority
} from "./types"

export const shifts: ShiftType[] = ["D", "E", "N", "O"]

export function makeDateArray(startISO: string, endISO: string): string[] {
  const res: string[] = []
  const start = new Date(startISO)
  const end = new Date(endISO)
  for (let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    res.push(`${y}-${m}-${day}`)
  }
  return res
}

export const monthDates: string[] = makeDateArray("2025-01-01", "2025-01-31")
export const allDates: string[] = monthDates

// === 3A 내과병동 (선호도 몰림 - 경쟁 심화) ===
export const staff3A: Staff[] = [
  // 책임간호사들 (CN)
  {
    id: "staff-3a-cn-01",
    name: "김수련",
    role: "CN",
    employeeId: "3A001",
    hireDate: "2020-03-15",
    maxWeeklyHours: 40,
    skills: ["중환자관리", "응급처치", "신규교육"],
    technicalSkill: 5,
    leadership: 5,
    communication: 4,
    adaptability: 4,
    reliability: 5,
    experienceLevel: "EXPERT",
    active: true
  },
  {
    id: "staff-3a-cn-02",
    name: "박정현",
    role: "CN",
    employeeId: "3A002",
    hireDate: "2019-08-20",
    maxWeeklyHours: 40,
    skills: ["교육담당", "품질관리"],
    technicalSkill: 4,
    leadership: 5,
    communication: 5,
    adaptability: 4,
    reliability: 4,
    experienceLevel: "EXPERT",
    active: true
  },

  // 일반간호사들 (RN) - 시니어
  {
    id: "staff-3a-rn-01",
    name: "이민지",
    role: "RN",
    employeeId: "3A003",
    hireDate: "2021-01-10",
    maxWeeklyHours: 40,
    skills: ["투약관리", "환자교육"],
    technicalSkill: 4,
    leadership: 3,
    communication: 4,
    adaptability: 4,
    reliability: 4,
    experienceLevel: "SENIOR",
    active: true
  },
  {
    id: "staff-3a-rn-02",
    name: "최서영",
    role: "RN",
    employeeId: "3A004",
    hireDate: "2021-06-01",
    maxWeeklyHours: 40,
    skills: ["상처관리", "감염관리"],
    technicalSkill: 4,
    leadership: 3,
    communication: 3,
    adaptability: 4,
    reliability: 4,
    experienceLevel: "SENIOR",
    active: true
  },
  {
    id: "staff-3a-rn-03",
    name: "정하은",
    role: "RN",
    employeeId: "3A005",
    hireDate: "2022-03-01",
    maxWeeklyHours: 40,
    skills: ["심전도", "응급처치"],
    technicalSkill: 3,
    leadership: 2,
    communication: 4,
    adaptability: 3,
    reliability: 4,
    experienceLevel: "JUNIOR",
    active: true
  },
  {
    id: "staff-3a-rn-04",
    name: "강윤서",
    role: "RN",
    employeeId: "3A006",
    hireDate: "2022-09-15",
    maxWeeklyHours: 40,
    skills: ["기본간호", "투약"],
    technicalSkill: 3,
    leadership: 2,
    communication: 3,
    adaptability: 3,
    reliability: 3,
    experienceLevel: "JUNIOR",
    active: true
  },
  {
    id: "staff-3a-rn-05",
    name: "윤채원",
    role: "RN",
    employeeId: "3A007",
    hireDate: "2023-03-01",
    maxWeeklyHours: 40,
    skills: ["기본간호"],
    technicalSkill: 2,
    leadership: 1,
    communication: 3,
    adaptability: 3,
    reliability: 3,
    experienceLevel: "NEWBIE",
    active: true
  },

  // 선임간호사들 (SN)
  {
    id: "staff-3a-sn-01",
    name: "임수빈",
    role: "SN",
    employeeId: "3A008",
    hireDate: "2020-09-01",
    maxWeeklyHours: 40,
    skills: ["환자관리", "업무조정"],
    technicalSkill: 4,
    leadership: 4,
    communication: 4,
    adaptability: 4,
    reliability: 4,
    experienceLevel: "SENIOR",
    active: true
  },
  {
    id: "staff-3a-sn-02",
    name: "조민경",
    role: "SN",
    employeeId: "3A009",
    hireDate: "2021-11-15",
    maxWeeklyHours: 40,
    skills: ["문서관리", "신규지도"],
    technicalSkill: 3,
    leadership: 3,
    communication: 4,
    adaptability: 3,
    reliability: 4,
    experienceLevel: "JUNIOR",
    active: true
  },

  // 간호조무사들 (NA)
  {
    id: "staff-3a-na-01",
    name: "홍지우",
    role: "NA",
    employeeId: "3A010",
    hireDate: "2019-05-01",
    maxWeeklyHours: 40,
    skills: ["환경관리", "물품관리"],
    technicalSkill: 3,
    leadership: 2,
    communication: 3,
    adaptability: 3,
    reliability: 4,
    experienceLevel: "SENIOR",
    active: true
  },
  {
    id: "staff-3a-na-02",
    name: "신다은",
    role: "NA",
    employeeId: "3A011",
    hireDate: "2022-01-15",
    maxWeeklyHours: 40,
    skills: ["환경정리", "보조업무"],
    technicalSkill: 2,
    leadership: 2,
    communication: 3,
    adaptability: 3,
    reliability: 3,
    experienceLevel: "JUNIOR",
    active: true
  }
]

// === 5B 외과병동 (선호도 분포 널널함) ===
export const staff5B: Staff[] = [
  // 책임간호사들 (CN)
  {
    id: "staff-5b-cn-01",
    name: "김준호",
    role: "CN",
    employeeId: "5B001",
    hireDate: "2018-03-01",
    maxWeeklyHours: 40,
    skills: ["수술간호", "마취관리", "팀관리"],
    technicalSkill: 5,
    leadership: 5,
    communication: 5,
    adaptability: 4,
    reliability: 5,
    experienceLevel: "EXPERT",
    active: true
  },
  {
    id: "staff-5b-cn-02",
    name: "송미경",
    role: "CN",
    employeeId: "5B002",
    hireDate: "2019-06-15",
    maxWeeklyHours: 40,
    skills: ["외과간호", "감염관리"],
    technicalSkill: 5,
    leadership: 4,
    communication: 4,
    adaptability: 5,
    reliability: 5,
    experienceLevel: "EXPERT",
    active: true
  },

  // 일반간호사들 (RN)
  {
    id: "staff-5b-rn-01",
    name: "이태우",
    role: "RN",
    employeeId: "5B003",
    hireDate: "2020-02-01",
    maxWeeklyHours: 40,
    skills: ["수술전후간호", "드레싱"],
    technicalSkill: 4,
    leadership: 3,
    communication: 4,
    adaptability: 4,
    reliability: 4,
    experienceLevel: "SENIOR",
    active: true
  },
  {
    id: "staff-5b-rn-02",
    name: "박소현",
    role: "RN",
    employeeId: "5B004",
    hireDate: "2020-11-15",
    maxWeeklyHours: 40,
    skills: ["통증관리", "환자상담"],
    technicalSkill: 4,
    leadership: 3,
    communication: 5,
    adaptability: 4,
    reliability: 4,
    experienceLevel: "SENIOR",
    active: true
  },
  {
    id: "staff-5b-rn-03",
    name: "정우진",
    role: "RN",
    employeeId: "5B005",
    hireDate: "2021-08-01",
    maxWeeklyHours: 40,
    skills: ["기본외과간호", "수액관리"],
    technicalSkill: 3,
    leadership: 3,
    communication: 3,
    adaptability: 3,
    reliability: 4,
    experienceLevel: "JUNIOR",
    active: true
  },
  {
    id: "staff-5b-rn-04",
    name: "한서진",
    role: "RN",
    employeeId: "5B006",
    hireDate: "2022-02-15",
    maxWeeklyHours: 40,
    skills: ["상처관리", "투약"],
    technicalSkill: 3,
    leadership: 2,
    communication: 4,
    adaptability: 4,
    reliability: 3,
    experienceLevel: "JUNIOR",
    active: true
  },
  {
    id: "staff-5b-rn-05",
    name: "최준영",
    role: "RN",
    employeeId: "5B007",
    hireDate: "2023-07-01",
    maxWeeklyHours: 40,
    skills: ["기본간호"],
    technicalSkill: 2,
    leadership: 2,
    communication: 3,
    adaptability: 3,
    reliability: 3,
    experienceLevel: "NEWBIE",
    active: true
  },

  // 선임간호사들 (SN)
  {
    id: "staff-5b-sn-01",
    name: "강혜진",
    role: "SN",
    employeeId: "5B008",
    hireDate: "2019-10-15",
    maxWeeklyHours: 40,
    skills: ["물품관리", "업무분배"],
    technicalSkill: 4,
    leadership: 4,
    communication: 4,
    adaptability: 4,
    reliability: 5,
    experienceLevel: "SENIOR",
    active: true
  },
  {
    id: "staff-5b-sn-02",
    name: "오예린",
    role: "SN",
    employeeId: "5B009",
    hireDate: "2021-05-01",
    maxWeeklyHours: 40,
    skills: ["환자관리", "보호자상담"],
    technicalSkill: 3,
    leadership: 3,
    communication: 4,
    adaptability: 3,
    reliability: 4,
    experienceLevel: "JUNIOR",
    active: true
  },
  {
    id: "staff-5b-sn-03",
    name: "류서연",
    role: "SN",
    employeeId: "5B010",
    hireDate: "2022-12-01",
    maxWeeklyHours: 40,
    skills: ["기록관리", "환경관리"],
    technicalSkill: 3,
    leadership: 2,
    communication: 3,
    adaptability: 3,
    reliability: 3,
    experienceLevel: "JUNIOR",
    active: true
  },

  // 간호조무사들 (NA)
  {
    id: "staff-5b-na-01",
    name: "배현우",
    role: "NA",
    employeeId: "5B011",
    hireDate: "2018-09-01",
    maxWeeklyHours: 40,
    skills: ["물품정리", "환경관리", "멸균업무"],
    technicalSkill: 4,
    leadership: 3,
    communication: 3,
    adaptability: 4,
    reliability: 5,
    experienceLevel: "SENIOR",
    active: true
  },
  {
    id: "staff-5b-na-02",
    name: "서지안",
    role: "NA",
    employeeId: "5B012",
    hireDate: "2021-03-15",
    maxWeeklyHours: 40,
    skills: ["환경정리", "기본보조"],
    technicalSkill: 2,
    leadership: 2,
    communication: 3,
    adaptability: 3,
    reliability: 3,
    experienceLevel: "JUNIOR",
    active: true
  }
]



// === 병동 설정 ===
export const hardConstraints3A: HardConstraints = {
  maxConsecutiveNights: 2,
  minRestHours: 10,
  noPatterns: ["D->N", "N->D"],
  maxWeeklyHours: 40,
  minStaffPerShift: { D: 6, E: 5, N: 4, O: 0 },
  roleMixRequirements: {
    D: { RN: 4, CN: 1 },
    E: { RN: 3, CN: 1 },
    N: { RN: 3 }
  }
}

export const softConstraints3A: SoftConstraints = {
  respectPreferencesWeight: 3,
  fairWeekendRotationWeight: 2,
  avoidSplitShiftsWeight: 1,
  teamCompatibilityWeight: 2,
  experienceBalanceWeight: 2
}

export const hardConstraints5B: HardConstraints = {
  maxConsecutiveNights: 2,
  minRestHours: 10,
  noPatterns: ["D->N", "N->D"],
  maxWeeklyHours: 40,
  minStaffPerShift: { D: 5, E: 5, N: 3, O: 0 },
  roleMixRequirements: {
    D: { RN: 3, CN: 1 },
    E: { RN: 3, CN: 1 },
    N: { RN: 2 }
  }
}

export const softConstraints5B: SoftConstraints = {
  respectPreferencesWeight: 2,
  fairWeekendRotationWeight: 3,
  avoidSplitShiftsWeight: 2,
  teamCompatibilityWeight: 3,
  experienceBalanceWeight: 2
}

export const demoConfig3A: HospitalConfig = {
  hospital: {
    id: "hospital-demo",
    name: "Shifteasy Demo General Hospital",
    timeZone: "Asia/Seoul",
    shifts: [
      { id: "D", label: "Day", start: "07:00", end: "15:00", duration: 8 },
      { id: "E", label: "Evening", start: "15:00", end: "23:00", duration: 8 },
      { id: "N", label: "Night", start: "23:00", end: "07:00", duration: 8 },
      { id: "O", label: "Off" },
    ],
    roles: ["RN", "CN", "SN", "NA"],
  },
  ward: {
    id: "ward-3A",
    name: "3A 내과병동 (선호도 몰림)",
    code: "3A",
    hardRules: hardConstraints3A,
    softRules: softConstraints3A,
  },
}

export const demoConfig5B: HospitalConfig = {
  hospital: demoConfig3A.hospital,
  ward: {
    id: "ward-5B",
    name: "5B 외과병동 (선호도 분산)",
    code: "5B",
    hardRules: hardConstraints5B,
    softRules: softConstraints5B,
  },
}

// Combined exports for API usage
export const testWards: Ward[] = [
  {
    id: "ward-3A",
    name: "3A 내과병동 (선호도 몰림)",
    code: "3A",
    active: true,
    hardRules: hardConstraints3A,
    softRules: softConstraints3A,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "ward-5B", 
    name: "5B 외과병동 (선호도 분산)",
    code: "5B",
    active: true,
    hardRules: hardConstraints5B,
    softRules: softConstraints5B,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

export const testStaff: Staff[] = [...staff3A, ...staff5B]

export const testRequests: Request[] = [
  {
    id: "req-1",
    wardId: "ward-3A",
    staffId: "staff-3A-001",
    type: "ANNUAL_LEAVE" as RequestType,
    status: "PENDING" as RequestStatus,
    priority: "MEDIUM" as RequestPriority,
    startDate: "2025-01-15",
    endDate: "2025-01-17",
    shiftType: undefined,
    reason: "가족 여행",
    description: "3일간 연차 신청합니다.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approvedBy: undefined,
    approvedAt: undefined,
    rejectedReason: undefined
  },
  {
    id: "req-2",
    wardId: "ward-5B",
    staffId: "staff-5B-001",
    type: "SHIFT_PREFERENCE" as RequestType,
    status: "PENDING" as RequestStatus,
    priority: "LOW" as RequestPriority,
    startDate: "2025-01-20",
    endDate: undefined,
    shiftType: "D" as ShiftType,
    reason: "개인 사정",
    description: "20일 데이 근무 선호합니다.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approvedBy: undefined,
    approvedAt: undefined,
    rejectedReason: undefined
  }
]

export const testSchedules: Schedule[] = []

export const testShifts: Shift[] = [
  {
    id: "shift-D",
    type: "D" as ShiftType,
    label: "Day",
    startTime: "07:00",
    endTime: "15:00",
    duration: 8,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "shift-E", 
    type: "E" as ShiftType,
    label: "Evening",
    startTime: "15:00",
    endTime: "23:00",
    duration: 8,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "shift-N",
    type: "N" as ShiftType,
    label: "Night", 
    startTime: "23:00",
    endTime: "07:00",
    duration: 8,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "shift-O",
    type: "O" as ShiftType,
    label: "Off",
    startTime: undefined,
    endTime: undefined,
    duration: 0,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

// === 선호도 테스트 데이터 ===

// 3A 병동: 선호도 몰림 패턴 (Day 근무 선호, Night 기피)
export const preferences3A: Preference[] = [
  // 김수련 (CN) - Day 선호, Night 강력 기피
  ...monthDates.flatMap(date => [
    {
      id: `pref-3a-cn-01-${date}-D`,
      staffId: "staff-3a-cn-01",
      date: date,
      shiftType: "D" as ShiftType,
      score: 5,
      reason: "가족과 함께하는 저녁 시간이 중요해요",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: `pref-3a-cn-01-${date}-N`,
      staffId: "staff-3a-cn-01",
      date: date,
      shiftType: "N" as ShiftType,
      score: 1,
      reason: "야간 근무는 체력적으로 부담이 커요",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]),

  // 박정현 (CN) - Day/Evening 선호, Night 기피
  ...monthDates.flatMap(date => [
    {
      id: `pref-3a-cn-02-${date}-D`,
      staffId: "staff-3a-cn-02",
      date: date,
      shiftType: "D" as ShiftType,
      score: 4,
      reason: "업무 집중도가 가장 좋아요",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: `pref-3a-cn-02-${date}-E`,
      staffId: "staff-3a-cn-02",
      date: date,
      shiftType: "E" as ShiftType,
      score: 4,
      reason: "오후 업무도 괜찮아요",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: `pref-3a-cn-02-${date}-N`,
      staffId: "staff-3a-cn-02",
      date: date,
      shiftType: "N" as ShiftType,
      score: 2,
      reason: "수면 패턴 유지가 어려워요",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]),

  // 이현우 (RN) - 강한 Day 선호
  ...monthDates.flatMap(date => [
    {
      id: `pref-3a-rn-01-${date}-D`,
      staffId: "staff-3a-rn-01",
      date: date,
      shiftType: "D" as ShiftType,
      score: 5,
      reason: "어린 아이가 있어서 낮 근무만 가능해요",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: `pref-3a-rn-01-${date}-E`,
      staffId: "staff-3a-rn-01",
      date: date,
      shiftType: "E" as ShiftType,
      score: 2,
      reason: "육아 때문에 어려워요",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: `pref-3a-rn-01-${date}-N`,
      staffId: "staff-3a-rn-01",
      date: date,
      shiftType: "N" as ShiftType,
      score: 1,
      reason: "절대 불가능해요",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ])
]

// 5B 병동: 선호도 분산 패턴 (고른 분포)
export const preferences5B: Preference[] = [
  // 김준호 (CN) - 균형잡힌 선호도
  ...monthDates.flatMap(date => [
    {
      id: `pref-5b-cn-01-${date}-D`,
      staffId: "staff-5b-cn-01", 
      date: date,
      shiftType: "D" as ShiftType,
      score: 3,
      reason: "어떤 시간대든 괜찮아요",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: `pref-5b-cn-01-${date}-E`,
      staffId: "staff-5b-cn-01",
      date: date,
      shiftType: "E" as ShiftType,
      score: 4,
      reason: "오후가 조금 더 선호해요",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: `pref-5b-cn-01-${date}-N`,
      staffId: "staff-5b-cn-01",
      date: date,
      shiftType: "N" as ShiftType,
      score: 3,
      reason: "야간도 나쁘지 않아요",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]),

  // 정미란 (CN) - Night 선호 (특이 패턴)
  ...monthDates.flatMap(date => [
    {
      id: `pref-5b-cn-02-${date}-D`,
      staffId: "staff-5b-cn-02",
      date: date,
      shiftType: "D" as ShiftType,
      score: 2,
      reason: "아침이 힘들어요",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: `pref-5b-cn-02-${date}-E`,
      staffId: "staff-5b-cn-02",
      date: date,
      shiftType: "E" as ShiftType,
      score: 3,
      reason: "보통이에요",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: `pref-5b-cn-02-${date}-N`,
      staffId: "staff-5b-cn-02",
      date: date,
      shiftType: "N" as ShiftType,
      score: 5,
      reason: "밤이 집중이 잘 돼요. 올빼미형이라서요",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ])
]

// 통합 선호도 데이터 (양쪽 병동 포함)
export const allPreferences: Preference[] = [
  ...preferences3A,
  ...preferences5B
]

// Legacy export for compatibility
export const testPreferences: Preference[] = [...preferences3A, ...preferences5B]