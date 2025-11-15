# ShiftEasy - 프로젝트 가이드라인

## 프로젝트 개요
ShiftEasy는 의료, 제조, 서비스 산업을 위한 지능형 근무 스케줄 관리 시스템입니다.

## 기술 스택
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **Database**: Supabase
- **i18n**: react-i18next
- **UI Components**: Custom components with Lucide icons

## 다국어(i18n) 관리 가이드라인

### 지원 언어
- 한국어 (ko) - 기본
- 영어 (en)
- 일본어 (ja)

### 번역 파일 구조
```
src/lib/i18n/
├── settings.ts         # i18n 설정
├── client.ts          # 클라이언트 컴포넌트용
├── index.ts           # 서버 컴포넌트용
└── locales/
    ├── ko/
    │   ├── common.json    # 공통 텍스트
    │   ├── schedule.json  # 스케줄 페이지
    │   ├── team.json      # 팀 관리 페이지
    │   └── config.json    # 설정 페이지
    ├── en/
    │   └── ... (동일 구조)
    └── ja/
        └── ... (동일 구조)
```

### 텍스트 추가/수정/삭제 가이드라인

#### 1. 텍스트 추가 시
모든 언어 파일에 동일한 키로 번역을 추가해야 합니다.

**예시: 새로운 버튼 텍스트 추가**
```json
// ko/common.json
{
  "buttons": {
    "newFeature": "새 기능"
  }
}

// en/common.json
{
  "buttons": {
    "newFeature": "New Feature"
  }
}

// ja/common.json
{
  "buttons": {
    "newFeature": "新機能"
  }
}
```

**컴포넌트에서 사용:**
```tsx
const { t } = useTranslation('common');
<button>{t('buttons.newFeature')}</button>
```

#### 2. 텍스트 수정 시
모든 언어 파일에서 해당 키의 값을 동시에 수정합니다.

```json
// 모든 언어 파일에서 동일한 키를 찾아 수정
"title": "기존 텍스트" → "새로운 텍스트"
```

#### 3. 텍스트 삭제 시
1. 모든 언어 파일에서 해당 키를 삭제
2. 컴포넌트에서 해당 키를 사용하는 부분 제거

#### 4. 동적 텍스트 처리
변수가 포함된 텍스트는 interpolation을 사용합니다.

```json
// 번역 파일
{
  "greeting": "안녕하세요, {{name}}님!"
}
```

```tsx
// 컴포넌트
t('greeting', { name: userName })
```

### 새로운 페이지 추가 시 체크리스트

- [ ] 각 언어별 번역 파일 생성 (`ko`, `en`, `ja`)
- [ ] 페이지 컴포넌트에 `useTranslation` 훅 추가
- [ ] 하드코딩된 텍스트를 모두 `t()` 함수로 변환
- [ ] 날짜 포맷팅에 적절한 locale 적용
- [ ] 동적 텍스트는 interpolation 사용
- [ ] 모든 언어에서 UI 레이아웃 확인

### 컴포넌트별 i18n 적용 현황

#### ✅ 완료된 컴포넌트
- `src/app/schedule/page.tsx` - 스케줄 페이지
- `src/app/team/page.tsx` - 팀 관리 페이지
- `src/app/config/page.tsx` - 설정 페이지 (부분 완료)
- `src/components/LanguageSwitcher.tsx` - 언어 전환 UI
- `src/components/providers/I18nProvider.tsx` - i18n Provider

#### ⏳ 추가 작업 필요
- `src/components/schedule/ScheduleBoard.tsx`
- `src/components/schedule/MonthView.tsx`
- `src/components/schedule/ShiftCell.tsx`
- `src/components/schedule/StaffCard.tsx`
- `src/components/notifications/NotificationCenter.tsx`

### 번역 컨벤션

#### 키 네이밍 규칙
- 소문자와 camelCase 사용
- 계층 구조로 그룹화
- 의미있는 네임스페이스 사용

```json
{
  "page": {
    "title": "페이지 제목",
    "subtitle": "부제목"
  },
  "buttons": {
    "save": "저장",
    "cancel": "취소"
  },
  "alerts": {
    "success": "성공",
    "error": "오류"
  }
}
```

#### 일관성 유지
- 동일한 기능은 동일한 용어 사용
- 각 언어의 공식 용어 준수
- 톤 앤 매너 일관성 유지

### 테스트 가이드

#### 언어 전환 테스트
1. 각 언어로 전환하여 모든 텍스트 확인
2. 레이아웃 깨짐 확인
3. 날짜/숫자 포맷 확인
4. 동적 콘텐츠 확인

#### 누락된 번역 확인
```bash
# 콘솔에서 누락된 키 확인
# i18next missing key 경고 확인
```

### 문제 해결

#### 번역이 표시되지 않을 때
1. 번역 파일 경로 확인
2. 키 이름 오타 확인
3. namespace 설정 확인
4. 언어 설정 확인

