import { Request, Response } from 'express';
import { healthService } from '../../services/admin/health.service.js';
import { logger } from '../../config/logger.js';

class AdminHealthController {
  async getSystemHealth(req: Request, res: Response) {
    try {
      const health = await healthService.getSystemHealth();
      res.json({ success: true, data: health });
    } catch (error) {
      logger.error('[AdminHealthController] Error getting system health:', error);
      res.status(500).json({ success: false, error: 'Failed to get system health' });
    }
  }

  async getDatabaseHealth(req: Request, res: Response) {
    try {
      const dbHealth = await healthService.getDatabaseHealth();
      res.json({ success: true, data: dbHealth });
    } catch (error) {
      logger.error('[AdminHealthController] Error getting database health:', error);
      res.status(500).json({ success: false, error: 'Failed to get database health' });
    }
  }

  async getPerformanceMetrics(req: Request, res: Response) {
    try {
      const metrics = await healthService.getPerformanceMetrics();
      res.json({ success: true, data: metrics });
    } catch (error) {
      logger.error('[AdminHealthController] Error getting performance metrics:', error);
      res.status(500).json({ success: false, error: 'Failed to get performance metrics' });
    }
  }

  async getTISourceHealth(req: Request, res: Response) {
    try {
      const tiHealth = await healthService.getTISourceHealth();
      res.json({ success: true, data: tiHealth });
    } catch (error) {
      logger.error('[AdminHealthController] Error getting TI source health:', error);
      res.status(500).json({ success: false, error: 'Failed to get TI source health' });
    }
  }

  async getRealtimeStats(req: Request, res: Response) {
    try {
      const realtimeStats = await healthService.getRealtimeStats();
      res.json({ success: true, data: realtimeStats });
    } catch (error) {
      logger.error('[AdminHealthController] Error getting real-time stats:', error);
      res.status(500).json({ success: false, error: 'Failed to get real-time stats' });
    }
  }
}

export { AdminHealthController };
export const healthController = new AdminHealthController();