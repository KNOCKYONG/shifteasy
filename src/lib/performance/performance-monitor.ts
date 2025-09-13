/**
 * Performance Monitoring System
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface QueryMetric {
  query: string;
  duration: number;
  rows: number;
  timestamp: Date;
  slow: boolean;
}

export interface ApiMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private queryMetrics: QueryMetric[] = [];
  private apiMetrics: ApiMetric[] = [];
  private startTimes: Map<string, number> = new Map();
  private slowQueryThreshold = 1000; // 1 second
  private slowApiThreshold = 2000; // 2 seconds

  private constructor() {
    this.startPeriodicCleanup();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start timing an operation
   */
  startTimer(operationId: string): void {
    this.startTimes.set(operationId, performance.now());
  }

  /**
   * End timing and record metric
   */
  endTimer(operationId: string, metricName: string, tags?: Record<string, string>): number {
    const startTime = this.startTimes.get(operationId);
    if (!startTime) {
      console.warn(`No start time found for operation: ${operationId}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(operationId);

    this.recordMetric({
      name: metricName,
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      tags,
    });

    return duration;
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  /**
   * Record query performance
   */
  recordQuery(query: string, duration: number, rows: number = 0): void {
    const metric: QueryMetric = {
      query: this.sanitizeQuery(query),
      duration,
      rows,
      timestamp: new Date(),
      slow: duration > this.slowQueryThreshold,
    };

    this.queryMetrics.push(metric);

    if (metric.slow) {
      console.warn(`Slow query detected (${duration}ms):`, query.substring(0, 100));
    }

    // Keep only last 500 queries
    if (this.queryMetrics.length > 500) {
      this.queryMetrics = this.queryMetrics.slice(-500);
    }
  }

  /**
   * Record API performance
   */
  recordApi(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number
  ): void {
    const metric: ApiMetric = {
      endpoint,
      method,
      statusCode,
      duration,
      timestamp: new Date(),
    };

    this.apiMetrics.push(metric);

    if (duration > this.slowApiThreshold) {
      console.warn(`Slow API call detected (${duration}ms):`, `${method} ${endpoint}`);
    }

    // Keep only last 1000 API calls
    if (this.apiMetrics.length > 1000) {
      this.apiMetrics = this.apiMetrics.slice(-1000);
    }
  }

  /**
   * Get performance statistics
   */
  getStatistics(): {
    metrics: {
      total: number;
      average: number;
      min: number;
      max: number;
      p95: number;
      p99: number;
    };
    queries: {
      total: number;
      slow: number;
      averageDuration: number;
      slowestQuery: QueryMetric | null;
    };
    apis: {
      total: number;
      averageDuration: number;
      errorRate: number;
      slowest: ApiMetric | null;
    };
  } {
    // Calculate metrics statistics
    const metricValues = this.metrics.map(m => m.value);
    const metricsStats = this.calculateStats(metricValues);

    // Calculate query statistics
    const slowQueries = this.queryMetrics.filter(q => q.slow);
    const queryDurations = this.queryMetrics.map(q => q.duration);
    const slowestQuery = this.queryMetrics.reduce(
      (max, q) => (q.duration > (max?.duration || 0) ? q : max),
      null as QueryMetric | null
    );

    // Calculate API statistics
    const apiErrors = this.apiMetrics.filter(a => a.statusCode >= 400);
    const apiDurations = this.apiMetrics.map(a => a.duration);
    const slowestApi = this.apiMetrics.reduce(
      (max, a) => (a.duration > (max?.duration || 0) ? a : max),
      null as ApiMetric | null
    );

    return {
      metrics: {
        total: this.metrics.length,
        ...metricsStats,
      },
      queries: {
        total: this.queryMetrics.length,
        slow: slowQueries.length,
        averageDuration: this.calculateAverage(queryDurations),
        slowestQuery,
      },
      apis: {
        total: this.apiMetrics.length,
        averageDuration: this.calculateAverage(apiDurations),
        errorRate: this.apiMetrics.length > 0
          ? (apiErrors.length / this.apiMetrics.length) * 100
          : 0,
        slowest: slowestApi,
      },
    };
  }

  /**
   * Get slow queries
   */
  getSlowQueries(limit: number = 10): QueryMetric[] {
    return this.queryMetrics
      .filter(q => q.slow)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get slow API calls
   */
  getSlowApis(limit: number = 10): ApiMetric[] {
    return this.apiMetrics
      .filter(a => a.duration > this.slowApiThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get metrics by name
   */
  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.name === name);
  }

  /**
   * Calculate statistics
   */
  private calculateStats(values: number[]): {
    average: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  } {
    if (values.length === 0) {
      return { average: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }

    const sorted = values.slice().sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      average: sum / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.min(index, sorted.length - 1)];
  }

  /**
   * Calculate average
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  /**
   * Sanitize query for storage
   */
  private sanitizeQuery(query: string): string {
    // Remove sensitive data from queries
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/token\s*=\s*'[^']*'/gi, "token='***'")
      .substring(0, 500); // Limit length
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): {
    metrics: PerformanceMetric[];
    queries: QueryMetric[];
    apis: ApiMetric[];
    exported: Date;
  } {
    return {
      metrics: this.metrics,
      queries: this.queryMetrics,
      apis: this.apiMetrics,
      exported: new Date(),
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.queryMetrics = [];
    this.apiMetrics = [];
    this.startTimes.clear();
  }

  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    // Clean up old metrics every hour
    setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 3600000);

      this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
      this.queryMetrics = this.queryMetrics.filter(q => q.timestamp > oneHourAgo);
      this.apiMetrics = this.apiMetrics.filter(a => a.timestamp > oneHourAgo);
    }, 3600000); // 1 hour
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    recommendations: string[];
  } {
    const stats = this.getStatistics();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check for slow queries
    if (stats.queries.slow > 10) {
      issues.push(`High number of slow queries: ${stats.queries.slow}`);
      recommendations.push('Consider optimizing database queries or adding indexes');
      status = 'degraded';
    }

    // Check API error rate
    if (stats.apis.errorRate > 5) {
      issues.push(`High API error rate: ${stats.apis.errorRate.toFixed(2)}%`);
      recommendations.push('Investigate API errors and improve error handling');
      status = stats.apis.errorRate > 10 ? 'unhealthy' : 'degraded';
    }

    // Check average API duration
    if (stats.apis.averageDuration > 1000) {
      issues.push(`Slow average API response time: ${stats.apis.averageDuration.toFixed(0)}ms`);
      recommendations.push('Consider implementing caching or optimizing API endpoints');
      status = status === 'healthy' ? 'degraded' : status;
    }

    // Check for p99 latency
    if (stats.metrics.p99 > 5000) {
      issues.push(`High p99 latency: ${stats.metrics.p99.toFixed(0)}ms`);
      recommendations.push('Investigate performance bottlenecks');
      status = 'degraded';
    }

    return {
      status,
      issues,
      recommendations,
    };
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();