#### 레이아웃이 깨질 때
1. 긴 텍스트를 위한 반응형 디자인 적용
2. 텍스트 줄바꿈 처리
3. 폰트 크기 조정

### 모범 사례

1. **컴포넌트 단위 번역**: 각 컴포넌트는 자체 namespace 사용
2. **재사용 가능한 텍스트**: common namespace에 저장
3. **타입 안정성**: TypeScript 타입 정의 추가
4. **성능 최적화**: 필요한 namespace만 로드
5. **접근성**: 모든 언어에서 스크린 리더 지원

### 향후 개선 사항

- [ ] 번역 키 자동 추출 도구 도입
- [ ] 번역 검증 자동화
- [ ] 더 많은 언어 지원
- [ ] RTL 언어 지원
- [ ] 언어별 날짜/시간 형식 최적화

## 기여 가이드

### 텍스트 변경 시 워크플로우
1. 기능 브랜치 생성
2. 모든 언어 파일 업데이트
3. 컴포넌트 수정
4. 모든 언어로 테스트
5. PR 생성 시 변경사항 명시

### 커밋 메시지 컨벤션
```
i18n: Add translation for [feature]
i18n: Update [language] translations
i18n: Fix missing translation in [component]
```

## 대시보드 개발 가이드라인

### 대시보드 컴포넌트 구조
- **위치**: `src/components/dashboard/AdminDashboard.tsx`
- **데이터 소스**: tRPC `api.schedule.getDashboardData`
- **백엔드**: `src/server/api/routers/schedule.ts`

### 네비게이션 패턴

#### ✅ 올바른 패턴 (Link + div)
```tsx
<Link href="/schedule" className="block">
  <div className="p-4 bg-white rounded-lg border hover:shadow-lg cursor-pointer">
    {/* 카드 내용 */}
  </div>
</Link>
```

#### ❌ 잘못된 패턴 (Link + Card 중첩)
```tsx
<Link href="/schedule">
  <Card className="p-4 hover:shadow-lg cursor-pointer">
    {/* 카드 내용 */}
  </Card>
</Link>
```

**이유**: `<Link><Card>` 중첩 구조는 HTML 시맨틱 오류를 발생시켜 클릭 이벤트가 차단됩니다.

### 데이터 집계 로직 주의사항

#### 근무자 카운트 (`workingToday`)

**반드시 제외해야 할 시프트 타입**:
- `'O'` - 휴무 (OFF day)
- `'OFF'` - 휴무 (영문)
- `'off'` - 휴무 (소문자)
- 연차, 휴가, 병가 등 비근무 상태

**올바른 필터링 로직**:
```typescript
const isNonWorkingShift = (assignment: any): boolean => {
  if (!assignment.shiftId && !assignment.shiftType) return true; // 빈 배정

  const nonWorkingCodes = ['off', 'O', 'OFF', 'LEAVE', 'VAC', '연차'];

  return (
    nonWorkingCodes.includes(assignment.shiftId?.toUpperCase()) ||
    nonWorkingCodes.includes(assignment.shiftType?.toUpperCase())
  );
};

// 사용 예시
const workingToday = assignments.filter(assignment => {
  const assignmentDate = new Date(assignment.date).toISOString().split('T')[0];
  const isToday = assignmentDate === todayStr;
  const isWorking = !isNonWorkingShift(assignment);
  return isToday && isWorking;
}).length;
```

### 통계 카드 추가 시 체크리스트

- [ ] href 경로 정확하게 설정
- [ ] Link 컴포넌트 직접 사용 (Card 중첩 금지)
- [ ] 데이터 집계 로직에 비근무 타입 제외 확인
- [ ] 로딩 상태 처리 (`isLoading` 확인)
- [ ] 다크모드 스타일 적용
- [ ] 호버 효과 및 커서 스타일 설정

### 대시보드 성능 최적화

```tsx
// 데이터 캐싱 설정
const { data, isLoading } = api.schedule.getDashboardData.useQuery(undefined, {
  staleTime: 2 * 60 * 1000, // 2분 캐시
  refetchOnWindowFocus: false, // 포커스 시 재요청 비활성화
});
```

### 일반적인 실수와 해결 방법

#### 문제 1: 클릭이 작동하지 않음
- **원인**: Card 컴포넌트가 Link 내부에 중첩됨
- **해결**: Link에 직접 스타일 적용하고 div 사용

#### 문제 2: 잘못된 카운트
- **원인**: OFF/연차 등 비근무 타입이 포함됨
- **해결**: 모든 비근무 코드를 명시적으로 제외

#### 문제 3: 데이터 깜빡임
- **원인**: 캐싱 설정 누락
- **해결**: `staleTime` 및 `refetchOnWindowFocus` 설정

## API 라우트 개발 가이드라인 (Next.js 14 App Router)

### 필수 설정: Route Segment Config

