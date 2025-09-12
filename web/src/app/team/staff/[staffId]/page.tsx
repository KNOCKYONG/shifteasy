"use client"
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import type { ShiftType } from '@/lib/types'

const shiftTypes: { id: ShiftType; label: string; description: string; color: string }[] = [
  { id: "D", label: "Day", description: "07:00-15:00", color: "bg-yellow-100 text-yellow-800" },
  { id: "E", label: "Evening", description: "15:00-23:00", color: "bg-orange-100 text-orange-800" },
  { id: "N", label: "Night", description: "23:00-07:00", color: "bg-blue-100 text-blue-800" },
  { id: "O", label: "Off", description: "휴무", color: "bg-gray-100 text-gray-800" },
]

const scoreOptions = [
  { value: 5, label: "매우 선호", color: "bg-green-500", description: "이 시간대를 가장 선호합니다" },
  { value: 4, label: "선호", color: "bg-green-400", description: "이 시간대를 선호합니다" },
  { value: 3, label: "보통", color: "bg-gray-400", description: "상관없습니다" },
  { value: 2, label: "비선호", color: "bg-red-400", description: "이 시간대를 선호하지 않습니다" },
  { value: 1, label: "매우 비선호", color: "bg-red-500", description: "이 시간대를 가능한 피하고 싶습니다" },
]

// 근무 패턴 선호도 타입
type WorkPatternPreference = {
  consecutiveWorkDays: '2-3' | '4-5' | 'no-preference'
  offDayPattern: 'consecutive' | 'distributed' | 'no-preference'
}

