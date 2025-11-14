# Authentication & Permission System Setup - ShiftEasy

## 작업 일자: 2025-09-13

## 작업자: Developer B - Authentication & Permission System

---

## 📋 작업 개요

ShiftEasy 프로젝트의 인증 및 권한 시스템을 구축했습니다. Supabase Auth를 통한 인증, RBAC(Role-Based Access Control) 시스템, Rate Limiting, 그리고 감사 로그 시스템을 완성했습니다.

### 기술 스택
- **Authentication**: Supabase Auth (Organization 기반)
- **Authorization**: Custom RBAC System
- **Rate Limiting**: Upstash Redis
- **Audit Logging**: Custom implementation with PostgreSQL

---

## 🔐 구현된 시스템

### 1. Supabase Auth 인증 통합
- Organization 기반 멀티테넌시
- 자동 사용자 동기화
- 세션 관리

### 2. RBAC 권한 시스템
- 4개 역할: Owner, Admin, Manager, Member
- 세분화된 권한 매트릭스
- 권한 기반 API 접근 제어

### 3. Rate Limiting
- 작업별 차별화된 제한
- Redis 기반 슬라이딩 윈도우
- 자동 복구 메커니즘

### 4. 감사 로그
- 모든 중요 작업 기록
- 민감 정보 자동 마스킹
- 보안 이벤트 추적

---

## 🛡️ 권한 매트릭스

### 역할 정의

#### Owner (소유자)
- 모든 권한 보유
- 결제 및 청구 관리
- 조직 설정 관리
- 보안 설정 관리

#### Admin (관리자)
- 스케줄 전체 관리 (생성, 수정, 삭제, 발행)
- 직원 관리 (추가, 수정, 역할 변경)
- 스왑 승인/거절
- 리포트 생성 및 내보내기
- 감사 로그 조회

#### Manager (매니저)
- 스케줄 조회
- 직원 조회
- 스왑 승인/거절
- 리포트 조회

#### Member (일반 직원)
- 본인 스케줄 조회
- 본인 프로필 조회
- 본인 스왑 요청
- 본인 근태 관리

### 권한 세부 사항

총 37개의 세분화된 권한:

#### 스케줄 권한
- `schedule.create` - 스케줄 생성
- `schedule.edit` - 스케줄 수정
- `schedule.delete` - 스케줄 삭제
- `schedule.publish` - 스케줄 발행
- `schedule.view` - 전체 스케줄 조회
- `schedule.view.own` - 본인 스케줄 조회

#### 직원 권한
- `staff.create` - 직원 추가
- `staff.edit` - 직원 정보 수정
- `staff.delete` - 직원 삭제
- `staff.view` - 전체 직원 조회
- `staff.view.own` - 본인 프로필 조회

#### 스왑 권한
- `swap.approve` - 스왑 승인
- `swap.reject` - 스왑 거절
- `swap.request` - 스왑 요청
- `swap.request.own` - 본인 스왑 요청
- `swap.view` - 전체 스왑 조회
- `swap.view.own` - 본인 스왑 조회

#### 기타 권한
- 배정, 근태, 리포트, 설정, 감사, 사용자 관리 등

---

## 🚦 Rate Limiting 설정

### 엔드포인트별 제한

| 타입 | 제한 | 시간 창 | 용도 |
|------|------|---------|------|
| api | 100 requests | 1분 | 일반 API 요청 |
| auth | 10 attempts | 10분 | 인증 시도 |
| schedule | 30 requests | 1시간 | 스케줄 작업 |
| swap | 20 requests | 1시간 | 스왑 요청 |
| report | 10 requests | 1시간 | 리포트 생성 |
| notification | 50 requests | 1분 | 알림 전송 |
| upload | 20 requests | 1시간 | 파일 업로드 |

### Rate Limiting 특징
- 사용자 + 테넌트 + IP 조합으로 추적
- 자동 복구 및 재시도 정보 제공
- 헤더를 통한 상태 정보 제공
- 위반 시 감사 로그 기록

---

## 📝 감사 로그 시스템

### 추적되는 이벤트

#### 인증 이벤트
- 로그인/로그아웃
- 실패한 로그인 시도
- 비밀번호 재설정
- MFA 활성화/비활성화

