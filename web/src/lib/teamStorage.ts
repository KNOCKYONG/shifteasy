"use client"
import type { Staff } from "@/lib/types"

const CURRENT_KEY = "shifteasy/team/current"
const PRESETS_KEY = "shifteasy/team/presets"

export type TeamPreset = { name: string; wardId: string; roster: Staff[] }

export function saveCurrentTeam(roster: Staff[], wardId: string) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify({ wardId, roster }))
}

export function loadCurrentTeam(): { wardId: string; roster: Staff[] } | null {
  const raw = localStorage.getItem(CURRENT_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as { wardId: string; roster: Staff[] } } catch { return null }
}

export function listTeamPresets(wardId?: string): string[] {
  const raw = localStorage.getItem(PRESETS_KEY)
  if (!raw) return []
  try {
    const map = JSON.parse(raw) as Record<string, TeamPreset>
    return Object.values(map).filter(p => !wardId || p.wardId === wardId).map(p => p.name)
  } catch { return [] }
}

export function saveTeamPreset(name: string, wardId: string, roster: Staff[]) {
  const raw = localStorage.getItem(PRESETS_KEY)
  const map = raw ? (JSON.parse(raw) as Record<string, TeamPreset>) : {}
  map[name] = { name, wardId, roster }
  localStorage.setItem(PRESETS_KEY, JSON.stringify(map))
}

export function loadTeamPreset(name: string): TeamPreset | null {
  const raw = localStorage.getItem(PRESETS_KEY)
  if (!raw) return null
  try {
    const map = JSON.parse(raw) as Record<string, TeamPreset>
    return map[name] || null
  } catch { return null }
}

