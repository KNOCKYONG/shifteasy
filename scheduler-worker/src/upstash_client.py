import os
from typing import Optional

from upstash_redis import Redis
from loguru import logger


def get_upstash_client() -> Optional[Redis]:
  url = os.getenv("UPSTASH_REDIS_REST_URL")
  token = os.getenv("UPSTASH_REDIS_REST_TOKEN")
  if not url or not token:
    logger.warning("Upstash Redis credentials not provided. Skipping Upstash client init.")
    return None
  try:
    client = Redis(url=url, token=token)
    # lightweight ping to ensure credentials are valid
    client.ping()
    logger.info("Upstash Redis client initialized and ping successful.")
    return client
  except Exception as exc:  # pragma: no cover
    logger.warning(f"Failed to initialize Upstash Redis client: {exc}")
    return None
