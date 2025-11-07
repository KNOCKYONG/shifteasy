# 성능 개선 계획

## 🚨 현재 문제점

### 1. 초기 로드 시간 분석 (2025-01-07)

#### 컴파일 시간
- `/schedule` 페이지: 13.7초 (2826 modules)
- `/api/trpc/[trpc]`: 5.1초 (3159 modules)
- 총 2800-3200개의 모듈을 매번 로드

#### API 응답 시간
- `GET /schedule`: 15초
- `GET /api/users/me`: 7.3초
- TRPC batch 요청: 8-9초
- `GET /api/notifications`: 2초

#### SSE 연결 문제 (심각)
- `GET /api/sse`: 419초 (약 7분)
- 일부 연결은 883초 (약 15분)
- 연결 타임아웃 발생

#### 중복/과도한 데이터 로드
- 모든 사용자 정보 (21명)를 매번 전체 로드
- `offBalance.getBulkCurrentBalance` API가 반복 호출됨
- 동일한 TRPC 쿼리가 여러 번 중복 호출

## ✅ 적용된 개선 사항

### 1. 로딩 스켈레톤 추가 (2025-01-07)

#### 구현 내용
- `Skeleton.tsx` 컴포넌트 생성
- `DashboardSkeleton` 컴포넌트 추가
- `MemberDashboard`에 로딩 스테이트 추가
- `DashboardClient`에 로딩 스켈레톤 적용

#### 효과
- 데이터 로드 중에도 즉시 UI 표시
- 사용자에게 로딩 진행 상황 시각적 피드백
- 체감 로딩 시간 단축

#### 코드 위치
```typescript
// src/components/ui/Skeleton.tsx
export function DashboardSkeleton() { /* ... */ }

// src/components/dashboard/MemberDashboard.tsx
if (!isLoaded || !dbUser) {
  return <DashboardSkeleton />;
}

// src/app/dashboard/DashboardClient.tsx
if (!mounted || !currentUser.isLoaded) {
  return <DashboardSkeleton />;
}
```

## 🔄 추가 권장 개선 사항

### 2. SSE 연결 최적화 (우선순위: 긴급)

#### 문제
- SSE 연결이 7-15분 걸림
- 타임아웃 발생으로 사용자 경험 저하

#### 해결 방안
```typescript
// src/app/api/sse/route.ts
export async function GET(request: Request) {
  // 타임아웃 설정 추가
  const timeout = 30000; // 30초

  // 연결 헬스체크
  const healthCheck = setInterval(() => {
    stream.write(':keepalive\n\n');
  }, 15000);

  // 클린업
  request.signal.addEventListener('abort', () => {
    clearInterval(healthCheck);
  });
}
```

### 3. 데이터 패칭 최적화

#### A. TRPC 쿼리 중복 제거
```typescript
// 문제: 동일한 쿼리가 여러 번 호출됨
api.tenant.users.current.useQuery() // 여러 컴포넌트에서 중복 호출

// 해결: React Query의 staleTime과 cacheTime 설정
export const api = createTRPCReact<AppRouter>({
  config() {
    return {
      queryClientConfig: {
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1분
            cacheTime: 5 * 60 * 1000, // 5분
          },
        },
      },
    };
  },
});
```

#### B. offBalance API 호출 최적화
```typescript
// 문제: 21명의 사용자 정보를 매번 전체 조회
GET /api/trpc/offBalance.getBulkCurrentBalance?employeeIds=[...21개]

// 해결: 필요한 사용자만 조회
// 1. 현재 보이는 페이지의 사용자만 조회
// 2. 가상 스크롤링 적용
// 3. 페이지네이션 또는 무한 스크롤
```

### 4. 코드 스플리팅 및 레이지 로딩

#### 문제
- 2826-3159개의 모듈을 한 번에 로드
- 초기 번들 크기가 큼

#### 해결 방안
```typescript
// src/app/dashboard/page.tsx
import dynamic from 'next/dynamic';

// 동적 import로 컴포넌트 로딩
const MemberDashboard = dynamic(
  () => import('@/components/dashboard/MemberDashboard'),
  {
    loading: () => <DashboardSkeleton />,
    ssr: false, // 필요시
  }
);

const DashboardClient = dynamic(
  () => import('./DashboardClient'),
  {
    loading: () => <DashboardSkeleton />,
  }
);
```

### 5. 데이터베이스 쿼리 최적화

#### 인덱스 추가
```sql
-- 자주 조회되는 컬럼에 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_user_date
  ON shift_assignments(user_id, date);
```

#### N+1 쿼리 문제 해결
```typescript
// 문제: 각 사용자마다 별도 쿼리
users.forEach(user => {
  getOffBalance(user.id); // N번 쿼리
});

// 해결: 한 번에 조회
const offBalances = await getOffBalanceBulk(userIds); // 1번 쿼리
```

### 6. 클라이언트 사이드 캐싱

#### React Query 설정 최적화
```typescript
// src/lib/trpc/client.ts
export const trpc = createTRPCReact<AppRouter>({
  config() {
    return {
      links: [
        httpBatchLink({
          url: '/api/trpc',
          maxURLLength: 2083,
        }),
      ],
      queryClientConfig: {
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1분간 fresh
            cacheTime: 5 * 60 * 1000, // 5분간 캐시
            refetchOnWindowFocus: false, // 포커스 시 재조회 방지
            refetchOnReconnect: false, // 재연결 시 재조회 방지
          },
        },
      },
    };
  },
});
```

### 7. 이미지 및 정적 자원 최적화

```typescript
// next.config.js
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30일
  },
  // Webpack 최적화
  webpack: (config, { dev }) => {
    if (!dev) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          commons: {
            name: 'commons',
            chunks: 'all',
            minChunks: 2,
          },
        },
      };
    }
    return config;
  },
};
```

## 📊 예상 개선 효과

| 개선 사항 | 현재 | 목표 | 개선율 |
|----------|------|------|--------|
| 초기 로드 시간 | 15-20초 | 3-5초 | 70-80% |
| API 응답 시간 | 7-15초 | 1-3초 | 80% |
| SSE 연결 | 7-15분 | 1-3초 | 99% |
| 체감 로딩 시간 | 느림 | 즉시 | 스켈레톤 효과 |

## 🎯 구현 우선순위

### 긴급 (1-2일)
1. ✅ 로딩 스켈레톤 추가 - **완료**
2. SSE 연결 최적화
3. TRPC 쿼리 캐싱 설정

### 높음 (1주)
4. offBalance API 호출 최적화
5. 데이터베이스 인덱스 추가
6. N+1 쿼리 해결

### 중간 (2주)
7. 코드 스플리팅 적용
8. 레이지 로딩 구현
9. React Query 설정 최적화

### 낮음 (1개월)
10. 이미지 최적화
11. Webpack 설정 개선
12. CDN 적용

## 📝 모니터링

### 성능 측정 도구
- Chrome DevTools Performance
- Lighthouse
- React DevTools Profiler
- Next.js Analytics

### 추적할 메트릭
- **FCP (First Contentful Paint)**: < 1.8초
- **LCP (Largest Contentful Paint)**: < 2.5초
- **TTI (Time to Interactive)**: < 3.8초
- **CLS (Cumulative Layout Shift)**: < 0.1
- **FID (First Input Delay)**: < 100ms

## 🔗 참고 자료

- [Next.js Performance](https://nextjs.org/docs/advanced-features/measuring-performance)
- [React Query Performance](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
- [TRPC Best Practices](https://trpc.io/docs/server/caching)
