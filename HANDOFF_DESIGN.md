# 간호사 인수인계 시스템 설계

## 문제 정의
- **현재 문제**: 인수인계에 평균 30~60분 소요, 정보 누락, 비표준화된 형식
- **목표**: 인수인계 시간 50% 단축, 정보 누락 제로, 표준화된 프로세스

## 핵심 기능

### 1. SBAR 기반 구조화 인수인계
**SBAR Framework** (국제 간호 표준):
- **S (Situation)**: 환자 현재 상황 - "무엇이 일어나고 있는가?"
- **B (Background)**: 배경 정보 - "임상적 배경은?"
- **A (Assessment)**: 평가 - "문제가 무엇이라고 생각하는가?"
- **R (Recommendation)**: 권고사항 - "무엇을 해야 하는가?"

### 2. 우선순위 시스템
- 🔴 **Critical**: 응급/중증 환자 (즉시 주의 필요)
- 🟠 **High**: 집중 관찰 필요
- 🟡 **Medium**: 일반 관찰
- 🟢 **Low**: 안정 상태

### 3. 빠른 입력 지원
- 템플릿 기반 입력
- 이전 근무 환자 목록 자동 불러오기
- 자주 사용하는 문구 라이브러리
- 음성 메모 지원 (추후)
- 사진 첨부 (차트, 상처 등)

### 4. 실시간 협업
- 인계자 작성 → 인수자 실시간 확인
- 질문/답변 기능
- 필수 체크리스트
- 확인 서명

### 5. 모바일 최적화
- 이동하면서 확인 가능
- 큰 터치 영역
- 다크모드 (야간 근무)
- 빠른 검색/필터

## 데이터 구조

### handoffs (인수인계 세션)
```typescript
{
  id: string;
  tenantId: string;
  departmentId: string;
  shiftDate: Date;
  shiftType: 'D' | 'E' | 'N'; // 주간/저녁/야간
  handoverUserId: string; // 인계자
  receiverUserId: string; // 인수자
  status: 'draft' | 'submitted' | 'in_review' | 'completed';
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // 소요 시간 (분)
  overallNotes?: string;
  metadata?: {
    totalPatients: number;
    criticalCount: number;
    checklistCompleted: boolean;
  };
}
```

### handoff_items (환자별 인수인계)
```typescript
{
  id: string;
  handoffId: string;
  patientIdentifier: string; // 환자 식별자 (암호화)
  roomNumber: string; // 병실 번호
  bedNumber?: string; // 침상 번호

  // 우선순위
  priority: 'critical' | 'high' | 'medium' | 'low';

  // SBAR
  situation: string; // 현재 상황
  background: string; // 진단명, 입원일, 수술/시술 이력
  assessment: string; // 현재 평가 (활력징후, 의식수준, 통증)
  recommendation: string; // 인수자가 해야 할 일

  // 세부 정보
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    consciousness?: string;
    painScore?: number;
  };

  medications?: Array<{
    name: string;
    time: string;
    route: string;
    note?: string;
  }>;

  scheduledProcedures?: Array<{
    procedure: string;
    scheduledTime: string;
    preparation?: string;
  }>;

  alerts?: Array<{
    type: 'allergy' | 'fall_risk' | 'infection' | 'isolation' | 'other';
    description: string;
  }>;

  // 상태 추적
  status: 'pending' | 'reviewed' | 'acknowledged';
  reviewedAt?: Date;
  questions?: Array<{
    question: string;
    answer?: string;
    askedAt: Date;
  }>;
}
```

### handoff_templates (템플릿)
```typescript
{
  id: string;
  tenantId: string;
  departmentId: string;
  name: string;
  description: string;
  isDefault: boolean;
  sections: Array<{
    name: string;
    fields: Array<{
      key: string;
      label: string;
      type: 'text' | 'textarea' | 'select' | 'checkbox';
      required: boolean;
      options?: string[];
    }>;
  }>;
}
```

## UI 화면 구성

### 1. 인수인계 대시보드
- 오늘의 인수인계 현황
- 내가 받을 인수인계 (인수자)
- 내가 할 인수인계 (인계자)
- 통계: 평균 시간, 완료율

### 2. 인수인계 작성 화면
- 환자 목록 (우선순위 정렬)
- 각 환자별 SBAR 입력
- 빠른 입력 도구
- 템플릿 선택
- 임시저장

### 3. 인수인계 확인 화면
- 환자별 카드 뷰
- 우선순위별 필터
- 체크리스트
- 질문하기
- 확인 서명

### 4. 환자 상세 화면
- SBAR 전체 정보
- 활력징후 그래프
- 투약 일정
- 예정 처치
- 과거 인수인계 이력

## 워크플로우

### 인계자 (교대 끝나는 간호사)
1. "인수인계 시작" 버튼 클릭
2. 담당 환자 목록 자동 불러오기
3. 각 환자별 SBAR 작성
   - 템플릿 선택 또는 이전 내용 불러오기
   - 변경사항 중심으로 작성
   - 우선순위 설정
4. 전체 검토 및 제출
5. 인수자 확인 대기

### 인수자 (교대 시작하는 간호사)
1. 인수인계 알림 받기
2. 환자 목록 확인 (우선순위 순)
3. Critical 환자부터 검토
4. 필요시 질문 등록
5. 각 환자별 "확인" 체크
6. 전체 완료 서명

## 성공 지표
- 평균 인수인계 시간: 30분 → 15분
- 정보 누락률: 0%
- 사용자 만족도: 90% 이상
- 인수인계 완료율: 100%

## 추후 확장 기능
- 음성 메모 (Speech-to-Text)
- AI 요약 기능
- 다국어 지원
- 환자 상태 트렌드 그래프
- 병원 EMR 연동
