# 📊 ShiftEasy 간호사 스케줄링 로직 개선 제안서

## 1. 실제 근무표 분석 결과

### 1.1 기본 통계
- **분석 기간**: 2025년 1월 ~ 9월 (9개월)
- **총 인원**: 35명
  - Unit Manager: 1명 (박선미)
  - FRN (Float Resource Nurse): 2명 (이다운, 이경은)
  - RN (Registered Nurse): 32명
    - Senior RN: 5명
    - Mid-level RN: 10명
    - Junior RN: 17명

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
interface NursingConstraints {
  // 법적 제약
  maxConsecutiveDays: 5;           // 최대 연속 근무일
  maxConsecutiveNights: 3;         // 최대 연속 야간 근무
  minRestAfterNight: 24;           // 야간 후 최소 휴식(시간)
  maxWeeklyHours: 52;              // 주당 최대 근무시간
  maxMonthlyNights: 8;             // 월 최대 야간 근무

  // 금지된 전환
  forbiddenTransitions: ['N→D', 'N→E'];

  // 최소 인원 요구사항
  minStaffPerShift: {
    day: 8,
    evening: 6,
    night: 5
  };

  // 자격/면허 요구사항
  requiresCertification: {
    CCRN: boolean;      // 중환자 간호
    PALS: boolean;      // 소아 응급
    chemotherapy: boolean; // 항암 자격
  };

  // 환자 대 간호사 비율
  nurseToPatientRatio: {
    ICU: '1:2',
    general: '1:5',
    emergency: '1:4'
  };
}
```

#### Soft Constraints (선호 사항)
```typescript
interface NursingSoftConstraints {
  // 개인 선호도
  personal: {
    preferredShifts: string[];      // 선호 근무 시간
    preferredUnits: string[];       // 선호 병동
    preferredDaysOff: string[];     // 선호 휴무일
    workLifeBalance: 'flexible' | 'fixed';
  };

  // 팀 선호도
  team: {
    buddySystem: boolean;           // 특정 동료와 함께 근무
    mentorshipPairs: {              // 프리셉터-신규 간호사 매칭
      preceptor: string;
      newGrad: string;
      duration: number;             // 교육 기간 (주)
    }[];
    teamCohesion: boolean;          // 팀 응집력 고려
  };

  // 간호 전문 선호도
  nursing: {
    continuityOfCare: boolean;      // 환자 케어 연속성
    specialtyRotation: boolean;     // 전문 분야 순환
    educationDays: number;          // 월 교육일수
    committeParticipation: boolean; // 위원회 활동
  };

  // 근무 패턴 선호
  patterns: {
    preferredTransitions: ['D→E', 'E→N', 'N→OFF'];
    targetConsecutiveDays: '3-4';
    weekendFrequency: 'alternate'; // 격주 주말
    nightShiftPreference: 'minimal' | 'regular' | 'preferred';
  };
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
class NursingFairnessBalancer {
  private metrics = {
    // 기본 근무 메트릭
    totalHours: Map<string, number>,
    overtimeHours: Map<string, number>,
    nightShifts: Map<string, number>,
    weekendShifts: Map<string, number>,
    holidayShifts: Map<string, number>,

    // 간호 특화 메트릭
    criticalCareHours: Map<string, number>,
    floatPoolAssignments: Map<string, number>,
    chargeNurseDuties: Map<string, number>,
    preceptorHours: Map<string, number>,
    committeeHours: Map<string, number>
  };

  balanceWorkload() {
    // 공정성 최적화 가중치
    const weights = {
      totalHours: 0.25,          // 총 근무시간 균형
      nightShifts: 0.20,         // 야간 근무 공평 분배
      weekendShifts: 0.20,       // 주말 근무 공평 분배
      continuityOfCare: 0.15,    // 환자 케어 연속성
      nursePreference: 0.10,     // 개인 선호도 반영
      teamBalance: 0.10          // 팀 균형
    };

    // 표준편차 최소화 알고리즘
    return this.optimizeVariance(weights);
  }
}
```

### 2.3 AI/ML 기반 최적화

#### Reinforcement Learning 적용
```typescript
class NursingRLOptimizer {
  private model: tf.Sequential;

  async train(data: NursingScheduleData) {
    // State: 현재 스케줄 상태
    const state = this.encodeNursingState(data);

    // Action Space for Nursing
    const actions = [
      'assign_shift',      // 근무 할당
      'swap_nurses',       // 간호사 교대
      'float_pool',        // Float Pool 활용
      'adjust_ratio',      // 환자 비율 조정
      'add_overtime',      // 초과근무 추가
      'use_agency'         // 에이전시 간호사 활용
    ];

    const action = await this.model.predict(state);

    // Nursing-specific Reward Function
    const reward = this.calculateReward(action, {
      patientSafety: 0.30,        // 환자 안전 최우선
      continuityOfCare: 0.20,     // 케어 연속성
      nurseWellbeing: 0.20,        // 간호사 복지
      compliance: 0.15,            // 법규 준수
      efficiency: 0.10,            // 운영 효율성
      cost: 0.05                   // 비용 효율성
    });

    // Q-learning with nursing-specific parameters
    await this.updateModel(state, action, reward);
  }
}
```

#### Pattern Recognition
```typescript
class NursingPatternRecognizer {
  private model: tf.LayersModel;

