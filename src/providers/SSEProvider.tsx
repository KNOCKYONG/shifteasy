"use client";

/**
 * Global SSE Provider
 * 애플리케이션 전역에서 SSE 연결을 관리하고 자동으로 쿼리를 무효화
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { SSEClient, type SSEClientOptions } from '@/lib/sse/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  type SSEEventType,
  type SSEEvent,
  getQueriesToInvalidate,
} from '@/lib/sse/events';

// ============================================================================
// Context
// ============================================================================

interface SSEContextValue {
  isConnected: boolean;
  reconnectAttempt: number;
  client: SSEClient | null;
}

const SSEContext = createContext<SSEContextValue>({
  isConnected: false,
  reconnectAttempt: 0,
  client: null,
});

// ============================================================================
// Provider Props
// ============================================================================

interface SSEProviderProps {
  children: React.ReactNode;
  enabled?: boolean; // SSE 활성화 여부
}

// ============================================================================
// SSE Provider Component
// ============================================================================

export function SSEProvider({ children, enabled = true }: SSEProviderProps) {
  const queryClient = useQueryClient();
  const { userId } = useCurrentUser();
  const clientRef = useRef<SSEClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !userId) {
      console.log('[SSE Provider] Disabled or no user ID');
      return;
    }

    console.log('[SSE Provider] Initializing SSE connection for user:', userId);

    // SSE 클라이언트 생성
    const options: SSEClientOptions = {
      url: '/api/sse',
      headers: {
        userId: userId,
      },
      reconnect: true,
      reconnectDelay: 3000,
      maxReconnectAttempts: 10,
      onOpen: () => {
        console.log('✅ [SSE Provider] Connected');
        setIsConnected(true);
        setReconnectAttempt(0);
      },
      onClose: () => {
        console.log('🔌 [SSE Provider] Disconnected');
        setIsConnected(false);
      },
      onError: (error) => {
        console.error('❌ [SSE Provider] Error:', error);
        setIsConnected(false);
      },
      onReconnect: (attempt) => {
        console.log(`🔄 [SSE Provider] Reconnecting... (attempt ${attempt})`);
        setReconnectAttempt(attempt);
      },
    };

    const client = new SSEClient(options);
    clientRef.current = client;

    // ========================================================================
    // 중앙 집중식 이벤트 핸들러
    // ========================================================================

    /**
     * 모든 SSE 이벤트를 처리하는 중앙 핸들러
     */
    const matchesQueryKey = (targetKey: string, currentKey: QueryKey) => {
      if (!Array.isArray(currentKey) || currentKey.length === 0) {
        return false;
      }

      const [pathSegment] = currentKey;

      if (typeof pathSegment === 'string') {
        return pathSegment === targetKey;
      }

      if (Array.isArray(pathSegment)) {
        const joined = pathSegment.join('.');
        return joined === targetKey;
      }

      return false;
    };

    const handleSSEEvent = (eventType: SSEEventType) => (event: MessageEvent) => {
      try {
        const parsedData: SSEEvent = JSON.parse(event.data);
        console.log(`📡 [SSE Provider] Received ${eventType}:`, parsedData);

        // 해당 이벤트와 관련된 쿼리 무효화
        const queriesToInvalidate = getQueriesToInvalidate(eventType);

        if (queriesToInvalidate.length > 0) {
          console.log(`🔄 [SSE Provider] Invalidating queries:`, queriesToInvalidate);

          queriesToInvalidate.forEach(queryKey => {
            queryClient.invalidateQueries({
              predicate: ({ queryKey: currentKey }) => matchesQueryKey(queryKey, currentKey),
            });
          });
        }

        // 커스텀 이벤트 발행 (다른 컴포넌트에서 감지 가능)
        window.dispatchEvent(
          new CustomEvent(`sse:${eventType}`, { detail: parsedData })
        );
      } catch (error) {
        console.error(`[SSE Provider] Error handling ${eventType}:`, error);
      }
    };

    // ========================================================================
    // 이벤트 리스너 등록
    // ========================================================================

    // Schedule 이벤트
    client.on('schedule.published', handleSSEEvent('schedule.published'));
    client.on('schedule.updated', handleSSEEvent('schedule.updated'));
    client.on('schedule.generated', handleSSEEvent('schedule.generated'));
    client.on('schedule.archived', handleSSEEvent('schedule.archived'));
    client.on('schedule.deleted', handleSSEEvent('schedule.deleted'));
    client.on('schedule.version_updated', handleSSEEvent('schedule.version_updated'));

    // Staff 이벤트
    client.on('staff.created', handleSSEEvent('staff.created'));
    client.on('staff.updated', handleSSEEvent('staff.updated'));
    client.on('staff.deleted', handleSSEEvent('staff.deleted'));
    client.on('staff.career_updated', handleSSEEvent('staff.career_updated'));
    client.on('staff.preferences_updated', handleSSEEvent('staff.preferences_updated'));

    // Team 이벤트
    client.on('team.created', handleSSEEvent('team.created'));
    client.on('team.updated', handleSSEEvent('team.updated'));
    client.on('team.deleted', handleSSEEvent('team.deleted'));
    client.on('team.member_added', handleSSEEvent('team.member_added'));
    client.on('team.member_removed', handleSSEEvent('team.member_removed'));

    // Config 이벤트
    client.on('config.updated', handleSSEEvent('config.updated'));
    client.on('config.shift_types_updated', handleSSEEvent('config.shift_types_updated'));
    client.on('config.constraints_updated', handleSSEEvent('config.constraints_updated'));

    // Swap 이벤트 (이미 구현됨, 추가 처리)
    client.on('swap.requested', handleSSEEvent('swap.requested'));
    client.on('swap.approved', handleSSEEvent('swap.approved'));
    client.on('swap.rejected', handleSSEEvent('swap.rejected'));

    // Handoff 이벤트 (이미 구현됨, 추가 처리)
    client.on('handoff.submitted', handleSSEEvent('handoff.submitted'));
    client.on('handoff.completed', handleSSEEvent('handoff.completed'));
    client.on('handoff.critical_patient', handleSSEEvent('handoff.critical_patient'));

    // Notification 이벤트
    client.on('notification', handleSSEEvent('notification'));

    // 연결 시작
    client.connect();

    // Cleanup
    return () => {
      console.log('[SSE Provider] Cleaning up SSE connection');
      client.disconnect();
      clientRef.current = null;
    };
  }, [enabled, userId, queryClient]);

  // ========================================================================
  // Background Refetch on Focus (SSE 백업)
  // ========================================================================
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isConnected) {
        console.log('👁️ [SSE Provider] Tab focused - refreshing critical queries');

        // 주요 쿼리 갱신
        queryClient.invalidateQueries({ queryKey: ['schedule'] });
        queryClient.invalidateQueries({ queryKey: ['staff'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isConnected, queryClient]);

  // ========================================================================
  // Context Value
  // ========================================================================
  const value: SSEContextValue = {
    isConnected,
    reconnectAttempt,
    client: clientRef.current,
  };

  return (
    <SSEContext.Provider value={value}>
      {children}

      {/* SSE 연결 상태 인디케이터 (개발 환경) */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: isConnected ? '#10b981' : '#ef4444',
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: 9999,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          {isConnected ? '🟢 SSE Connected' : '🔴 SSE Disconnected'}
          {reconnectAttempt > 0 && ` (Attempt ${reconnectAttempt})`}
        </div>
      )}
    </SSEContext.Provider>
  );
}

// ============================================================================
// Custom Hook
// ============================================================================

/**
 * SSE 컨텍스트 사용 훅
 */
export function useSSEContext() {
  const context = useContext(SSEContext);

  if (!context) {
    throw new Error('useSSEContext must be used within SSEProvider');
  }

  return context;
}

/**
 * 특정 SSE 이벤트 구독 훅
 */
export function useSSEEvent<T extends SSEEventType>(
  eventType: T,
  handler: (event: CustomEvent<SSEEvent<T>>) => void
) {
  useEffect(() => {
    const eventHandler = (event: Event) => {
      handler(event as CustomEvent<SSEEvent<T>>);
    };

    window.addEventListener(`sse:${eventType}`, eventHandler);
    return () => window.removeEventListener(`sse:${eventType}`, eventHandler);
  }, [eventType, handler]);
}
