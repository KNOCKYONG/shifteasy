# ShiftEasy 백엔드 PRD (Product Requirements Document - Backend)

## 1. 백엔드 아키텍처 개요

### 기술 스택
- **API 레이어**: tRPC + Zod (타입 안전 API)
- **데이터베이스**: Supabase (서버 전용, RLS 미사용)
- **ORM**: Drizzle 또는 Prisma (단일 선택)
- **캐시/레이트리밋**: Upstash Redis
- **큐/워커**: Cloudflare Queues 또는 Upstash Q
- **파일 스토리지**: Cloudflare R2
- **인증**: Clerk (Organization 기반)
- **결제**: Stripe
- **실시간**: SSE → WebSocket (확장 시)
- **모니터링**: Sentry + OpenTelemetry

## 2. 멀티테넌시 보안 아키텍처

### 2.1 테넌트 격리 원칙
- **tRPC 컨텍스트에서 tenantId 강제 주입** (Clerk 세션/Org에서 파생)
- **DB 접근은 scopedDb(tenantId) 헬퍼만 사용** (직접 쿼리 금지)
- **모든 쿼리/리포지토리 함수에 tenant_id 포함** (타이핑 강제)
- **DB 유니크 키에 tenant_id 포함** (겹침 방지)
- **데이터 페치/캐시/레이트리밋 모두 테넌트 스코프 키 적용**
- **리스트/카운트/검색 등 모든 엔드포인트에 테넌트 격리 테스트**

### 2.2 테넌트 구조
```typescript
// 테넌트 = Organization (병원/공장/콜센터/보안업체)
// 부서/병동 = Sub-scope within tenant
Tenant {
id: string
name: string
billing: BillingInfo
settings: TenantSettings
}
```

## 3. 권한 관리 시스템 (RBAC)

### 3.1 역할 정의
- **Owner**: 결제/청구, 조직 설정, 관리자 위임
- **Admin/Manager**: 스케줄 생성/승인/공지, 스왑 승인/거절, 리포트
- **Member/Nurse**: 내 스케줄 열람, 스왑 요청/응답, 출퇴근 체크
- **라우팅 가드**: 권한 미달 시 404/비노출 (존재 은닉)
- **중요 작업**: 삭제/청구 변경 시 2단계 확인(재인증)
- **고객지원**: 임퍼소네이션 플로우 + 감사로그 기록

### 3.2 권한 체크 구현
```typescript
// 모든 API/쿼리에 tenantId 강제
// 컨텍스트/DB/캐시/푸시 주제에 적용
```

## 4. 데이터베이스 설계

### 4.1 핵심 스키마
```sql
-- 멀티테넌트 기본 구조
Tenant(id, name, billing, settings)
Department/Ward(tenant_id, name)
User(tenant_id, role, profile)

-- 스케줄링 도메인
ShiftType(tenant_id, code[D/E/N/O], start, end, color)
Pattern(tenant_id, name, sequence, constraints)
Schedule(tenant_id, period(start,end), status)
Assignment(schedule_id, user_id, shift_type_id, date, lock)

-- 스왑/승인 워크플로
SwapRequest(tenant_id, requester_id, target_assignment_id, status, reason)
Approval(swap_request_id, approver_id, status, timestamps)

-- 근태/알림
Attendance(assignment_id, clock_in, clock_out, notes)
Notification(tenant_id, user_id, type, payload, read_at)

-- 푸시/캘린더
PushSubscription(user_id, endpoint, keys, device, tenant_id)
CalendarLink(user_id, ics_token, visibility)

-- 감사/작업
AuditLog(tenant_id, actor, action, entity, before/after)
Job(id, type, payload, status, attempts, next_run_at)
```

### 4.2 ORM 전략
- **Drizzle** (팀 표준화)
- **마이그레이션 자동화** (CI: lint/test 후 db:migrate)
- **소프트 삭제**(deleted_at), PITR 고려
- **대량 인덱스/쿼리 성능 점검** (실행계획/슬로우쿼리)

### 4.3 Supabase 보안
- **서비스 키 서버 사이드 전용** (클라이언트 노출 금지)
- **RLS 미사용 보완**: 뷰/스토어드 프로시저에 tenant_id 강제 바인딩
- **환경 분리**: Dev/Staging/Prod 분리 (Supabase/Redis/R2/Stripe/Clerk 키 분리)

