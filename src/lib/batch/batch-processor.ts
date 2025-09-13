/**
 * Batch Processing System with Async Queues
 */

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

export interface BatchJob {
  id: string;
  type: string;
  status: JobStatus;
  priority: JobPriority;
  data: any;
  result?: any;
  error?: string;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, any>;
}

export interface JobOptions {
  priority?: JobPriority;
  maxRetries?: number;
  timeout?: number;
  metadata?: Record<string, any>;
}

export interface ProcessorFunction {
  (job: BatchJob): Promise<any>;
}

export class BatchProcessor {
  private static instance: BatchProcessor;
  private jobQueue: Map<string, BatchJob> = new Map();
  private processingQueue: Set<string> = new Set();
  private processors: Map<string, ProcessorFunction> = new Map();
  private isProcessing: boolean = false;
  private maxConcurrent: number = 3;
  private processInterval: NodeJS.Timeout | null = null;
  private progressCallbacks: Map<string, (progress: number) => void> = new Map();

  private constructor() {
    this.registerDefaultProcessors();
    this.startProcessing();
  }

  static getInstance(): BatchProcessor {
    if (!BatchProcessor.instance) {
      BatchProcessor.instance = new BatchProcessor();
    }
    return BatchProcessor.instance;
  }

  /**
   * Register default job processors
   */
  private registerDefaultProcessors(): void {
    // Report generation processor
    this.registerProcessor('generate_report', async (job) => {
      const { reportType, data, format } = job.data;

      // Simulate report generation with progress updates
      for (let i = 0; i <= 100; i += 20) {
        await this.updateProgress(job.id, i);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return {
        reportId: `report_${Date.now()}`,
        format,
        size: Math.floor(Math.random() * 1000000),
        url: `/reports/${reportType}_${Date.now()}.${format}`,
      };
    });

    // Analytics calculation processor
    this.registerProcessor('calculate_analytics', async (job) => {
      const { metrics, timeRange } = job.data;

      // Simulate analytics calculation
      const totalMetrics = metrics.length;
      for (let i = 0; i < totalMetrics; i++) {
        await this.updateProgress(job.id, ((i + 1) / totalMetrics) * 100);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      return {
        metrics: metrics.map((m: string) => ({
          name: m,
          value: Math.random() * 100,
          trend: Math.random() > 0.5 ? 'up' : 'down',
        })),
        timestamp: new Date(),
      };
    });

    // Data export processor
    this.registerProcessor('export_data', async (job) => {
      const { dataType, format, filters } = job.data;

      // Simulate data export
      await this.updateProgress(job.id, 20);
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.updateProgress(job.id, 60);
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.updateProgress(job.id, 100);

      return {
        exportId: `export_${Date.now()}`,
        recordCount: Math.floor(Math.random() * 10000),
        fileSize: Math.floor(Math.random() * 5000000),
        downloadUrl: `/exports/${dataType}_${Date.now()}.${format}`,
      };
    });

    // Bulk update processor
    this.registerProcessor('bulk_update', async (job) => {
      const { entityType, updates } = job.data;
      const total = updates.length;
      let processed = 0;
      let failed = 0;

      for (let i = 0; i < total; i++) {
        try {
          // Simulate update
          await new Promise(resolve => setTimeout(resolve, 50));
          processed++;
        } catch (error) {
          failed++;
        }

        await this.updateProgress(job.id, ((i + 1) / total) * 100);
      }

      return {
        total,
        processed,
        failed,
        success: failed === 0,
      };
    });

    // Schedule optimization processor
    this.registerProcessor('optimize_schedule', async (job) => {
      const { scheduleId, constraints } = job.data;

      // Simulate complex optimization
      const steps = [
        'Loading data',
        'Analyzing constraints',
        'Generating solutions',
        'Evaluating fitness',
        'Selecting optimal solution',
      ];

      for (let i = 0; i < steps.length; i++) {
        await this.updateProgress(job.id, ((i + 1) / steps.length) * 100);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      return {
        scheduleId,
        optimizationScore: 85 + Math.random() * 15,
        improvements: Math.floor(Math.random() * 20),
        conflicts: Math.floor(Math.random() * 5),
      };
    });
  }

  /**
   * Register a job processor
   */
  registerProcessor(type: string, processor: ProcessorFunction): void {
    this.processors.set(type, processor);
  }

  /**
   * Add a job to the queue
   */
  async addJob(
    type: string,
    data: any,
    options: JobOptions = {}
  ): Promise<string> {
    const jobId = this.generateJobId();

    const job: BatchJob = {
      id: jobId,
      type,
      status: 'pending',
      priority: options.priority || 'normal',
      data,
      progress: 0,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      metadata: options.metadata,
    };

    this.jobQueue.set(jobId, job);
    this.sortQueueByPriority();

    return jobId;
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobQueue.get(jobId);
    if (!job) return false;

    if (job.status === 'pending') {
      job.status = 'cancelled';
      job.completedAt = new Date();
      return true;
    }

    if (job.status === 'processing') {
      // Mark for cancellation
      job.status = 'cancelled';
      this.processingQueue.delete(jobId);
      return true;
    }

    return false;
  }

  /**
   * Get job status
   */
  getJob(jobId: string): BatchJob | undefined {
    return this.jobQueue.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): BatchJob[] {
    return Array.from(this.jobQueue.values());
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: JobStatus): BatchJob[] {
    return Array.from(this.jobQueue.values()).filter(job => job.status === status);
  }

  /**
   * Start processing jobs
   */
  private startProcessing(): void {
    if (this.processInterval) return;

    this.processInterval = setInterval(() => {
      this.processNextJobs();
    }, 1000);
  }

  /**
   * Process next jobs in queue
   */
  private async processNextJobs(): Promise<void> {
    if (this.processingQueue.size >= this.maxConcurrent) return;

    const pendingJobs = this.getJobsByStatus('pending');
    const availableSlots = this.maxConcurrent - this.processingQueue.size;

    for (let i = 0; i < Math.min(availableSlots, pendingJobs.length); i++) {
      const job = pendingJobs[i];
      if (!this.processingQueue.has(job.id)) {
        this.processingQueue.add(job.id);
        this.processJob(job);
      }
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: BatchJob): Promise<void> {
    try {
      job.status = 'processing';
      job.startedAt = new Date();

      const processor = this.processors.get(job.type);
      if (!processor) {
        throw new Error(`No processor found for job type: ${job.type}`);
      }

      const result = await processor(job);

      job.result = result;
      job.status = 'completed';
      job.completedAt = new Date();
      job.progress = 100;

      // Notify completion
      this.notifyProgress(job.id, 100);

    } catch (error: any) {
      job.error = error.message;
      job.retryCount++;

      if (job.retryCount < job.maxRetries) {
        job.status = 'pending';
        console.log(`Retrying job ${job.id} (attempt ${job.retryCount}/${job.maxRetries})`);
      } else {
        job.status = 'failed';
        job.completedAt = new Date();
        console.error(`Job ${job.id} failed after ${job.maxRetries} attempts:`, error);
      }
    } finally {
      this.processingQueue.delete(job.id);
    }
  }

  /**
   * Update job progress
   */
  private async updateProgress(jobId: string, progress: number): Promise<void> {
    const job = this.jobQueue.get(jobId);
    if (job) {
      job.progress = Math.min(100, Math.max(0, progress));
      this.notifyProgress(jobId, job.progress);
    }
  }

  /**
   * Register progress callback
   */
  onProgress(jobId: string, callback: (progress: number) => void): void {
    this.progressCallbacks.set(jobId, callback);
  }

  /**
   * Notify progress update
   */
  private notifyProgress(jobId: string, progress: number): void {
    const callback = this.progressCallbacks.get(jobId);
    if (callback) {
      callback(progress);

      // Clean up completed jobs
      if (progress === 100) {
        setTimeout(() => {
          this.progressCallbacks.delete(jobId);
        }, 5000);
      }
    }
  }

  /**
   * Sort queue by priority
   */
  private sortQueueByPriority(): void {
    const priorityOrder: Record<JobPriority, number> = {
      critical: 4,
      high: 3,
      normal: 2,
      low: 1,
    };

    const sorted = Array.from(this.jobQueue.entries()).sort((a, b) => {
      const priorityA = priorityOrder[a[1].priority];
      const priorityB = priorityOrder[b[1].priority];

      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      return a[1].createdAt.getTime() - b[1].createdAt.getTime();
    });

    this.jobQueue = new Map(sorted);
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue statistics
   */
  getStatistics(): any {
    const jobs = Array.from(this.jobQueue.values());

    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      cancelled: jobs.filter(j => j.status === 'cancelled').length,
      processingSlots: {
        used: this.processingQueue.size,
        available: this.maxConcurrent - this.processingQueue.size,
        total: this.maxConcurrent,
      },
    };
  }

  /**
   * Clear completed jobs
   */
  clearCompleted(): number {
    const completed = this.getJobsByStatus('completed');
    completed.forEach(job => {
      this.jobQueue.delete(job.id);
      this.progressCallbacks.delete(job.id);
    });
    return completed.length;
  }

  /**
   * Stop processing
   */
  stopProcessing(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  }

  /**
   * Resume processing
   */
  resumeProcessing(): void {
    this.startProcessing();
  }
}

export const batchProcessor = BatchProcessor.getInstance();