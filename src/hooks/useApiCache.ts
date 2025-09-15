import { useState, useEffect, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface UseApiCacheOptions {
  ttl?: number; // Time to live in milliseconds
  cacheKey: string;
  enabled?: boolean;
}

interface UseApiCacheReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  clearCache: () => void;
}

// 전역 캐시 스토어
const globalCache = new Map<string, CacheEntry<any>>();

// 캐시 클리너 - 만료된 항목 정리
const cleanExpiredCache = () => {
  const now = Date.now();
  globalCache.forEach((entry, key) => {
    if (now - entry.timestamp > entry.ttl) {
      globalCache.delete(key);
    }
  });
};

// 5분마다 캐시 정리
setInterval(cleanExpiredCache, 5 * 60 * 1000);

export function useApiCache<T>(
  fetcher: () => Promise<T>,
  options: UseApiCacheOptions
): UseApiCacheReturn<T> {
  const { ttl = 5 * 60 * 1000, cacheKey, enabled = true } = options; // 기본 TTL: 5분
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    const now = Date.now();
    const cached = globalCache.get(cacheKey);

    // 캐시가 유효하고 강제 새로고침이 아닌 경우
    if (!forceRefresh && cached && (now - cached.timestamp <= cached.ttl)) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();

      // 캐시에 저장
      globalCache.set(cacheKey, {
        data: result,
        timestamp: now,
        ttl,
      });

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('API 호출 실패'));

      // 에러 발생 시 기존 캐시 데이터 사용 (있는 경우)
      if (cached) {
        setData(cached.data);
      }
    } finally {
      setLoading(false);
    }
  }, [cacheKey, enabled, fetcher, ttl]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  const clearCache = useCallback(() => {
    globalCache.delete(cacheKey);
    setData(null);
  }, [cacheKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch, clearCache };
}

// 특정 패턴의 캐시를 모두 삭제하는 유틸리티 함수
export function clearCachePattern(pattern: string) {
  const keys = Array.from(globalCache.keys());
  keys.forEach(key => {
    if (key.includes(pattern)) {
      globalCache.delete(key);
    }
  });
}

// 모든 캐시 삭제
export function clearAllCache() {
  globalCache.clear();
}

// 캐시 통계 가져오기
export function getCacheStats() {
  const now = Date.now();
  let totalSize = 0;
  let expiredCount = 0;
  let activeCount = 0;

  globalCache.forEach((entry) => {
    const isExpired = now - entry.timestamp > entry.ttl;
    if (isExpired) {
      expiredCount++;
    } else {
      activeCount++;
    }
    // 대략적인 메모리 크기 추정
    totalSize += JSON.stringify(entry.data).length;
  });

  return {
    totalEntries: globalCache.size,
    activeEntries: activeCount,
    expiredEntries: expiredCount,
    estimatedSizeKB: Math.round(totalSize / 1024),
  };
}