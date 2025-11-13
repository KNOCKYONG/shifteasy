# Stripe 결제 연동 메모

> 2025-xx-xx: Stripe 실결제 연결 전까지 참고용으로 스캐폴딩 상태를 정리했습니다. 현재 코드는 “결제 비활성화 모드”로 안전하게 동작하며, 여기에 적힌 절차대로 키를 주입하면 바로 연결할 수 있습니다.

## 1. 현재 구현 상태 요약

- 테넌트 스키마(`src/db/schema/tenants.ts`)에 Stripe 관련 메타데이터가 추가됨:
  - `billingEmail`, `billingStatus`, `stripeCustomerId`, `stripeSubscriptionId`, `billingPeriodEnd`, `trialEndsAt`, `billingMetadata`.
  - 마이그레이션 파일: `drizzle/0011_add_tenant_billing_columns.sql`. `npm run db:push` 후 적용.
- Stripe SDK(`stripe@^16.6.0`) 기반 유틸:
  - `src/lib/payments/stripe.ts`: 클라이언트 생성, 가격 ID 매핑, 기본 Success/Cancel URL.
  - `src/lib/payments/billing-service.ts`: Customer 생성, subscription/invoice 이벤트 처리, 테넌트 상태 업데이트.
- App Router API 엔드포인트:
  - `POST /api/billing/checkout-session`: 결제 세션 생성. `tenant:billing` 권한 필수.
  - `POST /api/billing/customer-portal`: Stripe Customer Portal 링크.
  - `POST /api/webhooks/stripe`: Stripe 이벤트 수신 → 테넌트 결제 상태 동기화.
- Stripe 환경변수가 미설정이면 각 API가 501(Not Implemented)을 반환하여 안전하게 꺼진 상태를 유지.

## 2. 환경 변수 체크리스트

`.env.local` (또는 배포 환경) 추가 항목:

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx   # 기본 Pro 월간
STRIPE_PRICE_PRO_YEARLY=price_xxx    # 기본 Pro 연간 (옵션)
STRIPE_PRICE_ENTERPRISE=price_xxx    # 엔터프라이즈 가격 (옵션)
APP_URL=https://app.shifteasy.com    # 성공/취소 리다이렉트 기본값
```

- 가격 ID는 Checkout에서 기본값으로 사용되며, API 요청에서 `priceId`를 덮어쓸 수 있습니다.
- `APP_URL`이 없으면 `NEXT_PUBLIC_APP_URL` → `http://localhost:3000` 순으로 fallback.

## 3. API 플로우 정리

### 3.1 Checkout Session (`/api/billing/checkout-session`)

- 입력: `priceId?`, `quantity?`, `successUrl?`, `cancelUrl?`, `billingEmail?`.
- 검증: Stripe 키 존재 여부 → 테넌트 컨텍스트/권한 → payload Zod 검증.
- 동작: `ensureStripeCustomer`로 Customer 보장 → `checkout.sessions.create` → session URL 반환.
- Seat 수량 기본값: 요청값 → `tenant.billingMetadata.seatQuantity` → `tenant.settings.maxUsers` → 1.

### 3.2 Customer Portal (`/api/billing/customer-portal`)

- 입력: `returnUrl?`.
- Customer 없으면 자동 생성.
- Portal 세션 URL 반환 → UI에서 링크 오픈.

### 3.3 Stripe Webhook (`/api/webhooks/stripe`)

- `runtime = 'nodejs'` (Edge 불가).
- 서명 검증 후 `handleStripeEvent` 호출.
- 대응 이벤트:
  - `checkout.session.completed`: 최초 결제 성공 시 trial→active 전환 준비.
  - `customer.subscription.created/updated/deleted`: Billing status, 기간 종료일, 좌석 수량 갱신.
  - `invoice.payment_failed/succeeded`: `past_due`/`active` 업데이트 + 마지막 에러 메모.
- 미처리 이벤트는 로그만 남김. 필요 시 여기서 분기 추가.

## 4. 권한 & UI 연동 포인트

- 두 Billing API는 `Permission.TENANT_BILLING (tenant:billing)` 필요.
- RBAC 매핑 (`src/lib/auth/rbac.ts`): 현재 Owner만 해당 권한을 가지고 있으므로 Admin/Manager에게 열 계획이면 Role 매트릭스 갱신 필요.
- 프런트엔드:
  - `/settings/billing` 페이지에서 “플랜 업그레이드” 클릭 시 Checkout API 호출 → Stripe URL로 리다이렉트.
  - “결제 정보 관리” 버튼에서 Customer Portal API 호출.
  - API 응답이 501이면 “아직 결제 연동 준비 중” 메시지 표시하도록 방어.

## 5. 실제 결제 연결 체크리스트

1. **Stripe Dashboard**
   - 제품/가격(Price) 생성 → env에 기록.
   - Webhook 엔드포인트 등록: `{APP_URL}/api/webhooks/stripe`.
   - Events: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed/succeeded`.
2. **환경 변수 배포**
   - Dev/Staging/Prod 각각 별도 키 사용.
   - Vercel/Render 등 배포 환경에 같은 값 설정.
3. **DB 적용**
   - `npm run db:push`로 빌링 컬럼 적용.
   - 기존 테넌트에 기본 `billing_status = inactive` 세팅 확인.
4. **UI 스위치**
   - Billing 페이지에서 API 호출 로직 붙이기.
   - 501 처리문구 제거 후 실제 CTA 노출.
5. **QA 시나리오**
   - 신규 테넌트 → Checkout → 구독 생성 → webhook으로 상태 전환되는지 확인.
   - 카드 실패 이벤트로 `past_due` 전환 테스트.
   - Customer Portal에서 결제 수단 변경/취소 후 상태 동기화 확인.

## 6. 추후 고도화 아이디어

- **좌석 수량 동기화**: 현재 Subscription line item 1개만 가정. 멀티 라인/사용량 과금 필요 시 `billingMetadata` 구조 확장.
- **Plan Enforcement**: `billingStatus !== 'active'`일 때 주요 기능 제한. 예: 스케줄 발행 차단.
- **Email/Slack 알림**: `past_due` 되면 관리자에게 알림 발송.
- **Tax/Invoice 커스터마이징**: Stripe Tax, branded invoice 필요 시 `billingMetadata`에 국가/사업자 정보 추가.
- **Self-serve Downgrade**: Portal에서 플랜 변경 가능하게 Price를 Product에 매핑하거나, 내부 `/api/billing/update-plan` API 추가.

## 7. 참고 파일 목록

- `README.md` ― Stripe 환경변수 및 엔드포인트 개요.
- `src/lib/payments/stripe.ts` ― 기본 설정/URL 도우미.
- `src/lib/payments/billing-service.ts` ― 모든 Stripe↔DB 동기화 로직.
- `src/app/api/billing/*` ― Checkout & Portal 핸들러.
- `src/app/api/webhooks/stripe/route.ts` ― 웹훅 엔트리 포인트.
- `prds` 문서: `prd_backend.md` 11장 결제 요구사항. (실 구현 시 이 문서도 갱신 필요)

필요 시 이 문서에 실제 키/테넌트 맵핑 내역을 추가하거나, QA 체크리스트를 확장해서 사용하세요.
