FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Context이 리포지토리 루트일 때도 동작하도록 명시 경로 사용
COPY scheduler-worker/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY scheduler-worker/ /app

CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "4000"]
