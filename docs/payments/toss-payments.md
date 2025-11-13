# Toss Payments 연동 가이드

이 문서는 ShiftEasy에 토스페이먼츠를 연결할 때 필요한 환경 변수, API 흐름, 데이터 모델을 정리합니다.

## 1. 환경 변수

`.env.local` 혹은 배포 환경에 다음 값을 설정하세요.

| 변수 | 설명 |
| --- | --- |
| `TOSS_SECRET_KEY` | 토스 결제 비밀키(서버용). `Basic` 인증에 사용됩니다. |
| `TOSS_CLIENT_KEY` | 결제 위젯 초기화 시 사용하는 클라이언트 키. (프런트) |
| `TOSS_WEBHOOK_SECRET` | 웹훅 서명 검증에 사용되는 시크릿. |
| `TOSS_API_BASE_URL` *(옵션)* | 기본값은 `https://api.tosspayments.com`. Sandbox 사용 시 엔드포인트를 오버라이드할 수 있습니다. |

## 2. 데이터 모델

- `payments` 테이블: 주문번호(`order_id`), 결제키(`toss_payment_key`), 결제 금액/상태/실패 코드 등을 저장합니다.
- `subscriptions` 테이블: 정기결제나 빌링키(`toss_billing_key`)를 보관하고, 테넌트별 플랜 상태를 기록합니다.

두 테이블 모두 `drizzle/0011_add_payments_tables.sql` 마이그레이션과 `src/db/schema/payments.ts`에 정의되어 있으며, `npm run db:push`로 생성할 수 있습니다.

## 3. 서버 API

| 엔드포인트 | 설명 |
| --- | --- |
| `POST /api/payments/toss/order` | 주문번호/고객키를 발급합니다. `amount`, `currency`, `plan` 등을 전달하면 `payments` 테이블에 `requested` 상태로 저장됩니다. |
| `POST /api/payments/toss/confirm` | 토스 위젯이 반환한 `paymentKey`, `orderId`, `amount`를 검증하고 승인합니다. 성공 시 `payments` 상태가 `paid`로 바뀝니다. |
| `POST /api/webhooks/toss` | 토스 웹훅을 수신해 결제 상태 변동(DONE/FAILED/CANCELED 등)을 동기화합니다. `TOSS_WEBHOOK_SECRET` 기반 HMAC 서명을 검증합니다. |

모든 결제 API는 `tenant:billing` 권한이 있는 사용자만 접근할 수 있도록 보호되어 있습니다.

## 4. 연동 플로우

1. **주문 생성**: Billing 페이지에서 금액/플랜을 선택하고 `POST /api/payments/toss/order`로 주문번호와 고객키를 발급받습니다.
2. **결제 진행**: 프런트엔드에서 토스 결제 위젯을 초기화 (`TOSS_CLIENT_KEY`, `customerKey`, `orderId`, `amount`).
3. **승인 요청**: 위젯 결과로 받은 `paymentKey`를 `POST /api/payments/toss/confirm` API로 전달해 승인.
4. **웹훅 처리**: 토스가 전송하는 웹훅을 `/api/webhooks/toss`에서 수신 → `payments` 상태 업데이트. 재전송 대비로 idempotent하게 구현되어 있습니다.
5. **플랜 갱신**: 결제 성공 후 테넌트의 `plan`, `settings.planExpiresAt` 등을 업데이트하는 로직을 후속 작업으로 연결합니다.

## 5. 테스트 팁

- 토스 콘솔 Sandbox 모드에서는 테스트 카드/계좌번호를 사용할 수 있습니다.
- 로컬 테스트 시 `ngrok` 등으로 웹훅을 터널링하고, `TOSS_WEBHOOK_SECRET`을 동일하게 맞춰야 합니다.
- 실패/취소, 부분 취소 시나리오까지 QA하여 `payments.status` 값이 `failed`/`canceled`/`refunded`로 정상 전환되는지 확인하세요.

## 6. 향후 작업 아이디어

- 정기결제(billing key) 발급 및 `subscriptions` 테이블 업데이트
- 결제 내역 조회 UI (`/settings/billing/history` 등)
- 결제 실패 알림/자동 재시도 및 테넌트 플랜 제한 적용
- 환불/취소 API 래퍼 (`POST /v1/payments/{paymentKey}/cancel`)

필요 시 이 문서를 계속 확장하면서 운영 절차(환불 정책, 세금계산서 처리 등)를 함께 정리하세요.