## 5. tRPC API 설계

### 5.1 라우터 구조
```typescript
// 인증
auth.org.switch
auth.me

// 스케줄 관리
schedule.generate
schedule.publish
schedule.list
schedule.get

// 배정 관리
assignment.listByUser
assignment.update // 관리자 전용
assignment.lock

// 스왑 워크플로
swap.create
swap.respond
swap.approve
swap.reject
swap.list

// 근태
attendance.clockIn
attendance.clockOut
attendance.report

// KPI/분석
kpi.overview
kpi.fairness
kpi.absenceRate

// 알림
notification.feed
notification.read
push.subscribe
push.unsubscribe

// 캘린더
calendar.ics(userToken)
calendar.regenerateToken

// 리포트 (워커 잡 생성)
report.exportXlsx
report.exportPdf
```

### 5.2 API 표준
- **입력/출력 Zod 스키마 전부 정의**
- **API 에러 표준** (에러코드/메시지/추적ID)
- **감사지표**: 누가/무엇/언제 변경했는지 감사로그 테이블

## 6. 스케줄링 엔진

### 6.1 자동 스케줄링 알고리즘
#### 하드 제약 (반드시 준수)
- 법정 근로시간
- 연속근무 상한
- 필수 휴식
- 면허/직무 커버리지
- 최소 인원

#### 소프트 제약 (최적화 대상)
- 선호 시프트
- 주당 분배 공정성
- 주말/야간 균형
- 팀별 순환

#### 알고리즘 접근
- **목적함수**: 공정성(분산 최소화) + 인력 커버리지 부족 최소화 + 선호 충족도
- **솔버 접근**: 휴리스틱(그리디+탭서치) → 필요 시 MILP/CP-SAT
- **엣지케이스**: 갑작스런 결원, 교육/휴가 블록, 신규 직원 우선 배치
- **설명가능성**: 배정 사유 로그(규칙/충돌/스코어)

### 6.2 패턴 관리
- 2교대/3교대/맞춤 패턴
- 규칙 엔진: 휴식/연속근무 한도, 숙련도/직무별 커버리지, 선호도

## 7. 실시간 통신 & 알림

### 7.1 SSE (Server-Sent Events)
- **커넥션 관리**: heartbeat(30~60s), 지수 백오프 재연결(1→30s)
- **Last-Event-ID로 이벤트 재전송/중복 방지**
- **서버리스 타임아웃/동시연결 한도 문서화** (Vercel 한계)
- **이벤트 토픽**:
- schedule.published
- swap.requested/approved/rejected
- vacancy.detected
- attendance.missed

### 7.2 Web Push
- **알림 인박스**(읽음/안읽음) DB 원천 기록 후 SSE/푸시로 전달
- **웹 푸시 구독 테이블**(브라우저키, 유저, 테넌트, 토픽) 설계
- **토픽 설계**: 스레드/멘션/업무 이벤트 수준
- **iOS/Safari 웹 푸시**: 홈 화면 설치 PWA 조건 반영, 권한 UX 설계

### 7.3 확장 전략
- **규모 확대 시 WebSocket** (Pusher/Ably/Supabase Realtime) 전환 기준 정의

## 8. 파일 스토리지 (Cloudflare R2)

### 8.1 보안 및 접근 제어
- **사전서명 URL 발급** + 만료/권한 제어
- **업로드 크기/타입 검증** (프런트+백엔드 이중)
- **바이러스 스캔(워커)** + 썸네일/리사이즈 파이프라인
- **버킷 수명주기**(버전닝/아카이브) 정책

## 9. 큐/워커/배치 시스템

### 9.1 작업 큐 설계
- **리소스 작업**(이미지/리포트/AI) 워커 전담
- **작업 큐 도입** (Upstash Q/Cloudflare Queues/Inngest 등)
- **작업ID/상태 테이블** + 재시도/백오프/DLQ + idempotency key
- **예약/지연 실행 지원** (스케줄러)

### 9.2 워커 작업 예시
- 리포트 생성 (Excel/PDF)
- 이미지 처리 (썸네일/리사이즈)
- 대량 알림 발송
- 스케줄 최적화 배치

## 10. 캐시 & 레이트리밋 (Redis)

