"use client";

import React, { useState, useMemo } from 'react';
import { X, Calendar, ArrowRightLeft, Users, Clock, ChevronLeft, RefreshCw } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, getDay } from 'date-fns';
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
  const [currentMonth, setCurrentMonth] = useState(new Date());

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

  // 캘린더용 데이터 구조
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // 첫 주의 빈 칸 계산 (일요일 시작)
    const firstDayOfWeek = getDay(monthStart);
    const emptyDays = Array(firstDayOfWeek).fill(null);

    return [...emptyDays, ...days];
  }, [currentMonth]);

  // 날짜별 내 스케줄 매핑
  const myScheduleByDate = useMemo(() => {
    const map = new Map<string, SwapShift>();
    mySchedule.forEach(shift => {
      map.set(shift.date, shift);
    });
    return map;
  }, [mySchedule]);

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

  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden">
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
            <ArrowRightLeft className="w-5 h-5 text-white/60" />
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
            // Step 1: 캘린더 형식으로 내 근무 선택
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  <h3 className="font-semibold text-lg">교환할 내 근무를 선택하세요</h3>
                </div>
                {/* Month Navigation */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePrevMonth}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="text-lg font-semibold min-w-[120px] text-center">
                    {format(currentMonth, 'yyyy년 M월', { locale: ko })}
                  </div>
                  <button
                    onClick={handleNextMonth}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 rotate-180" />
                  </button>
                </div>
              </div>

              {mySchedule.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl">
                  <Calendar className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-lg">교환 가능한 근무가 없습니다</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                  {/* Calendar Header - Days of Week */}
                  <div className="grid grid-cols-7 gap-2 mb-2">
                    {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                      <div
                        key={day}
                        className={`text-center font-semibold text-sm py-2 ${
                          idx === 0 ? 'text-red-600 dark:text-red-400' :
                          idx === 6 ? 'text-blue-600 dark:text-blue-400' :
                          'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {calendarDays.map((day, idx) => {
                      if (!day) {
                        return <div key={`empty-${idx}`} className="aspect-square" />;
                      }

                      const dateStr = format(day, 'yyyy-MM-dd');
                      const myShift = myScheduleByDate.get(dateStr);
                      const dayOfWeek = getDay(day);
                      const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

                      return (
                        <button
                          key={dateStr}
                          onClick={() => myShift && handleMyShiftSelect(myShift)}
                          disabled={!myShift}
                          className={`aspect-square p-1 rounded-lg border-2 transition-all ${
                            myShift
                              ? 'border-blue-300 hover:border-blue-500 hover:shadow-md cursor-pointer'
                              : 'border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-40'
                          } ${isToday ? 'ring-2 ring-blue-400' : ''}`}
                        >
                          <div className="h-full flex flex-col items-center justify-center">
                            <div className={`text-sm font-semibold mb-1 ${
                              dayOfWeek === 0 ? 'text-red-600' :
                              dayOfWeek === 6 ? 'text-blue-600' :
                              'text-gray-700 dark:text-gray-300'
                            }`}>
                              {format(day, 'd')}
                            </div>
                            {myShift && (
                              <div
                                className="text-xs px-2 py-0.5 rounded text-white font-medium"
                                style={{ backgroundColor: getShiftColor(myShift.shiftId) }}
                              >
                                {myShift.shiftName}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Step 2: 교환 대상 선택 - 큰 카드 형식
            <div className="space-y-6">
              {/* 선택한 내 근무 표시 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    {/* Date Display */}
                    <div className="flex-shrink-0">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg">
                        <div className="text-3xl font-bold leading-none">
                          {format(parseISO(selectedMyShift!.date), 'd')}
                        </div>
                        <div className="text-xs mt-1 opacity-90">
                          {format(parseISO(selectedMyShift!.date), 'MMM', { locale: ko })}
                        </div>
                      </div>
                    </div>

                    {/* My Shift Info */}
                    <div>
                      <div className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">
                        내가 교환할 근무
                      </div>
                      <div className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        {format(parseISO(selectedMyShift!.date), 'yyyy년 M월 d일 EEEE', { locale: ko })}
                      </div>
                      <div
                        className="inline-block px-5 py-2.5 rounded-xl text-lg font-bold text-white shadow-md"
                        style={{ backgroundColor: getShiftColor(selectedMyShift!.shiftId) }}
                      >
                        {selectedMyShift!.shiftName}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleBack}
                    className="flex items-center gap-2 px-5 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    다시 선택
                  </button>
                </div>
              </div>

              {/* 교환 가능한 대상 목록 */}
              <div>
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="w-6 h-6 text-green-500" />
                    <h3 className="font-bold text-xl text-gray-800 dark:text-gray-200">
                      같은 날 근무하는 직원
                    </h3>
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-semibold">
                      {targetSchedules.length}명
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    교환하고 싶은 직원을 선택하세요
                  </p>
                </div>

                {targetSchedules.length === 0 ? (
                  <div className="text-center py-20 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
                    <Users className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-lg font-medium mb-2">
                      이 날짜에 근무하는 다른 직원이 없습니다
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm">
                      다른 날짜를 선택해 주세요
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {targetSchedules.map((shift, index) => (
                      <button
                        key={index}
                        onClick={() => handleTargetShiftSelect(shift)}
                        className="group bg-white dark:bg-gray-800 p-6 border-2 border-gray-200 dark:border-gray-700 rounded-2xl hover:border-green-500 dark:hover:border-green-400 hover:shadow-xl hover:scale-105 transition-all text-left"
                      >
                        <div className="flex flex-col items-center text-center space-y-4">
                          {/* Employee Avatar */}
                          <div className="relative">
                            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                              <span className="text-3xl font-bold text-white">
                                {shift.employeeName.charAt(0)}
                              </span>
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-md border-2 border-green-400">
                              <ArrowRightLeft className="w-4 h-4 text-green-500" />
                            </div>
                          </div>

                          {/* Employee Info */}
                          <div className="w-full">
                            <div className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                              {shift.employeeName}
                            </div>
                            <div
                              className="w-full px-4 py-3 rounded-xl text-base font-bold text-white shadow-md"
                              style={{ backgroundColor: getShiftColor(shift.shiftId) }}
                            >
                              {shift.shiftName}
                            </div>
                          </div>

                          {/* Hover Indicator */}
                          <div className="text-sm text-gray-400 dark:text-gray-500 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors font-medium">
                            클릭하여 교환 요청
                          </div>
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
