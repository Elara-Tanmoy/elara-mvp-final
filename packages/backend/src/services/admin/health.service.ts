import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { scanQueue } from '../queue/scan.queue.js';
import { threatIntelService } from '../threat-intel/threatIntelService.js';

class AdminHealthService {
  async getSystemHealth() {
    // Implementation for system health
    return { status: 'ok' };
  }

  async getDatabaseHealth() {
    // Implementation for database health
    return { status: 'ok' };
  }

  async getPerformanceMetrics() {
    // Implementation for performance metrics
    return { status: 'ok' };
  }

  async getTISourceHealth() {
    // Implementation for TI source health
    return { status: 'ok' };
  }

  async getRealtimeStats() {
    if (!scanQueue) {
      return {
        queueName: 'scan-queue',
        status: 'inactive',
        error: 'Redis is not configured, queue is not available.'
      };
    }

    const [jobCounts, workers, completedMetrics, failedMetrics] = await Promise.all([
      scanQueue.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed'),
      scanQueue.getWorkers(),
      scanQueue.getMetrics('completed'),
      scanQueue.getMetrics('failed'),
    ]);

    return {
      queueName: scanQueue.name,
      status: 'active',
      jobCounts,
      workerCount: workers.length,
      workers,
      metrics: {
        completed: completedMetrics,
        failed: failedMetrics,
      },
    };
  }
}

export const healthService = new AdminHealthService();
