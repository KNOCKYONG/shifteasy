# 📊 ShiftEasy 스케줄링 로직 개선 제안서

## 1. 실제 근무표 분석 결과

### 1.1 기본 통계
- **분석 기간**: 2025년 1월 ~ 9월 (9개월)
- **총 인원**: 35명
  - Unit Manager: 1명 (박선미)
  - FRN: 2명 (이다운, 이경은)
  - RN: 32명 (Senior 5명, Mid 10명, Junior 17명)

### 1.2 근무 유형 (Shift Types)
```
D   - Day shift (07:00 - 15:00)
E   - Evening shift (15:00 - 23:00)
N   - Night shift (23:00 - 07:00)
DL  - Day Leader (07:00 - 15:00) - Senior RN만 가능
EL  - Evening Leader (15:00 - 23:00) - Senior RN만 가능
11D - Late Day shift (11:00 - 19:00)
OFF - 휴무
```

### 1.3 발견된 패턴

#### 근무 전환 패턴 (Shift Transitions)
가장 빈번한 패턴:
1. `D → E` (Day to Evening) - 자연스러운 전환
2. `E → N` (Evening to Night) - 점진적 시간 이동
3. `N → OFF` (Night to Off) - 야간 후 휴식
4. `OFF → D` (Off to Day) - 휴식 후 주간 시작
5. `DL → D` (Day Leader to Day) - 리더 역할 후 일반 근무

금지된 패턴:
- `N → D` (Night to Day) - 발생 0회
- `N → E` (Night to Evening) - 매우 드물게 발생

#### 연속 근무 패턴
- 최대 연속 근무: 5-6일
- 일반적 패턴: 3-4일 연속 근무 후 1-2일 휴무
- 야간 근무는 최대 3일 연속

### 1.4 일별 필요 인원
```
주간(D/DL/11D): 평균 10-12명
저녁(E/EL): 평균 8-10명
야간(N): 평균 6-8명
```

## 2. 핵심 개선 사항

### 2.1 제약 조건 체계 (Constraint System)

#### Hard Constraints (필수 준수)
```typescript
interface HardConstraints {
  maxConsecutiveDays: 5;           // 최대 연속 근무일
  maxConsecutiveNights: 3;         // 최대 연속 야간 근무
  minRestAfterNight: 24;           // 야간 후 최소 휴식(시간)
  forbiddenTransitions: ['N→D', 'N→E']; // 금지된 전환
  minStaffPerShift: {
    day: 8,
    evening: 6,
    night: 5
  };
}
```

#### Soft Constraints (선호 사항)
```typescript
interface SoftConstraints {
  preferredTransitions: ['D→E', 'E→N', 'N→OFF'];
  targetConsecutiveDays: 3-4;
  weekendDistribution: 'fair';     // 주말 근무 공평 분배
  leaderRotation: 'weekly';         // 리더 역할 주단위 순환
}
```

### 2.2 스케줄링 알고리즘 개선

#### Phase 1: Pattern-Based Generation
```typescript
class PatternBasedScheduler {
  // 실제 데이터에서 학습한 패턴 적용
  private patterns = {
    'D-E-N-OFF-OFF': 0.15,  // 15% 확률
    'D-D-E-E-OFF': 0.12,     // 12% 확률
    'N-N-N-OFF-OFF': 0.10,   // 10% 확률
    // ... 더 많은 패턴
  };

  generateSchedule(nurse: Nurse, month: Date) {
    // 1. 간호사 경력 레벨 확인
    // 2. 가능한 패턴 필터링
    // 3. 가중치 기반 패턴 선택
    // 4. 제약 조건 검증
    return schedule;
  }
}
```

#### Phase 2: Coverage-Driven Assignment
```typescript
class CoverageOptimizer {
  optimizeCoverage(date: Date) {
    const required = {
      day: this.calculateDayRequirement(date),
      evening: this.calculateEveningRequirement(date),
      night: this.calculateNightRequirement(date)
    };

    // 우선순위 기반 할당
    // 1. Senior RN → Leader roles (DL/EL)
    // 2. Experienced RN → Critical shifts
    // 3. Junior RN → Standard shifts with supervision
  }
}
```

#### Phase 3: Fairness Balancer
```typescript
class FairnessBalancer {
  private metrics = {
    totalHours: Map<string, number>,
    nightShifts: Map<string, number>,
    weekendShifts: Map<string, number>,
    leaderShifts: Map<string, number>
  };

  balanceWorkload() {
    // 표준편차 최소화 알고리즘
    // 모든 간호사의 근무 부담 균등화
  }
}
```

### 2.3 AI/ML 기반 최적화

