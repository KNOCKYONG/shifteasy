"use client"
import type { HospitalConfig } from "@/lib/types"

const CURRENT_KEY = "shifteasy/config/current"
const PRESETS_KEY = "shifteasy/config/presets"

export type NamedPreset = { name: string; config: HospitalConfig }

export function saveCurrent(config: HospitalConfig) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(config))
}

export function loadCurrent(): HospitalConfig | null {
  const raw = localStorage.getItem(CURRENT_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as HospitalConfig } catch { return null }
}

export function listPresets(): string[] {
  const raw = localStorage.getItem(PRESETS_KEY)
  if (!raw) return []
  try {
    const map = JSON.parse(raw) as Record<string, HospitalConfig>
    return Object.keys(map)
  } catch { return [] }
}

export function savePreset(name: string, config: HospitalConfig) {
  const raw = localStorage.getItem(PRESETS_KEY)
  const map = raw ? (JSON.parse(raw) as Record<string, HospitalConfig>) : {}
  map[name] = config
  localStorage.setItem(PRESETS_KEY, JSON.stringify(map))
}

export function loadPreset(name: string): HospitalConfig | null {
  const raw = localStorage.getItem(PRESETS_KEY)
  if (!raw) return null
  try {
    const map = JSON.parse(raw) as Record<string, HospitalConfig>
    return map[name] || null
  } catch { return null }
}

export function exportConfig(config: HospitalConfig): string {
  return JSON.stringify(config, null, 2)
}
