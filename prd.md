멀티테넌트 B2B 앱 구축 체크리스트 (Next.js + tRPC + Supabase + Stripe/Clerk)
간호사/여성 사용자 중심의 깔끔하고 직관적 UX, 멀티테넌시 보안, 서버리스 운영 안정성에 초점.

1) 멀티테넌시 보안 가드레일
   tRPC 컨텍스트에서 tenantId 강제 주입 (Clerk 세션/Org에서 파생)


DB 접근은 scopedDb(tenantId) 헬퍼만 사용 (직접 쿼리 금지)


모든 쿼리/리포지토리 함수에 tenant_id 포함(타이핑 강제)


DB 유니크 키에 tenant_id 포함 (겹침 방지)


데이터 페치/캐시/레이트리밋 모두 테넌트 스코프 키 적용


리스트/카운트/검색 등 모든 엔드포인트에 테넌트 격리 테스트 존재



2) 권한 체계 (Clerk Orgs + RBAC)
   테넌트=Organization 매핑 확정


역할 정의: Owner / Admin / Member / Nurse (예시)


라우팅 가드: 권한 미달 시 404/비노출 (존재 은닉)


중요 작업(삭제/청구 변경) 2단계 확인(재인증) 적용


고객지원 임퍼소네이션 플로우 + 감사로그 기록



3) 프런트엔드 (Next.js + Tailwind + shadcn/ui + Framer Motion)
   App Router/RSC 적용, PPR/ISR 전략 수립


TanStack Query 도입 (캐시/동기화/오프라인 + optimistic update)


디자인 토큰화(theme) + 고대비/큰 터치 타겟/폰트 스케일


컴포넌트 접근성(a11y) 검증(aXe, ARIA, 키보드 내비)


애니메이션 가이드: 기본 Framer Motion / 물리 React Spring / 복잡 타임라인 GSAP


로딩/브랜드 인트로 Lottie 사용 (과도한 사용 자제)


i18n(next-intl): 24시간제/요일시작, 의료용어 용례집 유지


반응형(모바일/PC) 퍼스트 클래스 테스트(뷰포트 스냅샷)



4) PWA & WebView 대응
   서비스 워커: 정적(Cache First) + API(SWR) 캐싱 전략


오프라인 큐잉(폼 제출 재전송), 자동 재시도/취소


앱 매니페스트(아이콘/스플래시/테마) 구성


iOS/Safari 웹 푸시: 홈 화면 설치 PWA 조건 반영, 권한 UX 설계


WebView 권한/파일 업로드/깊은링크 점검 (iOS/Android)



5) 실시간 & 알림 (SSE + Web Push)
   SSE 커넥션 관리: heartbeat(30~60s), 지수 백오프 재연결


Last-Event-ID로 이벤트 재전송/중복 방지


서버리스 타임아웃/동시연결 한도 문서화(Vercel 한계)


알림 인박스(읽음/안읽음) DB 원천 기록 후 SSE/푸시로 전달


웹 푸시 구독 테이블(브라우저키, 유저, 테넌트, 토픽) 설계


토픽 설계: 스레드/멘션/업무 이벤트 수준


규모 확대 시 WebSocket(Pusher/Ably/Supabase Realtime) 전환 기준 정의



6) 백엔드 (Supabase + tRPC)
   Supabase 서비스 키 서버 사이드 전용 (클라이언트 노출 금지)


RLS 미사용 보완: 뷰/스토어드 프로시저에 tenant_id 강제 바인딩


tRPC 라우터: 입력/출력 Zod 스키마 전부 정의


API 에러 표준(에러코드/메시지/추적ID) 수립


감사지표: 누가/무엇/언제 변경했는지 감사로그 테이블



7) ORM & 마이그레이션
   Prisma 또는 Drizzle 중 하나만 선택 (팀 표준화)


마이그레이션 자동화 (CI: lint/test 후 db:migrate)


소프트 삭제(deleted_at), PITR 고려


대량 인덱스/쿼리 성능 점검(실행계획/슬로우쿼리)



8) 파일 스토리지 (Cloudflare R2)
   사전서명 URL 발급 + 만료/권한 제어


업로드 크기/타입 검증(프런트+백엔드 이중)


바이러스 스캔(워커) + 썸네일/리사이즈 파이프라인


버킷 수명주기(버전닝/아카이브) 정책



9) 큐/워커/배치
   리소스 작업(이미지/리포트/AI) 워커 전담


작업 큐 도입(Upstash Q/Cloudflare Queues/Inngest 등)


