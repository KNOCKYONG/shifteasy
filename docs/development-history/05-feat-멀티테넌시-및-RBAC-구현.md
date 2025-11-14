# 멀티테넌시 및 RBAC 권한 시스템 구현 (Multi-tenancy & RBAC Implementation)

## 최근 업데이트 (2025년 1월 14일)

### 🗄️ 데이터베이스 초기화 시스템 개선

#### 중앙 집중식 초기화 스크립트 (`/src/db/initialize.ts`)
- **통합 완료**: `seed-tenant.ts`와 `add-departments.ts`를 하나로 통합
- **확장된 데이터**: 10개 부서, 각 부서별 2명씩 총 20명의 테스트 사용자
- **워크플로우 확립**: 임시 파일 → 테스트 → initialize.ts 통합 → 임시 파일 삭제

#### 데이터베이스 유틸리티 (`/src/db/utils.ts`)
- **데이터 확인 도구**: 사용자, 테넌트, 부서 조회 기능
- **Supabase Auth 연동 체크**: Supabase Auth 사용자와 DB 사용자 동기화 확인
- **통계 대시보드**: 전체 데이터 요약 정보 제공

#### 새로운 npm 명령어
```bash
npm run db:init          # 초기 데이터 생성
npm run db:setup         # DB 생성 + 초기 데이터
npm run db:reset         # 완전 초기화
npm run db:check         # 모든 데이터 확인
npm run db:check:users   # 사용자 데이터 확인
npm run db:check:summary # 데이터 요약
```

### 📋 프로젝트 규칙 문서화 (`PROJECT_CONVENTIONS.md`)
- 데이터베이스 초기화 워크플로우 명문화
- 모든 초기 데이터는 `initialize.ts`에만 관리
- 임시 파일 사용 규칙 (temp-*.ts는 자동 .gitignore)

---

## 구현 완료 항목

### 1. 🏢 테넌트 격리 시스템 (`/src/lib/db/tenant-isolation.ts`)

#### 핵심 기능
- **ScopedDb 클래스**: 모든 DB 쿼리에 자동 테넌트 필터링
- **크로스 테넌트 접근 차단**: 다른 테넌트 데이터 접근 시 즉시 에러
- **자동 테넌트 ID 추가**: CREATE 작업 시 자동으로 tenantId 주입
- **감사 로그 자동 기록**: 모든 변경사항 추적

#### 주요 메서드
```typescript
// 테넌트별 격리된 조회
scopedDb.getUsers()
scopedDb.getDepartments()
scopedDb.getSchedules()

// 안전한 CRUD 작업
scopedDb.create(table, data) // tenantId 자동 추가
scopedDb.update(table, id, data) // 테넌트 검증 후 업데이트
scopedDb.delete(table, id) // 테넌트 검증 후 삭제

// 대량 작업
scopedDb.bulkCreate(table, items)
scopedDb.transaction(callback)
```

#### 보안 특징
- ✅ 테넌트 ID 검증 필수
- ✅ 직접 DB 접근 차단
- ✅ 트랜잭션 내 격리 유지
- ✅ Soft Delete 지원

---

### 2. 🔐 Supabase Auth 인증 통합 (`/src/lib/auth.ts`)

#### Organization 기반 멀티테넌시
- **자동 사용자 동기화**: Supabase Auth 사용자 ↔ DB 사용자
- **Organization → Tenant 매핑**: 조직이 테넌트로 자동 변환
- **역할 동기화**: Supabase Auth 역할 → 앱 역할 자동 매핑

#### Webhook 이벤트 처리
```typescript
// 지원되는 이벤트
- user.created/updated/deleted
- organizationMembership.created/updated/deleted
```

#### 헬퍼 함수
```typescript
syncSupabase AuthUser() // 현재 사용자 동기화
getCurrentTenantContext() // 테넌트 컨텍스트 획득
getCurrentScopedDb() // 격리된 DB 인스턴스
canAccessResource(type, id) // 리소스 접근 권한 확인
```

---

