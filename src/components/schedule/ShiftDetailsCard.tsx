"use client";

import { Clock, Users, Coffee, AlertCircle } from "lucide-react";
import type { Shift } from "@/lib/scheduler/types";

interface ShiftDetailsCardProps {
  shift: Shift;
  assignedCount: number;
  employeeNames?: string[];
}

export function ShiftDetailsCard({ shift, assignedCount, employeeNames = [] }: ShiftDetailsCardProps) {
  const isUnderstaffed = assignedCount < (shift.minStaff || shift.requiredStaff);
  const isOverstaffed = assignedCount > (shift.maxStaff || shift.requiredStaff);
  const isOptimal = assignedCount === shift.requiredStaff;

  // 휴식 시간 포맷팅
  const formatBreakTime = (minutes?: number) => {
    if (!minutes) return '없음';
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: shift.color }}
          />
          <h3 className="font-semibold text-gray-900">{shift.name}</h3>
        </div>
        {isUnderstaffed && (
          <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
            <AlertCircle className="w-3 h-3" />
            인원 부족
          </span>
        )}
        {isOverstaffed && (
          <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
            <AlertCircle className="w-3 h-3" />
            인원 초과
          </span>
        )}
        {isOptimal && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
            적정 인원
          </span>
        )}
      </div>

      <div className="space-y-2">
        {/* 근무 시간 */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4 text-gray-400" />
          <span>
            {shift.time.start} - {shift.time.end} ({shift.time.hours}시간)
          </span>
        </div>

        {/* 휴식 시간 (미사용 필드 활용) */}
        {shift.time.breakMinutes && shift.time.breakMinutes > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Coffee className="w-4 h-4 text-gray-400" />
            <span>휴식: {formatBreakTime(shift.time.breakMinutes)}</span>
          </div>
        )}

        {/* 인원 현황 (minStaff, maxStaff 활용) */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="w-4 h-4 text-gray-400" />
          <div className="flex items-center gap-1">
            <span className={assignedCount < (shift.minStaff || shift.requiredStaff) ? 'text-red-600 font-medium' : ''}>
              {assignedCount}명
            </span>
            <span className="text-gray-400">/</span>
            <span className="text-gray-500">
              {shift.minStaff && shift.maxStaff
                ? `${shift.minStaff}-${shift.maxStaff}명`
                : `${shift.requiredStaff}명`}
            </span>
          </div>
        </div>

        {/* 배정된 직원 목록 */}
        {employeeNames.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">배정된 직원</p>
            <div className="flex flex-wrap gap-1">
              {employeeNames.map((name, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-1 bg-gray-50 text-gray-700 rounded"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 인원 상태 바 */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>최소: {shift.minStaff || shift.requiredStaff}명</span>
          <span>최대: {shift.maxStaff || shift.requiredStaff}명</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              isUnderstaffed
                ? 'bg-red-500'
                : isOverstaffed
                ? 'bg-orange-500'
                : 'bg-green-500'
            }`}
            style={{
              width: `${Math.min(
                100,
                (assignedCount / (shift.maxStaff || shift.requiredStaff)) * 100
              )}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}