작업ID/상태 테이블 + 재시도/백오프/DLQ + idempotency key


예약/지연 실행 지원(스케줄러)



10) 캐시 & 레이트리밋 (Redis)
    서버리스 호환(Upstash Redis 등) 선택


키 규칙: env:tenant:<tenantId>:<domain>:<resource>:<id>


TTL 표준 + 조기 갱신(early refresh) + 지터(jitter)로 스탬피드 방지


슬라이딩 윈도우/토큰 버킷 레이트리밋 (엔드포인트·유저·테넌트·IP)


429 UX(재시도 지침/대기시간) 설계



11) 인증 & 세션 (Clerk)
    Org 매핑/초대/승인 플로우 정의


서버 신뢰 경계 확립(민감 로직은 서버 전용)


세션 만료/갱신 정책 + 보안 이벤트 알림


개인정보 최소화/민감정보 별도 저장



12) 결제 (Stripe)
    테넌트 ↔ Customer/Subscription 매핑 스키마


가격/플랜(좌석/사용량) 모델 정의, proration 처리


웹훅 서명 검증 + 재시도 내성 + idempotency


미수금(past_due) 처리/정지/복구 플로우


영수증/세금(Stripe Tax 필요 시) + 브랜드드 인보이스


무료 체험/해지 예약/환불 정책 문서화



13) 배포/환경 (Vercel)
    PR Preview → Staging → Prod 승격형 파이프라인


Staging 자동 db:migrate && seed + 데이터 비식별화


Dev/Staging/Prod 분리(Supabase/Redis/R2/Stripe/Clerk 키 분리)


환경변수/비밀 관리 + 키 로테이션 절차



14) 관측성/로그/트레이싱
    Sentry(웹/서버/워커) 통합


OpenTelemetry 트레이싱(요청→큐→워커 전 구간)


구조적 로그(JSON) + 요청ID/테넌트/사용자 태그


Vercel Analytics + Core Web Vitals 모니터링


대시보드: 오류율, LCP/INP/TTFB, SSE 재연결, 푸시 도달률, 레이트리밋 히트율



15) 테스트 & 품질관리
    단위(Jest/Vitest) + 컴포넌트(React Testing Library)


계약 테스트(tRPC + Zod 스키마 스냅샷)


e2e는 Playwright 또는 Cypress 중 하나 선택


접근성(aXe) & 성능(Lighthouse CI) 자동화


커버리지 게이트(임계 미달 시 머지 차단)


Stripe/Clerk/Web Push/업로드 회귀 테스트 세트 유지



16) 보안 & 컴플라이언스
    CSP/코르스/보안 헤더: Content-Security-Policy, X-Frame-Options, Referrer-Policy


업로드 보안: 확장자/컨텐트타입 이중 체크 + AV 스캔


비밀 스캔(pre-commit, CI) 도입


데이터 보존/파기 정책 + 백업/복구 절차 문서화


(의료 맥락 시) 민감정보 분리/마스킹, 접근 통제, 필요 시 규제(HIPAA 등) 검토



17) 데이터/시드/백업
    Idempotent 시드(반복 실행에도 동일 상태)


테넌트별 파라미터화된 샘플 사용자/권한/데이터


자동 백업 + 복구 리허설(주기적 테스트)


R2 수명주기 정책(버전닝/아카이브) 적용



18) 프로덕트 분석 & 실험
    PostHog/Amplitude 등 이벤트 수집(테넌트/역할 태깅)


퍼널/리텐션/사용성 계측(간호사 핵심 플로우 TTI)


피처 토글(테넌트 롤아웃) + 빠른 롤백 스위치



19) 간호사 친화 UX 디테일
    큰 입력/버튼, 터치 오류 방지 여백


오토세이브/Undo/에러 복구 UX


명확한 콘트라스트, 다크모드, 폰트 크기 프리셋


키보드 중심 워크플로(탭 순서/쇼트컷)


오프라인 지원(임시 저장/동기화 상태 표시)



20) 성능/웹 바이탈 & 품질 지표
    LCP/INP/TTFB SLO 설정, 페이지별 예산(budget)


이미지 최적화(next/image, AVIF/WebP), 코드 스플리팅


RSC 스트리밍/Prefetch, 중복 fetch 제거


캐시-HIT율/미스율 모니터링



21) 운영 정책
    장애 대응 runbook(알림 경로/우선순위/에스컬레이션)


변경관리(릴리스 트레인, 챈절로그, 버전 태깅)


고객 데이터 내보내기/삭제(포터빌리티/지우기 권리)