### 3. 🛡️ RBAC 권한 시스템 (`/src/lib/auth/rbac.ts`)

#### 역할 계층
```
Owner (소유자)
  ├─ 모든 권한
  └─ 테넌트 삭제 가능

Admin (관리자)
  ├─ 사용자 관리
  ├─ 부서 관리
  ├─ 스케줄 승인
  └─ 보고서 접근

Manager (매니저)
  ├─ 스케줄 생성/발행
  ├─ 스왑 승인/거절
  └─ 보고서 조회

Member (일반 직원)
  ├─ 스케줄 조회
  ├─ 스왑 요청
  └─ 기본 읽기 권한
```

#### 권한 매트릭스 (총 27개 권한)
- **테넌트**: manage, billing, delete
- **사용자**: create, read, update, delete, manage_roles
- **부서**: create, read, update, delete
- **스케줄**: create, read, update, delete, publish, approve
- **교대**: create, read, update, delete
- **스왑**: create, read, approve, reject
- **보고서**: view, export, analytics
- **설정**: view, update
- **감사**: view, export

#### 권한 체크 방법
```typescript
// 단일 권한
checkPermission(Permission.SCHEDULE_CREATE)

// 여러 권한 중 하나
hasAnyPermission([Permission.ADMIN, Permission.MANAGER])

// 모든 권한 필요
hasAllPermissions([Permission.SCHEDULE_CREATE, Permission.SCHEDULE_PUBLISH])

// 데코레이터
@requirePermission(Permission.USER_DELETE)
@requireRole(Role.ADMIN)
```

---

### 4. 🚀 미들웨어 통합 (`/src/middleware.ts`)

#### 인증 플로우
1. **Supabase Auth 인증 확인**: 로그인 여부
2. **Organization 확인**: 테넌트 선택 여부
3. **역할 기반 라우팅**: Admin/Manager/Member별 접근 제어
4. **헤더 주입**: x-tenant-id, x-user-id, x-user-role

#### 보호된 라우트
```typescript
// 공개 라우트
/sign-in, /sign-up, /

// 인증 필요
/schedule, /team, /config

// 관리자 전용
/admin/*, /settings/billing

// API 보호
/api/users, /api/departments, /api/schedules
```

---

### 5. 🔧 API 래퍼 (`/src/lib/api/with-auth.ts`)

#### 인증된 API 핸들러
```typescript
// 기본 권한 체크
export const GET = withAuth(handler, Permission.USER_READ)

// 여러 권한 중 하나
export const POST = withAnyPermission(handler, [
  Permission.ADMIN,
  Permission.MANAGER
])

// 모든 권한 필요
export const DELETE = withAllPermissions(handler, [
  Permission.USER_DELETE,
  Permission.AUDIT_VIEW
])

// 자기 자신만 접근
export const PUT = withSelfOnly(handler)
```

#### AuthenticatedRequest 타입
```typescript
interface AuthenticatedRequest {
  auth: TenantContext // 테넌트 정보
  scopedDb: ScopedDb // 격리된 DB
  permissions: PermissionChecker // 권한 체커
}
```

---

### 6. 🧪 테스트 시스템 (`/src/lib/test/tenant-isolation.test.ts`)

#### 테넌트 격리 테스트
- ✅ 크로스 테넌트 접근 차단
- ✅ 테넌트 ID 자동 추가
- ✅ 업데이트 시 테넌트 검증
- ✅ 삭제 시 테넌트 검증
- ✅ 조회 시 테넌트 필터링

#### RBAC 테스트
- ✅ Owner 전체 권한
- ✅ Admin 권한 제한
- ✅ Manager 운영 권한
- ✅ Member 기본 권한
- ✅ 역할 계층 검증

---

## 기술적 성과

### 📊 보안 강화 지표
| 항목 | 구현 | 상태 |
|------|------|------|
| 테넌트 격리 | 100% 쿼리 검증 | ✅ |
| 권한 체크 | 27개 세분화 권한 | ✅ |
| 감사 로그 | 모든 변경사항 기록 | ✅ |
| 크로스 테넌트 차단 | 즉시 에러 반환 | ✅ |

