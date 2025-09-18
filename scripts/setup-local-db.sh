#!/bin/bash

# ShiftEasy Local Database Setup Script
# 이 스크립트는 팀원들이 로컬 개발 환경을 쉽게 설정할 수 있도록 도와줍니다.

set -e # 에러 발생 시 즉시 종료

echo "🚀 ShiftEasy 로컬 데이터베이스 설정 시작..."
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# PostgreSQL 설치 확인
check_postgres() {
    if command -v psql &> /dev/null; then
        echo "✅ PostgreSQL이 설치되어 있습니다."
        return 0
    else
        echo -e "${YELLOW}⚠️  PostgreSQL이 설치되어 있지 않습니다.${NC}"
        echo ""

        # OS별 설치 가이드
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "macOS에서 PostgreSQL 설치:"
            echo "  brew install postgresql@16"
            echo "  brew services start postgresql@16"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            echo "Linux에서 PostgreSQL 설치:"
            echo "  sudo apt-get update"
            echo "  sudo apt-get install postgresql postgresql-contrib"
        fi

        echo ""
        read -p "PostgreSQL을 설치한 후 계속하시겠습니까? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# 데이터베이스 생성
create_database() {
    DB_NAME="shifteasy"
    DB_USER=$(whoami)

    echo "📦 데이터베이스 생성 중..."

    # 데이터베이스 존재 확인
    if psql -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
        echo -e "${YELLOW}⚠️  데이터베이스 '$DB_NAME'가 이미 존재합니다.${NC}"
        read -p "기존 데이터베이스를 삭제하고 새로 생성하시겠습니까? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "기존 데이터베이스 삭제 중..."
            dropdb -U $DB_USER $DB_NAME 2>/dev/null || true
            createdb -U $DB_USER $DB_NAME
            echo "✅ 데이터베이스가 재생성되었습니다."
        fi
    else
        createdb -U $DB_USER $DB_NAME
        echo "✅ 데이터베이스 '$DB_NAME'가 생성되었습니다."
    fi
}

# 환경 변수 파일 설정
setup_env() {
    ENV_FILE=".env.local"
    DB_USER=$(whoami)

    echo "🔧 환경 변수 설정 중..."

    if [ ! -f "$ENV_FILE" ]; then
        echo "# Local Development Environment
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database (Local PostgreSQL)
DATABASE_URL=postgresql://$DB_USER@localhost:5432/shifteasy

# Authentication (Clerk) - 테스트 키
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YWJsZS1tdXN0YW5nLTE1LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_oa1ZdbWfuYftfCwmEjjP686ruOymIKIUwLhmCeVUpN
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
CLERK_WEBHOOK_SECRET=whsec_FPE/MHwRfZP6+owVq74VaDxCBi60s8+G

# 기타 설정 (개발용 placeholder)
STRIPE_SECRET_KEY=sk_test_your-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-key
STRIPE_WEBHOOK_SECRET=whsec_your-secret" > $ENV_FILE

        echo "✅ .env.local 파일이 생성되었습니다."
    else
        echo -e "${YELLOW}ℹ️  .env.local 파일이 이미 존재합니다.${NC}"
        echo "   DATABASE_URL이 다음과 같이 설정되어 있는지 확인하세요:"
        echo "   postgresql://$DB_USER@localhost:5432/shifteasy"
    fi
}

# 마이그레이션 실행
run_migrations() {
    echo "🗄️  데이터베이스 마이그레이션 실행 중..."

    # Drizzle 마이그레이션 실행
    npm run db:push

    echo "✅ 마이그레이션이 완료되었습니다."
}

# 시드 데이터 생성
seed_database() {
    echo "🌱 시드 데이터 생성 중..."

    # 테스트 테넌트 생성
    DATABASE_URL=postgresql://$(whoami)@localhost:5432/shifteasy npx tsx src/db/seed-tenant.ts

    echo "✅ 시드 데이터가 생성되었습니다."
}

# 메인 실행 흐름
main() {
    echo "======================================"
    echo "   ShiftEasy 로컬 DB 설정 스크립트"
    echo "======================================"
    echo ""

    # 1. PostgreSQL 확인
    check_postgres

    # 2. 데이터베이스 생성
    create_database

    # 3. 환경 변수 설정
    setup_env

    # 4. npm 패키지 설치
    echo "📦 npm 패키지 설치 중..."
    npm install
    echo "✅ npm 패키지 설치 완료"

    # 5. 마이그레이션 실행
    run_migrations

    # 6. 시드 데이터 생성
    read -p "테스트 데이터를 생성하시겠습니까? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        seed_database
    fi

    echo ""
    echo "======================================"
    echo -e "${GREEN}✅ 로컬 데이터베이스 설정이 완료되었습니다!${NC}"
    echo "======================================"
    echo ""
    echo "다음 명령어로 개발 서버를 시작하세요:"
    echo "  npm run dev"
    echo ""
    echo "테스트 계정 정보는 시드 데이터 생성 시 출력됩니다."
    echo ""
}

# 스크립트 실행
main