### 10.1 캐싱 전략
- **서버리스 호환** (Upstash Redis 등) 선택
- **키 규칙**: `env:tenant:<tenantId>:<domain>:<resource>:<id>`
- **TTL 표준** + 조기 갱신(early refresh) + 지터(jitter)로 스탬피드 방지

### 10.2 레이트리밋
- **슬라이딩 윈도우/토큰 버킷** 레이트리밋
- **적용 범위**: 엔드포인트·유저·테넌트·IP
- **429 UX** (재시도 지침/대기시간) 설계

## 11. 결제 시스템 (Stripe)

### 11.1 구독 모델
- **테넌트 ↔ Customer/Subscription 매핑** 스키마
- **가격/플랜**(좌석/사용량) 모델 정의, proration 처리
- **요금제 설계**:
- Free: 인원/부서 제한, 기본 뷰/스왑
- Pro: 자동 배정, 리포트, 푸시, 승인 워크플로
- Enterprise: 고급 제약/알고리즘, SSO, 감사/보존

### 11.2 웹훅 처리
- **웹훅 서명 검증** + 재시도 내성 + idempotency
- **미수금(past_due) 처리**/정지/복구 플로우
- **영수증/세금** (Stripe Tax 필요 시) + 브랜드드 인보이스
- **무료 체험/해지 예약/환불 정책** 문서화

## 12. 통합/연동

### 12.1 캘린더 통합
- **구글 캘린더**: 개인별 ICS 읽기 전용 링크(토큰)
- 시간이동 시 자동 반영
- 초기: ICS 단방향 → 추후 OAuth 양방향 검토

### 12.2 메신저 연동
- 이메일/슬랙/카카오 비즈 알림 정책
- 웹훅 기반 이벤트 전달

## 13. 배포 & 환경 관리

### 13.1 배포 파이프라인
- **PR Preview → Staging → Prod** 승격형 파이프라인
- **Staging 자동 db:migrate && seed** + 데이터 비식별화
- **CI/CD**: GitHub Actions→Staging 자동 배포/마이그레이트→Prod 승인 승격

### 13.2 환경 관리
- **환경변수/비밀 관리** + 키 로테이션 절차
- **Dev/Staging/Prod 분리** (모든 외부 서비스 키 분리)

## 14. 모니터링 & 관측성

### 14.1 통합 모니터링
- **Sentry**(웹/서버/워커) 통합
- **OpenTelemetry 트레이싱** (요청→큐→워커 전 구간)
- **구조적 로그(JSON)** + 요청ID/테넌트/사용자 태그

### 14.2 메트릭 대시보드
- 오류율
- API 응답시간 (P50/P95/P99)
- SSE 재연결률
- 푸시 도달률
- 레이트리밋 히트율
- 큐 처리 지연시간

## 15. 보안 & 컴플라이언스

### 15.1 보안 헤더
- Content-Security-Policy
- X-Frame-Options
- Referrer-Policy
- CORS 정책

### 15.2 데이터 보안
- **업로드 보안**: 확장자/컨텐트타입 이중 체크 + AV 스캔
- **비밀 스캔**(pre-commit, CI) 도입
- **데이터 보존/파기 정책** + 백업/복구 절차 문서화
- **(의료 맥락 시)** 민감정보 분리/마스킹, 접근 통제, HIPAA 검토

### 15.3 감사 로그
- 모든 중요 작업 기록
- 누가/무엇/언제/어떻게 변경
- 변경 전후 상태 보존

## 16. 테스트 전략

### 16.1 백엔드 테스트
- **단위 테스트**: 비즈니스 로직, 알고리즘
- **통합 테스트**: tRPC 엔드포인트, DB 트랜잭션
- **계약 테스트**: tRPC + Zod 스키마 스냅샷
- **멀티테넌시 격리 테스트**: 다른 테넌트 데이터 접근 불가 검증

### 16.2 커버리지 목표
- 비즈니스 로직: 90%+
- API 엔드포인트: 80%+
- 테넌트 격리: 100%

## 17. 데이터 관리

### 17.1 시드 데이터
- **Idempotent 시드** (반복 실행에도 동일 상태)
- **테넌트별 파라미터화된** 샘플 사용자/권한/데이터

### 17.2 백업 전략
- **자동 백업** + 복구 리허설(주기적 테스트)
- **R2 수명주기 정책** (버전닝/아카이브) 적용
- **PITR (Point-In-Time Recovery)** 지원

