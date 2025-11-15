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
  - `requiredStaffPerShift`는 `department_patterns.required_staff_by_shift` JSON 맵을 그대로 전달받는다. 부서 패턴 UI는 D/E/N 기본값에 더해 새로 등록된 근무 타입(근무 타입 설정 탭, SSE 실시간 반영)까지 모두 이 맵에 기록하며, 행정/휴무/휴가 코드(`A`,`O`,`V`)는 자동으로 제외된다.
  - 같은 날 동일 시프트 안에서 가능한 한 서로 다른 `teamId`가 최소 1명 이상 포함되도록 팀 커버리지 가중치를 부여해 편향을 줄인다.
- `workPatternType === 'night-intensive'` 직원은 가능한 한 야간(`N`) 시프트에만 배정되며, 지원 근무가 필요할 때도 야간 슬롯이 없으면 OFF로 유지한다.
- 스케줄 설정 > 고급 설정의 “나이트 집중 근무 유급 휴가” 값(`nightIntensivePaidLeaveDays`)은 해당 직원의 월간 휴무 한도(`maxOffDays`)를 늘리는 용도로만 사용하며, 연속 OFF 블록을 강제하지 않는다. 즉, 보상 휴무 수만큼 추가 휴무를 배정할 수 있지만 배치 순서는 일반 OFF 로직과 동일하게 결정된다.
- 엔진은 `남은 휴무 필요량 = maxOffDays - 현재 OFF`가 남은 날짜 수와 같아지는 시점(나이트 집중 근무자는 같아지기만 해도)부터 근무 배치 후보에서 제외하고 즉시 OFF로 전환해, 월말에 휴무가 부족하게 배정되는 상황을 방지한다.
- 선호 패턴이 없는 나이트 집중 근무자는 `N` 연속 근무(기본 3일, 직접 설정 값이 더 낮으면 그 값) 이후 최소 2일, 연속 야간이 한 번 더 이어지면 최대 3일까지 회복 OFF를 확보하며, 이 회복 OFF(`nightRecoveryDaysNeeded`)가 소진되기 전에는 다른 근무나 지원 근무에 배정되지 않는다.
- 선호 패턴이 없는 일반 3교대 인원도 `N` 근무가 나오면 2~3회까지 연속 배정한 뒤 최소 2일 OFF를 묶어서 제공하며, 그동안은 다른 시프트나 지원 근무로 전환하지 않는다.
- 기본 순환은 `D → (O) → E → (O) → N` 순으로 가중치를 부여하며, OFF가 사이에 껴 있어도 직전 실제 근무 시프트를 기준으로 다음 시프트의 보너스/페널티가 계산된다. 특히 `D` 이후에는 `E`를, `E` 이후에는 `N`을 권장하고, `N` 이후에는 우선 `O`(불가 시 `E`)를 배정해 회복을 돕는다. 선호 패턴이 정의된 직원은 이 규칙보다 선호가 우선 적용된다.
- `D` 시프트 비중이 높아지면 점진적으로 큰 페널티가 적용되고, 같은 이유로 `E` 시프트가 `N` 대비 과도하게 많아지면 재배정 점수가 떨어져 시프트들이 고르게 순환된다.
- 야간(`N`) 근무 직후에는 주간(`D`)·저녁(`E`) 시프트가 배정되지 않도록 하드 필터를 두어 연속 야간→주간 패턴을 차단한다.
- 선호 정보(`preferredShiftTypes`)가 없는 직원은 2~3회 연속 동일 시프트를 우선 배정해 패턴을 유지하되, 연속 3회를 넘기면 자동으로 다른 시프트나 휴무를 권장해 한 달 내내 동일 시프트만 받지 않도록 한다.
- 지원 근무로도 배치할 수 없는 잉여 OFF는 `extraOffDays`로 축적해 나중에 잔여 휴무로 표기한다.

### 2.3 개인 선호(`nurse_preferences`)
- `preferred_patterns`를 기준으로 남은 슬롯에 우선 배정하고, `avoid_patterns`에 해당하는 시프트는 피한다.
- 선호를 지킬 수 없으면 같은 형식의 violation을 남긴다.

### 2.4 부서 패턴(`department_patterns`)
- `required` 규칙(예: 특정 시프트 필수 인원)과 `patterns`(근무 순환 규칙 등)를 적용해 남은 빈 슬롯을 채운다.
- 충돌 시 fallback 전략(대체 시프트, 스왑 등)을 정의하고, 최종적으로 불가하면 violation으로 남긴다.

