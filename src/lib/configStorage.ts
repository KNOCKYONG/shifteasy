import type { HospitalConfig } from './types'

const STORAGE_KEY_PREFIX = 'shifteasy:config:'
const CURRENT_KEY = STORAGE_KEY_PREFIX + 'current'
const PRESET_PREFIX = STORAGE_KEY_PREFIX + 'preset:'

export function saveCurrent(config: HospitalConfig): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CURRENT_KEY, JSON.stringify(config))
}

export function loadCurrent(): HospitalConfig | null {
  if (typeof window === 'undefined') return null
  const data = localStorage.getItem(CURRENT_KEY)
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

export function savePreset(name: string, config: HospitalConfig): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PRESET_PREFIX + name, JSON.stringify(config))
}

export function loadPreset(name: string): HospitalConfig | null {
  if (typeof window === 'undefined') return null
  const data = localStorage.getItem(PRESET_PREFIX + name)
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

export function listPresets(): string[] {
  if (typeof window === 'undefined') return []
  const keys = Object.keys(localStorage)
  return keys
    .filter(key => key.startsWith(PRESET_PREFIX))
    .map(key => key.slice(PRESET_PREFIX.length))
}

export function deletePreset(name: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(PRESET_PREFIX + name)
}