import React from 'react';
import { X, ArrowRight, Calendar, User, Users, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
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
  const { data: shiftTypesConfig } = api.tenantConfigs.getByKey.useQuery({
    configKey: 'shift_types',
  });

  // Get users for the department
  const { data: usersData } = api.tenant.users.list.useQuery({
    limit: 100,
    offset: 0,
    status: 'active',
  });

  const users = usersData?.items || [];
  const customShiftTypes = shiftTypesConfig?.configValue?.shiftTypes || [];

  // Find the published schedule for this month
  const publishedSchedule = schedulesData?.items?.[0];
  const assignments = publishedSchedule?.assignments || [];

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

  // Calculate shift coverage statistics
  const calculateShiftCoverage = (assignments: any[]) => {
    const coverage = new Map<string, { count: number; employees: string[] }>();

    assignments.forEach((a: any) => {
      const shiftInfo = getShiftInfo(a.shiftId);
      const existing = coverage.get(shiftInfo.code) || { count: 0, employees: [] };
      coverage.set(shiftInfo.code, {
        count: existing.count + 1,
        employees: [...existing.employees, getUserName(a.employeeId)]
      });
    });

    return coverage;
  };

  const beforeCoverage = calculateShiftCoverage(beforeAssignments);
  const afterCoverage = calculateShiftCoverage(afterAssignments);

  // Get all unique shift types from both before and after
  const allShiftTypes = new Set([...beforeCoverage.keys(), ...afterCoverage.keys()]);

  // Calculate coverage changes
  const coverageChanges = Array.from(allShiftTypes).map(shiftCode => {
    const before = beforeCoverage.get(shiftCode) || { count: 0, employees: [] };
    const after = afterCoverage.get(shiftCode) || { count: 0, employees: [] };
    const shiftType = customShiftTypes.find((st: any) => st.code === shiftCode);

    return {
      code: shiftCode,
      name: shiftType?.name || shiftCode,
      color: shiftType?.color || '#3b82f6',
      beforeCount: before.count,
      afterCount: after.count,
      change: after.count - before.count,
      beforeEmployees: before.employees,
      afterEmployees: after.employees,
    };
  }).sort((a, b) => {
    // Sort by shift type order if available
    const orderA = customShiftTypes.findIndex((st: any) => st.code === a.code);
    const orderB = customShiftTypes.findIndex((st: any) => st.code === b.code);
    return orderA - orderB;
  });

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

              {/* Team-Wide Shift Coverage Statistics */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">팀 근무 배치 현황</h3>
                </div>

                <div className="space-y-3">
                  {coverageChanges.map((coverage) => {
                    const hasChange = coverage.change !== 0;
                    const isIncrease = coverage.change > 0;
                    const isDecrease = coverage.change < 0;

                    return (
                      <div
                        key={coverage.code}
                        className={`p-4 rounded-lg border transition-all ${
                          hasChange
                            ? isDecrease
                              ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20'
                              : 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div
                              className="px-3 py-1.5 rounded-lg text-white text-sm font-bold min-w-[60px] text-center"
                              style={{ backgroundColor: coverage.color }}
                            >
                              {coverage.code}
                            </div>
                            <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                              {coverage.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
                                  {coverage.beforeCount}명
                                </span>
                                {hasChange && (
                                  <>
                                    <ArrowRight className="w-4 h-4 text-gray-400" />
                                    <span className={`text-lg font-bold ${
                                      isIncrease
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-amber-600 dark:text-amber-400'
                                    }`}>
                                      {coverage.afterCount}명
                                    </span>
                                    <span className={`text-sm font-medium ${
                                      isIncrease
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-amber-600 dark:text-amber-400'
                                    }`}>
                                      ({isIncrease ? '+' : ''}{coverage.change})
                                    </span>
                                  </>
                                )}
                                {!hasChange && (
                                  <span className="text-sm text-gray-500 dark:text-gray-400">(변경 없음)</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Show affected employees if there's a change */}
                        {hasChange && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <p className="text-gray-600 dark:text-gray-400 mb-1 font-medium">변경 전:</p>
                                <p className="text-gray-900 dark:text-gray-100">
                                  {coverage.beforeEmployees.join(', ') || '-'}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600 dark:text-gray-400 mb-1 font-medium">변경 후:</p>
                                <p className="text-gray-900 dark:text-gray-100">
                                  {coverage.afterEmployees.join(', ') || '-'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Total Statistics */}
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      총 근무 인원
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {beforeAssignments.length}명
                      </span>
                      {beforeAssignments.length !== afterAssignments.length && (
                        <>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {afterAssignments.length}명
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Coverage Impact Summary */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                      팀 배치 영향도 분석
                    </p>
                    <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                      {coverageChanges.some(c => c.change !== 0) ? (
                        <>
                          <p>• 교환 요청자: <strong>{request.requester?.name}</strong> ({getShiftInfo(request.originalShiftId).name} → {getShiftInfo(request.targetShiftId || '').name})</p>
                          {request.targetUserId && (
                            <p>• 교환 대상: <strong>{request.targetUser?.name}</strong> ({getShiftInfo(request.targetShiftId || '').name} → {getShiftInfo(request.originalShiftId).name})</p>
                          )}
                          <p className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                            {coverageChanges.filter(c => c.change < 0).length > 0 && (
                              <span className="text-amber-700 dark:text-amber-400 font-medium">
                                ⚠ {coverageChanges.filter(c => c.change < 0).length}개 시프트의 인원이 감소합니다.
                              </span>
                            )}
                            {coverageChanges.filter(c => c.change > 0).length > 0 && (
                              <span className="text-green-700 dark:text-green-400 font-medium">
                                ✓ {coverageChanges.filter(c => c.change > 0).length}개 시프트의 인원이 증가합니다.
                              </span>
                            )}
                          </p>
                        </>
                      ) : (
                        <p>• 이 교환은 팀의 전체 근무 배치에 영향을 주지 않습니다.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
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
