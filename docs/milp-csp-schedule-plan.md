# milp-csp-scheduler 설계 (MILP + CSP)

## 1. 배경 및 목표
- 새 엔진 명칭은 `milp-csp-scheduler`이며, AI 프롬프트 의존 없이 **MILP + CSP** 조합으로 동일(또는 강화된) 제약을 계산하도록 전환합니다.
- 본 문서는 프롬프트에 나열된 규칙을 수치 모델로 치환하는 방법과 전체 파이프라인 구조를 정의합니다.

## 2. 입력 데이터 요약
- 기간: `[startDate, endDate]`, 날짜 수 `D`.
- 직원 목록 `E`: id, teamId, workPatternType, preferredShiftTypes, guaranteedOffDays, previousOffAccruals, yearsOfService, careerGroupAlias 등.
- 시프트 정의 `S`: 코드별 requiredStaff/min/max.
- 특이 규칙 입력:
  - Special requests (employeeId, date, shiftTypeCode 등).
  - Holidays (공휴일·주말 집합).
  - Team pattern / avoid pattern.
  - Night intensive paid leave days.
  - Career groups config (minYears/maxYears 범위).

> 주: 기존 스케줄 생성 API가 수집하던 입력(payload) 구조를 그대로 재사용하면, 프런트엔드에서 추가 데이터를 요구하지 않고도 `milp-csp-scheduler`로 전환할 수 있다.

### 2.1 데이터 로딩 경로
1. **프런트엔드 수집** (`src/app/schedule/page.tsx`의 `handleGenerateSchedule`)  
   - 팀 구성원, 커스텀 시프트, 특근 요청, 휴일, 팀 패턴, `requiredStaffPerShift` 등을 취합해 `api.schedule.generate` 뮤테이션을 호출한다.
2. **TRPC 라우터** (`src/server/api/routers/schedule.ts:generate`)  
   - 권한/입력 검증 및 `previousOffAccruals` 계산 후 `requestScheduleGenerationFromBackend`로 payload를 전달한다.
3. **스케줄러 백엔드 큐**  
   - `requestScheduleGenerationFromBackend`는 `MILP_SCHEDULER_BACKEND_URL`(`undefined`면 기존 `SCHEDULER_BACKEND_URL`) 의 `/scheduler/jobs`에 작업을 등록하고, 상태를 폴링해 완료 시 결과를 돌려준다.
4. **저장 및 브로드캐스트**  
   - 결과 assignments와 통계는 `schedules` 테이블 및 SSE 브로드캐스터(sse.schedule.generated)에 기록된다.

`milp-csp-scheduler`는 위 payload를 변환하여 MILP/CSP 엔진이 소비할 `MilpCspScheduleInput` DTO(정의: `src/lib/scheduler/milp-csp/types.ts`)로 사용한다.

## 3. 비즈니스 규칙 요약
아래 규칙들은 모두 제약으로 취급한다. 불가피하게 완전 충족이 어렵다면 slack 변수를 두고 결과 리포트에 어떤 제약을 완화했는지 표기한다.

1. **특별 요청 우선 배치**
   - `specialRequests`에 있는 날짜/시프트를 먼저 고정한다. `lock[e,d,s] = 1`이면 `x[e,d,s]=1`.
   - 출력 시 `shiftType`에 `^` 표시 등은 새 파이프라인에서도 동일하게 유지.
   - 행정/나이트 집중 근무자는 `A`, `V`(휴가) 코드에 대한 요청을 포함할 수 있으며, 해당 요청은 항상 유효한 근무 조합으로 간주한다.
2. **행정 근무(weekday-only)**
   - 평일은 `A`, 휴일은 `O`. 다른 시프트는 허용하지 않는다.
3. **나이트 집중 근무(night-intensive)**
   - 근무는 `N`만 허용, 휴무(O)는 주말·휴일 + `nightIntensivePaidLeaveDays`.
   - 미리 정의된 패턴 집합(N,N,N,O,O / N,N,O,O / N,O,O / N,O 등) 중 하나를 반복 가능하도록 제약.
4. **팀 밸런스**
   - 각 날짜/시프트에서 모든 팀이 최소 1명 이상 포함.
   - 기간 전체에서 팀별 근무일 편차가 최소가 되도록 목적함수에 포함.
