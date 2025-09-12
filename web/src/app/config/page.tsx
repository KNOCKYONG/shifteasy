"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { HospitalConfig, Role, ShiftId } from "@/lib/types"
import { loadCurrent, saveCurrent, listPresets, savePreset, loadPreset } from "@/lib/configStorage"
import { listTeamPresets, loadTeamPreset, loadCurrentTeam } from "@/lib/teamStorage"

const defaultShifts: { id: ShiftId; label: string; start?: string; end?: string }[] = [
  { id: "D", label: "Day", start: "07:00", end: "15:00" },
  { id: "E", label: "Evening", start: "15:00", end: "23:00" },
  { id: "N", label: "Night", start: "23:00", end: "07:00" },
  { id: "O", label: "Off" },
]

const defaultRoles: Role[] = ["RN", "CN", "SN", "NA"]

function makeDefault(): HospitalConfig {
  return {
    hospital: {
      id: "hospital-default",
      name: "우리 병원",
      timeZone: "Asia/Seoul",
      shifts: defaultShifts,
      roles: defaultRoles,
    },
    ward: {
      id: "ward-1A",
      name: "1A 병동",
      code: "1A",
      hardRules: { 
        maxConsecutiveNights: 2, 
        minRestHours: 10, 
        noPatterns: ["D->N", "N->D"], 
        maxWeeklyHours: 40,
        minStaffPerShift: { D: 6, E: 5, N: 4, O: 0 },
        roleMixRequirements: {}
      },
      softRules: { 
        respectPreferencesWeight: 3, 
        fairWeekendRotationWeight: 2, 
        avoidSplitShiftsWeight: 1,
        teamCompatibilityWeight: 2,
        experienceBalanceWeight: 2
      },
    },
  }
}

type Patch = { hospital?: Partial<HospitalConfig["hospital"]>; ward?: Partial<HospitalConfig["ward"]> }

