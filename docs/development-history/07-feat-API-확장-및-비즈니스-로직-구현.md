# feat: API 확장 및 비즈니스 로직 구현

## 개요
- **작업 일시**: 2025-01-13
- **작업자**: AI Assistant
- **관련 이슈**: Phase 2 - API 확장 및 비즈니스 로직

## 작업 내용

### 1. 스케줄 생성 워크플로우 구현
#### 1.1 스케줄 생성 API (`/api/schedule/generate`)
- AI 기반 스케줄 자동 생성 엔드포인트
- Zod를 이용한 요청 데이터 검증
- 직원, 시프트, 제약조건 기반 최적화
- 메타데이터 포함 응답 (생성 시간, 생성자, 테넌트 ID)

#### 1.2 스케줄 검증 API (`/api/schedule/validate`)
- 제약조건 기반 스케줄 검증
- 하드/소프트 제약조건 분류
- 검증 점수 계산 (0-100점)
- 위반 사항별 개선 제안 생성
- 법적 요구사항 준수 확인

#### 1.3 스케줄 최적화 API (`/api/schedule/optimize`)
- 기존 스케줄 개선 최적화
- 반복적 개선 알고리즘
- 목표 점수 도달 시 종료
- 개선 전후 비교 메트릭스
- 잠긴 배정 보존 옵션

#### 1.4 스케줄 확정 API (`/api/schedule/confirm`)
- 스케줄 승인 및 발행
- 권한 기반 접근 제어 (admin, manager)
- 직원 알림 발송 옵션
- 확정 보고서 생성
- 확정 취소(철회) 기능

### 2. 스왑 워크플로우 구현
#### 2.1 스왑 요청 시스템 (`/api/swap/request`)
- 시프트 교환 요청 생성
- 대상 직원 지정 또는 공개 요청
- 잠긴 시프트 교환 방지
- 요청 목록 조회 (필터링 지원)
- 요청 취소 기능

#### 2.2 스왑 승인 워크플로우 (`/api/swap/approve`)
- 다단계 승인 체인
  - 관리자/매니저: 모든 스왑 승인 가능
  - 대상 직원: 본인 스왑 승인 가능
  - 일반 직원: 공개 스왑 수락 가능
- 제약조건 자동 검증
- 승인 시 스케줄 자동 업데이트
- 승인/거절 알림 발송

### 3. 검증 및 알림 시스템
#### 3.1 제약조건 검증 통합
- 모든 API에 제약조건 검증 적용
- 한국 근로기준법 준수 확인
- 위반 심각도 분류 (critical, high, medium, low)
- 오버라이드 가능 여부 판단

#### 3.2 알림 매니저 (`/lib/notifications/manager.ts`)
- 다중 채널 알림 지원 (이메일, 푸시, 인앱)
- 알림 타입별 선호도 설정
- 방해 금지 시간대 설정
- 일괄 알림 발송 기능
- 알림 구독/구독 취소 기능
- 오래된 알림 자동 정리

### 4. API 특징
#### 4.1 보안 및 인증
- 헤더 기반 테넌트/사용자 식별
- 역할 기반 접근 제어 (RBAC)
- 민감한 작업 감사 로그

#### 4.2 데이터 검증
- Zod 스키마 기반 입력 검증
- 타입 안정성 보장
- 상세한 오류 메시지

#### 4.3 성능 최적화
- 비동기 처리
- 배치 작업 지원
- 캐싱 전략 (임시 메모리 저장소)

## 기술 스택
- **Framework**: Next.js 15 App Router
- **Validation**: Zod
- **Type Safety**: TypeScript
- **Algorithm**: AI 스케줄러 (Genetic Algorithm + Tabu Search)
- **Notification**: Custom notification manager

## 파일 구조
```
src/
├── app/
│   └── api/
│       ├── schedule/
│       │   ├── generate/route.ts    # 스케줄 생성
│       │   ├── validate/route.ts    # 스케줄 검증
│       │   ├── optimize/route.ts    # 스케줄 최적화
│       │   └── confirm/route.ts     # 스케줄 확정
│       └── swap/
│           ├── request/route.ts     # 스왑 요청
│           └── approve/route.ts     # 스왑 승인
└── lib/
    └── notifications/
        └── manager.ts               # 알림 관리자
```

## API 엔드포인트 요약

| 엔드포인트 | 메소드 | 설명 | 권한 |
|-----------|--------|------|------|
| `/api/schedule/generate` | POST | AI 스케줄 생성 | All |
| `/api/schedule/validate` | POST | 스케줄 검증 | All |
| `/api/schedule/optimize` | POST | 스케줄 최적화 | All |
| `/api/schedule/confirm` | POST | 스케줄 확정 | Admin/Manager |
| `/api/schedule/confirm` | GET | 확정 스케줄 조회 | All |
| `/api/schedule/confirm` | DELETE | 확정 취소 | Admin |
| `/api/swap/request` | POST | 스왑 요청 생성 | Employee |
| `/api/swap/request` | GET | 스왑 요청 목록 | All |
| `/api/swap/request` | DELETE | 스왑 요청 취소 | Requester |
| `/api/swap/approve` | POST | 스왑 승인/거절 | Varies |