5. **시프트 인원수**
   - `requiredStaffPerShift[s]` 이상, `maxStaff` 이하를 강제. 값이 없으면 기본 D/E/N=5/4/3 사용.
   - `requiredStaffPerShift[s]`가 1 이상인 시프트만 배정 대상으로 간주한다. 0 또는 미입력이라면 해당 시프트는 스케줄 생성에서 제외하며, `A`는 weekday-only 직원 전용, `O`는 휴무 처리 전용으로 별도 취급한다.
6. **교대 근무(three-shift)**
   - 개인 선호/부서 패턴을 우선 적용하되, 동일 시프트 반복을 방지하고 최대 연속 근무/야간 제약을 지킨다.
   - three-shift 직원에게는 `A` 근무를 배정하지 않는다.
7. **휴무일 균형**
   - 각 three-shift 직원은 `(주말·공휴일 + previousOffAccruals)`일의 휴무를 받는다(월 초 2일까지는 확보가 어려울 수 있으므로 최대 2일까지만 부족을 허용).
   - 나이트 집중 근무자의 휴무 목표는 `(주말·공휴일 + previousOffAccruals + nightIntensivePaidLeaveDays)`로 계산하며, 최소한 그 수만큼의 `O`/`V` 휴무가 반드시 배정되도록 강제한다.
   - 휴무일 수 차이는 팀 내에서 최대 2일 차이 이내.
8. **경력 그룹 균형**
   - 모든 날짜/시프트에서 가능한 한 모든 경력 그룹이 최소 1명씩 포함되도록 강제(그룹 인원이 부족하면 slack 허용).
   - 전체 기간 동안 그룹 간 근무일 편차 ±1일 이내.
9. **출력 완전성**
   - `|E| * D`개의 배정을 모두 채우고, 날짜/직원 조합 중복 X.
10. **결과 검증/자체 점검**
    - solver 결과를 반환하기 전에 모든 제약 조건을 다시 평가하고, 위반 시 재시도 또는 실패 처리.

필수 하드 제약 – 시프트별 최소 인원, 하루 1근무, 휴무 계산 
중간 우선순위 – 특별 요청 고정, 팀 밸런스, 경력 그룹 균형 
소프트 제약/후처리 – 패턴/연속 근무, 휴무 차이 ±2일 유지, 선호 반영

이 규칙들은 아래 MILP/CSP 설계에서 직접 대응되는 제약으로 구현한다.

## 4. 변수 정의
| 이름 | 의미 | 범위 |
| --- | --- | --- |
| `x[e,d,s]` | 직원 `e`가 날짜 `d`에 시프트 `s`로 근무 | {0,1} |
| `o[e,d]` | 직원 `e`가 날짜 `d`에 휴무(O) | {0,1} |
| `lock[e,d,s]` | 특수 요청/locked 여부를 나타내는 고정 플래그 | {0,1} (상수) |
| `g[e,c]` | 직원 `e`가 경력 그룹 `c`에 속하는지 | {0,1} (상수) |
| `team[e,t]` | 직원-팀 소속 플래그 | {0,1} (상수) |
| `p[e,d,s]` | 개인/부서 패턴 요구 여부 | {0,1} (상수) |
| `f[d,s,t]` | 날짜/시프트/팀 균형 slack | ≥0 (continuous) |
| `cg[d,s,c]` | 날짜/시프트/경력그룹 slack | ≥0 |

> 구현 현황  
- `x[e,d,s]`는 OR-Tools BoolVar로 모델링되며, 특수 요청·패턴 제약은 slack(페널티)을 둬 infeasible 대신 “위반”으로 보고한다.  
- `f[d,s,t]`, `cg[d,s,c]`는 각각 `teamCoverageGap`, `careerGroupCoverageGap` 진단으로 표면화된다.  
- 추가 slack 변수: `staff_shortage`, `off_balance`, `repeat_slack`, `special_req_slack`. 모두 `generationResult.diagnostics`에 기록해 UI에서 바로 확인한다.

필요에 따라 연속 근무나 패턴을 위한 보조 변수 (예: `y[e,d]` = 직전 근무 타입)도 추가한다.

## 5. MILP 모델링