#### Reinforcement Learning 적용
```typescript
class RLScheduleOptimizer {
  private model: tf.Sequential;

  async train() {
    // State: 현재 스케줄 상태
    // Action: 근무 할당
    // Reward: 제약 충족도 + 공정성 점수 + 선호도 만족도

    const state = this.encodeScheduleState();
    const action = await this.model.predict(state);
    const reward = this.calculateReward(action);

    // Q-learning 또는 PPO 알고리즘 적용
  }
}
```

#### Pattern Recognition
```typescript
class PatternRecognizer {
  analyzeHistoricalData() {
    // LSTM 네트워크로 시계열 패턴 학습
    // 계절성, 휴가 패턴, 특별 이벤트 고려
  }

  predictFutureNeeds() {
    // 과거 데이터 기반 미래 수요 예측
    // 인플루엔자 시즌, 휴가철 등 고려
  }
}
```

## 3. 구현 로드맵

### Phase 1: 기본 제약 시스템 (2주)
- [ ] Hard constraints 엔진 구현
- [ ] Soft constraints 평가 시스템
- [ ] 제약 위반 검증 도구

### Phase 2: 패턴 기반 생성 (3주)
- [ ] 패턴 라이브러리 구축
- [ ] 패턴 매칭 알고리즘
- [ ] 경력 레벨별 차별화

### Phase 3: 최적화 엔진 (3주)
- [ ] Coverage optimizer
- [ ] Fairness balancer
- [ ] Preference manager

### Phase 4: UI/UX 개선 (2주)
- [ ] 드래그 앤 드롭 스케줄 편집
- [ ] 실시간 제약 검증
- [ ] 충돌 해결 제안

### Phase 5: AI 통합 (4주)
- [ ] TensorFlow.js 통합
- [ ] 모델 학습 파이프라인
- [ ] 예측 시스템 구축

## 4. 예상 효과

### 정량적 개선
- **스케줄 생성 시간**: 2시간 → 5분 (96% 감소)
- **제약 위반**: 월 평균 15건 → 0건
- **공정성 지수**: 표준편차 30% 감소
- **만족도**: 70% → 90% 상승 예상

### 정성적 개선
- 투명하고 공정한 스케줄링
- 개인 선호도 반영 증가
- 번아웃 예방 효과
- 팀 만족도 향상

## 5. 기술 스택

### Backend
```typescript
// Drizzle ORM Schema
export const scheduleOptimization = pgTable('schedule_optimization', {
  id: uuid('id').primaryKey(),
  scheduleId: uuid('schedule_id').references(() => schedules.id),
  optimizationScore: real('optimization_score'),
  constraints: jsonb('constraints'),
  patterns: jsonb('patterns'),
  mlPredictions: jsonb('ml_predictions')
});
```

### Frontend
```tsx
// React Component
const ScheduleOptimizer: React.FC = () => {
  const [constraints, setConstraints] = useState<Constraints>();
  const [schedule, setSchedule] = useState<Schedule>();

  const optimizeSchedule = async () => {
    const result = await api.optimize({
      constraints,
      preferences: userPreferences,
      historicalData: pastSchedules
    });
    setSchedule(result);
  };

  return (
    <div className="schedule-optimizer">
      <ConstraintEditor onChange={setConstraints} />
      <ScheduleViewer schedule={schedule} />
      <OptimizationMetrics />
    </div>
  );
};
```

### AI/ML
```typescript
// TensorFlow.js Model
const model = tf.sequential({
  layers: [
    tf.layers.lstm({ units: 128, returnSequences: true }),
    tf.layers.dropout({ rate: 0.2 }),
    tf.layers.lstm({ units: 64 }),
    tf.layers.dense({ units: 32, activation: 'relu' }),
    tf.layers.dense({ units: numShiftTypes, activation: 'softmax' })
  ]
});

await model.compile({
  optimizer: 'adam',
  loss: 'categoricalCrossentropy',
  metrics: ['accuracy']
});
```

## 6. 성공 지표 (KPIs)

1. **효율성**: 스케줄 생성 시간 90% 단축
2. **정확성**: 제약 위반 0건 달성
3. **공정성**: Gini 계수 0.2 이하
4. **만족도**: NPS 50점 이상
5. **자동화율**: 80% 이상 자동 생성

## 7. 리스크 및 대응

### 기술적 리스크
- **복잡도**: 단계적 구현으로 관리
- **성능**: 캐싱 및 최적화 적용
- **정확도**: 지속적 모니터링 및 개선

### 운영적 리스크
- **사용자 저항**: 충분한 교육 및 전환 기간
- **데이터 품질**: 검증 시스템 구축
- **변경 관리**: 점진적 롤아웃

## 결론

실제 9개월간의 근무표 분석을 통해 도출한 패턴과 규칙을 기반으로,
제약 조건 시스템, 패턴 기반 생성, AI/ML 최적화를 통합한
차세대 스케줄링 시스템을 구축하여 효율성과 공정성을 대폭 개선할 수 있습니다.