# ShiftEasy 프로젝트 규칙

## 🚨 중요 규칙 (Claude에게)

### 데이터베이스 초기화 워크플로우

#### 1️⃣ 새로운 데이터 추가가 필요할 때
1. **임시 파일 생성**: `src/db/temp-[기능명].ts` 생성하여 테스트
   ```typescript
   // src/db/temp-add-notifications.ts
   import { db } from '@/db';
   // ... 새로운 데이터 추가 코드
   ```

2. **테스트 실행**: `tsx src/db/temp-[기능명].ts`

3. **⭐ 필수: initialize.ts에 통합**
   - 테스트 완료 후 반드시 `initialize.ts`에 코드 통합
   - 임시 파일은 즉시 삭제
   - "initialize.ts에 통합했습니다" 메시지 필수

#### 2️⃣ 최종 상태
- **모든 초기 데이터는 `src/db/initialize.ts`에만 존재**
- 별도의 seed 파일이나 temp 파일 유지 금지
- 새로운 테스트 데이터가 필요하면 initialize.ts를 수정

### 파일 구조
```
src/db/
├── initialize.ts     # ⭐ 모든 초기 데이터는 여기에만
├── utils.ts         # 📊 데이터 확인/디버깅 유틸리티
├── schema/          # 스키마 정의
└── index.ts         # DB 연결
```

### 유틸리티 명령어
```bash
npm run db:check          # 모든 데이터 확인
npm run db:check:users    # 사용자만 확인
npm run db:check:clerk    # Clerk 사용자 확인
npm run db:check:summary  # 데이터 요약
```

### 초기화 스크립트 구조
```typescript
// src/db/initialize.ts
async function initializeDatabase() {
  // 1. 테넌트
  // 2. 부서
  // 3. 근무 유형
  // 4. 사용자
  // 5. 추가 설정 (여기에 계속 추가)
}
```

### 명령어
- `npm run db:init` - 초기 데이터 생성
- `npm run db:setup` - 테이블 + 초기 데이터
- `npm run db:reset` - 완전 초기화

## 개발 상태
- **현재 단계**: 스키마 설계 중 (자유롭게 변경 가능)
- **데이터베이스**: 로컬 PostgreSQL 사용
- **프로덕션 전환**: 스키마 확정 후 Supabase로 이전 예정

## Claude에게 요청할 때
"initialize.ts에 [새로운 데이터] 추가해줘"
"스키마 변경했으니 initialize.ts도 업데이트해줘"