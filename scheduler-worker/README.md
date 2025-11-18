# Scheduler Worker (MILP/CSP)

이 디렉터리는 `milp-csp-scheduler` Python 워커를 위한 초기 스켈레톤입니다. OR-Tools/HiGHS 기반 MILP 솔버와 향후 CSP 후처리를 구현하여 Fly.io NestJS 워커에서 호출할 수 있도록 설계합니다.

## 구조

```
scheduler-worker/
 ├─ requirements.txt         # OR-Tools, highspy, FastAPI 등
 └─ src/
    ├─ models.py             # MilpCspScheduleInput 호환 파이썬 모델
    ├─ solver/
    │   ├─ ortools_solver.py # 하드 제약을 해결하는 OR-Tools MILP
    │   └─ highs_solver.py   # HiGHS 백업 솔버 (추후 구현)
    └─ run_solver.py         # CLI/테스트 진입점
```

## 개발 메모

- Node/Next.js 앱이 생성한 `milpInput` JSON을 이 워커에 전달하여 솔버를 실행합니다.
- 현재는 CLI 기반으로 테스트 시나리오(JSON)를 받아 assignments JSON을 출력하는 방식입니다.
- 향후 FastAPI + Redis 큐를 붙여 `/scheduler/jobs` REST 엔드포인트를 구현합니다.

### CLI 실행

```
pip install -r scheduler-worker/requirements.txt
python scheduler-worker/src/run_solver.py tests/milp-csp/milp-input.json /tmp/out.json
```

### FastAPI 서버 실행

```
uvicorn scheduler-worker.src.app:app --host 0.0.0.0 --port 8000 --reload
```

- `POST /scheduler/jobs` : `{ "milpInput": { ... } }`
- `GET /scheduler/jobs/{jobId}` : 상태/결과 조회