## 18. 성능 요구사항

### 18.1 API 성능
- **응답시간**: <200ms (P95)
- **처리량**: 1000 req/s per instance
- **동시연결**: 10K SSE connections

### 18.2 스케줄링 성능
- **자동 편성**: <5초 (100명 기준)
- **스왑 처리**: <500ms
- **리포트 생성**: <30초 (월간 리포트)

## 19. 구현 로드맵

### Phase 1: 기초 인프라 (1-2주)
- [ ] Supabase 프로젝트 설정
- [ ] Drizzle ORM 스키마 정의
- [ ] Clerk 인증 통합
- [ ] tRPC 라우터 기본 구조

### Phase 2: 핵심 API (3-4주)
- [ ] 테넌트 격리 시스템
- [ ] 사용자/권한 관리
- [ ] 스케줄 CRUD
- [ ] 스왑 워크플로

### Phase 3: 비즈니스 로직 (5-6주)
- [ ] 자동 스케줄링 알고리즘
- [ ] 제약 조건 검증
- [ ] 공정성 스코어링
- [ ] 근태 관리

### Phase 4: 실시간/알림 (7주)
- [ ] SSE 구현
- [ ] Web Push
- [ ] 알림 인박스
- [ ] 이벤트 라우팅

### Phase 5: 통합 (8-9주)
- [ ] Stripe 결제
- [ ] ICS 캘린더
- [ ] R2 파일 스토리지
- [ ] 워커/큐 시스템

### Phase 6: 운영 준비 (10-12주)
- [ ] 모니터링/로깅
- [ ] 테스트 커버리지
- [ ] 성능 최적화
- [ ] 보안 강화

## 20. 주요 의사결정 사항

### 즉시 결정 필요
1. **ORM 선택**: Drizzle vs Prisma
2. **큐 시스템**: Cloudflare Queues vs Upstash Q
3. **초기 알고리즘**: 휴리스틱만 vs MILP 포함

### 추후 검토
1. **WebSocket 전환 시점**: 동시접속 1000명 기준?
2. **마이크로서비스 분리**: 스케줄링 엔진 분리 시점
3. **AI 도입**: 스케줄 최적화에 ML 적용 시점

## 21. 리스크 및 대응 방안

### 기술적 리스크
| 리스크 | 영향도 | 대응 방안 |
|--------|--------|-----------|
| 테넌트 데이터 유출 | 치명적 | 모든 쿼리에 tenant_id 강제, 격리 테스트 |
| 스케줄링 성능 저하 | 높음 | 캐싱, 비동기 처리, 워커 분산 |
| 실시간 연결 제한 | 중간 | SSE → WebSocket 마이그레이션 계획 |
| 결제 장애 | 높음 | Stripe 웹훅 재시도, 상태 동기화 |

### 운영 리스크
| 리스크 | 영향도 | 대응 방안 |
|--------|--------|-----------|
| 데이터 손실 | 치명적 | 자동 백업, PITR, 복구 테스트 |
| 서비스 중단 | 높음 | 무중단 배포, 롤백 전략 |
| 보안 침해 | 치명적 | 감사로그, 비밀 스캔, 정기 보안 점검 |

## 22. 성공 지표 (KPI)

### 기술 지표
- API 가용성: 99.9%+
- 평균 응답시간: <200ms
- 에러율: <0.1%
- 테스트 커버리지: 80%+

### 비즈니스 지표
- 스케줄 편성 시간: 50% 감소
- 스왑 처리 시간: 40% 감소
- 시스템 채택률: 80%+
- 데이터 정확도: 99.9%+

---

## 부록: 백엔드 개발 체크리스트

### 필수 구현 사항
- [ ] 멀티테넌시 격리 (모든 레벨)
- [ ] RBAC 권한 시스템
- [ ] 감사 로그
- [ ] 에러 추적 (Sentry)
- [ ] API 문서화
- [ ] 테스트 (unit/integration/e2e)
- [ ] 모니터링/알림
- [ ] 백업/복구
- [ ] 보안 스캔
- [ ] 성능 최적화

### 코드 품질 기준
- TypeScript strict mode
- ESLint/Prettier 준수
- 코드 리뷰 필수
- 테스트 없는 코드 머지 금지
- 문서화 없는 API 배포 금지