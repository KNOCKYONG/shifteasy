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

## 연락처
문의사항이나 제안사항이 있으시면 이슈를 생성해 주세요.