export type Role = 'RN' | 'CN' | 'SN' | 'NA'
export type ShiftId = 'D' | 'E' | 'N' | 'O'

export type Staff = {
  id: string
  name: string
  role: Role
  maxWeeklyHours?: number
  skills?: string[]
  preferences?: Partial<Record<ShiftId, number>>
  unavailable?: string[] // ISO dates
}

export type CellId = `${string}:${ShiftId}` // e.g., '2025-09-15:D'

export type Assignment = { id: string; staffId: string; cellId: CellId }

export type Schedule = { wardId: string; version: string; assignments: Assignment[] }

export type RoleMixRule = Partial<Record<Role, string>>

export type HospitalConfig = {
  hospital: {
    name: string
    timeZone: string
    shifts: { id: ShiftId; label: string; start?: string; end?: string }[]
    roles: Role[]
  }
  ward: {
    id: string
    name: string
    minStaffPerShift: Record<ShiftId, number>
    roleMix: Partial<Record<ShiftId, RoleMixRule>>
    hardRules: {
      maxConsecutiveNights: number
      minRestHours: number
      noPatterns: string[]
      maxWeeklyHours: number
    }
    softRules: {
      respectPreferencesWeight: number
      fairWeekendRotationWeight: number
      avoidSplitShiftsWeight: number
    }
  }
}