export default function ConfigPage() {
  const router = useRouter()
  const [config, setConfig] = useState<HospitalConfig>(makeDefault)
  const [presetName, setPresetName] = useState("")
  const [selectedPreset, setSelectedPreset] = useState("")
  const [presetList, setPresetList] = useState<string[]>([])
  const [teamNames, setTeamNames] = useState<string[]>([])
  const [selectedTeam, setSelectedTeam] = useState("")
  const [hasCurrentTeam, setHasCurrentTeam] = useState(false)

  useEffect(() => {
    try {
      const cur = loadCurrent()
      if (cur) setConfig(cur)
      setPresetList(listPresets())
      setTeamNames(listTeamPresets())
      const ct = loadCurrentTeam()
      if (ct) setHasCurrentTeam(true)
    } catch (error) {
      console.error('Failed to load config:', error)
      alert('설정을 불러오는 중 오류가 발생했습니다. 기본 설정을 사용합니다.')
      setConfig(makeDefault())
    }
  }, [])

  const shiftIds = useMemo(() => {
    // config.hospital과 config.hospital.shifts가 존재하는지 확인
    if (config?.hospital?.shifts && Array.isArray(config.hospital.shifts)) {
      return config.hospital.shifts.map(s => s.id)
    }
    // 기본값 반환
    return defaultShifts.map(s => s.id)
  }, [config])

  const update = (patch: Patch) => setConfig(prev => ({
    hospital: { ...prev.hospital, ...(patch.hospital || {}) },
    ward: { ...prev.ward, ...(patch.ward || {}) },
  }))

  const handleGenerate = () => {
    try {
      saveCurrent(config)
      router.replace("/")
    } catch (error) {
      console.error('Save failed:', error)
      alert('❌ 설정 저장 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }

  const saveAsPreset = () => {
    try {
      if (!presetName.trim()) {
        alert('⚠️ 프리셋 이름을 입력해주세요.')
        return
      }
      savePreset(presetName.trim(), config)
      setPresetList(listPresets())
      setPresetName("")
      alert(`✅ "${presetName.trim()}" 프리셋이 저장되었습니다.`)
    } catch (error) {
      console.error('Preset save failed:', error)
      alert('❌ 프리셋 저장 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }

  const loadPresetByName = () => {
    try {
      if (!selectedPreset) {
        alert('⚠️ 불러올 프리셋을 선택해주세요.')
        return
      }
      const p = loadPreset(selectedPreset)
      if (p) {
        setConfig(p)
        alert(`✅ "${selectedPreset}" 프리셋을 불러왔습니다.`)
      } else {
        alert('❌ 선택한 프리셋을 찾을 수 없습니다.')
      }
    } catch (error) {
      console.error('Preset load failed:', error)
      alert('❌ 프리셋 불러오기 중 오류가 발생했습니다.')
    }
  }

  const loadTeamIntoContext = () => {
    try {
      if (!selectedTeam) {
        alert('⚠️ 팀을 선택해주세요.')
        return
      }
      if (selectedTeam === "current") {
        alert('ℹ️ 현재 팀이 이미 적용되어 있습니다.')
        return
      }
      const p = loadTeamPreset(selectedTeam)
      if (p && p.wardId) {
        update({ ward: { id: p.wardId } })
        alert(`✅ "${selectedTeam}" 팀의 병동 ID가 적용되었습니다.`)
      } else {
        alert('❌ 선택한 팀 설정을 찾을 수 없습니다.')
      }
    } catch (error) {
      console.error('Team load failed:', error)
      alert('❌ 팀 설정 불러오기 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="min-h-screen p-6 sm:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">스케줄 설정</h1>
          <div className="flex gap-2">
            <Link href="/team" className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm transition-colors">
              ← 팀 설정
            </Link>
            <Link href="/" className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors">
              스케줄 보기
            </Link>
          </div>
        </div>

        <section className="bg-white/60 rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">팀 선택</h2>
            <Link className="text-sm underline" href="/team">팀 설정으로 이동</Link>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select className="border rounded px-3 py-2" value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}>
              <option value="">팀 선택</option>
              {hasCurrentTeam && <option value="current">(현재 팀)</option>}
              {teamNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="px-3 py-2 rounded bg-gray-200" onClick={loadTeamIntoContext}>적용</button>
          </div>
        </section>

        <section className="bg-white/60 rounded-lg border p-4 space-y-4">
          <h2 className="text-lg font-medium">병원 기본</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">병원 이름</span>
              <input className="border rounded px-3 py-2" value={config?.hospital?.name || ""} onChange={e => update({ hospital: { name: e.target.value } })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">시간대</span>
              <input className="border rounded px-3 py-2" value={config?.hospital?.timeZone || ""} onChange={e => update({ hospital: { timeZone: e.target.value } })} />
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-gray-600">근무조</div>
            <div className="grid md:grid-cols-4 sm:grid-cols-2 grid-cols-1 gap-3">
              {(config?.hospital?.shifts || []).map((s, idx) => (
                <div key={`${s.id}-${idx}`} className="border rounded p-3 space-y-2 h-full">
                  <div className="flex items-center gap-2">
                    <input className="w-14 border rounded px-2 py-1" value={s.id} onChange={e => {
                      const v = e.target.value.toUpperCase().slice(0,1) as ShiftId
                      const next = [...(config?.hospital?.shifts || [])]
                      next[idx] = { ...next[idx], id: v }
                      update({ hospital: { shifts: next } })
                    }} />
                    <input className="flex-1 min-w-0 border rounded px-2 py-1" value={s.label} onChange={e => {
                      const next = [...(config?.hospital?.shifts || [])]; next[idx] = { ...next[idx], label: e.target.value }; update({ hospital: { shifts: next } })
                    }} />
                  </div>
                  {s.id !== "O" && (
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder="시작" className="border rounded px-2 py-1 w-full" value={s.start || ""} onChange={e => { const next = [...(config?.hospital?.shifts || [])]; next[idx] = { ...next[idx], start: e.target.value }; update({ hospital: { shifts: next } }) }} />
                      <input placeholder="끝" className="border rounded px-2 py-1 w-full" value={s.end || ""} onChange={e => { const next = [...(config?.hospital?.shifts || [])]; next[idx] = { ...next[idx], end: e.target.value }; update({ hospital: { shifts: next } }) }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white/60 rounded-lg border p-4 space-y-4">
          <h2 className="text-lg font-medium">병동 설정</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">병동 이름</span>
              <input className="border rounded px-3 py-2" value={config?.ward?.name || ""} onChange={e => update({ ward: { name: e.target.value } })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">병동 ID</span>
              <input className="border rounded px-3 py-2" value={config?.ward?.id || ""} onChange={e => update({ ward: { id: e.target.value } })} />
            </label>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-gray-600">근무 인원 최소(각 근무조)</div>
            <div className="grid md:grid-cols-3 gap-3">
              {shiftIds.filter(id => id !== "O").map(id => (
                <label key={id} className="flex items-center gap-2 border rounded p-2">
                  <span className="w-16 text-sm">{id}</span>
                  <input type="number" min={0} className="border rounded px-2 py-1 w-24" value={config?.ward?.hardRules?.minStaffPerShift?.[id] ?? 0} onChange={e => {
                    const v = Math.max(0, Number(e.target.value || 0))
                    update({ ward: { hardRules: { ...config?.ward?.hardRules, minStaffPerShift: { ...config?.ward?.hardRules?.minStaffPerShift, [id]: v } } } })
                  }} />
                </label>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">연속 야간 최대</span>
              <input type="number" min={0} className="border rounded px-3 py-2" value={config?.ward?.hardRules?.maxConsecutiveNights ?? 0} onChange={e => update({ ward: { hardRules: { ...config?.ward?.hardRules, maxConsecutiveNights: Number(e.target.value || 0) } } })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">휴식 최소 시간</span>
              <input type="number" min={0} className="border rounded px-3 py-2" value={config?.ward?.hardRules?.minRestHours ?? 0} onChange={e => update({ ward: { hardRules: { ...config?.ward?.hardRules, minRestHours: Number(e.target.value || 0) } } })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">주당 최대 근무시간</span>
              <input type="number" min={0} className="border rounded px-3 py-2" value={config?.ward?.hardRules?.maxWeeklyHours ?? 0} onChange={e => update({ ward: { hardRules: { ...config?.ward?.hardRules, maxWeeklyHours: Number(e.target.value || 0) } } })} />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">피하고 싶은 패턴 (쉼표로 구분)</span>
            <input className="border rounded px-3 py-2" value={(config?.ward?.hardRules?.noPatterns || []).join(", ")} onChange={e => update({ ward: { hardRules: { ...config?.ward?.hardRules, noPatterns: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } } })} />
          </label>

          <div className="grid md:grid-cols-3 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">선호 반영 가중치</span>
              <input type="range" min={0} max={5} value={config?.ward?.softRules?.respectPreferencesWeight ?? 0} onChange={e => update({ ward: { softRules: { ...config?.ward?.softRules, respectPreferencesWeight: Number(e.target.value) } } })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">주말 공정 가중치</span>
              <input type="range" min={0} max={5} value={config?.ward?.softRules?.fairWeekendRotationWeight ?? 0} onChange={e => update({ ward: { softRules: { ...config?.ward?.softRules, fairWeekendRotationWeight: Number(e.target.value) } } })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">분할근무 가중치</span>
              <input type="range" min={0} max={5} value={config?.ward?.softRules?.avoidSplitShiftsWeight ?? 0} onChange={e => update({ ward: { softRules: { ...config?.ward?.softRules, avoidSplitShiftsWeight: Number(e.target.value) } } })} />
            </label>
          </div>
        </section>

        <section className="bg-white/60 rounded-lg border p-4 space-y-3">
          <h2 className="text-lg font-medium">저장/불러오기</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input className="border rounded px-3 py-2" placeholder="저장 이름" value={presetName} onChange={e => setPresetName(e.target.value)} />
            <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={saveAsPreset}>저장</button>

            <select className="border rounded px-3 py-2" value={selectedPreset} onChange={e => setSelectedPreset(e.target.value)}>
              <option value="">불러올 설정 선택</option>
              {presetList.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="px-3 py-2 rounded bg-gray-200" onClick={loadPresetByName}>불러오기</button>

            <button className="px-3 py-2 rounded bg-gray-200" onClick={() => {
              const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" })
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = `${config?.ward?.name || "config"}.json`
              a.click(); URL.revokeObjectURL(url)
            }}>내보내기</button>

            <label className="px-3 py-2 rounded bg-gray-200 cursor-pointer">
              가져오기
              <input type="file" accept="application/json" className="hidden" onChange={async e => {
                const f = e.target.files?.[0]; if (!f) return
                const text = await f.text()
                try { const json = JSON.parse(text) as HospitalConfig; setConfig(json) } catch {}
              }} />
            </label>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <button className="px-4 py-2 rounded bg-gray-200" onClick={() => saveCurrent(config)}>임시 저장</button>
          <button className="px-4 py-2 rounded bg-green-600 text-white" onClick={handleGenerate}>생성하기</button>
        </div>
      </div>
    </div>
  )
}
