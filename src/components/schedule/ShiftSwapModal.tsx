"use client";
import { useState } from "react";
import { X, Users, ArrowLeftRight, Calendar, Check, AlertCircle } from "lucide-react";
import { type Staff, type ShiftType } from "@/lib/types";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface ShiftSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: Staff[];
  currentStaffId: string;
  currentDate: Date;
  currentShift?: ShiftType;
  onSwapRequest: (targetStaffId: string, targetDate: Date, reason?: string) => void;
}

export function ShiftSwapModal({
  isOpen,
  onClose,
  staff,
  currentStaffId,
  currentDate,
  currentShift,
  onSwapRequest
}: ShiftSwapModalProps) {
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [swapDate, setSwapDate] = useState(currentDate.toISOString().split('T')[0]);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStaffInfo = staff.find(s => s.id === currentStaffId);
  const eligibleStaff = staff.filter(s =>
    s.id !== currentStaffId &&
    s.role === currentStaffInfo?.role // 같은 역할만 교환 가능
  );

  const handleSubmit = async () => {
    if (!selectedStaff) {
      alert("교환할 직원을 선택해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSwapRequest(selectedStaff, new Date(swapDate), reason);
      alert("근무 교환 요청이 전송되었습니다.");
      onClose();
    } catch (error) {
      alert("요청 전송에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            근무 교환 요청
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* 현재 근무 정보 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <div className="text-sm text-blue-900 dark:text-blue-300">
              <div className="font-medium mb-1">현재 근무</div>
              <div className="space-y-1 text-xs">
                <div>직원: {currentStaffInfo?.name}</div>
                <div>날짜: {format(currentDate, "M월 d일 (EEE)", { locale: ko })}</div>
                {currentShift && <div>근무: {currentShift === "D" ? "주간" : currentShift === "E" ? "저녁" : currentShift === "N" ? "야간" : "휴무"}</div>}
              </div>
            </div>
          </div>

          {/* 교환 대상 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              교환할 직원 선택
            </label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              <option value="">선택하세요</option>
              {eligibleStaff.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.experienceLevel === "JUNIOR" ? "신입" :
                            s.experienceLevel === "INTERMEDIATE" ? "중급" :
                            s.experienceLevel === "SENIOR" ? "시니어" : "전문가"})
                </option>
              ))}
            </select>
            {eligibleStaff.length === 0 && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                교환 가능한 동일 역할 직원이 없습니다
              </p>
            )}
          </div>

          {/* 교환 날짜 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              교환 희망 날짜
            </label>
            <input
              type="date"
              value={swapDate}
              onChange={(e) => setSwapDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          {/* 사유 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              교환 사유 (선택)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="교환이 필요한 이유를 입력하세요"
              rows={3}
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none"
            />
          </div>

          {/* 안내 메시지 */}
          <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p>• 교환 요청은 상대방의 승인이 필요합니다</p>
                <p>• 승인 시 자동으로 스케줄에 반영됩니다</p>
                <p>• 교환은 같은 역할 간에만 가능합니다</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedStaff || isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>처리중...</>
            ) : (
              <>
                <Check className="w-4 h-4" />
                요청 전송
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}