### 4.1 기본 제약 (프롬프트 규칙 1~7, 9~10)
1. **단일 근무**: `∑_s x[e,d,s] = 1` (행정/휴무 포함). 휴무는 `s='O'`로 취급.
2. **특별 요청**: `lock[e,d,s]=1`이면 `x[e,d,s]=1` 강제, 다른 시프트는 0.
3. **Work Pattern 타입별 처리**  
   - `weekday-only`: 평일은 `A`, 휴일은 `O`. MILP에서 `weekday(e,d)` 상수로 제약.
   - `night-intensive`: `x`를 연속 패턴으로 모델링. 가장 간단한 방식은 `nightOnly[e]` 플래그로 `∑_{s≠N,O} x[e,d,s]=0`을 강제하고, 휴가 일수만큼 `O`를 분산하도록 추가 제약.
   - `three-shift`: 일반 교대 근무; 아래 추가 제약 적용.
4. **팀 밸런스**: 각 날짜/시프트 `d,s`에 대해 `∑_e x[e,d,s] * team[e,t] ≥ 1`. 추가로 `f[d,s,t]` slack을 두고 목적 함수를 통해 균등화.
5. **시프트 최소/최대 인원**: `requiredStaffPerShift[s] ≤ ∑_e x[e,d,s] ≤ maxStaff`. `minStaff` null이면 requiredStaff 사용.
6. **휴무 배분**:  
   - Three-shift 직원에 대해 `∑_d o[e,d] ≈ targetOff = weekends+holidays + previousOffAccruals`. `|actual-target| ≤ 2` 제약이나 slack에 패널티 부여.
   - 하루에 한 명에게만 휴무 몰리지 않도록 `difference ≤ 2`.
7. **날짜/직원 전 범위 배정**: MILP 자체에서 단일 근무 제약을 적용하면 자동 충족.

### 4.2 경력 그룹 균형 (새 규칙 8)
- 매 날짜/시프트마다 `∑_e x[e,d,s] * g[e,c] ≥ groupPresenceThreshold[c]`. 기본값은 1명, 그룹에 직원이 없으면 자동 relax.
- 전체 기간 동안 그룹별 근무 일수 차이가 1일 이내가 되도록  
  `| (∑_{d,s} x[e,d,s] for group c) - (average_c) | ≤ 1`. 평균은 `(총 필요 근무 일수 / 그룹 수)` 근사값을 사용하거나 slack 포함.
- 모델에서 `cg[d,s,c]` slack을 두어 infeasible한 경우 페널티 최소화.

### 4.3 패턴/연속 근무 제약
- `workPatternType === 'three-shift'`에 대해:
  - 최대 연속 근무일, 최대 연속 야간일: `x[e,d,N] + x[e,d+1,N] + ... ≤ max`.
  - 부서 패턴(예: `["D","E","N","O"]`)은 sliding window로 설정. 예) 길이 4 패턴이면 `x[e,d+i, pattern[i]] = 1`을 강제하거나 soft constraint로 처리.
  - `avoidPatterns`: 해당 시퀀스가 나오지 않도록 `∑ matchVars ≤ len-1`.

### 4.4 목적 함수
`minimize( w_teamBalance * ∑ f + w_careerBalance * ∑ cg + w_offSlack * ∑ |off-target| + w_pref * ∑(penalties) )`

가중치:
- 팀/경력/휴무 균형 가중치는 `/config` → 고급 설정에서 조정 가능하며, fallback 단계에서는 자동으로 0.7 → 0.5 → 0.3으로 감소한다.
- 패턴/선호도는 중간 가중치.
- 휴무 slack은 낮지만 0에 가깝게 유지.

### 4.5 솔버 고려
- OR-Tools CBC를 기본으로 사용하며, 실패 시 HiGHS(MIP) 폴백을 자동 시도한다. `/config → 고급 설정`에서 “선호 Solver(자동/OR-Tools/HiGHS)”를 선택해 강제로 HiGHS만 사용하거나 OR-Tools만 사용하도록 지정할 수 있다.
- 한 달 30일, 30명, 4시프트 기준 변수 ≈ 3,600개 → CBC도 수 초~분 단위 계산 가능. HiGHS는 동일 모델을 LP 포맷으로 내보내 실행한다.

