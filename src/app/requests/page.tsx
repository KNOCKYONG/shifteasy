'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { Clock, CheckCircle, XCircle, AlertCircle, Calendar, User, ArrowLeftRight, Eye, Loader2 } from 'lucide-react';
import { api } from '@/lib/trpc/client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { SwapPreviewModal } from '@/components/schedule/modals/SwapPreviewModal';
import { LottieLoadingOverlay } from '@/components/common/LottieLoadingOverlay';

interface SwapRequest {
  id: string;
  requesterId: string;
  originalShiftId: string;
  targetUserId: string | null;
  targetShiftId: string | null;
  date: Date;
  status: 'pending' | 'accepted' | 'rejected' | 'approved' | 'cancelled';
  reason: string;
  requestMessage?: string | null;
  responseMessage?: string | null;
  approvalNotes?: string | null;
  createdAt: Date;
  respondedAt?: Date | null;
  approvedAt?: Date | null;
  approvedBy?: string | null;
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

// Separate component that uses useSearchParams
function RequestsPageContent() {
  const { isLoaded, dbUser, role } = useCurrentUser();
  const searchParams = useSearchParams();

  // Initialize tab from URL parameter
  const statusParam = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | 'all' | null;
  const [selectedTab, setSelectedTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>(statusParam || 'pending');
  const [previewRequest, setPreviewRequest] = useState<SwapRequest | null>(null);

  // Update tab when URL parameter changes
  useEffect(() => {
    if (statusParam && ['pending', 'approved', 'rejected', 'all'].includes(statusParam)) {
      setSelectedTab(statusParam);
    }
  }, [statusParam]);

  // Get utils for cache invalidation
  const utils = api.useUtils();

  // Fetch swap requests
  const { data: swapRequestsData, refetch, isLoading: isLoadingRequests } = api.swap.list.useQuery({
    limit: 100,
    offset: 0,
  });

  // Approve mutation
  const approveMutation = api.swap.approve.useMutation({
    onSuccess: async () => {
      await refetch();
      await utils.schedule.list.invalidate();
      alert('교환 요청이 승인되었습니다.');
    },
    onError: (error) => {
      alert(`승인 실패: ${error.message}`);
    },
  });

  // Reject mutation
  const rejectMutation = api.swap.reject.useMutation({
    onSuccess: () => {
      refetch();
      alert('교환 요청이 거부되었습니다.');
    },
    onError: (error) => {
      alert(`거부 실패: ${error.message}`);
    },
  });

  // Cancel mutation
  const cancelMutation = api.swap.cancel.useMutation({
    onSuccess: async () => {
      await refetch();
      await utils.schedule.list.invalidate();
      alert('승인이 취소되었습니다. 요청이 대기중 상태로 변경되었습니다.');
    },
    onError: (error) => {
      alert(`취소 실패: ${error.message}`);
    },
  });

  // Loading state
  const isInitialLoading = !isLoaded || (isLoadingRequests && !swapRequestsData);

  if (isInitialLoading) {
    return (
      <MainLayout>
        <LottieLoadingOverlay
          fullScreen
          message="요청사항 데이터를 불러오는 중입니다..."
        />
      </MainLayout>
    );
  }

  const swapRequests = (swapRequestsData?.items || []) as SwapRequest[];

  // Filter requests - member only sees their own requests (where they are the requester)
  const userFilteredRequests = role === 'member'
    ? swapRequests.filter(req => req.requesterId === dbUser?.id)
    : swapRequests;

  // Filter requests by status
  const filteredRequests = userFilteredRequests.filter(req => {
    if (selectedTab === 'all') return true;
    return req.status === selectedTab;
  });

  // Calculate stats - use user-filtered requests for member
  const pendingCount = userFilteredRequests.filter(r => r.status === 'pending').length;
  const approvedCount = userFilteredRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = userFilteredRequests.filter(r => r.status === 'rejected').length;

  const isManager = role === 'manager' || role === 'admin';

  const handleShowPreview = (request: SwapRequest) => {
    setPreviewRequest(request);
  };

  const handleApprove = async (requestId: string) => {
    await approveMutation.mutateAsync({
      id: requestId,
      approvalNotes: '승인됨',
    });
  };

  const handleReject = async (requestId: string) => {
    const notes = prompt('거부 사유를 입력하세요:');
    if (!notes) return;

    await rejectMutation.mutateAsync({
      id: requestId,
      approvalNotes: notes,
    });
  };

  const handleCancel = async (requestId: string) => {
    if (!confirm('승인을 취소하시겠습니까?\n스케줄이 원래대로 되돌아가고, 요청이 대기중 상태로 변경됩니다.')) return;

    await cancelMutation.mutateAsync({
      id: requestId,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 rounded-full">대기중</span>;
      case 'accepted':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-full">수락됨</span>;
      case 'approved':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-full">승인됨</span>;
      case 'rejected':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-full">거부됨</span>;
      case 'cancelled':
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full">취소됨</span>;
      default:
        return null;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            요청사항
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            근무 교대 요청을 관리합니다
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">대기 중</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pendingCount}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">승인됨</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{approvedCount}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">거부됨</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{rejectedCount}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">전체</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userFilteredRequests.length}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setSelectedTab('pending')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'pending'
                ? 'border-yellow-600 dark:border-yellow-400 text-yellow-600 dark:text-yellow-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            대기중 ({pendingCount})
          </button>
          <button
            onClick={() => setSelectedTab('approved')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'approved'
                ? 'border-green-600 dark:border-green-400 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            승인됨 ({approvedCount})
          </button>
          <button
            onClick={() => setSelectedTab('rejected')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'rejected'
                ? 'border-red-600 dark:border-red-400 text-red-600 dark:text-red-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            거부됨 ({rejectedCount})
          </button>
          <button
            onClick={() => setSelectedTab('all')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'all'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            전체 ({userFilteredRequests.length})
          </button>
        </div>

        {/* Request List */}
        <div className="space-y-4">
          {filteredRequests.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                요청사항이 없습니다
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                현재 {selectedTab === 'all' ? '등록된' : selectedTab === 'pending' ? '대기 중인' : selectedTab === 'approved' ? '승인된' : '거부된'} 요청이 없습니다.
              </p>
            </div>
          ) : (
            filteredRequests.map((request) => (
              <div key={request.id} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                {/* Header with Date */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-white" />
                      <div>
                        <p className="text-white font-bold text-lg">
                          {format(new Date(request.date), 'yyyy년 MM월 dd일 (E)', { locale: ko })}
                        </p>
                        <p className="text-blue-100 text-xs">
                          요청일: {format(new Date(request.createdAt), 'MM월 dd일 HH:mm', { locale: ko })}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex flex-col md:flex-row gap-3 mb-4">
                    {/* Requester Info */}
                    <div className="flex-1 bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 relative">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-300">요청자</p>
                          </div>
                          <p className="text-base text-blue-900 dark:text-blue-100 font-bold mb-1">
                            {request.requester?.name || '이름 없음'}
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            {request.requester?.email || request.requesterId}
                          </p>
                        </div>
                        <div className="flex items-center justify-center w-16 h-16 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                          <span className="text-3xl font-black text-blue-600 dark:text-blue-400">
                            {request.originalShiftId?.replace('shift-', '').toUpperCase() || '?'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center md:py-8">
                      <ArrowLeftRight className="w-6 h-6 text-gray-400 transform md:rotate-0 rotate-90" />
                    </div>

                    {/* Target Info */}
                    {request.targetUserId && (
                      <div className="flex-1 bg-green-50 dark:bg-green-950/30 rounded-lg p-4 relative">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3">
                              <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                              <p className="text-sm font-medium text-green-900 dark:text-green-300">교환 대상</p>
                            </div>
                            <p className="text-base text-green-900 dark:text-green-100 font-bold mb-1">
                              {request.targetUser?.name || '이름 없음'}
                            </p>
                            <p className="text-xs text-green-700 dark:text-green-300">
                              {request.targetUser?.email || request.targetUserId}
                            </p>
                          </div>
                          <div className="flex items-center justify-center w-16 h-16 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                            <span className="text-3xl font-black text-green-600 dark:text-green-400">
                              {request.targetShiftId?.replace('shift-', '').toUpperCase() || '?'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reason */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">사유</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{request.reason}</p>
                  </div>

                  {/* Approval Notes */}
                  {request.approvalNotes && (
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-1">관리자 메모</p>
                      <p className="text-sm text-yellow-800 dark:text-yellow-400">{request.approvalNotes}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {isManager && request.status === 'pending' && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
                      <button
                        onClick={() => handleShowPreview(request)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        미리보기
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        disabled={rejectMutation.isPending}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        {rejectMutation.isPending ? '처리 중...' : '거부'}
                      </button>
                      <button
                        onClick={() => handleApprove(request.id)}
                        disabled={approveMutation.isPending}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        {approveMutation.isPending ? '처리 중...' : '승인'}
                      </button>
                    </div>
                  )}

                  {/* Cancel Button for Approved Requests */}
                  {isManager && request.status === 'approved' && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
                      <button
                        onClick={() => handleCancel(request.id)}
                        disabled={cancelMutation.isPending}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        {cancelMutation.isPending ? '처리 중...' : '승인 취소'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Swap Preview Modal */}
      {previewRequest && (
        <SwapPreviewModal
          request={previewRequest}
          onClose={() => setPreviewRequest(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </MainLayout>
  );
}

// Main page component with Suspense boundary
export default function RequestsPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-600 dark:text-gray-400">로딩 중...</div>
        </div>
      </MainLayout>
    }>
      <RequestsPageContent />
    </Suspense>
  );
}
