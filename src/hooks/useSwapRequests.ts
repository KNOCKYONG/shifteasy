import { useState, useEffect, useCallback } from 'react';
import { useApiCache } from './useApiCache';

export interface SwapRequest {
  id: string;
  type: 'swap' | 'cover' | 'auto-match' | 'open-request';
  requesterId: string;
  requesterName: string;
  requesterExperience?: number;
  requesterSeniority?: 'junior' | 'intermediate' | 'senior' | 'expert';
  requesterShift: {
    date: string;
    type: string;
    time: string;
  };
  targetId?: string;
  targetName?: string;
  targetExperience?: number;
  targetSeniority?: 'junior' | 'intermediate' | 'senior' | 'expert';
  targetShift?: {
    date: string;
    type: string;
    time: string;
  };
  status: 'requested' | 'in-approval' | 'confirmed' | 'rejected' | 'cancelled' | 'auto-matched';
  reason: string;
  createdAt: Date;
  approvedAt?: Date;
  confirmedAt?: Date;
  respondedAt?: Date;
  message?: string;
  managerApproval?: boolean;
  matchedRequests?: string[];
  openApplications?: any[];
  fairnessScore?: number;
}

interface UseSwapRequestsReturn {
  requests: SwapRequest[];
  myRequests: SwapRequest[];
  pendingRequests: SwapRequest[];
  loading: boolean;
  error: Error | null;
  createRequest: (data: Partial<SwapRequest>) => Promise<void>;
  approveRequest: (requestId: string, userId: string) => Promise<void>;
  rejectRequest: (requestId: string, userId: string, reason?: string) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useSwapRequests(userId: string): UseSwapRequestsReturn {
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 스왑 요청 가져오기
  const fetchRequests = useCallback(async () => {
    const response = await fetch('/api/swap/request', {
      headers: {
        'x-user-id': userId,
        'x-tenant-id': 'default-tenant',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch swap requests');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch swap requests');
    }

    // Date 문자열을 Date 객체로 변환
    const processedRequests = result.data.map((req: any) => ({
      ...req,
      createdAt: new Date(req.createdAt),
      approvedAt: req.approvedAt ? new Date(req.approvedAt) : undefined,
      confirmedAt: req.confirmedAt ? new Date(req.confirmedAt) : undefined,
      respondedAt: req.respondedAt ? new Date(req.respondedAt) : undefined,
    }));

    return processedRequests;
  }, [userId]);

  // 캐싱된 데이터 사용
  const {
    data: cachedRequests,
    loading: cacheLoading,
    error: cacheError,
    refetch,
  } = useApiCache(fetchRequests, {
    cacheKey: `swap-requests-${userId}`,
    ttl: 2 * 60 * 1000, // 2분 캐싱
  });

  useEffect(() => {
    if (cachedRequests) {
      setRequests(cachedRequests);
    }
  }, [cachedRequests]);

  // 새 스왑 요청 생성
  const createRequest = async (data: Partial<SwapRequest>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/swap/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-tenant-id': 'default-tenant',
        },
        body: JSON.stringify({
          type: data.type,
          requesterId: userId,
          requesterShift: data.requesterShift,
          targetId: data.targetId,
          targetShift: data.targetShift,
          reason: data.reason,
          message: data.message,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '스왑 요청 생성에 실패했습니다.');
      }

      // 캐시 새로고침
      await refetch();
      alert('스왑 요청이 성공적으로 생성되었습니다.');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('스왑 요청 생성 실패'));
      alert(err instanceof Error ? err.message : '스왑 요청 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 스왑 요청 승인
  const approveRequest = async (requestId: string, approverId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/swap/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': approverId,
          'x-tenant-id': 'default-tenant',
        },
        body: JSON.stringify({
          swapId: requestId,
          action: 'approve',
          approverId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '스왑 요청 승인에 실패했습니다.');
      }

      // 캐시 새로고침
      await refetch();
      alert('스왑 요청을 승인했습니다.');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('스왑 요청 승인 실패'));
      alert(err instanceof Error ? err.message : '스왑 요청 승인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 스왑 요청 거절
  const rejectRequest = async (requestId: string, rejectedBy: string, reason?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/swap/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': rejectedBy,
          'x-tenant-id': 'default-tenant',
        },
        body: JSON.stringify({
          swapId: requestId,
          action: 'reject',
          approverId: rejectedBy,
          reason: reason || '개인 사정으로 인해 거절합니다.',
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '스왑 요청 거절에 실패했습니다.');
      }

      // 캐시 새로고침
      await refetch();
      alert('스왑 요청을 거절했습니다.');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('스왑 요청 거절 실패'));
      alert(err instanceof Error ? err.message : '스왑 요청 거절에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 스왑 요청 취소
  const cancelRequest = async (requestId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/swap/request`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-tenant-id': 'default-tenant',
        },
        body: JSON.stringify({
          swapId: requestId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '스왑 요청 취소에 실패했습니다.');
      }

      // 캐시 새로고침
      await refetch();
      alert('스왑 요청이 취소되었습니다.');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('스왑 요청 취소 실패'));
      alert(err instanceof Error ? err.message : '스왑 요청 취소에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 내 요청 필터링
  const myRequests = requests.filter(req => req.requesterId === userId);

  // 내가 받은 대기 중인 요청 필터링
  const pendingRequests = requests.filter(
    req => req.targetId === userId && req.status === 'requested'
  );

  return {
    requests,
    myRequests,
    pendingRequests,
    loading: loading || cacheLoading,
    error: error || cacheError,
    createRequest,
    approveRequest,
    rejectRequest,
    cancelRequest,
    refetch,
  };
}