export default function StaffPreferencePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  
  const staffId = params?.staffId as string
  const staffName = searchParams.get('name') || '직원'
  
  const [preferences, setPreferences] = useState<Record<string, { shiftType: ShiftType; score: number; reason?: string }>>({})
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  
  // 근무 패턴 선호도 상태
  const [workPattern, setWorkPattern] = useState<WorkPatternPreference>({
    consecutiveWorkDays: 'no-preference',
    offDayPattern: 'no-preference'
  })
  
  // 개별 날짜 편집 모드
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [editingScore, setEditingScore] = useState(3)
  const [editingReason, setEditingReason] = useState('')

  // Generate next 30 days
  const next30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() + i)
    return date.toISOString().split('T')[0]
  })

  const updatePreference = (date: string, shiftType: ShiftType, score: number, reason?: string) => {
    // 사유가 입력되면 자동으로 5점 설정
    const finalScore = reason && reason.trim() ? 5 : score
    
    setPreferences(prev => ({
      ...prev,
      [date]: { shiftType, score: finalScore, reason }
    }))
  }

  const removePreference = (date: string) => {
    setPreferences(prev => {
      const newPrefs = { ...prev }
      delete newPrefs[date]
      return newPrefs
    })
    if (editingDate === date) {
      setEditingDate(null)
      setEditingScore(3)
      setEditingReason('')
    }
  }

  const getScoreOption = (score: number) => {
    return scoreOptions.find(opt => opt.value === score) || scoreOptions[2]
  }

  const savePreferences = async () => {
    setLoading(true)
    try {
      // Convert to API format
      const preferencesArray = Object.entries(preferences).map(([date, pref]) => ({
        staffId,
        date,
        shiftType: pref.shiftType,
        score: pref.score,
        reason: pref.reason || null
      }))

      // Call API to save preferences
      const response = await fetch('/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferences: preferencesArray,
          workPattern // 근무 패턴 선호도도 함께 저장
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Preferences saved successfully:', result)
        
        // Also save to localStorage as backup
        localStorage.setItem(`staff-preferences-${staffId}`, JSON.stringify(preferencesArray))
        localStorage.setItem(`staff-work-pattern-${staffId}`, JSON.stringify(workPattern))
        
        alert(`✅ ${staffName}님의 선호도 설정이 저장되었습니다!\n저장된 설정: ${result.count}개`)
      } else {
        const error = await response.json()
        console.error('API Error:', error)
        
        // 더 친절한 에러 메시지
        let userMessage = '저장 중 오류가 발생했습니다.'
        if (error.error?.includes('Staff not found')) {
          userMessage = '직원 정보를 찾을 수 없습니다. 팀 설정을 먼저 확인해주세요.'
        } else if (error.error?.includes('Invalid request data')) {
          userMessage = '입력된 정보에 오류가 있습니다. 모든 필드를 올바르게 입력했는지 확인해주세요.'
        }
        
        alert(`❌ ${userMessage}\n\n임시로 로컬에 저장하시겠습니까?`)
        
        // 로컬 저장 제안
        if (confirm('로컬에 임시 저장하시겠습니까? (나중에 다시 저장을 시도할 수 있습니다)')) {
          localStorage.setItem(`staff-preferences-${staffId}`, JSON.stringify(preferencesArray))
          localStorage.setItem(`staff-work-pattern-${staffId}`, JSON.stringify(workPattern))
          alert('로컬에 임시 저장되었습니다.')
        }
      }
      
    } catch (error) {
      console.error('Failed to save preferences:', error)
      
      // 네트워크 에러인지 확인
      let userMessage = '선호도 저장 중 오류가 발생했습니다.'
      if (error instanceof TypeError && error.message.includes('fetch')) {
        userMessage = '서버에 연결할 수 없습니다. 인터넷 연결을 확인하고 다시 시도해주세요.'
      } else if (error instanceof Error) {
        userMessage = `오류가 발생했습니다: ${error.message}`
      }
      
      alert(`❌ ${userMessage}\n\n로컬에 임시 저장하시겠습니까?`)
      
      // 로컬 저장 백업 제안
      if (confirm('데이터 손실을 방지하기 위해 로컬에 임시 저장하시겠습니까?')) {
        try {
          const preferencesArray = Object.entries(preferences).map(([date, pref]) => ({
            staffId,
            date,
            shiftType: pref.shiftType,
            score: pref.score,
            reason: pref.reason || null
          }))
          localStorage.setItem(`staff-preferences-${staffId}`, JSON.stringify(preferencesArray))
          localStorage.setItem(`staff-work-pattern-${staffId}`, JSON.stringify(workPattern))
          alert('✅ 로컬에 임시 저장되었습니다. 나중에 다시 저장을 시도해주세요.')
        } catch (localError) {
          console.error('Local save failed:', localError)
          alert('❌ 로컬 저장도 실패했습니다. 브라우저 저장 공간을 확인해주세요.')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const loadPreferences = useCallback(async () => {
    try {
      // Try loading from API first
      const response = await fetch(`/api/preferences?staffId=${staffId}`)
      
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.preferences) {
          const prefsObj: Record<string, { shiftType: ShiftType; score: number; reason?: string }> = {}
          result.preferences.forEach((pref: {date: string; shiftType: ShiftType; score: number; reason?: string}) => {
            prefsObj[pref.date] = {
              shiftType: pref.shiftType,
              score: pref.score,
              reason: pref.reason
            }
          })
          setPreferences(prefsObj)
          return
        }
      }
      
      // Fallback to localStorage
      const saved = localStorage.getItem(`staff-preferences-${staffId}`)
      if (saved) {
        const savedPrefs = JSON.parse(saved) as Array<{ date: string; shiftType: ShiftType; score: number; reason?: string }>
        const prefsObj: Record<string, { shiftType: ShiftType; score: number; reason?: string }> = {}
        savedPrefs.forEach(pref => {
          prefsObj[pref.date] = {
            shiftType: pref.shiftType,
            score: pref.score,
            reason: pref.reason
          }
        })
        setPreferences(prefsObj)
      }
      
      // Load work pattern preferences
      const savedPattern = localStorage.getItem(`staff-work-pattern-${staffId}`)
      if (savedPattern) {
        setWorkPattern(JSON.parse(savedPattern))
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
      
      // Try localStorage fallback on error
      try {
        const saved = localStorage.getItem(`staff-preferences-${staffId}`)
        if (saved) {
          const savedPrefs = JSON.parse(saved) as Array<{ date: string; shiftType: ShiftType; score: number; reason?: string }>
          const prefsObj: Record<string, { shiftType: ShiftType; score: number; reason?: string }> = {}
          savedPrefs.forEach(pref => {
            prefsObj[pref.date] = {
              shiftType: pref.shiftType,
              score: pref.score,
              reason: pref.reason
            }
          })
          setPreferences(prefsObj)
        }
        
        const savedPattern = localStorage.getItem(`staff-work-pattern-${staffId}`)
        if (savedPattern) {
          setWorkPattern(JSON.parse(savedPattern))
        }
      } catch (localError) {
        console.error('Failed to load from localStorage:', localError)
      }
    }
  }, [staffId])

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  return (
    <div className="min-h-screen p-6 sm:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{staffName} - 선호도 설정</h1>
            <p className="text-gray-600 mt-1">날짜별로 선호하는 근무 시간대와 선호도를 설정하세요</p>
          </div>
          <div className="flex gap-2">
            <Link href="/team" className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors">
              ← 팀 설정으로
            </Link>
            <button
              onClick={savePreferences}
              disabled={loading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors disabled:opacity-50"
            >
              {loading ? '저장중...' : '저장'}
            </button>
          </div>
        </div>

        {/* 향상된 선호도 점수 가이드 */}
        <section className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-3">📊 선호도 점수 가이드 & 스케줄링 반영 방식</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {scoreOptions.map(option => (
                <div key={option.value} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${option.color}`}></div>
                  <span className="text-sm text-blue-800">{option.value}점: {option.label}</span>
                </div>
              ))}
            </div>
            
            <div className="bg-white/70 rounded p-3 text-sm text-blue-900">
              <h4 className="font-semibold mb-2">🎯 스케줄링 시스템 반영 방식:</h4>
              <ul className="space-y-1">
                <li>• <strong>5점 (매우 선호)</strong>: 최우선 배치, 다른 제약이 없는 한 반드시 배정</li>
                <li>• <strong>4점 (선호)</strong>: 우선 고려, 가능한 한 배정 (약 80% 반영률)</li>
                <li>• <strong>3점 (보통)</strong>: 중립적 처리, 다른 직원과 균형 조정</li>
                <li>• <strong>2점 (비선호)</strong>: 가능한 한 회피 (약 20% 이하 배정)</li>
                <li>• <strong>1점 (매우 비선호)</strong>: 극히 예외적인 경우만 배정</li>
              </ul>
              <div className="mt-2 p-2 bg-yellow-50 rounded text-yellow-900">
                <strong>💡 팁:</strong> 사유를 입력하면 자동으로 5점(매우 선호)으로 설정되며, 
                수간호사가 스케줄 조정 시 참고할 수 있습니다.
              </div>
            </div>
          </div>
        </section>

        {/* 근무 패턴 선호도 설정 섹션 */}
        <section className="bg-white border rounded-lg p-4">
          <h3 className="font-medium mb-4">🔄 근무 패턴 선호도 설정</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {/* 연속 근무 선호도 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">연속 근무 일수 선호</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="consecutiveWork"
                    value="2-3"
                    checked={workPattern.consecutiveWorkDays === '2-3'}
                    onChange={(e) => setWorkPattern(prev => ({ ...prev, consecutiveWorkDays: '2-3' }))}
                    className="text-blue-600"
                  />
                  <span className="text-sm">2-3일 연속 근무 선호</span>
                  <span className="text-xs text-gray-500">(짧은 주기로 휴식)</span>
                </label>
                <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="consecutiveWork"
                    value="4-5"
                    checked={workPattern.consecutiveWorkDays === '4-5'}
                    onChange={(e) => setWorkPattern(prev => ({ ...prev, consecutiveWorkDays: '4-5' }))}
                    className="text-blue-600"
                  />
                  <span className="text-sm">4-5일 연속 근무 선호</span>
                  <span className="text-xs text-gray-500">(긴 연속 휴무 가능)</span>
                </label>
                <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="consecutiveWork"
                    value="no-preference"
                    checked={workPattern.consecutiveWorkDays === 'no-preference'}
                    onChange={(e) => setWorkPattern(prev => ({ ...prev, consecutiveWorkDays: 'no-preference' }))}
                    className="text-blue-600"
                  />
                  <span className="text-sm">상관없음</span>
                </label>
              </div>
            </div>

            {/* 휴무 패턴 선호도 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">휴무 패턴 선호</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="offPattern"
                    value="consecutive"
                    checked={workPattern.offDayPattern === 'consecutive'}
                    onChange={(e) => setWorkPattern(prev => ({ ...prev, offDayPattern: 'consecutive' }))}
                    className="text-blue-600"
                  />
                  <span className="text-sm">연속 휴무 선호</span>
                  <span className="text-xs text-gray-500">(2-3일 연속 휴식)</span>
                </label>
                <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="offPattern"
                    value="distributed"
                    checked={workPattern.offDayPattern === 'distributed'}
                    onChange={(e) => setWorkPattern(prev => ({ ...prev, offDayPattern: 'distributed' }))}
                    className="text-blue-600"
                  />
                  <span className="text-sm">분산 휴무 선호</span>
                  <span className="text-xs text-gray-500">(주기적으로 휴식)</span>
                </label>
                <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="offPattern"
                    value="no-preference"
                    checked={workPattern.offDayPattern === 'no-preference'}
                    onChange={(e) => setWorkPattern(prev => ({ ...prev, offDayPattern: 'no-preference' }))}
                    className="text-blue-600"
                  />
                  <span className="text-sm">상관없음</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* 근무 시간대 정보 */}
        <section className="bg-white border rounded-lg p-4">
          <h3 className="font-medium mb-3">⏰ 근무 시간대</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {shiftTypes.map(shift => (
              <div key={shift.id} className={`p-3 rounded-lg ${shift.color}`}>
                <div className="font-medium">{shift.label} ({shift.id})</div>
                <div className="text-sm">{shift.description}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 날짜별 선호도 설정 */}
        <section className="bg-white border rounded-lg p-4">
          <h3 className="font-medium mb-4">📅 날짜별 선호도 설정</h3>
          
          {/* 빠른 설정 */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium mb-2">빠른 설정</h4>
            <div className="flex gap-2 text-sm">
              <select 
                className="border rounded px-2 py-1"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                {next30Days.map(date => (
                  <option key={date} value={date}>
                    {new Date(date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                  </option>
                ))}
              </select>
              
              {shiftTypes.map(shift => (
                <button
                  key={shift.id}
                  onClick={() => {
                    setEditingDate(selectedDate)
                    updatePreference(selectedDate, shift.id, 3)
                  }}
                  className={`px-2 py-1 rounded text-xs ${shift.color}`}
                >
                  {shift.label}
                </button>
              ))}
            </div>
          </div>

          {/* 설정된 선호도 목록 */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {next30Days.slice(0, 14).map(date => {
                const pref = preferences[date]
                const dateObj = new Date(date)
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
                const isEditing = editingDate === date
                
                return (
                  <div key={date} className={`border rounded-lg p-3 ${isWeekend ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-medium text-sm">
                          {dateObj.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
                        </div>
                        {isWeekend && <span className="text-xs text-blue-600">주말</span>}
                      </div>
                      {pref && (
                        <button
                          onClick={() => removePreference(date)}
                          className="text-gray-400 hover:text-red-500 text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    
                    {pref ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs ${shiftTypes.find(s => s.id === pref.shiftType)?.color}`}>
                            {shiftTypes.find(s => s.id === pref.shiftType)?.label}
                          </span>
                          <div className={`w-3 h-3 rounded-full ${getScoreOption(pref.score).color}`}></div>
                          <span className="text-xs">{pref.score}점</span>
                          <button
                            onClick={() => {
                              setEditingDate(date)
                              setEditingScore(pref.score)
                              setEditingReason(pref.reason || '')
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            편집
                          </button>
                        </div>
                        
                        {/* 편집 모드 */}
                        {isEditing && (
                          <div className="space-y-2 p-2 bg-white rounded border">
                            <div className="flex gap-1">
                              {scoreOptions.map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => {
                                    setEditingScore(opt.value)
                                    updatePreference(date, pref.shiftType, opt.value, editingReason)
                                  }}
                                  className={`w-6 h-6 rounded-full ${opt.color} ${editingScore === opt.value ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                                  title={`${opt.value}점: ${opt.label}`}
                                />
                              ))}
                            </div>
                            <input
                              type="text"
                              placeholder="사유 입력 (입력 시 자동 5점)"
                              value={editingReason}
                              onChange={(e) => {
                                setEditingReason(e.target.value)
                                updatePreference(date, pref.shiftType, editingScore, e.target.value)
                              }}
                              className="w-full text-xs border rounded px-2 py-1"
                            />
                            <button
                              onClick={() => setEditingDate(null)}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              완료
                            </button>
                          </div>
                        )}
                        
                        {pref.reason && !isEditing && (
                          <div className="text-xs text-gray-600 bg-white p-1 rounded">
                            📝 {pref.reason}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <select
                          className="w-full border rounded px-2 py-1 text-xs"
                          onChange={(e) => {
                            if (e.target.value) {
                              updatePreference(date, e.target.value as ShiftType, 3)
                              setEditingDate(date)
                            }
                          }}
                          value=""
                        >
                          <option value="">시간대 선택</option>
                          {shiftTypes.map(shift => (
                            <option key={shift.id} value={shift.id}>{shift.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            
            {Object.keys(preferences).length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">설정된 선호도 ({Object.keys(preferences).length}개)</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {Object.entries(preferences).map(([date, pref]) => (
                    <div key={date} className="flex items-center justify-between p-2 bg-white border rounded text-sm">
                      <div className="flex items-center gap-3">
                        <span>{new Date(date).toLocaleDateString('ko-KR')}</span>
                        <span className={`px-2 py-1 rounded text-xs ${shiftTypes.find(s => s.id === pref.shiftType)?.color}`}>
                          {shiftTypes.find(s => s.id === pref.shiftType)?.label}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${getScoreOption(pref.score).color}`}></div>
                          <span>{pref.score}점</span>
                        </div>
                        {pref.reason && <span className="text-xs text-gray-500">📝 {pref.reason}</span>}
                      </div>
                      <button
                        onClick={() => removePreference(date)}
                        className="text-red-500 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}