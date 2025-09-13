# Phase 3: 실시간 통신 및 알림 시스템 구현

## 개요
- **작업 기간**: 2025년 1월 14일
- **작업 범위**: SSE, Web Push, 알림 시스템
- **주요 목표**: 실시간 이벤트 스트리밍 및 알림 인프라 구축

## 구현 내용

### 1. SSE (Server-Sent Events) 구현

#### 1.1 SSE 이벤트 매니저
**파일**: `/src/lib/sse/event-manager.ts`
- 클라이언트 연결 관리
- 이벤트 큐잉 시스템
- 토픽 기반 구독
- 자동 하트비트 (30초 간격)
- 재연결 시 이벤트 복구

**주요 기능**:
```typescript
- registerClient(): 클라이언트 등록
- sendToUser(): 특정 사용자에게 이벤트 전송
- sendToTopic(): 토픽 구독자에게 이벤트 전송
- broadcast(): 테넌트 내 모든 사용자에게 브로드캐스트
```

#### 1.2 SSE Manager
**파일**: `/src/lib/sse/sseManager.ts`
- 실시간 이벤트 타입 정의
- 클라이언트 연결 풀 관리
- 이벤트 헬퍼 함수
- 하트비트 관리

**이벤트 타입**:
```typescript
type SSEEventType =
  | 'schedule.updated'
  | 'schedule.published'
  | 'swap.requested'
  | 'swap.approved'
  | 'swap.rejected'
  | 'notification'
  | 'ping';
```

#### 1.3 SSE API 엔드포인트
**파일**: `/src/app/api/sse/route.ts`
- GET: SSE 스트림 연결
- 헤더 기반 인증 (x-tenant-id, x-user-id)
- 재연결 지원 (Last-Event-ID)
- CORS 지원

### 2. SSE 클라이언트 유틸리티

#### 2.1 SSE 클라이언트 클래스
**파일**: `/src/lib/sse/client.ts`

**주요 기능**:
- 자동 재연결 로직 (지수 백오프)
- 이벤트 핸들러 관리
- 연결 상태 모니터링
- React Hook 지원 (useSSE)

**재연결 전략**:
```typescript
- 기본 재연결 지연: 3초
- 최대 재연결 시도: 10회
- 지수 백오프: delay * 2^attempt
- 최대 지연: 60초
- Jitter 추가로 thundering herd 방지
```

### 3. Web Push 구독 관리

#### 3.1 Push 구독 매니저
**파일**: `/src/lib/push/subscription-manager.ts`

**주요 기능**:
- 구독 등록/해제
- 토픽 기반 구독 관리
- 사용자별 구독 인덱싱
- 만료된 구독 자동 정리
- 구독 통계 및 백업/복원

**데이터 구조**:
```typescript
interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string; };
  userId: string;
  tenantId: string;
  topics: string[];
  createdAt: Date;
  expirationTime?: number | null;
}
```

#### 3.2 Push API 엔드포인트
**파일**: `/src/app/api/push/subscribe/route.ts`
- POST: Push 구독 등록
- DELETE: Push 구독 해제
- 토픽 기반 구독 지원
- Zod 스키마 검증

### 4. 통합 알림 서비스

#### 4.1 알림 서비스
**파일**: `/src/lib/notifications/notification-service.ts`

**알림 타입**:
```typescript
type NotificationType =
  | 'schedule_published'
  | 'schedule_updated'
  | 'swap_requested'
  | 'swap_approved'
  | 'swap_rejected'
  | 'emergency_call'
  | 'shift_reminder'
  | 'general';
```

**우선순위 레벨**:
- `low`: 일반 정보
- `medium`: 중요 업데이트
- `high`: 즉시 확인 필요
- `urgent`: 긴급 알림 (Emergency)

**주요 기능**:
- 사용자별 알림 인박스
- 읽음/안읽음 상태 관리
- 액션 버튼 지원
- SSE와 Push 통합 전송
- 토픽 기반 브로드캐스트

#### 4.2 알림 API 엔드포인트
**파일**: `/src/app/api/notifications/route.ts`
- GET: 알림 인박스 조회
- POST: 알림 전송
- PATCH: 읽음 처리
- DELETE: 알림 전체 삭제

### 5. 이벤트 시스템

#### 5.1 스케줄 이벤트
- **스케줄 발행**: 새 스케줄 발행 시 영향받는 직원들에게 알림
- **스케줄 업데이트**: 스케줄 변경 시 실시간 업데이트

#### 5.2 스왑 이벤트
- **스왑 요청**: 대상 직원에게 승인/거절 액션 포함 알림
- **스왑 승인/거절**: 요청자에게 결과 알림

#### 5.3 긴급 호출
- **우선순위**: urgent
- **대상**: 특정 병동 또는 선택된 직원
- **액션**: 즉시 수락 버튼

### 6. 실시간 API 테스트 페이지

**파일**: `/src/app/api-test/realtime/page.tsx`

**기능**:
1. **SSE 이벤트 모니터링**
   - 연결 상태 표시
   - 실시간 이벤트 로그
   - 이벤트 타입별 필터링

2. **Push 알림 테스트**
   - 구독/구독 해제
   - 테스트 Push 전송
   - 토픽 선택

3. **알림 인박스**
   - 알림 목록 조회
   - 읽음 처리
   - 액션 버튼 테스트
   - 일괄 삭제

## 기술 스택
- **SSE**: EventSource API, ReadableStream
- **Push**: Web Push Protocol (모의 구현)
- **실시간 통신**: Server-Sent Events
- **상태 관리**: Singleton Pattern
- **검증**: Zod Schema

## 보안 고려사항
1. **인증/인가**
   - 헤더 기반 테넌트/사용자 식별
   - 토픽 구독 권한 관리

2. **데이터 보호**
   - Push 키 안전한 저장
   - 이벤트 데이터 암호화 (프로덕션)

3. **리소스 관리**
   - 클라이언트당 이벤트 큐 제한 (100개)
   - 자동 연결 정리
   - 메모리 누수 방지

## 성능 최적화
1. **연결 관리**
   - 하트비트로 연결 유지
   - 자동 재연결
   - 연결 풀링

2. **이벤트 전송**
   - 배치 전송 지원
   - 토픽 기반 필터링
   - 이벤트 큐잉

3. **클라이언트 최적화**
   - 지수 백오프 재연결
   - 이벤트 디바운싱
   - 메모리 효율적 이벤트 저장

## 테스트 방법

### SSE 테스트
1. `/api-test/realtime` 페이지 접속
2. SSE 연결 상태 확인
3. 테스트 이벤트 전송
4. 이벤트 로그 확인

### Push 알림 테스트
1. Push 구독 버튼 클릭
2. 테스트 알림 전송
3. 콘솔에서 Push 전송 로그 확인

### 알림 인박스 테스트
1. 다양한 우선순위 알림 전송
2. 읽음 처리 테스트
3. 액션 버튼 동작 확인
4. 일괄 삭제 테스트

## 향후 개선사항
1. **실제 Web Push 구현**
   - Service Worker 등록
   - VAPID 키 생성
   - Push 서버 구축

2. **이벤트 영속성**
   - Redis/Database 이벤트 저장
   - 이벤트 히스토리 관리
   - 오프라인 동기화

3. **고급 기능**
   - 이벤트 필터링/검색
   - 알림 그룹핑
   - 사용자 선호도 설정
   - 알림 스케줄링

4. **모니터링**
   - 연결 메트릭스
   - 이벤트 전송 통계
   - 에러 추적
   - 성능 대시보드