부록) 디폴트 기술 선택 요약
프런트: Next.js(App Router) + TanStack Query + shadcn/ui + next-intl + Framer Motion


백엔드: tRPC + Zod + Supabase(서버 전용) + Drizzle(또는 Prisma 단일)


실시간/푸시: 초기 SSE→확장 시 WS 서비스 검토, Push 구독/토픽 테이블


캐시/레이트: Upstash Redis, 네임스페이스/TTL/지터 규칙


큐/워커: Cloudflare Queues(or Upstash Q)+DLQ, 워커에서 리포트/이미지/AI


관측성: Sentry + OpenTelemetry + Vercel Analytics


CI/CD: GitHub Actions→Staging 자동 배포/마이그레이트→Prod 승인 승격


보안: CSP/업로드 스캔/감사로그/키 로테이션



Shifteasy(쉽지) 제품 정의 + 기술 체크리스트 통합본
1) 핵심 가치 제안 (Value Proposition)
   문제 정의: 교대 스케줄링 복잡/변경 잦음 → 엑셀/수기 비효율, 커뮤니케이션 비용 증가


해결책: 자동 스케줄링 + 실시간 변경/알림으로 관리자/직원 모두의 불편 최소화


핵심 지표: 스케줄 편성 소요시간 ↓, 스왑 처리 리드타임 ↓, 결원 알림 대응시간 ↓, 직원 만족도/채택률 ↑


2) 사용자/역할/테넌시
   테넌트=회사(병원/공장/콜센터/보안업체) 단위, 부서/병동 서브-스코프


역할: 관리자(매니저, 수간호사) / 직원(간호사 등) / 오너(결제/청구)


권한 매트릭스


관리자: 스케줄 생성/승인/공지, 스왑 승인/거절, 리포트 내보내기


직원: 내 스케줄 열람, 스왑 요청/응답, 공지 확인, 출퇴근 체크


오너: 결제/청구, 조직 설정, 관리자 위임


모든 API/쿼리에 tenantId 강제 (컨텍스트/DB/캐시/푸시 주제)


3) 핵심 기능 체크리스트
   (1) 인증/계정
   로그인/로그아웃/회원가입(초대코드 기반 테넌트 배정)


비밀번호 찾기/재설정, 이메일 검증


다중 테넌트 전환(Clerk Org switch)


(2) 대시보드
근무 현황 위젯(오늘/주/월, 병동별 필터, D/N/E 등 시프트 코드)


출퇴근 체크 요약


이슈 알림(결원/변경요청)


스케줄 트레이딩 상태(요청/결재중/승인)


결재 리스트(관리자 승인/거절)


KPI(편중도, 결근율, 초과근무 비율)


(3) 매니저 기능
자동 편성: 2교대/3교대/맞춤 패턴


규칙 엔진: 휴식/연속근무 한도, 숙련도/직무별 커버리지, 선호도


스케줄 승인/공지(앱/웹/메신저/캘린더)


변경요청 관리(스왑 승인/거절, 충돌 검사)


리포트(엑셀/PDF)


(4) 직원 기능
내 스케줄(달력/리스트)


스왑 요청/응답(확정 후)


공지/알림(읽음처리)


(5) 모바일/PWA 최적화
홈 화면 설치, 푸시, 오프라인-우선 폼(재전송)


웹뷰 권한/파일/딥링크


4) 화면 구성(플로우)
   로그인 → 회원가입 → 초대코드 → 테넌트 배정


대시보드 → 메뉴: [근무표/근무표 생성/내 스케줄/트레이드/리포트/설정]


근무표 생성(자동 배정 + 수동 수정)


직원 화면(내 스케줄/신청/알림)


리포트(근태 요약, 교대별 가동률, 결원 통계)


5) 데이터 모델(초안)
   Tenant(id, name, billing, settings)


Department/Ward(tenant_id, name)


User(tenant_id, role, profile)


ShiftType(tenant_id, code[D/E/N/O], start,end, color)


Pattern(tenant_id, name, sequence, constraints)


Schedule(tenant_id, period(start,end), status)


Assignment(schedule_id, user_id, shift_type_id, date, lock)


SwapRequest(tenant_id, requester_id, target_assignment_id, status, reason)


Approval(swap_request_id, approver_id, status, timestamps)


Attendance(assignment_id, clock_in, clock_out, notes)


Notification(tenant_id, user_id, type, payload, read_at)


PushSubscription(user_id, endpoint, keys, device, tenant_id)


CalendarLink(user_id, ics_token, visibility)


AuditLog(tenant_id, actor, action, entity, before/after)