### 🎨 아키텍처 특징
1. **Zero Trust 원칙**: 모든 요청 검증
2. **Defense in Depth**: 다층 보안 구조
3. **Fail-Safe 설계**: 기본 거부 정책
4. **감사 가능성**: 모든 작업 추적

### 🔧 기술 스택
- **인증**: Supabase Auth (Organization 기반)
- **DB 격리**: Drizzle ORM + Custom Wrapper
- **권한**: RBAC with Decorators
- **미들웨어**: Next.js Edge Runtime

---

## 사용 예시

### API 라우트에서 테넌트 격리 적용
```typescript
// /api/users/route.ts
export const GET = withAuth(
  async (req: AuthenticatedRequest) => {
    // 자동으로 현재 테넌트의 사용자만 조회
    const users = await req.scopedDb.getUsers();
    return NextResponse.json(users);
  },
  Permission.USER_READ
);
```

### 서버 액션에서 권한 체크
```typescript
// 서버 액션
@requireRole(Role.ADMIN)
async function deleteUser(userId: string) {
  const scopedDb = await getCurrentScopedDb();
  await scopedDb.delete(users, userId);
}
```

### 클라이언트에서 권한 확인
```typescript
// 컴포넌트
const hasPermission = await checkPermission(Permission.SCHEDULE_CREATE);
if (hasPermission) {
  // 스케줄 생성 버튼 표시
}
```

---

## 향후 개선 사항

### 단기 계획
1. **권한 캐싱**: Redis 기반 권한 캐싱
2. **동적 권한**: 커스텀 역할 생성
3. **위임 기능**: 임시 권한 부여
4. **2FA 강제**: 관리자 2단계 인증

### 장기 계획
1. **ABAC 확장**: Attribute-Based Access Control
2. **정책 엔진**: OPA (Open Policy Agent) 통합
3. **연합 인증**: SAML/OAuth 지원
4. **컴플라이언스**: SOC2, HIPAA 준수

---

## 체크리스트

- [x] 테넌트 격리 시스템 구현
- [x] scopedDb 헬퍼 완성
- [x] 모든 DB 쿼리에 tenant_id 강제
- [x] 테넌트 간 데이터 누출 방지 테스트
- [x] Supabase Auth 인증 통합 활성화
- [x] Organization 기반 멀티테넌시
- [x] 사용자 동기화 로직 (syncSupabase AuthUser)
- [x] RBAC 권한 시스템 구현
- [x] Owner/Admin/Manager/Member 역할
- [x] 27개 세분화 권한
- [x] Permission 기반 미들웨어
- [x] 권한 검증 테스트

---

## 📂 데이터베이스 구조 및 초기화

### 현재 파일 구조
```
src/db/
├── initialize.ts    # ⭐ 모든 초기 데이터 (중앙 집중)
├── utils.ts        # 📊 데이터 확인/디버깅 유틸리티
├── schema/         # Drizzle 스키마 정의
│   ├── tenants.ts  # 테넌트, 사용자, 부서
│   ├── hospitals.ts
│   ├── wards.ts
│   ├── staff.ts
│   ├── shifts.ts
│   ├── schedules.ts
│   ├── assignments.ts
│   ├── requests.ts
│   ├── preferences.ts
│   ├── system.ts
│   └── index.ts
└── index.ts        # DB 연결 설정
```

### 초기 데이터 (`initialize.ts`)
- **테넌트**: 서울대학교병원
- **부서**: 10개 (응급실, 중환자실, 내과, 외과, 소아과, 산부인과, 정형외과, 신경과, 재활의학과, 정신건강의학과)
- **근무 유형**: D(주간), E(저녁), N(야간), O(휴무)
- **사용자**: 관리자 1명 + 각 부서별 수간호사/간호사 2명씩 (총 21명)

---

**최종 수정일**: 2025년 1월 14일
**작성자**: Developer D (Security & Multi-tenancy)
**업데이트**: 데이터베이스 초기화 시스템 개선