### 2.5 CP-SAT/ILP 기반 커버리지 솔버
- 각 날짜마다 “직원×근무타입” 조합을 0/1 변수로 두고, `requiredStaffPerShift` 대비 시프트별 커버리지를 정확히 채워야 하는 제약을 걸어 탐색한다.
- 변수 후보는 `calculateCandidateScore` 결과를 비용으로 삼아 상위 2배수 인원만 추리고, 분기 한계(branch & bound) + 우선순위 큐 방식으로 탐색해 최적/차선 해를 찾는다.
- 회복 OFF, 회전 락, 야간→주간 금지 등 하드 필터링은 후보 생성 단계에서 제거하고, 커버리지 부족이 끝까지 남으면 부족분(`shortages`)을 기록해 `coverage` violation으로 승격한다.
- 이 단계에서 결정된 배정은 `updateEmployeeState`/`incrementOffCounter`를 통해 기존 상태 머신과 동일하게 누적되므로, 이후 휴무/회복 규칙과 자연스럽게 이어진다.

### 2.6 LNS(Local Neighborhood Search) 후처리
- 1차 패스에서 생성된 스케줄과 `validateSchedule` 결과를 토대로 위반이 집중된 날짜 블록(또는 랜덤 윈도우)을 고르고, 선택된 날짜를 제외한 나머지 날짜는 “락(lock)”된 상태로 고정한다.
- 락된 날은 직전 패스의 배정을 그대로 재사용하고, 나머지 날은 CP-SAT 솔버를 다시 실행해 부분 재배정을 수행한다. 이 과정을 최대 3회 반복해 violation 수와 score가 개선되면 즉시 채택한다.
- 윈도우 선택 기준: `affectedDates`가 있는 violation 우선 → 없으면 일정 길이의 연속 블록을 순차적으로 순회한다. 덕분에 특정 구간만 파괴/재구축할 수 있어 성능 부담 없이 품질을 개선한다.

## 3. 휴무 보장 및 잔여 휴무 기록
- 해당 월의 토/일/공휴일에 대해 직원별로 보장해야 하는 오프 일수를 계산한다.
- 각 직원에게 입력된 `employee.guaranteedOffDays`(없으면 달력 기반 기본값)를 우선 적용하고, 이전 달 `off_balance_ledger`에 적립된 잔여 OFF(`allocatedToAccumulation`)를 합산해 월간 총 휴무 한도(`maxOffDays`)를 계산한다.
- `workPatternType === 'night-intensive'` 직원은 위에서 산출한 기본 보장 휴무 수에 `nightIntensivePaidLeaveDays`를 더해 최종 `guaranteedOffDays`를 만들고, `off_balance_ledger` 및 스케줄 메타데이터에서도 같은 값을 사용해 추후 정산 시 보상 휴무가 자동 반영되게 한다.
- 각 날짜마다 `remainingOffNeeded > 남은 날짜 수 - 1`(일반) 또는 `remainingOffNeeded >= 남은 날짜 수`(나이트 집중 근무자)인 직원은 반드시 OFF를 배정해, `special_requests`가 없더라도 최종적으로 `actualOffDays >= guaranteedOffDays` 관계가 유지되도록 한다.
- 나이트 집중 근무자의 회복 OFF(`nightRecoveryDaysNeeded`)는 월 전 기간에 분산되며, 강제 휴무가 남아있는 동안에는 근무 후보군에서 제외해 월말 몰림을 방지한다.
- 선호 패턴이 없는 직원은 월 전체에서 D/E/N 비중이 일정 비율 내에서 유지되도록 가중치가 적용돼, 특정 시프트만 과도하게 배정되지 않도록 관리한다.

## 7. 스케줄 검증 흐름
- `/api/schedule/validate`는 `src/lib/scheduler/ai-scheduler.ts`의 `validateSchedule` 함수를 호출해 실제 배정표를 다시 시뮬레이션한다.
- 검증은 AI 엔진과 동일한 상태 머신/룰을 사용해 야간 블록, 휴무 한도, 시프트 커버리지, 순환 패턴 등을 평가하며, 위반 항목이 있으면 `ConstraintViolation`으로 반환한다.
- 프론트엔드에서 검증 버튼을 눌렀을 때 전달되는 직원/시프트/배정 정보만 업데이트하면 AI 로직이 자동 반영되므로, 스케줄 규칙을 바꿀 때는 `ai-scheduler.ts`만 수정하면 된다.
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
- **알고리즘**: 1차 패스는 날짜 단위 ILP(CP-SAT 스타일 분기 한계)로 커버리지를 맞추고, 2차 패스는 LNS로 일부 블록만 파괴·재생성해 최소 위반 해를 탐색한다. 두 단계 모두 기존 상태 머신(`updateEmployeeState`, `validateSchedule`)의 규칙을 그대로 재사용한다.
- **성능**: 후보 수를 필수 인원의 2배로 제한하고, 분기 한계 시 하한 비용(`suffixMinCost`)을 계산해 탐색 공간을 줄인다. LNS는 락/언락 구조 덕분에 재탐색 범위를 제한하므로 월 단위 입력도 수초 내에 수렴한다.
- **테스트**: 규칙별 단위 테스트와 통합 시나리오(특별 요청 충돌, 휴무 부족, 패턴 충돌 등)를 마련해 회귀를 방지한다. 특히 CP-SAT 후보 생성과 LNS 재배정이 동일한 상태 머신을 공유하는지 검증하는 회귀 테스트를 우선 추가한다.
