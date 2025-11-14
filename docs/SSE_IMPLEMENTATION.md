# SSE (Server-Sent Events) 중앙 집중식 구현 가이드

## 📋 목차

1. [개요](#개요)
2. [아키텍처](#아키텍처)
3. [구현 상세](#구현-상세)
4. [사용 방법](#사용-방법)
5. [테스트 가이드](#테스트-가이드)
6. [문제 해결](#문제-해결)

---

## 개요

ShiftEasy 프로젝트에서 실시간 데이터 동기화를 위한 중앙 집중식 SSE 시스템을 구현했습니다.

### 해결한 문제

**이전 문제점**:
- 데이터 변경 시 캐시는 무효화되지만 UI가 새로고침 없이 업데이트되지 않음
- 여러 탭/페이지를 열어놓은 경우 데이터 불일치 발생
- SSE 로직이 분산되어 관리가 어려움

**해결 방법**:
- 중앙 집중식 SSE 이벤트 시스템 구축
- 모든 뮤테이션에서 자동으로 SSE 이벤트 브로드캐스트
- React Query 자동 무효화를 통한 실시간 UI 업데이트

### 주요 기능

✅ **실시간 크로스 페이지 동기화**: 여러 탭에서 동시에 데이터 업데이트 반영
✅ **타입 안전성**: TypeScript로 모든 이벤트 타입 정의
✅ **자동 쿼리 무효화**: 이벤트별로 관련 쿼리 자동 갱신
✅ **중앙 관리**: 모든 SSE 로직을 한 곳에서 관리
✅ **재연결 자동화**: 연결 끊김 시 자동 재연결 (최대 10회)

---

## 아키텍처

### 3계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    클라이언트 계층                            │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        SSEProvider (전역 프로바이더)                  │  │
│  │  - SSE 연결 관리                                      │  │
│  │  - 이벤트 자동 구독                                   │  │
│  │  - React Query 자동 무효화                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓ SSE 이벤트 수신                 │
└─────────────────────────────────────────────────────────────┘
                             ↕
┌─────────────────────────────────────────────────────────────┐
│                    서버 계층                                 │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        broadcaster.ts (브로드캐스팅 계층)             │  │
│  │  - 중앙 SSE 브로드캐스터                              │  │
│  │  - 도메인별 헬퍼 함수                                 │  │
│  │    • sse.schedule.*                                   │  │
│  │    • sse.staff.*                                      │  │
│  │    • sse.team.*                                       │  │
│  │    • sse.config.*                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↑                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        events.ts (이벤트 정의 계층)                   │  │
│  │  - 타입 안전 이벤트 정의                              │  │
│  │  - 이벤트 → 쿼리 매핑                                 │  │
│  │  - 20+ SSE 이벤트 타입                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↑                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │    Mutation Routers (데이터 변경 계층)                │  │
│  │  - schedule.ts (5개 뮤테이션)                         │  │
│  │  - staff.ts (3개 뮤테이션)                            │  │
│  │  - teams.ts (3개 뮤테이션)                            │  │
│  │  - configs.ts (2개 뮤테이션)                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 구현 상세

### 1. 이벤트 정의 계층 (`/src/lib/sse/events.ts`)

#### SSE 이벤트 타입 정의

```typescript
export type SSEEventType =
  // Schedule 이벤트
  | 'schedule.published'
  | 'schedule.updated'
  | 'schedule.generated'
  | 'schedule.archived'
  | 'schedule.deleted'
  | 'schedule.version_updated'

  // Staff 이벤트
  | 'staff.created'
  | 'staff.updated'
  | 'staff.deleted'
  | 'staff.career_updated'

  // Team 이벤트
  | 'team.created'
  | 'team.updated'
  | 'team.deleted'
  | 'team.member_added'
  | 'team.member_removed'

  // Config 이벤트
  | 'config.updated'
  | 'config.shift_types_updated'
  | 'config.constraints_updated'

  // 기타 이벤트
  | 'swap.requested'
  | 'swap.approved'
  | 'swap.rejected'
  | 'handoff.submitted'
  | 'handoff.completed'
  | 'handoff.critical_patient'
  | 'notification';
```

#### 이벤트 페이로드 타입

```typescript
export interface SSEEventPayload {
  'schedule.published': {
    scheduleId: string;
    departmentId?: string;
    startDate: Date | string;
    endDate: Date | string;
    publishedBy: string;
  };

  'staff.updated': {
    userId: string;
    departmentId?: string;
    fields: string[];
    changes?: Record<string, unknown>;
  };

  'staff.career_updated': {
    userId: string;
    departmentId?: string;
    careerInfo: {
      hireYear?: number;
      yearsOfService?: number;
    };
  };

  // ... 나머지 이벤트 페이로드
}
```

#### 자동 쿼리 무효화 매핑

```typescript
export const EVENT_TO_QUERIES_MAP: Record<SSEEventType, string[]> = {
  'schedule.published': [
    'schedule.list',
    'schedule.get',
    'schedule.getPageData',
    'schedule.getMonthlySchedule',
    'staff.list',
    'notifications',
  ],

  'staff.updated': [
    'staff.list',
    'staff.get',
    'schedule.getPageData',
  ],

  'staff.career_updated': [
    'staff.list',
    'staff.get',
    'schedule.getPageData',
  ],

  // ... 나머지 매핑
};
```

### 2. 브로드캐스팅 계층 (`/src/lib/sse/broadcaster.ts`)

#### 중앙 SSE 브로드캐스터

```typescript
class SSEBroadcaster {
  /**
   * SSE 이벤트 브로드캐스트 (모든 연결된 클라이언트에게)
   */
  broadcast<T extends SSEEventType>(
    eventType: T,
    payload: SSEEventPayload[T],
    options?: {
      userId?: string;
      tenantId?: string;
      filterFn?: (clientId: string) => boolean;
    }
  ): void {
    const event = createSSEEvent(eventType, payload, {
      userId: options?.userId,
      tenantId: options?.tenantId,
    });

    console.log(`[SSE Broadcaster] Broadcasting ${eventType}`, {
      userId: options?.userId,
      tenantId: options?.tenantId,
      payload,
    });

    sseManager.broadcast(event, options?.filterFn);
  }

  /**
   * 특정 사용자에게만 SSE 이벤트 전송
   */
  sendToUser<T extends SSEEventType>(
    userId: string,
    eventType: T,
    payload: SSEEventPayload[T],
    options?: { tenantId?: string; }
  ): void {
    const event = createSSEEvent(eventType, payload, {
      userId,
      tenantId: options?.tenantId,
    });

    const clientIds = sseManager.getClientIdsByUserId(userId);
    clientIds.forEach(clientId => {
      sseManager.sendToClient(clientId, event);
    });
  }
}
```

#### 도메인별 헬퍼 함수

```typescript
// Schedule SSE 헬퍼
export const scheduleSSE = {
  published: (scheduleId: string, data: {...}) => { ... },
  updated: (scheduleId: string, data: {...}) => { ... },
  generated: (scheduleId: string, data: {...}) => { ... },
  archived: (scheduleId: string, data: {...}) => { ... },
  deleted: (scheduleId: string, data: {...}) => { ... },
  versionUpdated: (scheduleId: string, data: {...}) => { ... },
};

// Staff SSE 헬퍼
export const staffSSE = {
  created: (userId: string, data: {...}) => { ... },
  updated: (userId: string, data: {...}) => { ... },
  deleted: (userId: string, data: {...}) => { ... },
  careerUpdated: (userId: string, data: {...}) => { ... },
};

// Team SSE 헬퍼
export const teamSSE = {
  created: (teamId: string, data: {...}) => { ... },
  updated: (teamId: string, data: {...}) => { ... },
  deleted: (teamId: string, data: {...}) => { ... },
  memberAdded: (teamId: string, userId: string, data: {...}) => { ... },
  memberRemoved: (teamId: string, userId: string, data: {...}) => { ... },
};

// Config SSE 헬퍼
export const configSSE = {
  updated: (configKey: string, data: {...}) => { ... },
  shiftTypesUpdated: (data: {...}) => { ... },
  constraintsUpdated: (data: {...}) => { ... },
};

// 통합 Export
export const sse = {
  broadcaster: sseBroadcaster,
  schedule: scheduleSSE,
  staff: staffSSE,
  team: teamSSE,
  config: configSSE,
};
```

### 3. 프로바이더 계층 (`/src/providers/SSEProvider.tsx`)

#### 전역 SSE 프로바이더

```typescript
export function SSEProvider({ children, enabled = true }: SSEProviderProps) {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const clientRef = useRef<SSEClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !user?.id) {
      console.log('[SSE Provider] Disabled or no user ID');
      return;
    }

    console.log('[SSE Provider] Initializing SSE connection for user:', user.id);

    // SSE 클라이언트 생성
    const client = new SSEClient({
      url: '/api/sse',
      headers: { userId: user.id },
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
    });

    clientRef.current = client;

    // 중앙 집중식 이벤트 핸들러
    const handleSSEEvent = (eventType: SSEEventType) => (event: MessageEvent) => {
      try {
        const parsedData: SSEEvent = JSON.parse(event.data);
        console.log(`📡 [SSE Provider] Received ${eventType}:`, parsedData);

        // 해당 이벤트와 관련된 쿼리 무효화
        const queriesToInvalidate = getQueriesToInvalidate(eventType);

        if (queriesToInvalidate.length > 0) {
          console.log(`🔄 [SSE Provider] Invalidating queries:`, queriesToInvalidate);

          queriesToInvalidate.forEach(queryKey => {
            queryClient.invalidateQueries({ queryKey: [queryKey] });
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

    // 모든 이벤트 리스너 등록
    client.on('schedule.published', handleSSEEvent('schedule.published'));
    client.on('schedule.updated', handleSSEEvent('schedule.updated'));
    client.on('schedule.generated', handleSSEEvent('schedule.generated'));
    client.on('staff.created', handleSSEEvent('staff.created'));
    client.on('staff.updated', handleSSEEvent('staff.updated'));
    client.on('staff.career_updated', handleSSEEvent('staff.career_updated'));
    client.on('team.created', handleSSEEvent('team.created'));
    client.on('team.updated', handleSSEEvent('team.updated'));
    client.on('config.updated', handleSSEEvent('config.updated'));
    // ... 20+ 이벤트 리스너

    // 연결 시작
    client.connect();

    // Cleanup
    return () => {
      console.log('[SSE Provider] Cleaning up SSE connection');
      client.disconnect();
      clientRef.current = null;
    };
  }, [enabled, user?.id, queryClient]);

  // 포커스 시 자동 갱신 (SSE 백업)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isConnected) {
        console.log('👁️ [SSE Provider] Tab focused - refreshing critical queries');

        queryClient.invalidateQueries({ queryKey: ['schedule'] });
        queryClient.invalidateQueries({ queryKey: ['staff'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isConnected, queryClient]);

  return (
    <SSEContext.Provider value={{ isConnected, reconnectAttempt, client: clientRef.current }}>
      {children}

      {/* 개발 환경 연결 상태 인디케이터 */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
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
        }}>
          {isConnected ? '🟢 SSE Connected' : '🔴 SSE Disconnected'}
          {reconnectAttempt > 0 && ` (Attempt ${reconnectAttempt})`}
        </div>
      )}
    </SSEContext.Provider>
  );
}
```

### 4. 뮤테이션 라우터 통합

#### Schedule Router (`/src/server/api/routers/schedule.ts`)

```typescript
import { sse } from '@/lib/sse/broadcaster';
import { notificationService } from '@/lib/notifications/notification-service';
import { format } from 'date-fns';

export const scheduleRouter = createTRPCRouter({
  // 스케줄 생성
  generate: protectedProcedure
    .input(z.object({ ... }))
    .mutation(async ({ ctx, input }) => {
      // ... 스케줄 생성 로직

      // ✅ SSE: 스케줄 생성 이벤트 브로드캐스트
      sse.schedule.generated(schedule.id, {
        departmentId: input.departmentId,
        generatedBy: ctx.user?.id || 'system',
        tenantId,
      });

      return schedule;
    }),

  // 스케줄 확정
  publish: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // ... 스케줄 확정 로직

      // ✅ SSE: 스케줄 확정 이벤트 브로드캐스트
      sse.schedule.published(schedule.id, {
        departmentId: schedule.departmentId,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        publishedBy: ctx.user?.id || 'dev-user-id',
        tenantId,
      });

      // ✅ 알림: 해당 부서의 모든 사용자에게 알림 전송
      if (schedule.departmentId) {
        await notificationService.sendToTopic(
          tenantId,
          `department:${schedule.departmentId}`,
          {
            type: 'schedule_published',
            priority: 'high',
            title: '새로운 스케줄이 확정되었습니다',
            message: `${format(schedule.startDate, 'yyyy년 M월')} 스케줄이 확정되었습니다.`,
            actionUrl: '/schedule',
            departmentId: schedule.departmentId,
            data: { scheduleId: schedule.id },
          }
        );
      }

      return schedule;
    }),

  // 스케줄 아카이브
  archive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // ... 아카이브 로직

      // ✅ SSE: 스케줄 아카이브 이벤트 브로드캐스트
      sse.schedule.archived(input.id, {
        departmentId: schedule.departmentId,
        tenantId: ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d',
      });

      return schedule;
    }),

  // 스케줄 삭제
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // ... 삭제 로직

      // ✅ SSE: 스케줄 삭제 이벤트 브로드캐스트
      sse.schedule.deleted(input.id, {
        departmentId: schedule.departmentId,
        tenantId,
      });

      return { success: true };
    }),

  // 스케줄 버전 증가
  incrementVersion: protectedProcedure
    .input(z.object({
      scheduleId: z.string(),
      reason: z.string(),
      changes: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // ... 버전 증가 로직

      // ✅ SSE: 스케줄 버전 업데이트 이벤트 브로드캐스트
      sse.schedule.versionUpdated(input.scheduleId, {
        version: newVersion,
        reason: input.reason,
        changes: input.changes,
        tenantId,
      });

      return { newVersion };
    }),
});
```

#### Staff Router (`/src/server/api/routers/staff.ts`)

```typescript
import { sse } from '@/lib/sse/broadcaster';

export const staffRouter = createTRPCRouter({
  // 직원 생성
  create: adminProcedure
    .input(z.object({ ... }))
    .mutation(async ({ ctx, input }) => {
      // ... 직원 생성 로직

      // ✅ SSE: 직원 생성 이벤트 브로드캐스트
      sse.staff.created(user.id, {
        departmentId: input.departmentId,
        name: input.name,
        role: input.role,
        tenantId: ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d',
      });

      return user;
    }),

  // 직원 정보 업데이트
  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      hireDate: z.date().nullable().optional(),
      yearsOfService: z.number().optional(),
      // ... 기타 필드
    }))
    .mutation(async ({ ctx, input }) => {
      // ... 업데이트 로직

      // ✅ SSE: 직원 정보 업데이트 이벤트 브로드캐스트
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const updatedFields = Object.keys(updateData);

      sse.staff.updated(id, {
        departmentId: after.departmentId,
        fields: updatedFields,
        changes: updateData,
        tenantId,
      });

      // ✅ 경력 정보 업데이트인 경우 별도 이벤트 전송
      if (input.hireDate || input.yearsOfService) {
        sse.staff.careerUpdated(id, {
          departmentId: after.departmentId,
          careerInfo: {
            hireYear: input.hireDate ? new Date(input.hireDate).getFullYear() : undefined,
            yearsOfService: input.yearsOfService,
          },
          tenantId,
        });
      }

      return after;
    }),

  // 직원 비활성화
  deactivate: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // ... 비활성화 로직

      // ✅ SSE: 직원 비활성화 이벤트 브로드캐스트 (deleted로 처리)
      sse.staff.deleted(input.id, {
        departmentId: updated.departmentId,
        tenantId: ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d',
      });

      return updated;
    }),
});
```

#### Teams Router (`/src/server/api/routers/teams.ts`)

```typescript
import { sse } from '@/lib/sse/broadcaster';

export const teamsRouter = createTRPCRouter({
  // 팀 생성
  create: protectedProcedure
    .input(z.object({ ... }))
    .mutation(async ({ ctx, input }) => {
      // ... 팀 생성 로직

      // ✅ SSE: 팀 생성 이벤트 브로드캐스트
      sse.team.created(result[0].id, {
        departmentId: input.departmentId,
        name: input.name,
        tenantId,
      });

      return result[0];
    }),

  // 팀 업데이트
  update: protectedProcedure
    .input(z.object({ ... }))
    .mutation(async ({ ctx, input }) => {
      // ... 업데이트 로직

      // ✅ SSE: 팀 업데이트 이벤트 브로드캐스트
      sse.team.updated(input.id, {
        departmentId: result[0].departmentId,
        changes: updateData,
        tenantId,
      });

      return result[0];
    }),

  // 팀 삭제
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // ... 삭제 로직 (소프트 삭제)

      // ✅ SSE: 팀 삭제 이벤트 브로드캐스트
      sse.team.deleted(input.id, {
        departmentId: result[0].departmentId,
        tenantId,
      });

      return result[0];
    }),
});
```

#### Configs Router (`/src/server/api/routers/configs.ts`)

```typescript
import { sse } from '@/lib/sse/broadcaster';

export const configsRouter = createTRPCRouter({
  // 설정 저장 (생성/업데이트)
  set: protectedProcedure
    .input(z.object({
      configKey: z.string(),
      configValue: z.any(),
      departmentId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId || '3760b5ec-462f-443c-9a90-4a2b2e295e9d';
      const departmentId = input.departmentId ?? ctx.user?.departmentId ?? null;

      // ... 생성/업데이트 로직

      // ✅ SSE: 설정 업데이트 이벤트 브로드캐스트
      const category = input.configKey.includes('shift') ? 'shift_types' :
                      input.configKey.includes('contract') ? 'contract_types' :
                      input.configKey.includes('position') ? 'positions' : 'general';

      sse.config.updated(input.configKey, {
        departmentId: departmentId || undefined,
        category,
        tenantId,
      });

      // ✅ 시프트 타입 업데이트인 경우 별도 이벤트 전송
      if (input.configKey === 'shift_types') {
        sse.config.shiftTypesUpdated({
          departmentId: departmentId || undefined,
          shiftTypes: input.configValue,
          tenantId,
        });
      }

      return result[0];
    }),

  // 설정 삭제
  delete: protectedProcedure
    .input(z.object({
      configKey: z.string(),
      departmentId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // ... 삭제 로직

      // ✅ SSE: 설정 삭제 이벤트 브로드캐스트
      const category = input.configKey.includes('shift') ? 'shift_types' :
                      input.configKey.includes('contract') ? 'contract_types' :
                      input.configKey.includes('position') ? 'positions' : 'general';

      sse.config.updated(input.configKey, {
        departmentId: input.departmentId,
        category,
        tenantId,
      });

      return { success: true };
    }),
});
```

### 5. 루트 레이아웃 통합 (`/src/app/layout.tsx`)

```typescript
import { SSEProvider } from "@/providers/SSEProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseProvider>
      <html lang="ko" suppressHydrationWarning>
        <body>
          <ErrorBoundary>
            <TRPCProvider>
              <I18nProvider>
                <SSEProvider>  {/* ← SSE 프로바이더 추가 */}
                  <ThemeProvider>
                    <NavigationHeader />
                    {children}
                  </ThemeProvider>
                </SSEProvider>
              </I18nProvider>
            </TRPCProvider>
          </ErrorBoundary>
        </body>
      </html>
    </SupabaseProvider>
  );
}
```

---

## 사용 방법

### 서버 측 (라우터에서 SSE 이벤트 발송)

#### 기본 사용법

```typescript
import { sse } from '@/lib/sse/broadcaster';

// 1. 임포트 추가
// 2. 뮤테이션 성공 후 SSE 이벤트 발송

// Schedule 이벤트 예시
sse.schedule.published(scheduleId, {
  departmentId: 'dept-123',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  publishedBy: 'user-456',
  tenantId: 'tenant-789',
});

// Staff 이벤트 예시
sse.staff.updated(userId, {
  departmentId: 'dept-123',
  fields: ['name', 'position'],
  changes: { name: '홍길동', position: 'RN' },
  tenantId: 'tenant-789',
});

// 경력 정보 업데이트 시 별도 이벤트
sse.staff.careerUpdated(userId, {
  departmentId: 'dept-123',
  careerInfo: {
    hireYear: 2020,
    yearsOfService: 5,
  },
  tenantId: 'tenant-789',
});

// Team 이벤트 예시
sse.team.created(teamId, {
  departmentId: 'dept-123',
  name: '응급실팀',
  tenantId: 'tenant-789',
});

// Config 이벤트 예시
sse.config.updated('shift_types', {
  departmentId: 'dept-123',
  category: 'shift_types',
  tenantId: 'tenant-789',
});

sse.config.shiftTypesUpdated({
  departmentId: 'dept-123',
  shiftTypes: [{ code: 'D', name: '주간', ... }],
  tenantId: 'tenant-789',
});
```

#### 새로운 이벤트 추가 방법

```typescript
// 1. /src/lib/sse/events.ts에 이벤트 타입 추가
export type SSEEventType =
  | 'existing.event'
  | 'new.event_name';  // ← 새 이벤트 추가

// 2. 페이로드 타입 정의
export interface SSEEventPayload {
  // ... 기존 페이로드
  'new.event_name': {
    eventId: string;
    data: SomeDataType;
    // ... 필요한 필드
  };
}

// 3. 쿼리 매핑 추가
export const EVENT_TO_QUERIES_MAP: Record<SSEEventType, string[]> = {
  // ... 기존 매핑
  'new.event_name': [
    'query.to.invalidate1',
    'query.to.invalidate2',
  ],
};

// 4. /src/lib/sse/broadcaster.ts에 헬퍼 함수 추가
export const newDomainSSE = {
  eventName: (eventId: string, data: {...}) => {
    sseBroadcaster.broadcast('new.event_name', {
      eventId,
      ...data,
    }, { tenantId: data.tenantId });
  },
};

export const sse = {
  // ... 기존 도메인
  newDomain: newDomainSSE,  // ← 새 도메인 추가
};

// 5. /src/providers/SSEProvider.tsx에 이벤트 리스너 등록
client.on('new.event_name', handleSSEEvent('new.event_name'));
```

### 클라이언트 측 (자동 처리됨)

#### 기본 동작 (자동)

SSEProvider가 전역으로 적용되어 있으므로 별도의 코드 없이 자동으로 실시간 업데이트됩니다:

```typescript
// tRPC 쿼리를 사용하는 모든 컴포넌트는 자동으로 업데이트
const { data: staff } = api.staff.list.useQuery({ departmentId: 'dept-123' });

// 다른 탭에서 staff.update 뮤테이션 실행
// → SSE 이벤트 수신
// → staff.list 쿼리 자동 무효화
// → 컴포넌트 자동 리렌더링 (새 데이터 표시)
```

#### 특정 SSE 이벤트 구독 (선택사항)

특정 이벤트에 커스텀 로직을 추가하려면:

```typescript
import { useSSEEvent } from '@/providers/SSEProvider';

function MyComponent() {
  // 특정 SSE 이벤트에 반응
  useSSEEvent('staff.career_updated', (event) => {
    console.log('경력 정보 업데이트:', event.detail);

    // 커스텀 로직 (예: 토스트 알림)
    toast.success(`${event.detail.userId}의 경력 정보가 업데이트되었습니다`);
  });

  return <div>...</div>;
}
```

#### SSE 연결 상태 확인

```typescript
import { useSSEContext } from '@/providers/SSEProvider';

function ConnectionStatus() {
  const { isConnected, reconnectAttempt } = useSSEContext();

  return (
    <div>
      상태: {isConnected ? '연결됨' : '연결 끊김'}
      {reconnectAttempt > 0 && ` (재연결 시도 ${reconnectAttempt})`}
    </div>
  );
}
```

---

## 테스트 가이드

### 개발 환경 테스트

#### 1. SSE 연결 상태 확인

개발 모드(`npm run dev`)에서 실행하면 우측 하단에 SSE 연결 상태 인디케이터가 표시됩니다:

- **🟢 SSE Connected**: 정상 연결
- **🔴 SSE Disconnected**: 연결 끊김
- **🔴 SSE Disconnected (Attempt N)**: 재연결 시도 중

#### 2. 브라우저 콘솔 확인

```bash
# 연결 성공 시
✅ [SSE Provider] Connected

# 이벤트 수신 시
📡 [SSE Provider] Received staff.updated: { userId: "...", ... }
🔄 [SSE Provider] Invalidating queries: ['staff.list', 'staff.get', 'schedule.getPageData']

# 재연결 시
🔄 [SSE Provider] Reconnecting... (attempt 1)
```

#### 3. 크로스 페이지 동기화 테스트

**테스트 시나리오 1: 경력 정보 업데이트**

1. **탭 A**: 부서원 관리 페이지 (`/departments`) 열기
2. **탭 B**: 직원 선호사항 페이지 (`/preferences`) 열기
3. **탭 A**에서 직원 카드 클릭 → 경력 정보 수정 (입사일, 경력년수)
4. **탭 B**에서 새로고침 없이 즉시 경력 정보 업데이트 확인

**테스트 시나리오 2: 스케줄 확정**

1. **탭 A**: 스케줄 생성 페이지 열기
2. **탭 B**: 스케줄 조회 페이지 열기
3. **탭 C**: 알림 센터 열기
4. **탭 A**에서 스케줄 확정 버튼 클릭
5. **탭 B**에서 새로고침 없이 확정된 스케줄 표시 확인
6. **탭 C**에서 새로고침 없이 알림 수신 확인

**테스트 시나리오 3: 팀 생성/수정/삭제**

1. **탭 A**: 팀 관리 페이지 열기
2. **탭 B**: 스케줄 페이지 열기 (팀 정보 표시됨)
3. **탭 A**에서 팀 생성/수정/삭제
4. **탭 B**에서 새로고침 없이 팀 정보 업데이트 확인

**테스트 시나리오 4: 설정 변경**

1. **탭 A**: 설정 페이지 열기
2. **탭 B**: 스케줄 페이지 열기
3. **탭 A**에서 시프트 타입 변경 (예: 주간 근무 색상 변경)
4. **탭 B**에서 새로고침 없이 변경된 시프트 타입 반영 확인

#### 4. 네트워크 재연결 테스트

1. 브라우저 개발자 도구 열기 (F12)
2. Network 탭 → Throttling → Offline 선택
3. SSE 연결 끊김 확인 (🔴 SSE Disconnected)
4. Throttling → No throttling 선택
5. 자동 재연결 확인 (🟢 SSE Connected)

### 프로덕션 환경 테스트

#### 1. 성능 테스트

```bash
# SSE 연결 수 모니터링
# 서버 로그 확인
[SSE Manager] Client connected: client-123 (total: 50)
[SSE Manager] Broadcasting event to 50 clients

# 응답 시간 측정
# 뮤테이션 실행 → SSE 이벤트 수신 → 쿼리 무효화 → UI 업데이트
# 목표: 1초 이내
```

#### 2. 부하 테스트

```typescript
// 동시 접속자 시뮬레이션
// 100명의 사용자가 동시에 데이터 수정
// SSE 이벤트 브로드캐스트 성능 확인
```

#### 3. 장애 복구 테스트

```bash
# 서버 재시작 시나리오
1. 서버 중단
2. 클라이언트 자동 재연결 시도 (최대 10회)
3. 서버 재시작
4. 클라이언트 자동 재연결 성공
5. 기존 쿼리 자동 갱신
```

---

## 문제 해결

### 문제 1: SSE 연결이 되지 않음

**증상**:
- 🔴 SSE Disconnected 상태 유지
- 콘솔에 연결 에러 로그

**원인 및 해결**:

1. **사용자 ID 없음**
   ```typescript
   // 확인: useCurrentUser 훅이 올바른 user 반환하는지 확인
   const { user } = useCurrentUser();
   console.log('User:', user);  // null이면 문제
   ```
   **해결**: Supabase Auth 인증 상태 확인, 로그인 필요

2. **SSE 엔드포인트 오류**
   ```bash
   # 확인: /api/sse 엔드포인트가 정상 작동하는지
   curl http://localhost:3000/api/sse
   ```
   **해결**: `/src/app/api/sse/route.ts` 파일 확인

3. **CORS 문제 (프로덕션)**
   ```typescript
   // next.config.js에 CORS 설정 추가
   async headers() {
     return [
       {
         source: '/api/sse',
         headers: [
           { key: 'Access-Control-Allow-Origin', value: '*' },
           { key: 'Access-Control-Allow-Methods', value: 'GET' },
           { key: 'Cache-Control', value: 'no-cache' },
         ],
       },
     ];
   }
   ```

### 문제 2: 이벤트 수신되지만 UI 업데이트 안 됨

**증상**:
- 콘솔에 `📡 Received staff.updated` 로그 표시
- 콘솔에 `🔄 Invalidating queries` 로그 표시
- UI는 업데이트되지 않음

**원인 및 해결**:

1. **쿼리 키 불일치**
   ```typescript
   // 확인: 컴포넌트에서 사용하는 쿼리 키와
   // EVENT_TO_QUERIES_MAP의 쿼리 키가 일치하는지 확인

   // 컴포넌트
   const { data } = api.staff.list.useQuery({ departmentId: 'dept-123' });

   // events.ts
   'staff.updated': [
     'staff.list',  // ← 일치해야 함
     'staff.get',
   ]
   ```
   **해결**: 쿼리 키 일치시키기

2. **React Query 캐시 설정 문제**
   ```typescript
   // TRPCProvider에서 staleTime 설정 확인
   staleTime: 2 * 60 * 1000,  // 2분 캐시

   // 너무 긴 staleTime은 무효화가 작동해도
   // 데이터가 여전히 "신선"하다고 판단할 수 있음
   ```
   **해결**: staleTime 조정 또는 `refetchOnMount: true` 설정

3. **컴포넌트가 마운트되지 않음**
   ```typescript
   // 조건부 렌더링으로 컴포넌트가 마운트되지 않은 경우
   {isVisible && <StaffList />}  // isVisible이 false면 쿼리 실행 안 됨
   ```
   **해결**: 쿼리를 상위 컴포넌트로 이동

### 문제 3: 너무 많은 재렌더링

**증상**:
- UI가 계속 깜빡임
- 네트워크 탭에 과도한 요청
- 콘솔에 무한 쿼리 무효화 로그

**원인 및 해결**:

1. **순환 이벤트**
   ```typescript
   // 잘못된 패턴: 쿼리 결과로 뮤테이션 실행 → SSE 이벤트 → 쿼리 무효화 → 다시 뮤테이션
   useEffect(() => {
     if (data) {
       updateMutation.mutate({ ... });  // ← 위험!
     }
   }, [data]);
   ```
   **해결**: useEffect 의존성 배열 확인, 조건 추가

2. **너무 광범위한 쿼리 무효화**
   ```typescript
   // events.ts에서 불필요한 쿼리까지 무효화
   'staff.updated': [
     'staff',  // ← 모든 staff 관련 쿼리 무효화 (너무 광범위)
   ]
   ```
   **해결**: 구체적인 쿼리 키 사용
   ```typescript
   'staff.updated': [
     'staff.list',
     'staff.get',
     // 'staff'는 제거
   ]
   ```

### 문제 4: 특정 이벤트만 작동하지 않음

**증상**:
- 대부분의 SSE 이벤트는 작동
- 특정 이벤트(예: config.updated)만 작동하지 않음

**체크리스트**:

1. **서버 측 확인**
   ```typescript
   // 라우터에서 SSE 이벤트 발송 코드가 있는지 확인
   sse.config.updated(configKey, { ... });  // ← 이 코드가 있는가?
   ```

2. **이벤트 타입 확인**
   ```typescript
   // events.ts에 이벤트 타입이 정의되어 있는지
   export type SSEEventType =
     | 'config.updated'  // ← 있는가?
     | ...;
   ```

3. **페이로드 타입 확인**
   ```typescript
   // events.ts에 페이로드 타입이 정의되어 있는지
   export interface SSEEventPayload {
     'config.updated': {  // ← 있는가?
       configKey: string;
       departmentId?: string;
       category?: string;
     };
   }
   ```

4. **쿼리 매핑 확인**
   ```typescript
   // events.ts에 쿼리 매핑이 있는지
   export const EVENT_TO_QUERIES_MAP = {
     'config.updated': [  // ← 있는가?
       'configs.getAll',
       'configs.getByKey',
     ],
   };
   ```

5. **프로바이더 리스너 확인**
   ```typescript
   // SSEProvider.tsx에 이벤트 리스너가 등록되어 있는지
   client.on('config.updated', handleSSEEvent('config.updated'));  // ← 있는가?
   ```

### 문제 5: 개발 환경에서는 작동하지만 프로덕션에서 안 됨

**확인 사항**:

1. **환경 변수**
   ```bash
   # .env.production
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   ```

2. **SSE 타임아웃**
   ```typescript
   // 프로덕션 환경에서는 프록시/로드밸런서가
   // 긴 연결을 끊을 수 있음

   // 해결: Keep-alive 헤더 추가
   res.setHeader('Connection', 'keep-alive');
   res.setHeader('Keep-Alive', 'timeout=600');
   ```

3. **HTTPS 필수**
   ```
   프로덕션에서는 반드시 HTTPS 사용
   HTTP에서는 SSE가 제대로 작동하지 않을 수 있음
   ```

### 문제 6: 재연결이 실패함

**증상**:
- 연결 끊긴 후 재연결 시도하지만 계속 실패
- 최대 재연결 횟수(10회) 도달

**원인 및 해결**:

1. **서버 오류**
   ```bash
   # 서버 로그 확인
   tail -f logs/error.log
   ```

2. **인증 토큰 만료**
   ```typescript
   // Supabase Auth 토큰이 만료된 경우
   // 해결: 토큰 갱신 후 재연결
   ```

3. **네트워크 문제**
   ```typescript
   // reconnectDelay 조정
   const client = new SSEClient({
     reconnectDelay: 5000,  // 3초 → 5초로 증가
     maxReconnectAttempts: 20,  // 10회 → 20회로 증가
   });
   ```

---

## 모범 사례

### 1. 이벤트 네이밍 컨벤션

```typescript
// 도메인.액션 형식 사용
'schedule.published'  // ✅ 좋음
'schedule.updated'    // ✅ 좋음
'publishSchedule'     // ❌ 나쁨 (도메인 없음)
'schedule_published'  // ❌ 나쁨 (언더스코어)
```

### 2. 페이로드 설계

```typescript
// ✅ 좋은 페이로드
{
  scheduleId: string;           // 필수 식별자
  departmentId?: string;        // 필터링용
  tenantId?: string;            // 멀티테넌시
  changes?: Record<string, any>; // 상세 변경사항
}

// ❌ 나쁜 페이로드
{
  data: any;  // 타입 없음
}
```

### 3. 쿼리 무효화 최적화

```typescript
// ✅ 구체적인 쿼리만 무효화
'staff.updated': [
  'staff.list',
  'staff.get',
  'schedule.getPageData',  // staff 정보를 사용하는 다른 쿼리
]

// ❌ 모든 쿼리 무효화 (성능 저하)
'staff.updated': [
  'staff',      // 너무 광범위
  'schedule',   // 너무 광범위
]
```

### 4. 에러 처리

```typescript
// 서버 측
try {
  await db.update(...);

  // SSE 이벤트 발송
  sse.staff.updated(userId, { ... });
} catch (error) {
  // 로그 기록
  console.error('Failed to update staff:', error);

  // SSE 이벤트는 발송하지 않음 (데이터 불일치 방지)
  throw error;
}

// 클라이언트 측
const handleSSEEvent = (eventType: SSEEventType) => (event: MessageEvent) => {
  try {
    const parsedData = JSON.parse(event.data);
    // ... 처리
  } catch (error) {
    console.error(`[SSE Provider] Error handling ${eventType}:`, error);
    // 에러 로그만 남기고 계속 실행
  }
};
```

### 5. 성능 최적화

```typescript
// 1. 배치 처리
// 여러 직원을 동시에 업데이트하는 경우
const updatedUserIds = await Promise.all(
  users.map(user => updateUser(user))
);

// 단일 SSE 이벤트로 브로드캐스트
sse.staff.bulkUpdated({
  userIds: updatedUserIds,
  departmentId: 'dept-123',
  tenantId,
});

// 2. Debouncing
// 짧은 시간에 여러 이벤트 발생 시 마지막 이벤트만 처리
const debouncedInvalidate = debounce((queryKey: string) => {
  queryClient.invalidateQueries({ queryKey: [queryKey] });
}, 300);

// 3. 선택적 구독
// 현재 페이지와 관련 없는 이벤트는 무시
const handleSSEEvent = (eventType: SSEEventType) => (event: MessageEvent) => {
  // 현재 페이지가 /schedule이 아니면 schedule 이벤트 무시
  if (eventType.startsWith('schedule.') && !window.location.pathname.includes('/schedule')) {
    return;
  }

  // ... 이벤트 처리
};
```

---

## 참고 자료

### 관련 파일

- **이벤트 정의**: `/src/lib/sse/events.ts`
- **브로드캐스터**: `/src/lib/sse/broadcaster.ts`
- **프로바이더**: `/src/providers/SSEProvider.tsx`
- **SSE 클라이언트**: `/src/lib/sse/client.ts`
- **SSE 매니저**: `/src/lib/sse/sseManager.ts`
- **SSE 엔드포인트**: `/src/app/api/sse/route.ts`

### 라우터 파일

- **Schedule Router**: `/src/server/api/routers/schedule.ts`
- **Staff Router**: `/src/server/api/routers/staff.ts`
- **Teams Router**: `/src/server/api/routers/teams.ts`
- **Configs Router**: `/src/server/api/routers/configs.ts`

### 외부 문서

- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [React Query: Query Invalidation](https://tanstack.com/query/latest/docs/react/guides/query-invalidation)
- [tRPC: Subscriptions](https://trpc.io/docs/subscriptions)

---

## 요약

✅ **구현 완료 항목**:
- 중앙 집중식 SSE 이벤트 시스템 (3계층 아키텍처)
- 20+ SSE 이벤트 타입 정의
- 모든 뮤테이션 라우터에 SSE 통합 (13개 뮤테이션)
- 전역 SSE 프로바이더 및 자동 쿼리 무효화
- 자동 재연결 (최대 10회)
- 개발 환경 연결 상태 인디케이터

✅ **작동 방식**:
1. 사용자가 데이터 수정 (뮤테이션 실행)
2. 서버에서 DB 업데이트 후 SSE 이벤트 브로드캐스트
3. 모든 연결된 클라이언트가 SSE 이벤트 수신
4. SSEProvider가 관련 쿼리 자동 무효화
5. 컴포넌트 자동 리렌더링 (최신 데이터 표시)

✅ **실시간 크로스 페이지 동기화**:
- 부서원 관리에서 경력 정보 수정 → 직원 선호사항 페이지 자동 업데이트
- 스케줄 확정 → 모든 탭에서 자동 업데이트
- 팀 생성/수정/삭제 → 모든 관련 페이지 자동 업데이트
- 설정 변경 → 모든 페이지 자동 반영

🎉 **새로고침 없는 실시간 협업 환경 완성!**