  analyzeNursingPatterns(data: TimeSeriesData) {
    // LSTM 네트워크로 간호 패턴 학습
    const nursingPatterns = {
      seasonal: [
        'flu_season',           // 독감 시즌 (11-3월)
        'summer_vacation',      // 여름 휴가철
        'holiday_emergency',    // 명절 응급실 증가
        'new_grad_onboarding'   // 신규 간호사 입사 시기
      ],
      recurring: [
        'shift_rotation',       // 근무 순환 패턴
        'education_days',       // 교육일정
        'certification_renewal', // 자격 갱신 주기
        'performance_review'    // 인사 평가 시기
      ],
      special: [
        'pandemic_response',    // 팬데믹 대응
        'mass_casualty',        // 대량 환자 발생
        'joint_commission',     // JCI 인증 심사
        'hospital_expansion'    // 병원 확장
      ]
    };

    return this.model.fit(data, nursingPatterns);
  }

  predictNursingDemand(horizon: number) {
    // 간호 수요 예측 특화 요인
    const features = {
      patientCensus: this.getPatientCensus(),
      acuityIndex: this.getAcuityIndex(),
      admissionRate: this.getAdmissionRate(),
      seasonalFactors: this.getSeasonalFactors(),
      specialEvents: this.getSpecialEvents()
    };

    const predictions = this.model.predict(features);

    // 간호 특화 조정 요인
    const adjustments = {
      emergencyBuffer: 1.15,      // 응급 상황 대비
      weekendReduction: 0.85,     // 주말 감소
      nightDifferential: 1.1,     // 야간 추가 필요
      floatPoolAvailability: 0.9  // Float Pool 가용성
    };

    return this.applyAdjustments(predictions, adjustments);
  }
}
```

## 3. 구현 로드맵

### Phase 1: 기본 제약 시스템 (2주)
- [ ] Hard constraints 엔진 구현
- [ ] Soft constraints 평가 시스템
- [ ] 간호사 면허/자격 관리 시스템
- [ ] 제약 위반 검증 도구
- [ ] 환자 대 간호사 비율 계산기

### Phase 2: 패턴 기반 생성 (3주)
- [ ] 간호 패턴 라이브러리 구축
- [ ] 패턴 매칭 알고리즘
- [ ] 경력 레벨별 차별화 (신규/경력/시니어)
- [ ] 프리셉터-신규 간호사 매칭
- [ ] Float Pool 운영 시스템

### Phase 3: 최적화 엔진 (3주)
- [ ] Coverage optimizer
- [ ] Fairness balancer
- [ ] Preference manager
- [ ] 간호사 피로도 관리 시스템
- [ ] 케어 연속성 최적화

### Phase 4: UI/UX 개선 (2주)
- [ ] 드래그 앤 드롭 스케줄 편집
- [ ] 간호사 대시보드 (개인/팀/병동)
- [ ] 실시간 제약 검증
- [ ] 충돌 해결 제안
- [ ] 모바일 최적화 (병동 태블릿/스마트폰)
- [ ] 교대 신청/승인 워크플로우

### Phase 5: AI 통합 (4주)
- [ ] TensorFlow.js 통합
- [ ] 간호 패턴 학습 파이프라인
- [ ] 환자 수요 예측 시스템
- [ ] 간호사 이직율 예측
- [ ] A/B 테스팅 프레임워크
- [ ] 실시간 학습 및 적응

## 4. 예상 효과

### 정량적 개선
- **스케줄 생성 시간**: 2시간 → 5분 (96% 감소)
- **제약 위반**: 월 평균 15건 → 0건
- **공정성 지수**: 표준편차 30% 감소
- **간호사 만족도**: 70% → 90% 상승
- **초과근무 비용**: 25% 감소
- **환자 안전 지표**: 15% 개선
- **이직율**: 20% → 12% 감소

### 정성적 개선
- 투명하고 공정한 스케줄링
- 개인 선호도 반영 증가
- 번아웃 예방 효과
- 팀 응집력 향상
- 환자 케어 연속성 개선
- 간호사 피로도 관리
- 전문성 개발 기회 증대
- 워크-라이프 밸런스 개선

## 5. 기술 스택

### Backend
```typescript
// Drizzle ORM Schema
export const nurseScheduleOptimization = pgTable('nurse_schedule_optimization', {
  id: uuid('id').primaryKey(),
  scheduleId: uuid('schedule_id').references(() => schedules.id),
  nurseId: uuid('nurse_id').references(() => users.id),
  optimizationScore: real('optimization_score'),
  constraints: jsonb('constraints'),
  patterns: jsonb('patterns'),
  mlPredictions: jsonb('ml_predictions'),
  fatigueScore: real('fatigue_score'),
  continuityScore: real('continuity_score')
});

export const nurseSkillMatrix = pgTable('nurse_skill_matrix', {
  id: uuid('id').primaryKey(),
  nurseId: uuid('nurse_id').references(() => users.id),
  certifications: jsonb('certifications'), // CCRN, PALS, etc.
  specialties: jsonb('specialties'),       // ICU, ER, OR, etc.
  competencyLevel: varchar('competency_level'), // Junior, Mid, Senior
  preceptorQualified: boolean('preceptor_qualified'),
  floatPoolEligible: boolean('float_pool_eligible')
});

export const nursePreferences = pgTable('nurse_preferences', {
  id: uuid('id').primaryKey(),
  nurseId: uuid('nurse_id').references(() => users.id),
  preferredShifts: jsonb('preferred_shifts'),
  preferredUnits: jsonb('preferred_units'),
  maxNightShifts: integer('max_night_shifts'),
  weekendPreference: varchar('weekend_preference')
});
```

### Frontend
```tsx
// React Component for Nursing Schedule
const NursingScheduleOptimizer: React.FC = () => {
  const [constraints, setConstraints] = useState<NursingConstraints>();
  const [schedule, setSchedule] = useState<Schedule>();
  const [fatigueAlert, setFatigueAlert] = useState<FatigueAlert[]>();

  const optimizeSchedule = async () => {
    const result = await api.optimizeNursingSchedule({
      constraints,
      nursePreferences: userPreferences,
      patientAcuity: currentAcuityLevels,
      historicalData: pastSchedules,
      continuityRequirements: continuityGoals
    });

    setSchedule(result.schedule);
    setFatigueAlert(result.fatigueAlerts);

    // 간호사 비율 검증
    await validateNurseRatios(result);
  };

  return (
    <div className="nursing-schedule-optimizer">
      <NursingConstraintEditor onChange={setConstraints} />
      <NursingScheduleViewer
        schedule={schedule}
        fatigueAlerts={fatigueAlert}
      />
      <NursingMetrics />
      <PatientSafetyDashboard />
      <ContinuityTracker />
    </div>
  );
};
```

### AI/ML
```typescript
// TensorFlow.js Model for Nursing
const nursingModel = tf.sequential({
  layers: [
    tf.layers.lstm({
      units: 256,
      returnSequences: true,
      inputShape: [null, 8] // 8 features for nursing
    }),
    tf.layers.dropout({ rate: 0.2 }),
    tf.layers.lstm({ units: 128 }),
    tf.layers.dense({ units: 64, activation: 'relu' }),
    tf.layers.dense({ units: 32, activation: 'relu' }),
    tf.layers.dense({ units: 7, activation: 'softmax' }) // 7 shift types
  ]
});

// Nursing Model Compilation
await nursingModel.compile({
  optimizer: tf.train.adam(0.001),
  loss: 'categoricalCrossentropy',
  metrics: ['accuracy', 'precision', 'recall']
});

// Feature extraction for nursing
const nursingFeatures = [
  'patient_census',      // 환자 수
  'acuity_index',        // 중증도 지수
  'nurse_count',         // 가용 간호사
  'skill_mix',           // 스킬 믹스
  'fatigue_level',       // 피로도
  'day_of_week',         // 요일
  'shift_type',          // 근무 유형
  'historical_pattern'   // 과거 패턴
];
```

## 6. 성공 지표 (KPIs)

### 간호 스케줄링 KPIs
1. **효율성**: 스케줄 생성 시간 90% 단축
2. **정확성**: 제약 위반 0건 달성
3. **공정성**: Gini 계수 0.2 이하
4. **만족도**: NPS 50점 이상
5. **자동화율**: 80% 이상 자동 생성

### 간호 특화 지표
- **환자 안전 점수**: >95%
- **간호사 대 환자 비율 준수**: 100%
- **케어 연속성 지수**: >0.8
- **피로 위험 점수**: <3/10
- **초과근무 시간**: <10%
- **이직율**: <15%
- **교육 참여율**: >90%
- **프리셉터 만족도**: >85%

## 7. 리스크 및 대응

### 기술적 리스크
- **복잡도**: 단계적 구현으로 관리
- **성능**: 캐싱 및 최적화 적용
- **정확도**: 지속적 모니터링 및 개선

### 운영적 리스크
- **간호사 저항**: 충분한 교육 및 전환 기간
- **데이터 품질**: 검증 시스템 구축
- **변경 관리**: 점진적 롤아웃
- **환자 안전**: 실시간 모니터링 및 알림
- **법규 준수**: 자동 컴플라이언스 체크

## 결론

실제 9개월간의 간호사 근무표 분석을 통해 도출한 패턴과 규칙을 기반으로,
간호사 특화 제약 조건 시스템, 패턴 기반 생성, AI/ML 최적화를 통합한
차세대 간호사 스케줄링 시스템을 구축하여 효율성과 공정성을 대폭 개선할 수 있습니다.

핵심은 환자 안전을 최우선으로 하면서도 간호사의 워크-라이프 밸런스와
전문성 개발을 지원하는 균형잡힌 스케줄링 시스템을 구현하는 것입니다.