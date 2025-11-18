# Fly.io Scheduler Worker (Python + OR-Tools)

장시간 MILP/CSP 계산을 Next.js 프론트와 분리하기 위해 `scheduler-worker` (FastAPI + OR-Tools) 앱을 Fly.io에 배포하는 절차입니다.

## 구조 요약

- Next.js(TRPC) → `MILP_SCHEDULER_BACKEND_URL` (`https://<app>.fly.dev`) 로 FastAPI 워커 호출.
- FastAPI → OR-Tools/HiGHS로 MILP 계산, 결과를 `/scheduler/jobs/{id}` 응답으로 반환.
- Next.js는 동일한 큐 인터페이스(POST → 폴링)를 사용하므로 기존 TRPC 로직을 그대로 재사용합니다.

## 준비 사항

1. Fly CLI 로그인
   ```bash
   fly auth login
   ```
2. 앱 생성
   ```bash
   fly apps create shifteasy-milp-worker
   ```
3. `scheduler-worker/fly.example.toml`을 복사해 `fly.toml` 작성 후 `app`/리전을 수정합니다.

## 배포

```bash
cd scheduler-worker
fly launch --no-deploy  # 필요 시
fly deploy
```

배포 후 상태 확인:

```bash
fly status -a shifteasy-milp-worker
```

## 로컬 개발

```bash
cd scheduler-worker
pip install -r requirements.txt
uvicorn src.app:app --host 0.0.0.0 --port 4000 --reload
```

## 환경 변수

Vercel/로컬 `.env.local` 예시:

```
MILP_SCHEDULER_LOCAL_URL=http://127.0.0.1:4000            # 로컬 FastAPI 워커
MILP_SCHEDULER_BACKEND_URL=https://shifteasy-milp-worker.fly.dev  # (선택) Fly 백업 워커
```

애플리케이션은 `MILP_SCHEDULER_LOCAL_URL` → `MILP_SCHEDULER_BACKEND_URL` 순으로 자동 폴백하므로, Fly 인스턴스는 필요할 때만 켜 두고 평소에는 scale 0으로 비용을 줄일 수 있습니다.

Fly 앱 Secrets:
- (필요 시) `OPENAI_API_KEY` 등 향후 CSP/AI 의존성.

## 참고

- Dockerfile은 `scheduler-worker/Dockerfile`에 정의되어 있으며 Python 3.12 slim 이미지를 사용합니다.
- Fly에서 기본 포트는 8080이므로 `fly.toml`의 `internal_port`도 8080으로 설정되어 있습니다.
