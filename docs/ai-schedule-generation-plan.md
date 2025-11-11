# AI 스케줄 생성 설계안

## 1. 데이터 수집 및 전처리
- `special_requests`, `nurse_preferences`, `department_patterns`, `holidays`, `shifts`, `users` 등을 테넌트·부서 기준으로 로드하고, 한 달 동안의 토/일/공휴일 목록을 생성한다.
- 날짜/직원별로 필요한 휴무 횟수를 계산해 후속 검증에 사용한다.
- 모든 소스 데이터를 메모리에 캐시하거나 Map/Set 구조로 정규화해 빠르게 조회할 수 있도록 준비한다.

## 2. 우선순위 기반 배정 엔진
우선순위는 “특별 요청 → 행정/지원 배정 → 개인 선호 → 부서 패턴” 순서로 적용하며, 앞선 단계의 결정은 뒤 단계에서 덮어쓰지 않는다.

### 2.1 특별 요청(`special_requests`)
- 요청 유형(오프/특정 시프트)을 확인해 해당 날짜의 슬롯을 먼저 채운다.
- OFF 타입 특별 요청은 직원별 월간 휴무 한도(`maxOffDays`)에서 선차감하며, 요청 시점에 이미 한도를 소진했다면 OFF 확정을 취소하고 `violations`에 `special_request_off_quota`를 기록한 뒤 일반 배정 후보군으로 되돌린다.
- `O`(OFF)로 확정된 특별 요청은 월간 보장 휴무 한도에서 즉시 차감해, 요청이 일부만 수용되더라도 나머지 자동 배정 OFF가 잔여 한도 내에서만 생성되도록 한다.
- 엔진은 특별 요청 OFF(`specialRequestOffDays`)와 시스템 자동 OFF(`autoOffDays`)를 분리해 누적하고, 두 값의 합이 `maxOffDays`를 넘기지 않도록 OFF 할당 직전에 확인한다.
- UI에서는 특별 요청 OFF를 `O^` 등으로 표시하지만, 엔진은 문자 외 기호를 제거해 모두 `O`로 정규화하여 같은 휴무 한도로 계산한다.
- 엔진이 부여하는 기본 OFF(`assignOffShift`)와 특별 요청 OFF의 합이 한도를 넘으려 하면 해당 날짜에는 지원 근무/행정 근무 전환을 우선 시도해 휴무 초과를 방지한다. 불가피하게 초과한 경우에는 `extraOffDays`로 남겨 보고한다.
- 충돌(인력 부족 등)로 수용 불가할 경우 `{employeeId, date, rule: 'special_request', reason}` 형태로 `violations`에 기록하고 나중에 보고한다.

### 2.2 행정/지원 배정
- `workPatternType === 'weekday-only'`(행정 근무자)는 평일·비공휴일에는 행정 시프트(`A`)로 자동 배정하고, 주말·공휴일에는 강제 OFF로 처리해 3교대 요구 인원에서 제외한다.
- 일반 3교대 인원의 OFF가 월별 보장 한도를 초과하거나 해당 날짜까지의 목표 OFF 일수를 이미 채웠다면, D/E/N 중 **필요 대비 배정 비율**이 가장 낮은 시프트를 골라 “지원 근무”로 투입한다.  
  - 시프트별 필요 인원은 `requiredStaffPerShift`(없으면 시프트 템플릿의 `requiredStaff`)를 사용한다.  
  - 같은 날 동일 시프트 안에서 가능한 한 서로 다른 `teamId`가 최소 1명 이상 포함되도록 팀 커버리지 가중치를 부여해 편향을 줄인다.
