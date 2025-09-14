/**
 * Analytics Queue Processor
 */

import { Job } from 'bull';
import { AnalyticsJobData } from '../bull-config';

export async function analyticsProcessor(job: Job<AnalyticsJobData>): Promise<any> {
  const { tenantId, metric, aggregation, dateRange } = job.data;

  try {
    await job.progress(10);

    // Simulate data collection
    const rawData = await collectAnalyticsData(
      tenantId,
      metric,
      dateRange
    );

    await job.progress(40);

    // Aggregate data
    const aggregatedData = await aggregateData(
      rawData,
      aggregation
    );

    await job.progress(70);

    // Calculate insights
    const insights = calculateInsights(aggregatedData);

    await job.progress(90);

    const result = {
      analyticsId: `analytics-${Date.now()}`,
      tenantId,
      metric,
      aggregation,
      dateRange,
      data: aggregatedData,
      insights,
      processedAt: new Date().toISOString(),
    };

    await job.progress(100);

    return result;
  } catch (error: any) {
    console.error('Analytics processing failed:', error);
    throw new Error(`Failed to process analytics: ${error.message}`);
  }
}

async function collectAnalyticsData(
  tenantId: string,
  metric: string,
  dateRange: { start: Date; end: Date }
): Promise<any[]> {
  // Simulate data collection
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Generate mock data
  const data = [];
  const days = Math.ceil(
    (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) /
    (1000 * 60 * 60 * 24)
  );

  for (let i = 0; i < days; i++) {
    data.push({
      date: new Date(
        new Date(dateRange.start).getTime() + i * 24 * 60 * 60 * 1000
      ).toISOString(),
      value: Math.floor(Math.random() * 100) + 50,
      metric,
    });
  }

  return data;
}

async function aggregateData(
  data: any[],
  aggregation: 'hourly' | 'daily' | 'weekly' | 'monthly'
): Promise<any> {
  // Simulate aggregation processing
  await new Promise(resolve => setTimeout(resolve, 500));

  // Simple aggregation logic
  const aggregated: any = {};

  data.forEach(item => {
    let key: string;
    const date = new Date(item.date);

    switch (aggregation) {
      case 'hourly':
        key = `${date.toISOString().slice(0, 13)}:00`;
        break;
      case 'daily':
        key = date.toISOString().slice(0, 10);
        break;
      case 'weekly':
        const week = Math.floor(date.getDate() / 7);
        key = `${date.getFullYear()}-W${week}`;
        break;
      case 'monthly':
        key = date.toISOString().slice(0, 7);
        break;
      default:
        key = date.toISOString().slice(0, 10);
    }

    if (!aggregated[key]) {
      aggregated[key] = {
        period: key,
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
      };
    }

    aggregated[key].count++;
    aggregated[key].sum += item.value;
    aggregated[key].min = Math.min(aggregated[key].min, item.value);
    aggregated[key].max = Math.max(aggregated[key].max, item.value);
  });

  // Calculate averages
  Object.values(aggregated).forEach((item: any) => {
    item.average = item.sum / item.count;
  });

  return Object.values(aggregated);
}

function calculateInsights(data: any[]): any {
  if (!data.length) {
    return { trend: 'no_data' };
  }

  const values = data.map(d => d.average || d.value || 0);
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  return {
    trend: secondAvg > firstAvg ? 'increasing' : secondAvg < firstAvg ? 'decreasing' : 'stable',
    average: Math.round(average * 100) / 100,
    min: Math.min(...values),
    max: Math.max(...values),
    changePercent: firstAvg ? ((secondAvg - firstAvg) / firstAvg * 100).toFixed(2) : 0,
  };
}