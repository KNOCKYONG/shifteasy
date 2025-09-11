import type { HospitalConfig, ShiftId, Staff, CellId, Role } from "./types"

export const shifts: ShiftId[] = ["D", "E", "N", "O"]

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

export const monthDates: string[] = makeDateArray("2025-09-01", "2025-09-30")
export const allDates: string[] = monthDates

export const demoConfig3A: HospitalConfig = {
  hospital: {
    name: "Shifteasy Demo General Hospital",
    timeZone: "Asia/Seoul",
    shifts: [
      { id: "D", label: "Day", start: "07:00", end: "15:00" },
      { id: "E", label: "Evening", start: "15:00", end: "23:00" },
      { id: "N", label: "Night", start: "23:00", end: "07:00" },
      { id: "O", label: "Off" },
    ],
    roles: ["RN", "CN", "SN", "NA"],
  },
  ward: {
    id: "ward-3A",
    name: "3A 내과병동",
    minStaffPerShift: { D: 6, E: 5, N: 4, O: 0 },
    roleMix: { D: { RN: ">=4", CN: ">=1" }, N: { RN: ">=3" } },
    hardRules: { maxConsecutiveNights: 2, minRestHours: 10, noPatterns: ["D->N", "N->D"], maxWeeklyHours: 40 },
    softRules: { respectPreferencesWeight: 3, fairWeekendRotationWeight: 2, avoidSplitShiftsWeight: 1 },
  },
}

export const demoConfig5B: HospitalConfig = {
  hospital: demoConfig3A.hospital,
  ward: {
    id: "ward-5B",
    name: "5B 외과병동",
    minStaffPerShift: { D: 5, E: 5, N: 3, O: 0 },
    roleMix: { D: { RN: ">=3", CN: ">=1" }, N: { RN: ">=2" } },
    hardRules: { maxConsecutiveNights: 2, minRestHours: 10, noPatterns: ["D->N", "N->D"], maxWeeklyHours: 40 },
    softRules: { respectPreferencesWeight: 3, fairWeekendRotationWeight: 2, avoidSplitShiftsWeight: 1 },
  },
}

export const roster3A: Staff[] = [
  { id: "s01", name: "김하늘", role: "CN" },
  { id: "s02", name: "박서지", role: "RN" },
  { id: "s03", name: "이도윤", role: "RN" },
  { id: "s04", name: "장서연", role: "SN" },
  { id: "s05", name: "최민재", role: "RN" },
  { id: "s06", name: "한서준", role: "NA" },
  { id: "s07", name: "김민서", role: "RN" },
  { id: "s08", name: "오서현", role: "RN" },
  { id: "s09", name: "최민서", role: "RN" },
  { id: "s10", name: "윤지호", role: "RN" },
  { id: "s11", name: "김도현", role: "RN" },
  { id: "s12", name: "박채원", role: "RN" },
  { id: "s13", name: "이서우", role: "SN" },
  { id: "s14", name: "정수아", role: "RN" },
  { id: "s15", name: "홍도윤", role: "RN" },
  { id: "s16", name: "백아인", role: "NA" },
]

export const roster5B: Staff[] = [
  { id: "b01", name: "서지민", role: "CN" },
  { id: "b02", name: "김태양", role: "RN" },
  { id: "b03", name: "박현우", role: "RN" },
  { id: "b04", name: "이지안", role: "SN" },
  { id: "b05", name: "최가온", role: "RN" },
  { id: "b06", name: "한도영", role: "NA" },
  { id: "b07", name: "윤서후", role: "RN" },
  { id: "b08", name: "오하린", role: "RN" },
  { id: "b09", name: "정하준", role: "RN" },
  { id: "b10", name: "김하람", role: "RN" },
  { id: "b11", name: "박도영", role: "RN" },
  { id: "b12", name: "서하연", role: "RN" },
  { id: "b13", name: "이수안", role: "SN" },
  { id: "b14", name: "정하랑", role: "RN" },
]

export const wardIds = ["ward-3A", "ward-5B"] as const
export const configByWard: Record<string, HospitalConfig> = { "ward-3A": demoConfig3A, "ward-5B": demoConfig5B }
export const rosterByWard: Record<string, Staff[]> = { "ward-3A": roster3A, "ward-5B": roster5B }

function cid(date: string, shift: ShiftId): CellId {
  return `${date}:${shift}` as CellId
}

// Generate fair-ish assignments for a ward
export function generateInitialAssignmentsFor(minStaffPerShift: Record<ShiftId, number>, roster: Staff[]): Record<CellId, string[]> {
  const result: Record<CellId, string[]> = Object.create(null)
  for (const d of allDates) for (const s of shifts) result[cid(d, s)] = []

  const rn = roster.filter(r => r.role === "RN").map(r => r.id)
  const cn = roster.filter(r => r.role === "CN").map(r => r.id)
  const rest = roster.filter(r => r.role !== "RN" && r.role !== "CN").map(r => r.id)
  const all = roster.map(r => r.id)

  for (let dayIndex = 0; dayIndex < allDates.length; dayIndex++) {
    const d = allDates[dayIndex]
    const rotate = (arr: string[], k: number) => arr.length ? arr.slice(k % arr.length).concat(arr.slice(0, k % arr.length)) : []
    const rnR = rotate(rn, dayIndex)
    const cnR = rotate(cn, Math.floor(dayIndex / 2))
    const restR = rotate(rest, dayIndex * 2)
    const used = new Set<string>()

    // Day shift: ensure 4 RN and 1 CN minimum (or to available)
    const dayList: string[] = []
    for (const id of rnR) { if (dayList.length < Math.min(4, rn.length) && !used.has(id)) { dayList.push(id); used.add(id) } }
    for (const id of cnR) { if (dayList.length < Math.min(5, rn.length + cn.length) && !used.has(id)) { dayList.push(id); used.add(id) } }
    for (const pool of [rnR, restR, cnR]) {
      for (const id of pool) { if (dayList.length < (minStaffPerShift.D || 0) && !used.has(id)) { dayList.push(id); used.add(id) } }
    }
    result[cid(d, "D")] = dayList

    // Night shift: ensure 3 RN
    const nightList: string[] = []
    for (const id of rnR) { if (nightList.length < Math.min(3, rn.length) && !used.has(id)) { nightList.push(id); used.add(id) } }
    for (const pool of [rnR, restR, cnR]) {
      for (const id of pool) { if (nightList.length < (minStaffPerShift.N || 0) && !used.has(id)) { nightList.push(id); used.add(id) } }
    }
    result[cid(d, "N")] = nightList

    // Evening shift: fill remaining need
    const eveNeed = minStaffPerShift.E || 0
    const eveList: string[] = []
    for (const pool of [rnR, restR, cnR]) {
      for (const id of pool) { if (eveList.length < eveNeed && !used.has(id)) { eveList.push(id); used.add(id) } }
    }
    result[cid(d, "E")] = eveList

    // Others get Off
    for (const id of all) { if (!used.has(id)) result[cid(d, "O")].push(id) }
  }
  return result
}

export const initialAssignmentsByWard: Record<string, Record<CellId, string[]>> = {
  "ward-3A": generateInitialAssignmentsFor(configByWard["ward-3A"].ward.minStaffPerShift, roster3A),
  "ward-5B": generateInitialAssignmentsFor(configByWard["ward-5B"].ward.minStaffPerShift, roster5B),
}

