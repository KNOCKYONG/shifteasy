'use client';

import React, { useState } from 'react';
import { X, Calendar, Clock, User, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface SwapRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  myAssignment: {
    date: string;
    employeeName: string;
    shiftName: string;
    shiftTime: string;
  };
  targetAssignment: {
    date: string;
    employeeName: string;
    shiftName: string;
    shiftTime: string;
  };
}

export function SwapRequestModal({
  isOpen,
  onClose,
  onSubmit,
  myAssignment,
  targetAssignment,
}: SwapRequestModalProps) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('교환 사유를 입력해주세요.');
      return;
    }
    onSubmit(reason);
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">스케줄 교환 요청</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 내 스케줄 정보 */}
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-medium text-blue-900 dark:text-blue-300">내 스케줄</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
                <Calendar className="w-3 h-3" />
                {format(new Date(myAssignment.date), 'yyyy년 MM월 dd일 (EEE)', { locale: ko })}
              </div>
              <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
                <Clock className="w-3 h-3" />
                {myAssignment.shiftName} ({myAssignment.shiftTime})
              </div>
            </div>
          </div>

          {/* 교환 아이콘 */}
          <div className="flex justify-center">
            <ArrowLeftRight className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>

          {/* 교환 대상 스케줄 정보 */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{targetAssignment.employeeName}님의 스케줄</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Calendar className="w-3 h-3" />
                {format(new Date(targetAssignment.date), 'yyyy년 MM월 dd일 (EEE)', { locale: ko })}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Clock className="w-3 h-3" />
                {targetAssignment.shiftName} ({targetAssignment.shiftTime})
              </div>
            </div>
          </div>

          {/* 사유 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              교환 사유 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="교환 사유를 입력해주세요"
              required
            />
          </div>

          {/* 안내 메시지 */}
          <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-xs text-yellow-800 dark:text-yellow-300">
              교환 요청은 부서 관리자의 승인이 필요합니다.
            </p>
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