#### 사용자 관리
- 사용자 생성/수정/삭제
- 역할 변경
- 초대 발송
- 계정 활성화/비활성화

#### 데이터 작업
- 스케줄 생성/수정/삭제/발행
- 배정 생성/수정/잠금
- 스왑 요청/승인/거절
- 근태 기록

#### 보안 이벤트
- 권한 없는 접근 시도
- Rate limit 초과
- 의심스러운 활동
- 데이터 내보내기

### 감사 로그 특징
- 자동 민감 정보 마스킹
- 변경 전/후 상태 기록
- 메타데이터 포함 (IP, User Agent 등)
- 에러 시에도 메인 플로우 영향 없음

---

## 📁 구현된 파일 구조

```
src/
├── app/
│   └── layout.tsx              # SupabaseProvider 설정
├── middleware.ts                # 인증 미들웨어 & Rate limiting
├── lib/
│   ├── auth.ts                 # 인증 헬퍼 함수
│   ├── permissions.ts          # RBAC 권한 매트릭스
│   ├── rate-limit.ts           # Rate limiting 설정
│   └── audit-log.ts            # 감사 로그 시스템
└── server/
    └── trpc.ts                 # Supabase Auth 통합된 tRPC context
```

---

## 🔧 설정 및 사용법

### Supabase Auth 설정
```typescript
// layout.tsx
<SupabaseProvider>
  {children}
</SupabaseProvider>
```

### 권한 체크
```typescript
// 권한 확인
const hasAccess = hasPermission(role, 'schedule.create');

// 권한 요구
await requirePermission('schedule.create');

// tRPC에서 사용
export const myProcedure = t.procedure
  .use(requirePermission('schedule.create'))
  .mutation(/* ... */);
```

### Rate Limiting 사용
```typescript
// 미들웨어에서 자동 적용
const result = await checkRateLimit('api', identifier);

// tRPC에서 사용
export const myProcedure = t.procedure
  .use(withRateLimit('schedule'))
  .mutation(/* ... */);
```

### 감사 로그 생성
```typescript
await createAuditLog({
  tenantId,
  actorId,
  action: 'schedule.created',
  entityType: 'schedule',
  entityId: scheduleId,
  before: oldData,
  after: newData,
});
```

---

## 🚀 통합된 tRPC Procedures

### 권한 기반 Procedures
- `protectedProcedure` - 인증 필요
- `adminProcedure` - Admin/Owner 역할 필요
- `ownerProcedure` - Owner 역할 필요
- `createScheduleProcedure` - 스케줄 생성 권한 + Rate limiting
- `manageStaffProcedure` - 직원 관리 권한 + Rate limiting
- `approveSwapProcedure` - 스왑 승인 권한 + Rate limiting

---

## ⚠️ 주의사항

1. **환경 변수 설정 필요**:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `UPSTASH_REDIS_REST_URL`
    - `UPSTASH_REDIS_REST_TOKEN`

2. **Supabase Auth Dashboard 설정**:
    - Organization 기능 활성화
    - 웹훅 설정 (선택사항)

3. **Redis 설정**:
    - Upstash Redis 인스턴스 생성
    - 연결 정보 환경 변수에 추가

---

## 📊 완료 기준 달성

- ✅ **Supabase Auth 인증 플로우 완성**
- ✅ **4개 역할 권한 매트릭스** (Owner, Admin, Manager, Member)
- ✅ **Rate limiting 구현** (7개 타입별 차별화)
- ✅ **감사 로그 시스템** (모든 중요 작업 추적)

---

## 🎯 성과

**Developer B 작업 완료율: 100%**

모든 인증 및 권한 시스템이 완료되었으며, 즉시 사용 가능한 상태입니다.

---

## 📝 TODO (다음 단계)

1. [ ] Supabase Auth 웹훅 처리 구현
2. [ ] SSO(Single Sign-On) 설정
3. [ ] MFA(Multi-Factor Authentication) 활성화
4. [ ] 권한 관리 UI 구현
5. [ ] 감사 로그 뷰어 구현
6. [ ] Rate limiting 대시보드
7. [ ] 보안 알림 시스템
