'use client';

import React, { useState } from 'react';
import { Calendar, Clock, Users, ArrowLeftRight, Check, X, AlertCircle, Plus, Filter, Sparkles } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { format, addDays } from 'date-fns';
import { NewRequestModal, NewRequestData } from '@/components/swap/NewRequestModal';
import { OpenRequestCard } from '@/components/swap/OpenRequestCard';
import { api } from '@/lib/trpc/client';

// 스왑 요청 타입
type SwapRequestType = 'swap' | 'cover' | 'auto-match' | 'open-request';
type SwapStatus = 'requested' | 'in-approval' | 'confirmed' | 'rejected' | 'cancelled' | 'auto-matched';

// 오픈 요청 지원자
interface OpenRequestApplicant {
  employeeId: string;
  employeeName: string;
  experienceYears: number;
  seniorityLevel: 'junior' | 'intermediate' | 'senior' | 'expert';
  shift: {
    date: string;
    type: string;
    time: string;
  };
  appliedAt: Date;
  message?: string;
}

interface SwapRequest {
  id: string;
  type: SwapRequestType;
  requesterId: string;
  requesterName: string;
  requesterExperience?: number; // 요청자 연차
  requesterSeniority?: 'junior' | 'intermediate' | 'senior' | 'expert'; // 요청자 레벨
  requesterShift: {
    date: string;
    type: string;
    time: string;
  };
  targetId?: string; // optional for auto-match and open-request
  targetName?: string;
  targetExperience?: number; // 대상자 연차
  targetSeniority?: 'junior' | 'intermediate' | 'senior' | 'expert'; // 대상자 레벨
  targetShift?: {
    date: string;
    type: string;
    time: string;
  };
  status: SwapStatus;
  reason: string;
  createdAt: Date;
  approvedAt?: Date; // 승인 시작 시간
  confirmedAt?: Date; // 최종 확정 시간
  respondedAt?: Date;
  message?: string;
  managerApproval?: boolean; // 관리자 승인 여부
  matchedRequests?: string[]; // 자동 매칭된 요청 ID들
  openApplications?: OpenRequestApplicant[]; // 오픈 요청 지원자들
  fairnessScore?: number; // 공정성 점수 (0-100, 높을수록 공정)
}

// 자동 매칭 가능한 요청들 찾기
const findAutoMatches = (request: SwapRequest, allRequests: SwapRequest[]): SwapRequest[] => {
  if (request.type !== 'auto-match') return [];

  return allRequests.filter(r => {
    // 자기 자신 제외
    if (r.id === request.id) return false;
    // auto-match 타입만
    if (r.type !== 'auto-match') return false;
    // 대기 중인 요청만
    if (r.status !== 'requested') return false;

    // 날짜와 시프트 타입이 서로 교환 가능한지 확인
    const canSwap =
      r.requesterShift.date === request.requesterShift.date &&
      r.requesterShift.type === request.requesterShift.type &&
      request.requesterId !== r.requesterId;

    return canSwap;
  });
};

// Mock 데이터
const mockSwapRequests: SwapRequest[] = [
  // 오픈 요청 예시
  {
    id: 'open-001',
    type: 'open-request',
    requesterId: 'emp-002',
    requesterName: '박정호',
    requesterExperience: 8,
    requesterSeniority: 'senior',
    requesterShift: {
      date: format(addDays(new Date(), 4), 'yyyy-MM-dd'),
      type: '야간',
      time: '23:00 - 07:00',
    },
    status: 'requested',
    reason: '가족 행사 참석',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2시간 전
    openApplications: [
      {
        employeeId: 'emp-003',
        employeeName: '이민지',
        experienceYears: 3,
        seniorityLevel: 'intermediate',
        shift: {
          date: format(addDays(new Date(), 5), 'yyyy-MM-dd'),
          type: '주간',
          time: '07:00 - 15:00',
        },
        appliedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1시간 전
        message: '해당 날짜 교환 가능합니다.',
      },
      {
        employeeId: 'emp-005',
        employeeName: '정현우',
        experienceYears: 2,
        seniorityLevel: 'junior',
        shift: {
          date: format(addDays(new Date(), 6), 'yyyy-MM-dd'),
          type: '저녁',
          time: '15:00 - 23:00',
        },
        appliedAt: new Date(Date.now() - 30 * 60 * 1000), // 30분 전
        message: '교환 희망합니다.',
      },
    ],
  },
  {
    id: 'swap-001',
    type: 'swap',
    requesterId: 'emp-001',
    requesterName: '김수연',
    requesterShift: {
      date: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
      type: '주간',
      time: '07:00 - 15:00',
    },
    targetId: 'emp-002',
    targetName: '박정호',
    targetShift: {
      date: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
      type: '저녁',
      time: '15:00 - 23:00',
    },
    status: 'requested',
    reason: '개인 사정',
    createdAt: new Date(),
  },
  {
    id: 'swap-002',
    type: 'swap',
    requesterId: 'emp-003',
    requesterName: '이민지',
    requesterShift: {
      date: format(addDays(new Date(), 5), 'yyyy-MM-dd'),
      type: '야간',
      time: '23:00 - 07:00',
    },
    targetId: 'emp-004',
    targetName: '최서준',
    targetShift: {
      date: format(addDays(new Date(), 6), 'yyyy-MM-dd'),
      type: '주간',
      time: '07:00 - 15:00',
    },
    status: 'in-approval',
    reason: '병원 진료',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    approvedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    managerApproval: false,
    message: '동료 승인 완료, 관리자 승인 대기중',
  },
  {
    id: 'swap-003',
    type: 'cover',
    requesterId: 'emp-005',
    requesterName: '정유나',
    requesterShift: {
      date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      type: '저녁',
      time: '15:00 - 23:00',
    },
    targetId: 'emp-006',
    targetName: '강민수',
    status: 'confirmed',
    reason: '가족 행사',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    approvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    confirmedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    managerApproval: true,
    message: '최종 확정되었습니다.',
  },
];

