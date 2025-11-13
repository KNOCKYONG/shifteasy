# ShiftEasy - 스마트한 근무 스케줄 관리 시스템

## 📋 프로젝트 소개

ShiftEasy는 병원 및 의료 기관을 위한 스마트한 근무 스케줄 관리 시스템입니다.
간편한 스케줄 생성, 실시간 근무 교대 신청, 공정한 근무 분배를 지원합니다.

## 🚀 빠른 시작 (로컬 개발 환경)

### 필수 요구사항

- Node.js 18.x 이상
- PostgreSQL 14.x 이상
- npm 또는 pnpm

### 1. 자동 설정 (권장)

```bash
# 프로젝트 클론
git clone https://github.com/your-org/shifteasy.git
cd shifteasy

# 자동 설정 스크립트 실행
npm run db:setup
```

이 스크립트는 다음 작업을 자동으로 수행합니다:
- PostgreSQL 설치 확인
- 데이터베이스 생성
- 환경 변수 설정
- 마이그레이션 실행
- 테스트 데이터 생성

### 2. 수동 설정

#### PostgreSQL 설치

**macOS:**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

#### 데이터베이스 생성

```bash
# 데이터베이스 생성
createdb shifteasy

# 또는 psql로 생성
psql -c "CREATE DATABASE shifteasy;"
```

#### 환경 변수 설정

`.env.local` 파일을 생성하고 다음 내용을 추가:

```env
# Database (Local PostgreSQL)
DATABASE_URL=postgresql://[YOUR_USERNAME]@localhost:5432/shifteasy

# Authentication (Clerk) - 개발용 테스트 키
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YWJsZS1tdXN0YW5nLTE1LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_oa1ZdbWfuYftfCwmEjjP686ruOymIKIUwLhmCeVUpN

# Stripe (선구축용 선택 사항)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx
STRIPE_PRICE_ENTERPRISE=price_xxx

# 기타 설정
NODE_ENV=development
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**참고:** `[YOUR_USERNAME]`을 실제 시스템 사용자명으로 변경하세요 (예: `whoami` 명령어로 확인)

#### 의존성 설치 및 마이그레이션

```bash
# 패키지 설치
npm install

# 데이터베이스 마이그레이션
npm run db:push

# 테스트 데이터 생성 (선택사항)
npm run db:seed
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 📁 데이터베이스 관리

### 주요 명령어

```bash
# 초기 설정 (테이블 생성 + 테스트 데이터)
npm run db:setup

# 데이터베이스 초기화 (모든 데이터 삭제 후 재생성)
npm run db:reset

# 스키마 관리
npm run db:generate      # 마이그레이션 파일 생성
npm run db:push          # 스키마를 DB에 적용
npm run db:migrate       # 마이그레이션 실행

# 데이터 관리
npm run db:init          # 테스트 데이터 생성
npm run db:studio        # GUI 데이터베이스 관리 도구

# 데이터 확인 (디버깅용)
npm run db:check         # 모든 데이터 확인
npm run db:check:users   # 사용자 데이터만 확인
npm run db:check:summary # 데이터베이스 요약 정보
```

### 팀 협업 가이드

#### 스키마 변경 시

1. `src/db/schema/` 폴더에서 스키마 수정
2. 마이그레이션 파일 생성:
   ```bash
   npm run db:generate
   ```
3. 생성된 마이그레이션 파일을 Git에 커밋
4. 팀원들은 pull 후 다음 실행:
   ```bash
   npm run db:push
   ```

#### 테스트 데이터 공유

`src/db/initialize.ts` 파일에 모든 초기 데이터가 중앙 집중식으로 관리됩니다.

```bash
# 테스트 데이터 생성
npm run db:init
```

생성되는 테스트 데이터:
- **테넌트**: 서울대학교병원
- **시크릿 코드**: (실행 시 자동 생성)
- **부서**: 10개 (응급실, 중환자실, 내과, 외과, 소아과 등)
- **관리자**: admin@seoul-hospital.com
- **수간호사**: manager_er@seoul-hospital.com, manager_icu@seoul-hospital.com 등
- **간호사**: nurse_im@seoul-hospital.com, nurse_gs@seoul-hospital.com 등
- **총 사용자**: 21명 (관리자 1명 + 각 부서별 2명)

## 🏗️ 프로젝트 구조

```
shifteasy/
├── src/
│   ├── app/               # Next.js App Router
│   ├── components/        # React 컴포넌트
│   ├── db/
│   │   ├── index.ts       # 데이터베이스 연결
│   │   ├── initialize.ts  # ⭐ 중앙 집중식 초기 데이터
│   │   ├── utils.ts       # 데이터 확인 유틸리티
│   │   ├── schema/        # Drizzle 스키마 정의
│   │   └── migrations/    # 마이그레이션 파일
│   ├── lib/               # 유틸리티 함수
│   │   ├── auth/          # 인증 관련 (Clerk, RBAC)
│   │   └── db/            # DB 헬퍼 (테넌트 격리)
│   └── types/             # TypeScript 타입 정의
├── docs/
│   └── development-history/ # 개발 히스토리 문서
├── PROJECT_CONVENTIONS.md # 프로젝트 규칙
├── drizzle.config.ts      # Drizzle 설정
└── package.json
```

## 🔧 기술 스택

- **Frontend**: Next.js 15, React 19, TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: Clerk
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query

## 💳 Stripe 결제 스캐폴딩

Stripe 연동은 아직 실제 서비스에 연결하지 않지만, 다음 API로 미리 구축되어 있습니다.

- `POST /api/billing/checkout-session`: 테넌트 관리자(tenant:billing 권한)가 결제 세션을 생성합니다. `priceId`, `quantity`, `billingEmail`, `successUrl`, `cancelUrl`을 전달할 수 있으며, 환경 변수에 기본 가격이 없으면 400을 반환합니다.
- `POST /api/billing/customer-portal`: Stripe Customer Portal 세션을 생성하여 카드/청구 정보를 self-service로 관리할 수 있습니다.
- `POST /api/webhooks/stripe`: Stripe 웹훅 엔드포인트로, `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_*` 이벤트를 수신해 테넌트의 결제 상태를 동기화합니다.

> **주의:** `STRIPE_SECRET_KEY`와 `STRIPE_WEBHOOK_SECRET`이 설정되어 있지 않으면 각 API는 501(미구현) 상태를 반환하므로, 실 결제 연결 전까지 안전하게 비활성화된 상태를 유지합니다.

## 🐛 문제 해결

### PostgreSQL 연결 오류

```bash
# PostgreSQL 서비스 상태 확인
brew services list | grep postgresql

# 서비스 재시작
brew services restart postgresql@16
```

### 데이터베이스 권한 오류

```bash
# 현재 사용자로 데이터베이스 생성
createdb -U $(whoami) shifteasy
```

### 환경 변수 문제

- `.env.local` 파일이 올바르게 설정되었는지 확인
- `DATABASE_URL`의 사용자명이 시스템 사용자명과 일치하는지 확인

## 📝 개발 가이드

### 브랜치 전략

- `main`: 프로덕션 브랜치
- `develop`: 개발 브랜치
- `feature/*`: 기능 개발
- `fix/*`: 버그 수정

### 커밋 컨벤션

```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 추가
chore: 빌드 업무 수정
```

## 📄 라이선스

MIT License

## 🤝 기여하기

Pull Request는 언제나 환영합니다!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
