# Fly.io Scheduler Backend

장시간 스케줄 생성 작업을 Vercel 프론트와 분리하기 위해 NestJS 백엔드를 Fly.io에 올리는 방법을 정리했습니다.

## 구조 요약

- Next.js(TRPC) → `SCHEDULER_BACKEND_URL` (`https://shifteasy-scheduler.fly.dev`) 로 Fly NestJS API 호출.
- NestJS → Upstash Redis 큐에 작업 저장, 워커가 `generateAiSchedule` + `autoPolishWithAI` 수행.
- 작업 완료 시 NestJS가 JSON 응답을 반환하면 Next.js가 결과를 DB/상태에 반영.

## 준비 사항

1. Fly CLI 로그인
   ```bash
   fly auth login
   ```
2. Fly 앱 생성 (`fly apps create shifteasy-scheduler`)
3. `scheduler-backend/fly.toml`에서 `app` / `primary_region` 등 확인.
4. Secrets 등록:
   ```bash
   cd scheduler-backend
   fly secrets set \
     UPSTASH_REDIS_REST_URL=... \
     UPSTASH_REDIS_REST_TOKEN=... \
     OPENAI_API_KEY=... \
     SCHEDULER_WORKER_POLL_INTERVAL=1000
   ```

## 배포

루트에서:
```bash
cd scheduler-backend
fly deploy
```

배포 후 상태 확인:
```bash
fly status -a shifteasy-scheduler
```

## 로컬 개발 (옵션)

```bash
cd scheduler-backend
npm install
npm run start:dev
```

`.env.example`을 참고해 필요한 키들을 `.env`에 작성하면 됩니다.

## 환경 변수

Vercel/로컬 `.env.local`:
```
SCHEDULER_BACKEND_URL=https://shifteasy-scheduler.fly.dev
```

Fly secrets:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `OPENAI_API_KEY`
- `SCHEDULER_WORKER_POLL_INTERVAL`

## 기타

- NestJS 빌드 시 `scheduler-backend/Dockerfile`이 프로젝트 루트 `src/`를 함께 복사해 `@web/*` alias를 해석합니다.
- `tsconfig.json`에서 `scheduler-backend/**/*`를 제외해 Next.js 타입체크에 영향 없도록 했습니다.
