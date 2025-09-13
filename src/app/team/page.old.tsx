"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { Role, Staff } from "@/lib/types"
import { listTeamPresets, loadTeamPreset, saveTeamPreset, saveCurrentTeam, loadCurrentTeam } from "@/lib/teamStorage"

const roles: Role[] = ["RN", "CN", "SN", "NA"]

type Row = Staff

export default function TeamPage() {
  const router = useRouter()
  const [wardId, setWardId] = useState("ward-1A")
  const [rows, setRows] = useState<Row[]>([])
  const [presetName, setPresetName] = useState("")
  const [pickName, setPickName] = useState("")
  const [presetList, setPresetList] = useState<string[]>([])

  useEffect(() => {
    try {
      const cur = loadCurrentTeam()
      if (cur && cur.wardId) {
        setWardId(cur.wardId)
        if (Array.isArray(cur.staff)) {
          setRows(cur.staff)
        }
      }
      setPresetList(listTeamPresets())
    } catch (error) {
      console.error('Failed to load current team:', error)
      alert('팀 정보를 불러오는 중 오류가 발생했습니다. 페이지를 새로고침해주세요.')
      // 기본값으로 초기화
      setRows([])
      setWardId("ward-1A")
      setPresetList([])
    }
  }, [])

  const counts = useMemo(() => {
    const m = new Map<Role, number>()
    if (Array.isArray(rows)) {
      for (const r of rows) m.set(r.role, (m.get(r.role) || 0) + 1)
    }
    return roles.map(role => ({ role, count: m.get(role) || 0 }))
  }, [rows])

  const addRow = () => setRows(prev => {
    const newStaff: Staff = {
      id: crypto.randomUUID().slice(0,8),
      name: "",
      role: "RN",
      maxWeeklyHours: 40,
      skills: [],
      technicalSkill: 3,
      leadership: 3,
      communication: 3,
      adaptability: 3,
      reliability: 3,
      experienceLevel: "JUNIOR",
      active: true,
      wardId: wardId
    }
    return Array.isArray(prev) ? [...prev, newStaff] : [newStaff]
  })
  const removeRow = (id: string) => setRows(prev => Array.isArray(prev) ? prev.filter(r => r.id !== id) : [])
  const updateRow = (id: string, patch: Partial<Row>) => setRows(prev => Array.isArray(prev) ? prev.map(r => r.id === id ? { ...r, ...patch } : r) : [])

  const save = () => {
    try {
      saveCurrentTeam(wardId, rows)
      router.replace("/config")
    } catch (error) {
      console.error('Save failed:', error)
      alert('팀 정보 저장 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }

  const savePreset = () => {
    try {
      if (!presetName.trim()) {
        alert('저장할 이름을 입력해주세요.')
        return
      }
      saveTeamPreset(presetName.trim(), wardId, rows)
      setPresetList(listTeamPresets())
      setPresetName("")
      alert(`"${presetName.trim()}" 프리셋이 저장되었습니다.`)
    } catch (error) {
      console.error('Preset save failed:', error)
      alert('프리셋 저장 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }

  const loadPreset = () => {
    try {
      if (!pickName) {
        alert('불러올 프리셋을 선택해주세요.')
        return
      }
      const p = loadTeamPreset(pickName)
      if (p && p.wardId) { 
        setWardId(p.wardId)
        if (Array.isArray(p.staff)) {
          setRows(p.staff)
        }
        alert(`"${pickName}" 프리셋을 불러왔습니다.`)
      } else {
        alert('선택한 프리셋을 찾을 수 없습니다.')
      }
    } catch (error) {
      console.error('Preset load failed:', error)
      alert('프리셋 불러오기 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }

  return (
    <div className="min-h-screen p-6 sm:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">팀 설정</h1>
          <div className="flex gap-2">
            <Link href="/" className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors">
              ← 스케줄 보기
            </Link>
            <Link href="/config" className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-sm transition-colors">
              스케줄 설정 →
            </Link>
          </div>
        </div>

        <section className="bg-white/60 rounded-lg border p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">병동 ID</span>
              <input className="border rounded px-3 py-2" value={wardId} onChange={e => setWardId(e.target.value)} />
            </label>
            <div className="flex items-end gap-2">
              <div className="text-sm text-gray-600">인원 요약</div>
              <div className="flex flex-wrap gap-2 text-sm">
                {counts.map(c => (
                  <span key={c.role} className="px-2 py-1 border rounded bg-gray-50">{c.role}: {c.count}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2 border">이름</th>
                  <th className="text-left p-2 border">역할</th>
                  <th className="p-2 border">선호도 설정</th>
                  <th className="p-2 border">삭제</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(rows) && rows.map(r => (
                  <tr key={r.id}>
                    <td className="p-2 border"><input className="w-full border rounded px-2 py-1" value={r.name} onChange={e => updateRow(r.id, { name: e.target.value })} placeholder="예: 김간호" /></td>
                    <td className="p-2 border">
                      <select className="border rounded px-2 py-1" value={r.role} onChange={e => updateRow(r.id, { role: e.target.value as Role })}>
                        {roles.map(role => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </td>
                    <td className="p-2 border text-center">
                      <Link 
                        href={`/team/staff/${r.id}?name=${encodeURIComponent(r.name || '신규직원')}`}
                        className="px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs transition-colors"
                      >
                        선호도
                      </Link>
                    </td>
                    <td className="p-2 border text-center"><button className="px-2 py-1 rounded bg-gray-200" onClick={() => removeRow(r.id)}>삭제</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button className="px-3 py-2 rounded bg-gray-200" onClick={addRow}>인원 추가</button>
          </div>
        </section>

        <section className="bg-white/60 rounded-lg border p-4 space-y-3">
          <h2 className="text-lg font-medium">저장/불러오기</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input className="border rounded px-3 py-2" placeholder="저장 이름" value={presetName} onChange={e => setPresetName(e.target.value)} />
            <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={savePreset}>저장</button>
            <select className="border rounded px-3 py-2" value={pickName} onChange={e => setPickName(e.target.value)}>
              <option value="">불러올 설정 선택</option>
              {presetList.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="px-3 py-2 rounded bg-gray-200" onClick={loadPreset}>불러오기</button>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <button className="px-4 py-2 rounded bg-gray-200" onClick={() => saveCurrentTeam(wardId, rows)}>임시 저장</button>
          <button className="px-4 py-2 rounded bg-green-600 text-white" onClick={save}>다음으로 (스케줄 설정)</button>
        </div>
      </div>
    </div>
  )
}

