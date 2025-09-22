# Supabase 테이블 정리 가이드 (Drizzle 사용)

## 📋 개요
ShiftEasy 프로젝트의 Legacy 테이블들을 Drizzle ORM을 통해 정리하는 가이드입니다.

## 🔧 Drizzle 마이그레이션
이미 생성된 마이그레이션 파일: `src/db/migrations/0003_watery_living_mummy.sql`

## 🗑️ 삭제 대상 테이블 (Legacy)

### 병원/병동 관련 (Multi-tenant로 이전됨)
- `hospitals` → `tenants`로 대체
- `wards` → `departments`로 대체
- `staff` → `users`로 대체
- `staff_compatibility` → 사용 안함

### 스케줄 관련 (새 구조로 이전됨)
- `shifts` → `shiftTypes`로 대체
- `ward_schedules` → `schedules`로 대체
- `ward_assignments` → `schedules`에 통합
- `preferences` → `users.metadata`로 이전
- `requests` → `swapRequests`로 대체

## ✅ 유지할 테이블 (현재 사용 중)

### Core Multi-tenant
- `tenants` - 조직/병원 정보
- `departments` - 부서 정보
- `users` - 사용자 정보

### 스케줄링
- `schedules` - 스케줄 정보
- `shiftTypes` - 근무 유형 정의
- `patterns` - 근무 패턴
- `shift_assignments` - 근무 할당

### 기능 테이블
- `swapRequests` - 근무 교대 요청
- `notifications` - 알림
- `attendance` - 출근 기록
- `pushSubscriptions` - 푸시 알림 구독

### 시스템
- `audit_log` - 감사 로그
- `system_config` - 시스템 설정

## 🚀 실행 방법

### 방법 1: Supabase Dashboard에서 실행 (권장)

1. [Supabase Dashboard](https://supabase.com/dashboard) 로그인
2. 프로젝트 선택
3. SQL Editor 이동
4. 다음 SQL 실행 (Drizzle이 자동 생성한 마이그레이션):

```sql
-- 백업 생성 (선택사항 - 실행 전에 수행)
CREATE SCHEMA IF NOT EXISTS backup_legacy;
CREATE TABLE IF EXISTS backup_legacy.hospitals AS SELECT * FROM hospitals;
CREATE TABLE IF EXISTS backup_legacy.wards AS SELECT * FROM wards;
CREATE TABLE IF EXISTS backup_legacy.staff AS SELECT * FROM staff;
CREATE TABLE IF EXISTS backup_legacy.staff_compatibility AS SELECT * FROM staff_compatibility;
CREATE TABLE IF EXISTS backup_legacy.shifts AS SELECT * FROM shifts;
CREATE TABLE IF EXISTS backup_legacy.ward_schedules AS SELECT * FROM ward_schedules;
CREATE TABLE IF EXISTS backup_legacy.ward_assignments AS SELECT * FROM ward_assignments;
CREATE TABLE IF EXISTS backup_legacy.preferences AS SELECT * FROM preferences;
CREATE TABLE IF EXISTS backup_legacy.requests AS SELECT * FROM requests;

-- Drizzle 마이그레이션 실행 (src/db/migrations/0003_watery_living_mummy.sql)
DROP TABLE "ward_assignments" CASCADE;
DROP TABLE "hospitals" CASCADE;
DROP TABLE "wards" CASCADE;
DROP TABLE "staff" CASCADE;
DROP TABLE "staff_compatibility" CASCADE;
DROP TABLE "shifts" CASCADE;
DROP TABLE "ward_schedules" CASCADE;
DROP TABLE "preferences" CASCADE;
DROP TABLE "requests" CASCADE;
ALTER TABLE "tenants" DROP COLUMN "billing_info";
DROP TYPE "public"."staff_role";
DROP TYPE "public"."shift_type";
DROP TYPE "public"."schedule_status";
DROP TYPE "public"."request_priority";
DROP TYPE "public"."request_status";
DROP TYPE "public"."request_type";
```

### 방법 2: Drizzle Kit 사용 (자동화)

```bash
# 1. 스키마 변경사항 확인
npm run db:generate

# 2. 마이그레이션 적용 (interactive 모드)
npm run db:push

# 3. 또는 마이그레이션 파일 직접 실행
supabase db execute -f src/db/migrations/0003_watery_living_mummy.sql
```

## ⚠️ 주의사항

1. **백업 필수**: 테이블 삭제 전 반드시 데이터 백업
2. **의존성 확인**: 외래 키 제약 조건 확인
3. **애플리케이션 확인**: 코드에서 legacy 테이블 참조 제거 확인
4. **단계별 실행**: 한번에 모두 삭제하지 말고 단계별로 진행

## 🔍 정리 후 확인

```sql
-- 현재 테이블 목록 확인
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 예상 결과:
-- attendance
-- audit_log
-- departments
-- notifications
-- patterns
-- pushSubscriptions
-- schedules
-- shiftTypes
-- shift_assignments
-- swapRequests
-- system_config
-- tenants
-- users
```

## 📝 코드 변경사항

### 제거된 파일들
- `src/db/schema/hospitals.ts`
- `src/db/schema/wards.ts`
- `src/db/schema/staff.ts`
- `src/db/schema/shifts.ts`
- `src/db/schema/schedules.ts`
- `src/db/schema/assignments.ts`
- `src/db/schema/preferences.ts`
- `src/db/schema/requests.ts`

### 수정된 파일
- `src/db/schema/index.ts` - Legacy export 제거

### 생성된 파일
- `src/db/migrations/0003_watery_living_mummy.sql` - Drizzle 자동 생성 마이그레이션

## 🔄 롤백 방법

백업을 생성했다면:

```sql
-- Legacy 테이블 복원
CREATE TABLE hospitals AS SELECT * FROM backup_legacy.hospitals;
CREATE TABLE wards AS SELECT * FROM backup_legacy.wards;
-- ... (필요한 테이블 복원)

-- 백업 스키마 삭제
DROP SCHEMA backup_legacy CASCADE;
```

## ✨ 정리 효과

- 데이터베이스 구조 단순화
- 중복 테이블 제거
- Multi-tenant 구조로 통합
- 유지보수성 향상
- 스토리지 절약