- `workPatternType === 'night-intensive'` 직원은 가능한 한 야간(`N`) 시프트에만 배정되며, 지원 근무가 필요할 때도 야간 슬롯이 없으면 OFF로 유지한다.
- 스케줄 설정 > 고급 설정의 “나이트 집중 근무 유급 휴가” 값(`nightIntensivePaidLeaveDays`)은 해당 직원의 월간 휴무 한도(`maxOffDays`)를 늘리는 용도로만 사용하며, 연속 OFF 블록을 강제하지 않는다. 즉, 보상 휴무 수만큼 추가 휴무를 배정할 수 있지만 배치 순서는 일반 OFF 로직과 동일하게 결정된다.
- 야간(`N`) 근무 직후에는 주간(`D`)·저녁(`E`) 시프트가 배정되지 않도록 하드 필터를 두어 연속 야간→주간 패턴을 차단한다.
- 선호 정보(`preferredShiftTypes`)가 없는 직원은 2~3회 연속 동일 시프트를 우선 배정해 패턴을 유지하되, 연속 3회를 넘기면 자동으로 다른 시프트나 휴무를 권장해 한 달 내내 동일 시프트만 받지 않도록 한다.
- 지원 근무로도 배치할 수 없는 잉여 OFF는 `extraOffDays`로 축적해 나중에 잔여 휴무로 표기한다.

### 2.3 개인 선호(`nurse_preferences`)
- `preferred_patterns`를 기준으로 남은 슬롯에 우선 배정하고, `avoid_patterns`에 해당하는 시프트는 피한다.
- 선호를 지킬 수 없으면 같은 형식의 violation을 남긴다.

### 2.4 부서 패턴(`department_patterns`)
- `required` 규칙(예: 특정 시프트 필수 인원)과 `patterns`(근무 순환 규칙 등)를 적용해 남은 빈 슬롯을 채운다.
- 충돌 시 fallback 전략(대체 시프트, 스왑 등)을 정의하고, 최종적으로 불가하면 violation으로 남긴다.

## 3. 휴무 보장 및 잔여 휴무 기록
- 해당 월의 토/일/공휴일에 대해 직원별로 보장해야 하는 오프 일수를 계산한다.
- 배정 완료 후 실제 오프 일수와 비교해 부족분은 `off_balance_ledger`에 `remainingOffDays`로 적립한다.  
  - 저장 필드 예시: `tenantId`, `nurseId`, `year`, `month`, `periodStart`, `periodEnd`, `guaranteedOffDays`, `actualOffDays`, `remainingOffDays`, `scheduleId`.
- 동시에, 이번 스케줄에서 발생한 잔여 휴무(`extraOffDays`)를 `generationResult.offAccruals` 및 `schedules.metadata.offAccruals`에 기록해 UI/리포트에서 잔여 휴무 적립을 바로 확인할 수 있게 한다. 잔여 휴무는 월 내내 목표 대비 부족한 직원에게 우선 배정해 월말에 몰리지 않도록 목표치를 일 단위로 분산 관리하며, 화면에서는 “+X일 예정” 라벨로 표시된다.

## 4. 위반 사유 기록 체계
- 각 단계에서 위반이 발생하면 `{employeeId, date, ruleType, reason, priority}` 구조로 `metadata.violations`에 누적한다.
- 스케줄 생성 응답과 감사 로그(`createAuditLog`)에도 동일 정보를 남겨 나중에 UI/리포트에서 근거를 확인할 수 있게 한다.

## 5. 후처리 및 확정 흐름
- TRPC `schedule.generate`는 위 로직을 실행해 `draft` 스케줄과 메타데이터(`assignments`, `violations`, `generationContext`)를 저장한다.
- 확정 시(`schedule.publish` 또는 `/api/schedule/confirm`) `metadata.assignments`를 사용해 `off_balance_ledger`를 실제로 갱신하고, 필요하면 직원 알림을 보낸다.

## 6. 기술적 고려 사항
- **알고리즘**: 제약 충족을 위한 백트래킹 + 우선순위 큐 조합 또는 선형계획/ILP 도입을 고려한다. 우선순위별 가중치를 둬 “최소 위반” 해를 탐색한다.
- **성능**: 부서 단위로 입력을 분할하고, 날짜/시프트 별로 인덱싱된 구조를 사용해 O(1)에 가까운 탐색을 노린다.
- **테스트**: 규칙별 단위 테스트와 통합 시나리오(특별 요청 충돌, 휴무 부족, 패턴 충돌 등)를 마련해 회귀를 방지한다.