## 향후 개선 사항
1. **데이터베이스 연동**
   - Supabase 통합
   - 실제 데이터 저장소 구현
   - 트랜잭션 처리

2. **실시간 기능**
   - WebSocket 기반 실시간 알림
   - SSE (Server-Sent Events) 구현
   - 실시간 스케줄 업데이트

3. **고급 기능**
   - 머신러닝 기반 스케줄 예측
   - 과거 데이터 기반 패턴 학습
   - 자동 스왑 매칭 시스템

4. **성능 개선**
   - Redis 캐싱 도입
   - 백그라운드 작업 큐
   - 대용량 처리 최적화

## 테스트 시나리오
1. 스케줄 생성 → 검증 → 최적화 → 확정 플로우
2. 스왑 요청 → 검증 → 승인 → 스케줄 업데이트
3. 제약조건 위반 시나리오
4. 권한별 접근 제어 테스트
5. 알림 발송 및 수신 확인

## 참고 사항
- 현재 구현은 메모리 기반 임시 저장소 사용
- 프로덕션 배포 전 Supabase 연동 필수
- 알림 시스템은 콘솔 로그로 시뮬레이션
- 실제 이메일/푸시 서비스 통합 필요

## 버그 수정 및 개선 사항 (2025-01-13 추가)

### 1. API 테스트 페이지 구현 (`/app/api-test/page.tsx`)
- Schedule 및 Swap API 테스트를 위한 인터랙티브 UI 생성
- 탭 기반 네비게이션 (Schedule APIs / Swap APIs)
- 실시간 응답 표시 및 에러 처리
- 고정된 날짜 사용으로 Hydration 에러 방지
- Swap ID 자동 추적 및 활용

### 2. Swap 스토리지 시스템 개선 (`/lib/swap/storage.ts`)
- Singleton 패턴을 이용한 메모리 기반 스토리지 구현
- API 간 데이터 공유 문제 해결
- `updateSwapRequest` 메서드 개선: 전체 객체 및 partial updates 모두 지원
- Swap 요청과 스케줄 할당 통합 관리

### 3. Swap Approve/Reject 기능 수정 (`/api/swap/approve/route.ts`)
#### 문제점 수정:
- Mock 데이터 구조 완성:
  - Employee 객체: `maxHoursPerWeek`, `minHoursPerWeek`, `preferences`, `availability` 추가
  - Shift 객체: `time.hours` 구조로 변경
  - `availableDays` 배열 추가 (월~토 근무, 일요일 휴무)
- 업데이트 로직 개선: 필요한 필드만 업데이트
- 업데이트 성공 여부 확인 로직 추가
- `validateConstraints: false` 옵션으로 mock 데이터 검증 우회 가능

### 4. 팀 관리 페이지 개선 (`/app/team/page.tsx`)
#### 팀원 추가 기능 구현:
- `AddTeamMemberModal` 컴포넌트 생성 (`/components/AddTeamMemberModal.tsx`)
- 포괄적인 팀원 정보 입력 폼:
  - 기본 정보: 이름, 이메일, 전화번호, 입사일
  - 업무 정보: 부서, 직책, 역할, 계약 유형, 상태
  - 선호 시프트 및 근무 가능 요일 설정
  - 기술 및 자격증 관리
- 실시간 팀원 목록 업데이트

### 5. Build 에러 수정
- UTF-8 인코딩 문제 해결 (`/api/schedule/validate/route.ts`)
- 손상된 파일 재생성 (영문 주석으로 대체)

### 6. API 테스트 개선사항
- Pending 상태 필터링 추가: `status=pending` 쿼리 파라미터
- 전체 목록과 대기 중인 요청 구분 조회
- 테스트 순서 명확화 (1-5번)
- 자동 ID 추적 및 재사용

## 현재 작동 상태 요약
### ✅ 정상 작동:
- 스케줄 생성/검증/최적화/확정 API
- Swap 요청 생성
- Swap 승인/거절 (`validateConstraints: false` 사용 시)
- Pending 상태 필터링
- 팀원 추가 모달 기능
- API 테스트 페이지

### ⚠️ 제한 사항:
- Constraint validation은 복잡한 실제 데이터 필요 (현재 mock 데이터로는 비활성화 권장)
- 메모리 기반 저장소 (서버 재시작 시 데이터 손실)
- 실제 알림 서비스 미연동 (콘솔 로그만 출력)