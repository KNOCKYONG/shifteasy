# MILP/CSP Sample Scenarios

이 디렉터리는 `milp-csp-scheduler` 개발/회귀 테스트에 사용할 샘플 입력을 제공합니다. 각 파일은 다음 구조를 따릅니다.

```jsonc
{
  "description": "시나리오 설명",
  "scheduleInput": { /* schedule.generate payload 일부 */ },
  "careerGroupsConfig": [ /* configs career_groups 값 */ ],
  "yearsOfService": { "emp-id": number },
  "checks": [ "검증 체크리스트" ]
}
```

## Scenario 목록

| 파일 | 설명 | 주요 검증 포인트 |
| ---- | ---- | ---------------- |
| `scenario-basic-balance.json` | 1개월 6명 기준. 팀/경력 그룹 균형, 특별 요청, 휴무 타겟 확인 | - SPECIAL OFF 고정<br/>- 팀A/B 시프트별 최소 1명<br/>- 경력 그룹 JR/SR 균형 |
| `scenario-night-intensive.json` | 1개월 나이트 집중/행정직 혼합 | - night-intensive는 N/O 패턴 유지<br/>- weekday-only는 주말 OFF/A 배치<br/>- 휴무 차이 허용 범위 내 유지 |
| `scenario-weekday-admin.json` | 1개월, 행정/나이트 포함. 주간 행정 + 경력 밸런스 | - weekday-only는 평일 A/주말 O<br/>- night-intensive는 N/O 유지<br/>- 경력 그룹 JR/MD/SR 편차 ≤ 1 |
| `scenario-weekend-balance.json` | 2주 10명, 주말 커버리지/특근 요청 강조 | - 팀 A/B 모두 D/E 포함<br/>- night-intensive N/O, weekday-only A/O 유지<br/>- 특근 요청 모두 충족 |
| `scenario-admin-support.json` | 3주 12명, 행정 2인 동시 커버 | - `A` 시프트 2명 상시 배치<br/>- 팀 A/B/C 모두 D/E 포함<br/>- 경력 그룹 JR/MD/SR 균형 유지 |
| `scenario-complex-20.json` | 1개월 20명, 3팀, 혼합 패턴/선호/특별 요청 | - 팀 A/B/C 모두 D/E 시프트 포함<br/>- 경력 그룹 3종 편차 ≤ 2<br/>- 나이트 집중/weekday-only 준수 |

각 시나리오는 `validationRules` 필드로 자동 검증 조건 (예: `teamCoverage`, `careerGroupCoverage`, `nightIntensiveOnlyNO`)을 정의합니다. 하네스 스크립트는 해당 규칙을 참조하여 solver 출력이 요구 사항을 만족하는지 확인합니다.

## 사용법

1. **Scenario 확인**  
   ```
   npx tsx tests/milp-csp/run-scenario.ts scenario-basic-balance.json
   ```
   → 입력이 `MilpCspScheduleInput`으로 직렬화되는지 빠르게 확인.

2. **milpInput 생성**  
   ```
   npx tsx tests/milp-csp/prepare-milp-input.ts scenario-basic-balance.json /tmp/milp-input.json
   ```
   → Python 워커 실행 전에 `milpInput` JSON을 저장.

3. **Python solver 실행 + 검증 (단계별)**  
   ```
   npx tsx tests/milp-csp/evaluate.ts scenario-basic-balance.json output/basic-assignments.json
   ```
   → solver 출력(배열 형태의 assignments JSON)을 시나리오의 `validationRules`에 따라 검증.

4. **통합 하네스**  
   ```bash
   # npm 스크립트 (권장)
   npm run test:milp -- scenario-basic-balance.json
   npm run test:milp -- scenario-night-intensive.json

   # 또는 직접 실행
   npx tsx tests/milp-csp/run-harness.ts scenario-weekday-admin.json
   npx tsx tests/milp-csp/run-harness.ts tests/milp-csp/scenario-complex-20.json
   ```
   → (1) 시나리오 → milpInput 직렬화 → (2) `python scheduler-worker/src/run_solver.py` 실행 → (3) `evaluate.ts` 규칙 검증을 한 번에 수행. (상대경로/절대경로 모두 지원)

추가 시나리오는 동일 구조로 파일을 추가하고 테이블에 설명을 기록하세요.