**모든 API 라우트**는 다음 설정을 **반드시 포함**해야 합니다:

```typescript
// src/app/api/your-route/route.ts
export const dynamic = 'force-dynamic';
export const maxDuration = 10; // 10초 최대 실행 시간
```

### 왜 필요한가?

1. **`export const dynamic = 'force-dynamic'`**
   - API 라우트가 매 요청마다 동적으로 실행되도록 강제
   - 캐싱 방지 (API는 항상 최신 데이터 제공해야 함)
   - 없으면 빌드 타임에 정적으로 생성될 수 있음

2. **`export const maxDuration = 10`**
   - Vercel 서버리스 함수 최대 실행 시간 제한
   - 리소스 낭비 방지 (무한 루프, 데드락 등)
   - Vercel 비용 최적화 (실행 시간 = 비용)
   - 기본값 없음 → 명시적 설정 필수

### 표준 API 라우트 템플릿

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';

// 🔥 필수: Route Segment Config
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

// Request validation schema
const RequestSchema = z.object({
  // ... your schema
});

export async function POST(req: NextRequest) {
  try {
    // 1. 인증 확인
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 요청 데이터 검증
    const body = await req.json();
    const validated = RequestSchema.parse(body);

    // 3. 비즈니스 로직 실행
    const result = await yourBusinessLogic(validated);

    // 4. 응답 반환
    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error('API Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 특수 케이스: 긴 실행 시간이 필요한 경우

파일 업로드, 대용량 데이터 처리 등:

```typescript
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60초 (파일 업로드 등)

// 또는 Edge Runtime 사용 (더 빠르고 저렴)
export const runtime = 'edge';
export const maxDuration = 30;
```

### API 라우트 타입별 권장 설정

| 용도 | maxDuration | runtime | 예시 |
|------|-------------|---------|------|
| 일반 CRUD | 10초 | nodejs | 데이터 조회, 생성, 수정, 삭제 |
| 파일 업로드 | 60초 | nodejs | 이미지/문서 업로드 |
| 대용량 처리 | 30초 | nodejs | 리포트 생성, 배치 작업 |
| 간단한 조회 | 5초 | edge | 정적 데이터 조회 |
| Webhook | 10초 | nodejs | 외부 서비스 콜백 |
| SSE (실시간) | 300초 | nodejs | Server-Sent Events |

### 체크리스트: 새 API 라우트 생성 시

- [ ] `export const dynamic = 'force-dynamic'` 추가
- [ ] `export const maxDuration = 10` 추가 (또는 적절한 값)
- [ ] Zod 스키마로 요청 데이터 검증
- [ ] `getCurrentUser()`로 인증 확인
- [ ] try-catch로 에러 핸들링
- [ ] 적절한 HTTP 상태 코드 반환 (200, 400, 401, 500 등)
- [ ] TypeScript 타입 안전성 확보
- [ ] 민감 정보 로깅 방지

### 금지 사항

❌ **절대 하지 말 것**:
```typescript
// ❌ dynamic 설정 누락
export async function POST(req: NextRequest) { ... }

// ❌ maxDuration 설정 누락
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) { ... }

// ❌ vercel.json의 functions 패턴 사용 (App Router에서 작동 안 함)
{
  "functions": {
    "api/**/*.ts": { "memory": 512 }  // ❌ 작동 안 함
  }
}
```

✅ **올바른 방법**:
```typescript
// ✅ 모든 설정 포함
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(req: NextRequest) { ... }
```

### 성능 최적화 팁

1. **데이터베이스 쿼리 최적화**
   - 인덱스 활용 (`docs/DATABASE_INDEX_RECOMMENDATIONS.md` 참고)
   - N+1 쿼리 방지
   - 필요한 컬럼만 SELECT

2. **응답 크기 최소화**
   - 필요한 데이터만 반환
   - 페이지네이션 적용
   - gzip 압축 활용

3. **캐싱 전략**
   - React Query로 클라이언트 캐싱 (5분 권장)
   - Redis로 서버 캐싱 (선택사항)
   - HTTP 캐시 헤더 활용

4. **병렬 처리**
   - 독립적인 작업은 `Promise.all()` 사용
   - 순차 처리 최소화

### 디버깅 및 모니터링

```typescript
// 개발 환경에서만 상세 로그
if (process.env.NODE_ENV === 'development') {
  console.log('Request:', { body, user });
}

// 프로덕션 환경에서는 에러만
console.error('API Error:', {
  route: '/api/your-route',
  error: error.message,
  userId: user?.id,
});
```

### 참고 자료

- [Next.js Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
- [Vercel Function Duration Limits](https://vercel.com/docs/functions/serverless-functions/runtimes#max-duration)
- 프로젝트 내부: `docs/DATABASE_INDEX_RECOMMENDATIONS.md`

---

## 연락처
문의사항이나 제안사항이 있으시면 이슈를 생성해 주세요.