export default function SwapPage() {
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>(mockSwapRequests);
  const [filterStatus, setFilterStatus] = useState<'all' | 'requested' | 'in-approval' | 'confirmed' | 'rejected'>('all');
  const [showAutoMatchAlert, setShowAutoMatchAlert] = useState(false);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [currentUserId] = useState('emp-001'); // 실제로는 로그인한 사용자 ID
  const [activeTab, setActiveTab] = useState<'regular' | 'open'>('regular');

  // Fetch current user from database
  const { data: usersData } = api.tenant.users.list.useQuery({
    limit: 1,
    offset: 0,
    status: 'active',
  });

  // Get the first user as current user (temporary - should be from auth)
  const currentUser = React.useMemo(() => {
    if (!usersData?.items?.[0]) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = usersData.items[0] as any;
    return {
      id: item.id,
      employeeId: item.employeeId || '',
      name: item.name,
      email: item.email,
      role: item.role as 'admin' | 'manager' | 'staff',
      departmentId: item.departmentId || '',
      departmentName: item.department?.name || '',
      status: item.status as 'active' | 'inactive' | 'on_leave',
      position: item.position || '',
      joinedAt: item.createdAt?.toISOString() || new Date().toISOString(),
      avatar: '',
      phone: item.profile?.phone || '',
    };
  }, [usersData]);

  // 확정된 스케줄 (실제로는 DB에서 가져와야 함)
  const confirmedSchedules = [
    { date: format(addDays(new Date(), 3), 'yyyy-MM-dd'), shiftType: '주간', time: '07:00-15:00' },
    { date: format(addDays(new Date(), 5), 'yyyy-MM-dd'), shiftType: '저녁', time: '15:00-23:00' },
    { date: format(addDays(new Date(), 7), 'yyyy-MM-dd'), shiftType: '야간', time: '23:00-07:00' },
  ];

  // 공정성 점수 계산 함수
  const calculateFairnessScore = (requesterExp: number, targetExp: number): number => {
    const experienceDiff = Math.abs(requesterExp - targetExp);
    if (experienceDiff <= 1) return 100;
    if (experienceDiff <= 2) return 90;
    if (experienceDiff <= 3) return 80;
    if (experienceDiff <= 5) return 70;
    if (experienceDiff <= 7) return 60;
    return 50;
  };

  const filteredRequests = swapRequests.filter(request => {
    if (activeTab === 'open') {
      return request.type === 'open-request';
    }
    if (filterStatus === 'all') return request.type !== 'open-request';
    return request.status === filterStatus && request.type !== 'open-request';
  });

  const openRequests = swapRequests.filter(r => r.type === 'open-request');

  const myRequests = filteredRequests.filter(r => r.requesterId === currentUserId);
  const requestsToMe = filteredRequests.filter(r => r.targetId === currentUserId);
  const otherRequests = filteredRequests.filter(
    r => r.requesterId !== currentUserId && r.targetId !== currentUserId
  );

  const handleApprove = (requestId: string) => {
    const request = swapRequests.find(r => r.id === requestId);
    if (!request) return;

    // 동료 승인 -> 관리자 승인 대기
    if (request.status === 'requested') {
      setSwapRequests(prev =>
        prev.map(req =>
          req.id === requestId
            ? {
                ...req,
                status: 'in-approval' as SwapStatus,
                approvedAt: new Date(),
                message: '동료 승인 완료, 관리자 승인 대기중'
              }
            : req
        )
      );
    }
  };


  const handleReject = (requestId: string) => {
    setSwapRequests(prev =>
      prev.map(req =>
        req.id === requestId
          ? { ...req, status: 'rejected' as SwapStatus, respondedAt: new Date(), message: '거절되었습니다.' }
          : req
      )
    );
  };

  // 자동 매칭 처리
  const handleAutoMatch = () => {
    const autoMatchRequests = swapRequests.filter(r => r.type === 'auto-match' && r.status === 'requested');
    let matchCount = 0;
    const matchedPairs: Array<[string, string]> = [];

    // 이미 매칭된 요청들을 추적
    const alreadyMatched = new Set<string>();

    autoMatchRequests.forEach(request => {
      if (alreadyMatched.has(request.id)) return;

      const matches = findAutoMatches(request, swapRequests);
      const availableMatch = matches.find(m => !alreadyMatched.has(m.id));

      if (availableMatch) {
        matchedPairs.push([request.id, availableMatch.id]);
        alreadyMatched.add(request.id);
        alreadyMatched.add(availableMatch.id);
        matchCount++;
      }
    });

    if (matchCount > 0) {
      setSwapRequests(prev => prev.map(req => {
        const matchPair = matchedPairs.find(pair => pair[0] === req.id || pair[1] === req.id);
        if (matchPair) {
          const partnerId = matchPair[0] === req.id ? matchPair[1] : matchPair[0];
          const partner = prev.find(r => r.id === partnerId);

          return {
            ...req,
            status: 'in-approval' as SwapStatus, // 자동 매칭 시 바로 결재중으로
            targetId: partner?.requesterId,
            targetName: partner?.requesterName,
            targetShift: partner?.requesterShift,
            matchedRequests: [partnerId],
            message: '자동 매칭 완료, 관리자 승인 대기중',
            approvedAt: new Date(),
            managerApproval: false
          };
        }
        return req;
      }));

      setShowAutoMatchAlert(true);
      setTimeout(() => setShowAutoMatchAlert(false), 5000);
    } else {
      alert('매칭 가능한 요청이 없습니다.');
    }
  };

  const getStatusBadge = (status: SwapStatus) => {
    switch (status) {
      case 'requested':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 rounded-full">요청</span>;
      case 'in-approval':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-full">결재중</span>;
      case 'confirmed':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-full">확정</span>;
      case 'rejected':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-full">거절</span>;
      case 'cancelled':
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full">취소</span>;
      case 'auto-matched':
        return <span className="px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 rounded-full">자동매칭</span>;
    }
  };

  const getTypeBadge = (type: SwapRequestType) => {
    switch (type) {
      case 'swap':
        return <span className="text-xs text-gray-500 dark:text-gray-400">교대</span>;
      case 'cover':
        return <span className="text-xs text-gray-500 dark:text-gray-400">대체</span>;
      case 'auto-match':
        return <span className="text-xs text-purple-600 dark:text-purple-400">자동매칭</span>;
    }
  };

  const SwapCard = ({ request, showActions = false }: { request: SwapRequest; showActions?: boolean }) => (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 hover:shadow-md dark:hover:shadow-gray-900/50 transition-shadow">
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          {getStatusBadge(request.status)}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {format(request.createdAt, 'MM/dd HH:mm')}
          </span>
        </div>
        {showActions && request.status === 'requested' && (
          <div className="flex gap-1 sm:gap-2">
            <button
              onClick={() => handleApprove(request.id)}
              className="p-1 sm:p-1.5 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors"
            >
              <Check className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </button>
            <button
              onClick={() => handleReject(request.id)}
              className="p-1 sm:p-1.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
            >
              <X className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 모바일에서는 세로 레이아웃으로 변경 */}
      <div className="space-y-3">
        {/* 요청 타입 표시 */}
        <div>
          {getTypeBadge(request.type)}
        </div>

        {/* 요청자 정보 */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 sm:p-3">
          <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 mb-1.5">{request.requesterName}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Calendar className="w-3 h-3" />
              {format(new Date(request.requesterShift.date), 'MM/dd (EEE)')}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Clock className="w-3 h-3" />
              {request.requesterShift.type} ({request.requesterShift.time})
            </div>
          </div>
        </div>

        {/* 교환 아이콘 */}
        {request.targetId && (
          <div className="flex items-center justify-center py-1">
            <ArrowLeftRight className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400 dark:text-gray-500 rotate-90 sm:rotate-0" />
          </div>
        )}

        {/* 대상자 정보 (있는 경우만) */}
        {request.targetId && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 sm:p-3">
            <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 mb-1.5">{request.targetName}</p>
            {request.targetShift && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(request.targetShift.date), 'MM/dd (EEE)')}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <Clock className="w-3 h-3" />
                  {request.targetShift.type} ({request.targetShift.time})
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        <p className="text-xs text-gray-500 dark:text-gray-400">사유: {request.reason}</p>
        {request.message && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">관리자: {request.message}</p>
        )}
      </div>
    </div>
  );

  return (
    <MainLayout>
        {/* 자동 매칭 알림 */}
        {showAutoMatchAlert && (
          <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <p className="text-sm text-purple-800 dark:text-purple-300">자동 매칭이 완료되었습니다! 매칭된 요청은 관리자 승인 대기 상태입니다.</p>
          </div>
        )}

        {/* Page Header - 모바일 최적화 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">근무 교대 요청</h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">동료와 근무를 교대하거나 요청을 관리합니다</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleAutoMatch}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-colors"
            >
              <ArrowLeftRight className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              <span className="hidden sm:inline">자동 매칭 실행</span>
              <span className="sm:hidden">자동매칭</span>
            </button>
            <button
              onClick={() => setShowNewRequestModal(true)}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              <span className="hidden sm:inline">새 요청</span>
              <span className="sm:hidden">요청</span>
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('regular')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'regular'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            일반 요청
          </button>
          <button
            onClick={() => setActiveTab('open')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
              activeTab === 'open'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            오픈 요청
            {openRequests.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-full text-xs">
                {openRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Filter Tabs - 모바일 스크롤 가능 */}
        {activeTab === 'regular' && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <Filter className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                filterStatus === 'all'
                  ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              전체 ({swapRequests.length})
            </button>
            <button
              onClick={() => setFilterStatus('requested')}
              className={`px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                filterStatus === 'requested'
                  ? 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              요청 ({swapRequests.filter(r => r.status === 'requested').length})
            </button>
            <button
              onClick={() => setFilterStatus('in-approval')}
              className={`px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                filterStatus === 'in-approval'
                  ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              결재중 ({swapRequests.filter(r => r.status === 'in-approval').length})
            </button>
            <button
              onClick={() => setFilterStatus('confirmed')}
              className={`px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                filterStatus === 'confirmed'
                  ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              확정 ({swapRequests.filter(r => r.status === 'confirmed' || r.status === 'auto-matched').length})
            </button>
            <button
              onClick={() => setFilterStatus('rejected')}
              className={`px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                filterStatus === 'rejected'
                  ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              거절 ({swapRequests.filter(r => r.status === 'rejected').length})
            </button>
          </div>
        </div>
        )}

        {/* Requests Sections */}
        <div className="space-y-8">
          {/* 오픈 요청 섹션 */}
          {activeTab === 'open' && (
            <div>
              {openRequests.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4">
                  {openRequests.map(request => (
                    <OpenRequestCard
                      key={request.id}
                      request={{
                        ...request,
                        requesterExperience: request.requesterExperience || 5,
                        requesterSeniority: request.requesterSeniority || 'intermediate',
                        openApplications: request.openApplications || []
                      }}
                      currentUser={currentUser ? {
                        id: currentUser.id,
                        name: currentUser.name,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        experienceYears: (currentUser as any).experienceYears || 0,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        seniorityLevel: (currentUser as any).seniorityLevel || 'junior' as const
                      } : undefined}
                      isOwner={request.requesterId === currentUser?.id}
                      onApply={(requestId, message) => {
                        // 오픈 요청 지원 로직
                        const updatedRequests = swapRequests.map(r => {
                          if (r.id === requestId) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const currentUserData = currentUser as any;
                            const newApplication = {
                              employeeId: currentUser?.id || '',
                              employeeName: currentUser?.name || '',
                              experienceYears: currentUserData?.experienceYears || 0,
                              seniorityLevel: currentUserData?.seniorityLevel || 'junior' as const,
                              shift: {
                                date: confirmedSchedules[0].date,
                                type: confirmedSchedules[0].shiftType,
                                time: confirmedSchedules[0].time
                              },
                              appliedAt: new Date(),
                              message
                            };
                            return {
                              ...r,
                              openApplications: [...(r.openApplications || []), newApplication]
                            };
                          }
                          return r;
                        });
                        setSwapRequests(updatedRequests);
                      }}
                      onSelectApplicant={(requestId, applicantId) => {
                        // 지원자 선택 로직
                        const updatedRequests = swapRequests.map(r => {
                          if (r.id === requestId) {
                            const applicant = r.openApplications?.find(a => a.employeeId === applicantId);
                            if (applicant) {
                              const fairnessScore = calculateFairnessScore(
                                r.requesterExperience || 5,
                                applicant.experienceYears
                              );
                              return {
                                ...r,
                                targetId: applicantId,
                                targetName: applicant.employeeName,
                                targetExperience: applicant.experienceYears,
                                targetSeniority: applicant.seniorityLevel,
                                targetShift: applicant.shift,
                                status: 'in-approval' as SwapStatus,
                                fairnessScore,
                                message: fairnessScore < 70 ? '연차 차이로 인한 추가 검토 필요' : undefined
                              };
                            }
                          }
                          return r;
                        });
                        setSwapRequests(updatedRequests);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <Sparkles className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">현재 오픈 요청이 없습니다</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">새 요청 버튼을 눌러 오픈 요청을 생성해보세요</p>
                </div>
              )}
            </div>
          )}

          {/* 일반 요청 섹션 */}
          {activeTab === 'regular' && (
          <>
          {/* 내가 받은 요청 */}
          {requestsToMe.length > 0 && (
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 sm:w-5 h-4 sm:h-5 text-orange-500 dark:text-orange-400" />
                내가 받은 요청 ({requestsToMe.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4">
                {requestsToMe.map(request => (
                  <SwapCard key={request.id} request={request} showActions={true} />
                ))}
              </div>
            </div>
          )}

          {/* 내가 보낸 요청 */}
          {myRequests.length > 0 && (
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
                <Users className="w-4 sm:w-5 h-4 sm:h-5 text-blue-500 dark:text-blue-400" />
                내가 보낸 요청 ({myRequests.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4">
                {myRequests.map(request => (
                  <SwapCard key={request.id} request={request} />
                ))}
              </div>
            </div>
          )}

          {/* 다른 직원들의 요청 */}
          {otherRequests.length > 0 && (
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
                <Users className="w-4 sm:w-5 h-4 sm:h-5 text-gray-500 dark:text-gray-400" />
                다른 직원 요청 ({otherRequests.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4">
                {otherRequests.map(request => (
                  <SwapCard key={request.id} request={request} />
                ))}
              </div>
            </div>
          )}

          {filteredRequests.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">스왑 요청이 없습니다</p>
            </div>
          )}
          </>
          )}
        </div>

        {/* New Request Modal */}
        <NewRequestModal
          isOpen={showNewRequestModal}
          onClose={() => setShowNewRequestModal(false)}
          onSubmit={(requestData: NewRequestData) => {
            // 새 요청 생성 로직
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const currentUserData = currentUser as any;
            const newRequest: SwapRequest = {
              id: `swap-${Date.now()}`,
              type: requestData.type,
              requesterId: currentUser?.id || '',
              requesterName: currentUser?.name || '',
              requesterExperience: currentUserData?.experienceYears || 0,
              requesterSeniority: currentUserData?.seniorityLevel || 'junior' as const,
              requesterShift: {
                date: requestData.selectedDate,
                type: requestData.shiftType,
                time: requestData.shiftTime,
              },
              status: 'requested',
              reason: requestData.reason,
              createdAt: new Date(),
              openApplications: requestData.isOpenRequest ? [] : undefined,
            };

            if (requestData.targetDate && requestData.targetShiftType) {
              newRequest.targetShift = {
                date: requestData.targetDate,
                type: requestData.targetShiftType,
                time: requestData.targetShiftTime || '',
              };
            }

            setSwapRequests([...swapRequests, newRequest]);
            setShowNewRequestModal(false);

            // 오픈 요청이면 오픈 탭으로 이동
            if (requestData.isOpenRequest) {
              setActiveTab('open');
            }
          }}
          currentUser={{
            id: currentUser?.id || '',
            name: currentUser?.name || '',
            position: currentUser?.position || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            seniorityLevel: (currentUser as any)?.seniorityLevel || 'junior',
          }}
          confirmedSchedules={confirmedSchedules}
        />
    </MainLayout>
  );
}
