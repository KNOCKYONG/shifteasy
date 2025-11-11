/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { X, ArrowRight, Calendar, User, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { api } from '@/lib/trpc/client';

interface SwapRequest {
  id: string;
  requesterId: string;
  originalShiftId: string;
  targetUserId: string | null;
  targetShiftId: string | null;
  date: Date;
  reason: string;
  requester?: {
    id: string;
    name: string;
    email: string;
  };
  targetUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface SwapPreviewModalProps {
  request: SwapRequest;
  onClose: () => void;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

export const SwapPreviewModal = React.memo(function SwapPreviewModal({
  request,
  onClose,
  onApprove,
  onReject,
}: SwapPreviewModalProps) {
  const requestDate = new Date(request.date);
  const startOfMonth = new Date(requestDate.getFullYear(), requestDate.getMonth(), 1);
  const endOfMonth = new Date(requestDate.getFullYear(), requestDate.getMonth() + 1, 0);

  // Fetch schedule for the month
  const { data: schedulesData, isLoading } = api.schedule.list.useQuery({
    startDate: startOfMonth,
    endDate: endOfMonth,
    status: 'published',
  });

  // Fetch shift types for display
  const { data: shiftTypesConfig } = api.configs.getByKey.useQuery({
    configKey: 'shift_types',
  });

  // Get users for the department
  const { data: usersData } = api.tenant.users.list.useQuery({
    limit: 100,
    offset: 0,
    status: 'active',
  });

  const users = usersData?.items || [];
  const customShiftTypes = (shiftTypesConfig?.configValue as any)?.shiftTypes || [];

  // Find the published schedule for this month
  const publishedSchedule = schedulesData?.[0];
  const assignments = (publishedSchedule?.metadata as any)?.assignments || [];

  // Get assignments for the swap date
  const dateStr = format(requestDate, 'yyyy-MM-dd');
  const dateAssignments = assignments.filter((a: any) => {
    const assignmentDate = format(new Date(a.date), 'yyyy-MM-dd');
    return assignmentDate === dateStr;
  });

  // Get shift info helper
  const getShiftInfo = (shiftId: string) => {
    const shiftCode = shiftId.replace('shift-', '').toUpperCase();
    const shiftType = customShiftTypes.find((st: any) => st.code === shiftCode);
    return {
      code: shiftCode,
      name: shiftType?.name || shiftCode,
      color: shiftType?.color || '#3b82f6',
    };
  };

  // Create before/after scenarios
  const beforeAssignments = dateAssignments;
  const afterAssignments = dateAssignments.map((a: any) => {
    if (a.employeeId === request.requesterId) {
      return { ...a, shiftId: request.targetShiftId || a.shiftId };
    }
    if (a.employeeId === request.targetUserId) {
      return { ...a, shiftId: request.originalShiftId };
    }
    return a;
  });

  // Get user name
  const getUserName = (userId: string) => {
    const user = users.find((u: any) => u.id === userId);
    return user?.name || '알 수 없음';
  };

  // Highlight changed users
  const changedUserIds = new Set([request.requesterId, request.targetUserId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-xl font-bold text-white">스케줄 변경 미리보기</h2>
              <p className="text-sm text-blue-100">
                {format(requestDate, 'yyyy년 MM월 dd일 (E)', { locale: ko })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-600 dark:text-gray-400">로딩 중...</div>
            </div>
          ) : (
            <>
              {/* Swap Summary */}
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">교환 요청 내용</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">요청자</p>
                    <p className="font-medium text-blue-900 dark:text-blue-100">{request.requester?.name}</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <ArrowRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">교환 대상</p>
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      {request.targetUser?.name || '지정 없음'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">사유</p>
                  <p className="text-sm text-blue-900 dark:text-blue-100">{request.reason}</p>
                </div>
              </div>

              {/* Before/After Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* BEFORE */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100">변경 전 (현재)</h3>
                  </div>
                  <div className="space-y-2">
                    {beforeAssignments.map((assignment: any) => {
                      const shiftInfo = getShiftInfo(assignment.shiftId);
                      const isChanged = changedUserIds.has(assignment.employeeId);

                      return (
                        <div
                          key={assignment.employeeId}
                          className={`p-3 rounded-lg border transition-all ${
                            isChanged
                              ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <User className={`w-4 h-4 ${isChanged ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} />
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {getUserName(assignment.employeeId)}
                              </span>
                            </div>
                            <div
                              className="px-3 py-1 rounded-lg text-white text-sm font-bold min-w-[60px] text-center"
                              style={{ backgroundColor: shiftInfo.color }}
                            >
                              {shiftInfo.code}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* AFTER */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <h3 className="font-bold text-green-900 dark:text-green-100">변경 후 (예상)</h3>
                  </div>
                  <div className="space-y-2">
                    {afterAssignments.map((assignment: any) => {
                      const shiftInfo = getShiftInfo(assignment.shiftId);
                      const isChanged = changedUserIds.has(assignment.employeeId);

                      return (
                        <div
                          key={assignment.employeeId}
                          className={`p-3 rounded-lg border transition-all ${
                            isChanged
                              ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20 ring-2 ring-green-500/20'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <User className={`w-4 h-4 ${isChanged ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {getUserName(assignment.employeeId)}
                              </span>
                            </div>
                            <div
                              className="px-3 py-1 rounded-lg text-white text-sm font-bold min-w-[60px] text-center"
                              style={{ backgroundColor: shiftInfo.color }}
                            >
                              {shiftInfo.code}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Impact Notice */}
              {request.targetUserId && (
                <div className="mt-6 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-1">
                        변경 사항 요약
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        <strong>{request.requester?.name}</strong>님의 근무가{' '}
                        <strong className="text-amber-700 dark:text-amber-400">
                          {getShiftInfo(request.originalShiftId).code}
                        </strong>에서{' '}
                        <strong className="text-green-700 dark:text-green-300">
                          {getShiftInfo(request.targetShiftId || '').code}
                        </strong>로 변경되고,{' '}
                        <strong>{request.targetUser?.name}</strong>님의 근무가{' '}
                        <strong className="text-amber-700 dark:text-amber-400">
                          {getShiftInfo(request.targetShiftId || '').code}
                        </strong>에서{' '}
                        <strong className="text-green-700 dark:text-green-300">
                          {getShiftInfo(request.originalShiftId).code}
                        </strong>로 변경됩니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900">
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => {
                onReject(request.id);
                onClose();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              거부
            </button>
            <button
              onClick={() => {
                onApprove(request.id);
                onClose();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              승인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
