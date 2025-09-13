import type { Staff } from './types'

const STORAGE_KEY_PREFIX = 'shifteasy:team:'
const CURRENT_KEY = STORAGE_KEY_PREFIX + 'current'
const PRESET_PREFIX = STORAGE_KEY_PREFIX + 'preset:'

export function saveCurrentTeam(wardId: string, staff: Staff[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CURRENT_KEY, JSON.stringify({ wardId, staff }))
}

export function loadCurrentTeam(): { wardId: string; staff: Staff[] } | null {
  if (typeof window === 'undefined') return null
  const data = localStorage.getItem(CURRENT_KEY)
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

export function saveTeamPreset(name: string, wardId: string, staff: Staff[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PRESET_PREFIX + name, JSON.stringify({ wardId, staff }))
}

export function loadTeamPreset(name: string): { wardId: string; staff: Staff[] } | null {
  if (typeof window === 'undefined') return null
  const data = localStorage.getItem(PRESET_PREFIX + name)
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

export function listTeamPresets(): string[] {
  if (typeof window === 'undefined') return []
  const keys = Object.keys(localStorage)
  return keys
    .filter(key => key.startsWith(PRESET_PREFIX))
    .map(key => key.slice(PRESET_PREFIX.length))
}

export function deleteTeamPreset(name: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(PRESET_PREFIX + name)
}