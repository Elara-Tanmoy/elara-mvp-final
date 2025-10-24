/**
 * Admin Scans Controller
 *
 * Manages scan history and results:
 * - List all scans (paginated, filtered)
 * - Get scan details
 * - Search scans
 * - Delete scan
 * - Export scans
 * - Scan statistics
 */

import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';

export class AdminScansController {
  /**
   * GET /api/admin/scans
   * List scans with pagination and filtering
   */
  async listScans(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '20',
        riskLevel,
        startDate,
        endDate,
        search
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: any = {};

      if (riskLevel) {
        where.riskLevel = riskLevel;
      }

      if (startDate || endDate) {
        where.scanDate = {};
        if (startDate) where.scanDate.gte = new Date(startDate as string);
        if (endDate) where.scanDate.lte = new Date(endDate as string);
      }

      if (search) {
        where.url = {
          contains: search as string,
          mode: 'insensitive'
        };
      }

      const [scans, total] = await Promise.all([
        prisma.adminUrlScan.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { scanDate: 'desc' },
          select: {
            id: true,
            url: true,
            riskLevel: true,
            finalScore: true,
            activeMaxScore: true,
            baseScore: true,
            aiMultiplier: true,
            reachabilityState: true,
            pipelineUsed: true,
            scanDate: true,
            duration: true
          }
        }),
        prisma.adminUrlScan.count({ where })
      ]);

      logger.info(`[Admin Scans] Listed ${scans.length} scans (page ${pageNum})`);

      res.json({
        success: true,
        data: scans,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      logger.error('[Admin Scans] Error listing scans:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list scans'
      });
    }
  }

  /**
   * GET /api/admin/scans/:id
   * Get detailed scan results
   */
  async getScan(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const scan = await prisma.adminUrlScan.findUnique({
        where: { id },
        include: {
          configuration: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      if (!scan) {
        return res.status(404).json({
          success: false,
          error: 'Scan not found'
        });
      }

      logger.info('[Admin Scans] Retrieved scan:', id);

      res.json({
        success: true,
        data: scan
      });
    } catch (error) {
      logger.error('[Admin Scans] Error getting scan:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get scan'
      });
    }
  }

  /**
   * DELETE /api/admin/scans/:id
   * Delete scan record
   */
  async deleteScan(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await prisma.adminUrlScan.delete({
        where: { id }
      });

      logger.info('[Admin Scans] Deleted scan:', id);

      res.json({
        success: true,
        message: 'Scan deleted successfully'
      });
    } catch (error) {
      logger.error('[Admin Scans] Error deleting scan:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete scan'
      });
    }
  }

  /**
   * POST /api/admin/scans/bulk-delete
   * Delete multiple scans
   */
  async bulkDeleteScans(req: Request, res: Response) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid ids array'
        });
      }

      const result = await prisma.adminUrlScan.deleteMany({
        where: {
          id: { in: ids }
        }
      });

      logger.info(`[Admin Scans] Bulk deleted ${result.count} scans`);

      res.json({
        success: true,
        message: `Deleted ${result.count} scans`,
        count: result.count
      });
    } catch (error) {
      logger.error('[Admin Scans] Error bulk deleting scans:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete scans'
      });
    }
  }

  /**
   * GET /api/admin/scans/stats
   * Get scan statistics
   */
  async getStats(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      const where: any = {};
      if (startDate || endDate) {
        where.scanDate = {};
        if (startDate) where.scanDate.gte = new Date(startDate as string);
        if (endDate) where.scanDate.lte = new Date(endDate as string);
      }

      const [
        total,
        riskDistribution,
        avgDuration,
        avgScore,
        reachabilityDistribution
      ] = await Promise.all([
        prisma.adminUrlScan.count({ where }),
        prisma.adminUrlScan.groupBy({
          by: ['riskLevel'],
          where,
          _count: true
        }),
        prisma.adminUrlScan.aggregate({
          where,
          _avg: { duration: true }
        }),
        prisma.adminUrlScan.aggregate({
          where,
          _avg: { finalScore: true, baseScore: true, aiMultiplier: true }
        }),
        prisma.adminUrlScan.groupBy({
          by: ['reachabilityState'],
          where,
          _count: true
        })
      ]);

      const stats = {
        total,
        riskDistribution: riskDistribution.reduce((acc: any, item: any) => {
          acc[item.riskLevel] = item._count;
          return acc;
        }, {} as Record<string, number>),
        reachabilityDistribution: reachabilityDistribution.reduce((acc: any, item: any) => {
          acc[item.reachabilityState] = item._count;
          return acc;
        }, {} as Record<string, number>),
        averages: {
          duration: Math.round(avgDuration._avg.duration || 0),
          finalScore: Math.round(avgScore._avg.finalScore || 0),
          baseScore: Math.round(avgScore._avg.baseScore || 0),
          aiMultiplier: parseFloat((avgScore._avg.aiMultiplier || 1.0).toFixed(2))
        }
      };

      logger.info('[Admin Scans] Retrieved statistics');

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('[Admin Scans] Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics'
      });
    }
  }

  /**
   * GET /api/admin/scans/recent
   * Get recent scans (last 24 hours)
   */
  async getRecentScans(req: Request, res: Response) {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const scans = await prisma.adminUrlScan.findMany({
        where: {
          scanDate: {
            gte: oneDayAgo
          }
        },
        orderBy: { scanDate: 'desc' },
        take: 50,
        select: {
          id: true,
          url: true,
          riskLevel: true,
          finalScore: true,
          scanDate: true,
          duration: true
        }
      });

      logger.info(`[Admin Scans] Retrieved ${scans.length} recent scans`);

      res.json({
        success: true,
        data: scans,
        total: scans.length
      });
    } catch (error) {
      logger.error('[Admin Scans] Error getting recent scans:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get recent scans'
      });
    }
  }
}
