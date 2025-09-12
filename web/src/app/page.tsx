"use client"
import { useEffect, useState } from "react"
import ScheduleBoard from "./ScheduleBoard"

export default function Home() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Initialize localStorage with test data for MVP
    try {
      // Set up basic team data if not exists
      if (!localStorage.getItem("shifteasy/team/current")) {
        localStorage.setItem("shifteasy/team/current", JSON.stringify({
          id: "team_3A",
          name: "3A병동 (내과)",
          wardId: "ward_3A"
        }))
      }
      
      // Set up basic config data if not exists
      if (!localStorage.getItem("shifteasy/config/current")) {
        localStorage.setItem("shifteasy/config/current", JSON.stringify({
          id: "config_default",
          name: "기본 설정"
        }))
      }
    } catch (error) {
      console.error("Failed to initialize localStorage:", error)
    }
    setReady(true)
  }, [])

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center">
      <div>로딩 중...</div>
    </div>
  )

  return (
    <div className="min-h-screen p-6 sm:p-10 font-sans">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">ShiftEasy MVP</h1>
        <p className="text-gray-600 mt-2">병원 스케줄 관리 시스템 - 테스트 버전</p>
      </div>
      <ScheduleBoard />
    </div>
  )
}