## 6. CSP/휴리스틱 후처리
MILP 해가 존재하더라도 아래 조정이 필요할 수 있다:
1. **팀/경력 라운딩**: 정수 제약이 지나치게 빡빡하면 slack이 남을 수 있으므로, 결과를 읽고 부족 그룹을 찾은 뒤 swap 후보를 탐색.
2. **패턴 미세조정**: 팀 패턴, avoid pattern을 만족시키기 위해 Tabu Search나 Greedy swap 실시. 동일 일자 뿐 아니라 날짜 간 교차 스왑을 허용한다.
3. **휴무/요청 검증**: MILP에서 lock을 강제했지만, 후처리 단계에서 다시 확인하여 잘못된 스왑이 일어나지 않도록 한다 (AI Polish 문서와 동일한 보호 규칙 적용). 특별 요청이나 staffing 부족이 발견되면 해당 날짜/직원에 맞춰 swap을 우선 수행한다.

> 구현 메모: 현재 CSP 후처리는 Greedy swap 후보 평가 + Tabu queue + Simulated Annealing 수용 전략으로 반복 시프트/팀/경력·휴무 편차를 순차적으로 줄인다. 동일 일자 스왑뿐 아니라 교차일 스왑(move)도 지원해 인력 부족일을 다른 날과 교환할 수 있다. 스왑 탐색 파라미터는 `MILP_POSTPROCESS_*` 환경변수로 조절 가능하며, annealing 온도/냉각률도 외부에서 튜닝할 수 있다. 향후 추가 move evaluator(패턴 재배열 etc.)를 쉽게 붙일 수 있도록 구조화했다.

### CSP 구현 방식
- 상태: `assignments[e,d]`.
- 제약 검사 함수:
  - 팀별/경력별 카운트.
  - 연속 근무/휴무.
  - avoid pattern.
- 탐색:  
  1. 우선순위 큐에 “현재 위반 수”가 큰 날짜/시프트를 넣는다.  
  2. 후보 직원 교환 또는 시프트 재배정.  
  3. 위반이 줄어드는 move만 허용하거나 simulated annealing으로 탐색.  
  4. 제한 시간(예: 10초) 내 개선이 없으면 중단.

## 7. 파이프라인 구조
```
입력(payload) → 데이터 전처리(alias 매핑, 그룹 계산)
             → MILP Solver (기본 스케줄)
             → CSP/휴리스틱 조정 (패턴·균형 미세 조정)
             → 검증(모든 규칙 재확인)
             → DB 저장 + 감사 로그
```

### 데이터 전처리
- 기존 프롬프트에서 수행하던 alias 매핑 로직을 그대로 재현해 직원/팀/경력 그룹 alias를 만든다.
- `career_groups` config가 없을 경우, 기본적으로 연차 0-2/3-5/6+ 같은 가이드라인을 코드에 내장해도 된다(설정 가능하게 유지).
- `specialRequests`, `nightIntensivePaidLeaveDays`, `previousOffAccruals` 등도 MILP 파라미터로 전달.
- `schedulerAdvanced` config(`preferences.schedulerAdvanced`)를 통해 제약 가중치와 CSP 탐색 파라미터를 부서별로 저장/재사용 한다. (UI: `/config` → 고급 스케줄 제약)

### 결과 검증
- `processAssignments` 함수 대체 로직:
  1. 모든 날짜/직원 조합 존재 여부.
  2. 팀별/경력별 최소 조건 충족 여부.
  3. 휴무 균형 및 special request 보호 여부.
  4. 경력 그룹/팀별 통계 계산.
  5. 실패 시 로그와 함께 재시도 또는 오류 반환.

샘플 입력/검증 규칙은 `tests/milp-csp/*.json`, 자동 하네스는 `tests/milp-csp/evaluate.ts`에서 확인할 수 있다.

## 8. 구현 단계 로드맵
1. **데이터 계층**  
 - Career group/연차 로딩 로직 모듈화 (`src/server/api/utils/milp-data-loader.ts`).
 - MILP 입력 DTO 정의 (`MilpCspScheduleInput` 등 새 타입명 사용) 및 serializer 작성.
