'use client';

import { useState } from 'react';
import { X, Calendar, Clock, Users, Info, AlertTriangle, ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (request: NewRequestData) => void;
  currentUser: {
    id: string;
    name: string;
    position: string; // 직급 추가
    seniorityLevel: 'junior' | 'intermediate' | 'senior' | 'expert';
  };
  confirmedSchedules: Array<{
    date: string;
    shiftType: string;
    time: string;
  }>;
}

export interface NewRequestData {
  type: 'swap' | 'cover' | 'auto-match' | 'open-request';
  selectedDate: string;
  shiftType: string;
  shiftTime: string;
  targetDate?: string;
  targetShiftType?: string;
  targetShiftTime?: string;
  targetEmployeeId?: string;
  reason: string;
  isOpenRequest: boolean;
}

export function NewRequestModal({
  isOpen,
  onClose,
  onSubmit,
  currentUser,
  confirmedSchedules
}: NewRequestModalProps) {
  const [requestType, setRequestType] = useState<'swap' | 'cover' | 'auto-match' | 'open-request'>('swap');
  const [selectedSchedule, setSelectedSchedule] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [targetShift, setTargetShift] = useState('');
  const [reason, setReason] = useState('');
  const [showFairnessWarning, setShowFairnessWarning] = useState(false);

  // 달력 관련 상태
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [manualDateInput, setManualDateInput] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSchedule || !reason) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }

    const [date, shiftType, time] = selectedSchedule.split('|');

    const requestData: NewRequestData = {
      type: requestType,
      selectedDate: date,
      shiftType,
      shiftTime: time,
      reason,
      isOpenRequest: requestType === 'open-request',
    };

    if (requestType === 'swap' && targetDate) {
      requestData.targetDate = targetDate;
      // 실제로는 선택한 날짜의 시프트 정보도 함께 저장
      requestData.targetShiftType = '주간'; // 예시
      requestData.targetShiftTime = '07:00-15:00'; // 예시
    }

    onSubmit(requestData);
    handleClose();
  };

  const handleClose = () => {
    setRequestType('swap');
    setSelectedSchedule('');
    setTargetDate('');
    setTargetShift('');
    setReason('');
    setShowFairnessWarning(false);
    setShowCalendar(false);
    setManualDateInput('');
    onClose();
  };

  const getPositionBadgeColor = (level: string) => {
    switch (level) {
      case 'junior': return 'bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-400';
      case 'intermediate': return 'bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-400';
      case 'senior': return 'bg-purple-100 dark:bg-purple-950/30 text-purple-800 dark:text-purple-400';
      case 'expert': return 'bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-400';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  };

  const getPositionLabel = (position: string) => {
    // 실제 직급 표시 (예: 선임 간호사, 수간호사 등)
    return position || '간호사';
  };

  // 날짜 입력 핸들러
  const handleManualDateInput = (value: string) => {
    // 숫자와 점만 허용
    const cleaned = value.replace(/[^\d.]/g, '');
    setManualDateInput(cleaned);

    // yyyy.mm.dd 형식이 완성되면 targetDate 설정
    if (cleaned.length === 10) {
      const [year, month, day] = cleaned.split('.');
      if (year && month && day) {
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          setTargetDate(format(date, 'yyyy-MM-dd'));
          setShowCalendar(false);
        }
      }
    }
  };

  // 달력 렌더링
  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // 첫 주의 빈 날짜 채우기
    const startDay = monthStart.getDay();
    const emptyDays = Array(startDay).fill(null);

    return (
      <div className="absolute z-10 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="font-medium">
            {format(currentMonth, 'yyyy년 M월')}
          </h3>
          <button
            type="button"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {['일', '월', '화', '수', '목', '금', '토'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 p-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {emptyDays.map((_, idx) => (
            <div key={`empty-${idx}`} className="p-2" />
          ))}
          {days.map(day => {
            const isSelected = targetDate === format(day, 'yyyy-MM-dd');
            const isToday = isSameDay(day, new Date());

            return (
              <button
                key={day.toString()}
                type="button"
                onClick={() => {
                  setTargetDate(format(day, 'yyyy-MM-dd'));
                  setManualDateInput(format(day, 'yyyy.MM.dd'));
                  setShowCalendar(false);
                }}
                className={`p-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  isSelected ? 'bg-blue-500 text-white hover:bg-blue-600' : ''
                } ${isToday ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">새 요청 만들기</h2>
          <button onClick={handleClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 사용자 정보 표시 */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">요청자</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{currentUser.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">직급</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPositionBadgeColor(currentUser.seniorityLevel)}`}>
                  {getPositionLabel(currentUser.position || '선임 간호사')}
                </span>
              </div>
            </div>
          </div>

          {/* 요청 타입 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">요청 유형</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRequestType('swap')}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  requestType === 'swap'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                }`}
              >
                <ArrowLeftRight className="w-5 h-5 mx-auto mb-1 text-gray-700 dark:text-gray-300" />
                <span className="text-sm text-gray-900 dark:text-gray-100">근무 교환</span>
              </button>
              <button
                type="button"
                onClick={() => setRequestType('cover')}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  requestType === 'cover'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                }`}
              >
                <Users className="w-5 h-5 mx-auto mb-1 text-gray-700 dark:text-gray-300" />
                <span className="text-sm text-gray-900 dark:text-gray-100">대체 근무</span>
              </button>
              <button
                type="button"
                onClick={() => setRequestType('auto-match')}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  requestType === 'auto-match'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                }`}
              >
                <Clock className="w-5 h-5 mx-auto mb-1 text-gray-700 dark:text-gray-300" />
                <span className="text-sm text-gray-900 dark:text-gray-100">자동 매칭</span>
              </button>
              <button
                type="button"
                onClick={() => setRequestType('open-request')}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  requestType === 'open-request'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                }`}
              >
                <Calendar className="w-5 h-5 mx-auto mb-1 text-gray-700 dark:text-gray-300" />
                <span className="text-sm text-gray-900 dark:text-gray-100">오픈 요청</span>
              </button>
            </div>

            {requestType === 'open-request' && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <div className="flex gap-2">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-1">오픈 요청이란?</p>
                    <p>특정 날짜의 근무를 공개적으로 교환 요청하여, 모든 직원이 자유롭게 신청할 수 있는 방식입니다.</p>
                  </div>
                </div>
              </div>
            )}

            {requestType === 'open-request' && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                <div className="flex gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-300">
                    <p className="font-medium mb-1">공정성 안내</p>
                    <p>귀하는 {getPositionLabel(currentUser.position || '선임 간호사')} 직급입니다.
                       신입 직원들과의 교환 시 공정성 점수가 낮을 수 있으며,
                       관리자의 추가 검토가 필요할 수 있습니다.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 내 근무 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              교환/요청할 내 근무 <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSchedule}
              onChange={(e) => setSelectedSchedule(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              required
            >
              <option value="">선택하세요</option>
              {confirmedSchedules.map((schedule, idx) => (
                <option key={idx} value={`${schedule.date}|${schedule.shiftType}|${schedule.time}`}>
                  {format(new Date(schedule.date), 'M월 d일 (E)', { locale: ko })} - {schedule.shiftType} ({schedule.time})
                </option>
              ))}
            </select>
          </div>

          {/* 대상 근무 (swap 타입일 때만) */}
          {requestType === 'swap' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                교환 희망 날짜
              </label>
              <div className="relative">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualDateInput}
                    onChange={(e) => handleManualDateInput(e.target.value)}
                    placeholder="yyyy.mm.dd (예: 2024.01.20)"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    maxLength={10}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCalendar(!showCalendar)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>

                {showCalendar && renderCalendar()}

                {targetDate && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    선택된 날짜: {format(new Date(targetDate), 'yyyy년 M월 d일 (E)', { locale: ko })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 사유 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              요청 사유 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="요청 사유를 입력하세요"
              required
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              요청 생성
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}