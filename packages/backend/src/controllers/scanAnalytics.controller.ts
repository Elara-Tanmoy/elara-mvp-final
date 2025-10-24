/**
 * SCAN ANALYTICS CONTROLLER
 *
 * Enterprise-grade analytics dashboard for URL scan data
 * Provides comprehensive insights, visualizations, and raw data access
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

export class ScanAnalyticsController {
  /**
   * GET /api/v2/analytics/scans/overview
   * Get comprehensive scan analytics overview
   */
  async getOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { period = '30' } = req.query; // days
      const days = parseInt(period as string);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      logger.info(`[Scan Analytics] Overview requested for ${days} days`);

      // Get comprehensive stats in parallel
      const [
        totalScans,
        completedScans,
        avgRiskScore,
        riskDistribution,
        scansByType,
        recentScans,
        topThreats,
        scanTrends,
        riskTrends,
      ] = await Promise.all([
        // Total scans
        prisma.scanResult.count({
          where: { createdAt: { gte: startDate } }
        }),

        // Completed scans
        prisma.scanResult.count({
          where: {
            createdAt: { gte: startDate },
            status: 'completed'
          }
        }),

        // Average risk score
        prisma.scanResult.aggregate({
          where: {
            createdAt: { gte: startDate },
            status: 'completed'
          },
          _avg: { riskScore: true }
        }),

        // Risk level distribution
        prisma.scanResult.groupBy({
          by: ['riskLevel'],
          where: {
            createdAt: { gte: startDate },
            status: 'completed'
          },
          _count: true,
          orderBy: { _count: { riskLevel: 'desc' } }
        }),

        // Scans by type
        prisma.scanResult.groupBy({
          by: ['scanType'],
          where: { createdAt: { gte: startDate } },
          _count: true
        }),

        // Recent scans
        prisma.scanResult.findMany({
          where: { createdAt: { gte: startDate } },
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            scanType: true,
            url: true,
            riskLevel: true,
            riskScore: true,
            status: true,
            createdAt: true,
            scanDuration: true
          }
        }),

        // Top threats (from findings)
        prisma.$queryRaw`
          SELECT
            jsonb_array_elements(findings)->>'category' as threat_category,
            COUNT(*) as count
          FROM scan_results
          WHERE "createdAt" >= ${startDate}
            AND status = 'completed'
            AND findings IS NOT NULL
            AND jsonb_typeof(findings) = 'array'
            AND jsonb_array_length(findings) > 0
          GROUP BY threat_category
          ORDER BY count DESC
          LIMIT 10
        `,

        // Scan trends over time (daily)
        prisma.$queryRaw`
          SELECT
            DATE("createdAt") as date,
            COUNT(*) as scan_count,
            AVG("riskScore") as avg_risk
          FROM scan_results
          WHERE "createdAt" >= ${startDate}
            AND status = 'completed'
          GROUP BY DATE("createdAt")
          ORDER BY date ASC
        `,

        // Risk level trends
        prisma.$queryRaw`
          SELECT
            DATE("createdAt") as date,
            "riskLevel",
            COUNT(*) as count
          FROM scan_results
          WHERE "createdAt" >= ${startDate}
            AND status = 'completed'
            AND "riskLevel" IS NOT NULL
          GROUP BY DATE("createdAt"), "riskLevel"
          ORDER BY date ASC
        `
      ]);

      res.json({
        success: true,
        period: `${days} days`,
        overview: {
          totalScans,
          completedScans,
          pendingScans: totalScans - completedScans,
          avgRiskScore: avgRiskScore._avg.riskScore || 0,
          completionRate: totalScans > 0 ? (completedScans / totalScans) * 100 : 0
        },
        riskDistribution: riskDistribution.map(r => ({
          level: r.riskLevel || 'unknown',
          count: r._count
        })),
        scansByType: scansByType.map(s => ({
          type: s.scanType,
          count: s._count
        })),
        recentScans,
        topThreats,
        scanTrends,
        riskTrends,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Scan Analytics] Overview failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get analytics overview',
        details: (error as Error).message
      });
    }
  }

  /**
   * GET /api/v2/analytics/scans/detailed
   * Get detailed scan data with filters
   */
  async getDetailedScans(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        riskLevel,
        scanType,
        status,
        startDate,
        endDate,
        limit = '100',
        offset = '0',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      logger.info('[Scan Analytics] Detailed scans requested');

      // Build where clause
      const where: any = {};
      if (riskLevel) where.riskLevel = riskLevel;
      if (scanType) where.scanType = scanType;
      if (status) where.status = status;

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      // Get scans with full details
      const [scans, total] = await Promise.all([
        prisma.scanResult.findMany({
          where,
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
          orderBy: { [sortBy as string]: sortOrder },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            },
            organization: {
              select: {
                id: true,
                name: true,
                tier: true
              }
            }
          }
        }),
        prisma.scanResult.count({ where })
      ]);

      res.json({
        success: true,
        scans,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: total > parseInt(offset as string) + scans.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Scan Analytics] Detailed scans failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get detailed scans',
        details: (error as Error).message
      });
    }
  }

  /**
   * GET /api/v2/analytics/scans/raw/:id
   * Get raw scan data for a specific scan
   */
  async getRawScanData(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      logger.info(`[Scan Analytics] Raw data requested for scan ${id}`);

      const scan = await prisma.scanResult.findUnique({
        where: { id },
        include: {
          user: true,
          organization: true,
          riskCategories: true
        }
      });

      if (!scan) {
        res.status(404).json({
          success: false,
          error: 'Scan not found'
        });
        return;
      }

      res.json({
        success: true,
        scan,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Scan Analytics] Raw data fetch failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get raw scan data',
        details: (error as Error).message
      });
    }
  }

  /**
   * GET /api/v2/analytics/scans/threats
   * Get detailed threat analysis
   */
  async getThreatAnalysis(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { period = '30' } = req.query;
      const days = parseInt(period as string);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      logger.info(`[Scan Analytics] Threat analysis requested for ${days} days`);

      // Analyze threats from findings
      const [threatsByCategory, threatsBySeverity, threatTrends] = await Promise.all([
        // Threats by category
        prisma.$queryRaw`
          SELECT
            jsonb_array_elements(findings)->>'category' as category,
            jsonb_array_elements(findings)->>'severity' as severity,
            COUNT(*) as count,
            AVG((jsonb_array_elements(findings)->>'score')::float) as avg_score
          FROM scan_results
          WHERE "createdAt" >= ${startDate}
            AND status = 'completed'
            AND findings IS NOT NULL
            AND jsonb_typeof(findings) = 'array'
            AND jsonb_array_length(findings) > 0
          GROUP BY category, severity
          ORDER BY count DESC
        `,

        // Threats by severity
        prisma.$queryRaw`
          SELECT
            jsonb_array_elements(findings)->>'severity' as severity,
            COUNT(*) as count
          FROM scan_results
          WHERE "createdAt" >= ${startDate}
            AND status = 'completed'
            AND findings IS NOT NULL
            AND jsonb_typeof(findings) = 'array'
            AND jsonb_array_length(findings) > 0
          GROUP BY severity
          ORDER BY
            CASE severity
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
              ELSE 5
            END
        `,

        // Threat trends over time
        prisma.$queryRaw`
          SELECT
            DATE("createdAt") as date,
            jsonb_array_elements(findings)->>'category' as category,
            COUNT(*) as count
          FROM scan_results
          WHERE "createdAt" >= ${startDate}
            AND status = 'completed'
            AND findings IS NOT NULL
            AND jsonb_typeof(findings) = 'array'
            AND jsonb_array_length(findings) > 0
          GROUP BY DATE("createdAt"), category
          ORDER BY date ASC
        `
      ]);

      res.json({
        success: true,
        period: `${days} days`,
        threatsByCategory,
        threatsBySeverity,
        threatTrends,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Scan Analytics] Threat analysis failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get threat analysis',
        details: (error as Error).message
      });
    }
  }

  /**
   * GET /api/v2/analytics/scans/performance
   * Get scan performance metrics
   */
  async getPerformanceMetrics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { period = '30' } = req.query;
      const days = parseInt(period as string);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      logger.info(`[Scan Analytics] Performance metrics requested for ${days} days`);

      const [avgScanDuration, scanDurationByType, performanceTrends] = await Promise.all([
        // Average scan duration
        prisma.scanResult.aggregate({
          where: {
            createdAt: { gte: startDate },
            status: 'completed',
            scanDuration: { not: null }
          },
          _avg: { scanDuration: true },
          _min: { scanDuration: true },
          _max: { scanDuration: true }
        }),

        // Scan duration by type
        prisma.scanResult.groupBy({
          by: ['scanType'],
          where: {
            createdAt: { gte: startDate },
            status: 'completed',
            scanDuration: { not: null }
          },
          _avg: { scanDuration: true },
          _count: true
        }),

        // Performance trends
        prisma.$queryRaw`
          SELECT
            DATE("createdAt") as date,
            AVG("scanDuration") as avg_duration,
            COUNT(*) as scan_count
          FROM scan_results
          WHERE "createdAt" >= ${startDate}
            AND status = 'completed'
            AND "scanDuration" IS NOT NULL
          GROUP BY DATE("createdAt")
          ORDER BY date ASC
        `
      ]);

      res.json({
        success: true,
        period: `${days} days`,
        avgScanDuration,
        scanDurationByType: scanDurationByType.map(s => ({
          type: s.scanType,
          avgDuration: s._avg.scanDuration,
          count: s._count
        })),
        performanceTrends,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Scan Analytics] Performance metrics failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance metrics',
        details: (error as Error).message
      });
    }
  }

  /**
   * GET /api/v2/analytics/scans/export
   * Export scan analytics data
   */
  async exportAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { format = 'json', period = '30' } = req.query;
      const days = parseInt(period as string);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      logger.info(`[Scan Analytics] Export requested - Format: ${format}, Period: ${days} days`);

      const scans = await prisma.scanResult.findMany({
        where: { createdAt: { gte: startDate } },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true
            }
          },
          organization: {
            select: {
              name: true,
              tier: true
            }
          }
        }
      });

      if (format === 'csv') {
        // CSV format
        const headers = [
          'ID', 'Type', 'URL', 'Risk Level', 'Risk Score', 'Status',
          'Duration (ms)', 'Created At', 'User Email', 'Organization'
        ];

        const csv = [
          headers.join(','),
          ...scans.map(scan => [
            scan.id,
            scan.scanType,
            scan.url || '',
            scan.riskLevel || '',
            scan.riskScore || '',
            scan.status,
            scan.scanDuration || '',
            scan.createdAt.toISOString(),
            scan.user.email,
            scan.organization.name
          ].join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="scan-analytics-${Date.now()}.csv"`);
        res.send(csv);
      } else {
        // JSON format
        res.json({
          success: true,
          period: `${days} days`,
          totalScans: scans.length,
          scans,
          exportedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('[Scan Analytics] Export failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export analytics',
        details: (error as Error).message
      });
    }
  }

  /**
   * GET /api/v2/analytics/scans/realtime
   * Get real-time scan metrics (last 5 minutes)
   */
  async getRealtimeMetrics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const [recentScans, criticalScans, avgRiskScore] = await Promise.all([
        prisma.scanResult.count({
          where: { createdAt: { gte: fiveMinutesAgo } }
        }),

        prisma.scanResult.count({
          where: {
            createdAt: { gte: fiveMinutesAgo },
            riskLevel: { in: ['critical', 'high'] }
          }
        }),

        prisma.scanResult.aggregate({
          where: {
            createdAt: { gte: fiveMinutesAgo },
            status: 'completed'
          },
          _avg: { riskScore: true }
        })
      ]);

      res.json({
        success: true,
        realtime: {
          recentScans,
          criticalScans,
          avgRiskScore: avgRiskScore._avg.riskScore || 0,
          timeWindow: '5 minutes'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[Scan Analytics] Realtime metrics failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get realtime metrics',
        details: (error as Error).message
      });
    }
  }
}

export const scanAnalyticsController = new ScanAnalyticsController();
