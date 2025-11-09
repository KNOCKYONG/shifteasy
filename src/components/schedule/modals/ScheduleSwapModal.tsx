"use client";

import React, { useState, useMemo } from 'react';
import { X, Calendar, ArrowRight, Users, Clock, ChevronLeft, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ScheduleSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUserName: string;
  schedule: any[];
  allMembers: any[];
  getShiftName: (shiftId: string) => string;
  getShiftColor: (shiftId: string) => string;
  onSwapRequest: (myShift: SwapShift, targetShift: SwapShift) => void;
}

interface SwapShift {
  date: string;
  employeeId: string;
  employeeName: string;
  shiftId: string;
  shiftName: string;
}

export function ScheduleSwapModal({
  isOpen,
  onClose,
  currentUserId,
  currentUserName,
  schedule,
  allMembers,
  getShiftName,
  getShiftColor,
  onSwapRequest,
}: ScheduleSwapModalProps) {
  const [step, setStep] = useState<'select-my-shift' | 'select-target'>('select-my-shift');
  const [selectedMyShift, setSelectedMyShift] = useState<SwapShift | null>(null);

  // 내 스케줄만 필터링
  const mySchedule = useMemo(() => {
    return schedule
      .filter(s => s.employeeId === currentUserId)
      .map(s => ({
        date: typeof s.date === 'string' ? s.date : format(new Date(s.date), 'yyyy-MM-dd'),
        employeeId: s.employeeId,
        employeeName: currentUserName,
        shiftId: s.shiftId,
        shiftName: getShiftName(s.shiftId),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [schedule, currentUserId, currentUserName, getShiftName]);

  // 선택한 날짜의 다른 직원들의 스케줄
  const targetSchedules = useMemo(() => {
    if (!selectedMyShift) return [];

    return schedule
      .filter(s => {
        const scheduleDate = typeof s.date === 'string' ? s.date : format(new Date(s.date), 'yyyy-MM-dd');
        return scheduleDate === selectedMyShift.date && s.employeeId !== currentUserId;
      })
      .map(s => {
        const member = allMembers.find(m => m.id === s.employeeId);
        return {
          date: typeof s.date === 'string' ? s.date : format(new Date(s.date), 'yyyy-MM-dd'),
          employeeId: s.employeeId,
          employeeName: member?.name || '알 수 없음',
          shiftId: s.shiftId,
          shiftName: getShiftName(s.shiftId),
        };
      })
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [selectedMyShift, schedule, currentUserId, allMembers, getShiftName]);

  const handleMyShiftSelect = (shift: SwapShift) => {
    setSelectedMyShift(shift);
    setStep('select-target');
  };

  const handleTargetShiftSelect = (targetShift: SwapShift) => {
    if (selectedMyShift) {
      onSwapRequest(selectedMyShift, targetShift);
    }
  };

  const handleBack = () => {
    setStep('select-my-shift');
    setSelectedMyShift(null);
  };

  const handleClose = () => {
    setStep('select-my-shift');
    setSelectedMyShift(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header with Step Indicator */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">스케줄 교환</h2>
                <p className="text-blue-100 text-sm mt-0.5">근무 일정을 동료와 교환하세요</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Step Progress */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              step === 'select-my-shift'
                ? 'bg-white/25 backdrop-blur-sm'
                : 'bg-white/10'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                step === 'select-my-shift' ? 'bg-white text-blue-600' : 'bg-white/20 text-white'
              }`}>
                1
              </div>
              <span className="text-sm font-medium">내 근무 선택</span>
            </div>
            <ArrowRight className="w-5 h-5 text-white/60" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              step === 'select-target'
                ? 'bg-white/25 backdrop-blur-sm'
                : 'bg-white/10'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                step === 'select-target' ? 'bg-white text-blue-600' : 'bg-white/20 text-white'
              }`}>
                2
              </div>
              <span className="text-sm font-medium">교환 대상 선택</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
          {step === 'select-my-shift' ? (
            // Step 1: 내 근무 선택
            <div>
              <div className="mb-4 flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Calendar className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-lg">교환할 내 근무를 선택하세요</h3>
              </div>

              {mySchedule.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl">
                  <Calendar className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-lg">교환 가능한 근무가 없습니다</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mySchedule.map((shift, index) => (
                    <button
                      key={index}
                      onClick={() => handleMyShiftSelect(shift)}
                      className="group bg-white dark:bg-gray-800 p-5 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition-all text-left"
                    >
                      <div className="flex items-center gap-4">
                        {/* Date Display */}
                        <div className="flex-shrink-0">
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex flex-col items-center justify-center text-white shadow-md">
                            <div className="text-2xl font-bold leading-none">
                              {format(parseISO(shift.date), 'd')}
                            </div>
                            <div className="text-xs mt-1 opacity-90">
                              {format(parseISO(shift.date), 'MMM', { locale: ko })}
                            </div>
                          </div>
                        </div>

                        {/* Shift Info */}
                        <div className="flex-1">
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                            {format(parseISO(shift.date), 'yyyy년 M월 d일 EEEE', { locale: ko })}
                          </div>
                          <div
                            className="inline-block px-4 py-2 rounded-lg text-base font-semibold text-white shadow-sm"
                            style={{ backgroundColor: getShiftColor(shift.shiftId) }}
                          >
                            {shift.shiftName}
                          </div>
                        </div>

                        {/* Arrow */}
                        <ArrowRight className="w-6 h-6 text-gray-300 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Step 2: 교환 대상 선택
            <div className="space-y-6">
              {/* 선택한 내 근무 표시 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Date Display */}
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex flex-col items-center justify-center text-white shadow-md">
                        <div className="text-2xl font-bold leading-none">
                          {format(parseISO(selectedMyShift!.date), 'd')}
                        </div>
                        <div className="text-xs mt-1 opacity-90">
                          {format(parseISO(selectedMyShift!.date), 'MMM', { locale: ko })}
                        </div>
                      </div>
                    </div>

                    {/* My Shift Info */}
                    <div>
                      <div className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">
                        내가 교환할 근무
                      </div>
                      <div className="text-base text-gray-700 dark:text-gray-300 mb-2">
                        {format(parseISO(selectedMyShift!.date), 'yyyy년 M월 d일 EEEE', { locale: ko })}
                      </div>
                      <div
                        className="inline-block px-4 py-2 rounded-lg text-base font-semibold text-white shadow-sm"
                        style={{ backgroundColor: getShiftColor(selectedMyShift!.shiftId) }}
                      >
                        {selectedMyShift!.shiftName}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleBack}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    다시 선택
                  </button>
                </div>
              </div>

              {/* 교환 가능한 대상 목록 */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Users className="w-5 h-5 text-green-500" />
                    <h3 className="font-semibold text-lg">
                      같은 날 근무하는 직원 <span className="text-green-600 dark:text-green-400">({targetSchedules.length}명)</span>
                    </h3>
                  </div>
                </div>

                {targetSchedules.length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
                    <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-lg mb-1">
                      이 날짜에 근무하는 다른 직원이 없습니다
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm">
                      다른 날짜를 선택해 주세요
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {targetSchedules.map((shift, index) => (
                      <button
                        key={index}
                        onClick={() => handleTargetShiftSelect(shift)}
                        className="group bg-white dark:bg-gray-800 p-5 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-500 dark:hover:border-green-400 hover:shadow-lg transition-all text-left"
                      >
                        <div className="flex items-center gap-4">
                          {/* Employee Avatar */}
                          <div className="flex-shrink-0">
                            <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-md">
                              <span className="text-xl font-bold text-white">
                                {shift.employeeName.charAt(0)}
                              </span>
                            </div>
                          </div>

                          {/* Employee Info */}
                          <div className="flex-1">
                            <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
                              {shift.employeeName}
                            </div>
                            <div
                              className="inline-block px-4 py-2 rounded-lg text-base font-semibold text-white shadow-sm"
                              style={{ backgroundColor: getShiftColor(shift.shiftId) }}
                            >
                              {shift.shiftName}
                            </div>
                          </div>

                          {/* Arrow */}
                          <ArrowRight className="w-6 h-6 text-gray-300 group-hover:text-green-500 transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>교환 요청 후 관리자 승인이 필요합니다</span>
          </div>
          <button
            onClick={handleClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