Job(id, type, payload, status, attempts, next_run_at)


6) tRPC 라우터(초안)
   auth.org.switch, auth.me


schedule.generate, schedule.publish, schedule.list, schedule.get


assignment.listByUser, assignment.update (관리자), assignment.lock


swap.create, swap.respond, swap.approve, swap.reject, swap.list


attendance.clockIn, attendance.clockOut, attendance.report


kpi.overview, kpi.fairness, kpi.absenceRate


notification.feed, notification.read, push.subscribe/unsubscribe


calendar.ics(userToken), calendar.regenerateToken


report.exportXlsx, report.exportPdf (워커 잡 생성)


7) 자동 스케줄링 알고리즘 체크리스트
   하드 제약: 법정 근로시간/연속근무 상한/필수 휴식/면허/직무 커버리지/최소 인원


소프트 제약: 선호 시프트, 주당 분배 공정성, 주말/야간 균형, 팀별 순환


목적함수: 공정성(분산 최소화) + 인력 커버리지 부족 최소화 + 선호 충족도


솔버 접근: 휴리스틱(그리디+탭서치) → 필요 시 MILP/CP-SAT


엣지케이스: 갑작스런 결원, 교육/휴가 블록, 신규 직원 우선 배치


설명가능성: 배정 사유 로그(규칙/충돌/스코어)


8) 실시간/알림 설계
   SSE: heartbeat, lastEventId, 재연결 백오프(1→30s)


이벤트 토픽: schedule.published, swap.requested/approved/rejected, vacancy.detected, attendance.missed


웹 푸시: 구독 관리/토픽, 사일런트 푸시 + 인앱 토스트 연계


대체 경로: 규모↑ 시 WS(Pusher/Ably) 전환 기준/플랜


9) 통합/연동
   구글 캘린더: 개인별 ICS 읽기 전용 링크(토큰), 시간이동 시 자동 반영


메신저(선택): 이메일/슬랙/카카오 비즈 알림 정책


Stripe: 테넌트 구독/좌석/사용량, 웹훅 상태머신


10) UX 가이드(간호사 친화)
    큰 터치 타겟/높은 대비/폰트 프리셋


오토세이브/Undo, 오류 복구 UX


키보드 내비/숏컷, 모바일 제스처(스와이프 승인 등)


로딩/브랜드 인트로 Lottie(과용 금지), 자연스러운 모션


11) KPI/분석
    스케줄 편성 시간(관리자) / 스왑 리드타임 / 결원 대응시간


편중도 지표(Gini/분산) / 야간·주말 분배 비율


활성 사용자 비율, 푸시 opt-in율, 캘린더 구독수


12) 요금제(BM) 설계
    Free: 인원/부서 제한, 기본 뷰/스왑, ICS 링크


Pro: 자동 배정, 리포트, 푸시, 승인 워크플로, 기본 SLA


Enterprise: 고급 제약/알고리즘 튜닝, SSO(SAML), 역할 세분화, 감사/보존, 전용 지원


좌석/부서/사용량 기준 과금 정책 + 초과 과금 처리


13) 테스트 시나리오(샘플)
    자동 생성→수동 수정→승인→공지→직원 캘린더 반영


스왑 요청→상호 매칭→관리자 승인→알림/대시보드 업데이트


결원 탐지→대체 인력 추천→승인→재배치 알림


네트워크 오프라인→폼 큐잉→온라인 복귀 후 재전송


푸시 권한 부여/거부/재요청 플로우, iOS PWA 케이스


멀티테넌시 격리(다른 테넌트 데이터 접근 불가) e2e


14) 보안/컴플라이언스(요약)
    테넌트 격리 강제, 감사로그, RBAC, 민감정보 최소화/분리


업로드 검증/AV 스캔, CSP/보안헤더, 비밀 스캔


백업/복구/PITR 리허설, 데이터 보존/파기 정책


15) 롤아웃 계획
    파일럿(단일 병동/부서) → 다부서 확장 → 기관 전면 적용


파일럿 KPI: 배정 시간 50%↓, 스왑 리드타임 40%↓ 목표


피처 플래그로 점진적 롤아웃/롤백 스위치


16) 오픈 이슈/의사결정 필요사항
    자동 배정 알고리즘 수준(휴리스틱 vs. MILP)과 초기 범위


캘린더: ICS 단방향 vs. OAuth 양방향(복잡도↑)


알림 채널 우선순위(인앱/SSE/푸시/이메일)


요금제 경계값(인원/부서/푸시/리포트)

