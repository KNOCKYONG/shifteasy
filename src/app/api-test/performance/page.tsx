'use client';

import { useState, useEffect } from 'react';

type TabType = 'cache' | 'ratelimit' | 'performance' | 'guide';

export default function PerformanceTestPage() {
  const [activeTab, setActiveTab] = useState<TabType>('guide');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Cache State
  const [cacheAction, setCacheAction] = useState('stats');
  const [invalidatePattern, setInvalidatePattern] = useState('');
  const [invalidateType, setInvalidateType] = useState('all');

  // Rate Limit State
  const [tenantId, setTenantId] = useState('test-tenant');
  const [tenantTier, setTenantTier] = useState('free');
  const [rateLimitStats, setRateLimitStats] = useState<any>(null);

  // Performance State
  const [performanceType, setPerformanceType] = useState('stats');
  const [performanceStats, setPerformanceStats] = useState<any>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);

  // Simulation State
  const [simulating, setSimulating] = useState(false);

  // Fetch rate limit stats periodically
  useEffect(() => {
    if (activeTab === 'ratelimit') {
      fetchRateLimitStats();
      const interval = setInterval(fetchRateLimitStats, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Fetch performance stats periodically
  useEffect(() => {
    if (activeTab === 'performance') {
      fetchPerformanceStats();
      fetchHealthStatus();
      const interval = setInterval(() => {
        fetchPerformanceStats();
        fetchHealthStatus();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Cache Operations
  const getCacheStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cache');
      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const warmUpCache = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cache?action=warmup', {
        method: 'POST',
      });
      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const invalidateCache = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cache', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: invalidatePattern || undefined,
          type: invalidateType,
        }),
      });
      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Rate Limit Operations
  const fetchRateLimitStats = async () => {
    try {
      const res = await fetch('/api/rate-limit');
      const data = await res.json();
      setRateLimitStats(data);
    } catch (err) {
      console.error('Failed to fetch rate limit stats:', err);
    }
  };

  const updateTenantQuota = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          tier: tenantTier,
        }),
      });
      const data = await res.json();
      setResponse(data);
      fetchRateLimitStats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Performance Operations
  const fetchPerformanceStats = async () => {
    try {
      const res = await fetch('/api/performance');
      const data = await res.json();
      setPerformanceStats(data);
    } catch (err) {
      console.error('Failed to fetch performance stats:', err);
    }
  };

  const fetchHealthStatus = async () => {
    try {
      const res = await fetch('/api/performance?type=health');
      const data = await res.json();
      setHealthStatus(data.health);
    } catch (err) {
      console.error('Failed to fetch health status:', err);
    }
  };

  const getSlowQueries = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/performance?type=slow-queries&limit=10');
      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSlowApis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/performance?type=slow-apis&limit=10');
      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Simulate Load
  const simulateLoad = async () => {
    setSimulating(true);
    setError(null);

    try {
      // Simulate multiple API calls
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          fetch('/api/analytics/metrics', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': 'test-tenant',
              'x-user-id': `user-${i}`,
            },
            body: JSON.stringify({
              metrics: ['attendance'],
              timeRange: {
                start: '2024-01-01',
                end: '2024-01-31',
                period: 'monthly',
              },
            }),
          }).catch(() => null)
        );

        // Add small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await Promise.all(promises);
      setResponse({ message: 'Load simulation completed', requests: 20 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Performance & Optimization Test</h1>

      {/* Tab Navigation */}
      <div className="flex space-x-4 mb-8 border-b">
        <button
          onClick={() => setActiveTab('guide')}
          className={`pb-2 px-1 ${activeTab === 'guide' ? 'border-b-2 border-blue-500' : ''}`}
        >
          Test Guide
        </button>
        <button
          onClick={() => setActiveTab('cache')}
          className={`pb-2 px-1 ${activeTab === 'cache' ? 'border-b-2 border-blue-500' : ''}`}
        >
          Cache Management
        </button>
        <button
          onClick={() => setActiveTab('ratelimit')}
          className={`pb-2 px-1 ${activeTab === 'ratelimit' ? 'border-b-2 border-blue-500' : ''}`}
        >
          Rate Limiting
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`pb-2 px-1 ${activeTab === 'performance' ? 'border-b-2 border-blue-500' : ''}`}
        >
          Performance Monitor
        </button>
      </div>

      {/* Test Guide Tab */}
      {activeTab === 'guide' && (
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4">📚 Test Guide</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Cache Management</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>View cache statistics (hit rate, misses)</li>
                <li>Warm up cache with common data</li>
                <li>Invalidate cache by pattern or type</li>
                <li>Clear all cache entries</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">2. Rate Limiting</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>View current rate limit statistics</li>
                <li>Update tenant quotas (free, basic, premium, enterprise)</li>
                <li>Monitor API, Auth, Report, and DDoS limiters</li>
                <li>Simulate load to trigger rate limits</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">3. Performance Monitoring</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>View real-time performance metrics</li>
                <li>Check system health status</li>
                <li>Identify slow queries and APIs</li>
                <li>Export performance data for analysis</li>
              </ul>
            </div>

            <div className="bg-yellow-100 p-3 rounded mt-4">
              <p className="text-sm">
                <strong>Note:</strong> The system uses in-memory cache if Redis is not configured.
                Rate limiting falls back to memory-based limiting when Redis is unavailable.
              </p>
            </div>

            <div className="mt-6">
              <button
                onClick={simulateLoad}
                disabled={simulating}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              >
                {simulating ? 'Simulating...' : 'Simulate Load (20 requests)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cache Management Tab */}
      {activeTab === 'cache' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Cache Operations</h2>

            <div className="space-y-4">
              <div>
                <button
                  onClick={getCacheStats}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 mr-4"
                >
                  Get Statistics
                </button>

                <button
                  onClick={warmUpCache}
                  disabled={loading}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                >
                  Warm Up Cache
                </button>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Invalidate Cache</h3>
                <div className="flex space-x-4">
                  <input
                    type="text"
                    value={invalidatePattern}
                    onChange={(e) => setInvalidatePattern(e.target.value)}
                    placeholder="Pattern (optional)"
                    className="flex-1 p-2 border rounded"
                  />
                  <select
                    value={invalidateType}
                    onChange={(e) => setInvalidateType(e.target.value)}
                    className="p-2 border rounded"
                  >
                    <option value="all">All</option>
                    <option value="schedule">Schedule</option>
                    <option value="session">Session</option>
                    <option value="computation">Computation</option>
                    <option value="api">API</option>
                  </select>
                  <button
                    onClick={invalidateCache}
                    disabled={loading}
                    className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
                  >
                    Invalidate
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rate Limiting Tab */}
      {activeTab === 'ratelimit' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Tenant Quota Management</h2>

            <div className="flex space-x-4">
              <input
                type="text"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="Tenant ID"
                className="flex-1 p-2 border rounded"
              />
              <select
                value={tenantTier}
                onChange={(e) => setTenantTier(e.target.value)}
                className="p-2 border rounded"
              >
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <button
                onClick={updateTenantQuota}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Update Quota
              </button>
            </div>
          </div>

          {rateLimitStats && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Rate Limit Statistics</h2>

              {rateLimitStats.statistics?.tenantQuotas?.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Tenant Quotas</h3>
                  <div className="space-y-2">
                    {rateLimitStats.statistics.tenantQuotas.map((quota: any) => (
                      <div key={quota.tenantId} className="p-3 border rounded">
                        <div className="flex justify-between">
                          <span className="font-medium">{quota.tenantId}</span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                            {quota.tier}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Requests/min: {quota.limits.requestsPerMinute} |
                          Requests/hour: {quota.limits.requestsPerHour} |
                          Max users: {quota.limits.maxUsers === -1 ? 'Unlimited' : quota.limits.maxUsers}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Rate Limiters</h3>
                <div className="grid grid-cols-2 gap-3">
                  {rateLimitStats.statistics?.limiters?.map((limiter: any) => (
                    <div key={limiter.name} className="p-3 border rounded">
                      <div className="font-medium capitalize">{limiter.name}</div>
                      <div className="text-sm text-gray-600">
                        {limiter.config.points} requests per {limiter.config.duration}s
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Performance Monitor Tab */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {healthStatus && (
            <div className={`p-4 rounded-lg ${
              healthStatus.status === 'healthy' ? 'bg-green-50 border-green-200' :
              healthStatus.status === 'degraded' ? 'bg-yellow-50 border-yellow-200' :
              'bg-red-50 border-red-200'
            } border`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold">System Health</h2>
                <span className={`px-3 py-1 rounded text-sm font-medium ${
                  healthStatus.status === 'healthy' ? 'bg-green-100 text-green-800' :
                  healthStatus.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {healthStatus.status.toUpperCase()}
                </span>
              </div>

              {healthStatus.issues.length > 0 && (
                <div className="mt-2">
                  <h3 className="font-semibold text-sm mb-1">Issues:</h3>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {healthStatus.issues.map((issue: string, i: number) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {healthStatus.recommendations.length > 0 && (
                <div className="mt-2">
                  <h3 className="font-semibold text-sm mb-1">Recommendations:</h3>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {healthStatus.recommendations.map((rec: string, i: number) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Performance Analysis</h2>

            <div className="space-x-4">
              <button
                onClick={getSlowQueries}
                disabled={loading}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
              >
                Show Slow Queries
              </button>

              <button
                onClick={getSlowApis}
                disabled={loading}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              >
                Show Slow APIs
              </button>
            </div>
          </div>

          {performanceStats?.statistics && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Performance Statistics</h2>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 border rounded">
                  <h3 className="font-semibold mb-2">Metrics</h3>
                  <div className="text-sm space-y-1">
                    <div>Total: {performanceStats.statistics.metrics.total}</div>
                    <div>Average: {performanceStats.statistics.metrics.average.toFixed(2)}ms</div>
                    <div>P95: {performanceStats.statistics.metrics.p95.toFixed(2)}ms</div>
                    <div>P99: {performanceStats.statistics.metrics.p99.toFixed(2)}ms</div>
                  </div>
                </div>

                <div className="p-4 border rounded">
                  <h3 className="font-semibold mb-2">Queries</h3>
                  <div className="text-sm space-y-1">
                    <div>Total: {performanceStats.statistics.queries.total}</div>
                    <div>Slow: {performanceStats.statistics.queries.slow}</div>
                    <div>Avg Duration: {performanceStats.statistics.queries.averageDuration.toFixed(2)}ms</div>
                  </div>
                </div>

                <div className="p-4 border rounded">
                  <h3 className="font-semibold mb-2">APIs</h3>
                  <div className="text-sm space-y-1">
                    <div>Total: {performanceStats.statistics.apis.total}</div>
                    <div>Error Rate: {performanceStats.statistics.apis.errorRate.toFixed(2)}%</div>
                    <div>Avg Duration: {performanceStats.statistics.apis.averageDuration.toFixed(2)}ms</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Response Display */}
      {(response || error) && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-2">Response:</h3>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
              {error}
            </div>
          )}
          {response && (
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(response, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}