2. **MILP 모듈**  
 - OR-Tools/HiGHS 기반 solver util (Python 워커 `scheduler-worker/src/solver`).  
 - JSON 형태로 제약/결과를 주고받는 래퍼 작성.
 - 구현된 제약 요약:
   - 특수 요청을 소프트 제약(slack)으로 처리, 위반 시 `specialRequestMisses`.
   - 팀/경력 그룹 커버리지 최소 1명 + 부족 slack (`teamCoverageGaps`, `careerGroupCoverageGaps`).
   - 필수 인원 부족 slack (`staffingShortages`), 휴무 편차 ±2 slack (`offBalanceGaps`).
   - 최대 연속 근무/야간, 동일 시프트 3일 연속 금지 slack (`shiftPatternBreaks`).
   - 개인 선호·부서 패턴을 목적함수에 가중치로 반영해 선호도 높은 배치를 우선.
   - 진단 정보(`generationResult.diagnostics`)를 TRPC/DB 저장 메타데이터에 포함해 UI에서 바로 노출.
3. **CSP/휴리스틱 모듈**  
 - 스케줄 상태 구조체, swap 함수, 제약 평가기 작성. → `scheduler-worker/src/solver/postprocessor.py` 구현 완료 (Greedy swap + Tabu + Simulated Annealing, 반복 시프트·팀/경력·휴무 편차 재평가).  
 - 반복 횟수/시간 제한, Tabu 크기, 최대 연속 허용, 휴무 편차 허용, annealing 온도/냉각률 등을 환경 변수(`MILP_POSTPROCESS_MAX_ITERATIONS`, `MILP_POSTPROCESS_TIME_LIMIT_MS`, `MILP_POSTPROCESS_TABU_SIZE`, `MILP_POSTPROCESS_MAX_SAME_SHIFT`, `MILP_POSTPROCESS_OFF_TOLERANCE`, `MILP_POSTPROCESS_ANNEAL_TEMP`, `MILP_POSTPROCESS_ANNEAL_COOL`)로 조정 가능.  
 - `/config` → 고급 설정에서 부서별 constraint weights와 CSP 파라미터를 저장/로드할 수 있으며, UI에서 너무 낮거나 높은 값을 입력하면 경고가 표시된다.  
4. **검증/로깅**  
   - 기존 `processAssignments`에서 하던 검증 항목을 재구현하고, 추가로 경력 그룹 균형 검사 포함. → 통합 하네스(`tests/milp-csp/run-harness.ts`)가 시나리오별 검증을 자동 수행.  
   - MILP/CSP 실행 시 입력/출력을 `scheduler-worker/logs/` (환경변수 `MILP_LOG_DIR`)에 JSON으로 기록하며, 실패 시 단계별 완화 레벨과 진단을 `diagnostics.postprocess`에 포함시킨다.
5. **API 교체**  
   - TRPC 라우터에서 ChatGPT 호출 코드를 제거하고 새 solver 유틸을 호출하도록 변경.
6. **테스트**  
  - E2E 테스트: 최소 주간(6명)부터 20~24명 규모 한달 시나리오까지 커버하는 `tests/milp-csp/*.json` + `run-harness.ts` 유지.

## 9. 파일
- 백엔드 라우터 레이어에 새 solver 진입점을 추가하고, 필요 시 `scheduler/milp-csp-scheduler.ts` 같은 전용 모듈을 통해 TRPC mutation을 노출한다.

## 10. 추가 고려 사항
- **성능**: MILP 계산 시간이 늘어나면 워커/큐 기반 비동기 처리 권장 (upstash 의 redis, NestJS 는 fly.io 에서 구동)
- **Fallback**: MILP infeasible 시 자동으로 제약 가중치를 낮추고 휴무 허용치를 넓힌 relaxed run을 한 번 더 시도하며, 실패한 입력/출력을 `logs/` 폴더에 JSON으로 남긴다.
- **관찰 가능성**: 모든 실행에 대해 solver 입력/결과/후처리 통계를 JSON 로그와 UI(AI 생성 결과 카드, 상세 리포트)에 노출해 재현성을 확보한다.
- **Config 확장**: 향후 career group별 목표 비율(%)을 `configs`에 추가하여 MILP 목적함수 가중치로 반영할 수 있게 설계한다.

---
이 문서를 기준으로 세부 구현을 시작하면, 기존 프롬프트 기반 규칙을 동일하게 수치화하여 재현할 수 있다. 향후 규칙이 추가될 경우 각 섹션(제약 정의, MILP 수식, CSP 조정)을 업데이트한다.
