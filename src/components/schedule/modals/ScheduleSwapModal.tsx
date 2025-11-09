"use client";

import React, { useState, useMemo } from 'react';
import { X, Calendar, ArrowRight, Users, Clock } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                스케줄 교환 요청
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {step === 'select-my-shift'
                  ? '교환할 내 근무를 선택하세요'
                  : `${format(parseISO(selectedMyShift!.date), 'M월 d일 (E)', { locale: ko })} - 교환할 상대방을 선택하세요`
                }
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'select-my-shift' ? (
            // Step 1: 내 근무 선택
            <div className="space-y-3">
              {mySchedule.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    교환 가능한 근무가 없습니다
                  </p>
                </div>
              ) : (
                mySchedule.map((shift, index) => (
                  <button
                    key={index}
                    onClick={() => handleMyShiftSelect(shift)}
                    className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {format(parseISO(shift.date), 'd')}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {format(parseISO(shift.date), 'MMM', { locale: ko })}
                          </div>
                        </div>
                        <div className="h-12 w-px bg-gray-200 dark:bg-gray-700"></div>
                        <div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                            {format(parseISO(shift.date), 'EEEE', { locale: ko })}
                          </div>
                          <div className="flex items-center gap-2">
                            <div
                              className="px-3 py-1 rounded-lg text-sm font-medium text-white"
                              style={{ backgroundColor: getShiftColor(shift.shiftId) }}
                            >
                              {shift.shiftName}
                            </div>
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            // Step 2: 교환 대상 선택
            <div className="space-y-4">
              {/* 선택한 내 근무 표시 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {format(parseISO(selectedMyShift!.date), 'd')}
                      </div>
                      <div className="text-xs text-blue-500 dark:text-blue-400">
                        {format(parseISO(selectedMyShift!.date), 'MMM', { locale: ko })}
                      </div>
                    </div>
                    <div className="h-12 w-px bg-blue-200 dark:bg-blue-700"></div>
                    <div>
                      <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                        내 근무 · {format(parseISO(selectedMyShift!.date), 'EEEE', { locale: ko })}
                      </div>
                      <div
                        className="px-3 py-1 rounded-lg text-sm font-medium text-white inline-block"
                        style={{ backgroundColor: getShiftColor(selectedMyShift!.shiftId) }}
                      >
                        {selectedMyShift!.shiftName}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleBack}
                    className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                  >
                    변경
                  </button>
                </div>
              </div>

              {/* 교환 가능한 대상 목록 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  같은 날 근무하는 직원 ({targetSchedules.length}명)
                </h3>
                <div className="space-y-2">
                  {targetSchedules.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                      <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        이 날짜에 근무하는 다른 직원이 없습니다
                      </p>
                    </div>
                  ) : (
                    targetSchedules.map((shift, index) => (
                      <button
                        key={index}
                        onClick={() => handleTargetShiftSelect(shift)}
                        className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                {shift.employeeName.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                                {shift.employeeName}
                              </div>
                              <div
                                className="px-3 py-1 rounded-lg text-sm font-medium text-white inline-block"
                                style={{ backgroundColor: getShiftColor(shift.shiftId) }}
                              >
                                {shift.shiftName}
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Clock className="w-4 h-4" />
            <span>관리자 승인 후 교환이 완료됩니다</span>
          </div>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
