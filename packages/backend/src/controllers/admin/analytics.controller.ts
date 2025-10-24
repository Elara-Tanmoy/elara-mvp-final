/**
 * Admin Analytics Controller
 *
 * Provides analytics and reporting:
 * - Time-series data (scans over time)
 * - Risk trend analysis
 * - Category performance
 * - TI source effectiveness
 * - AI consensus metrics
 * - Performance metrics
 */

import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';

export class AdminAnalyticsController {
  /**
   * GET /api/admin/analytics/overview
   * Get overall analytics overview
   */
  async getOverview(req: Request, res: Response) {
    try {
      const { days = '7' } = req.query;
      const daysNum = parseInt(days as string);
      const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

      const [
        totalScans,
        criticalCount,
        highCount,
        recentScans,
        avgMetrics
      ] = await Promise.all([
        prisma.adminUrlScan.count({
          where: { scanDate: { gte: startDate } }
        }),
        prisma.adminUrlScan.count({
          where: {
            scanDate: { gte: startDate },
            riskLevel: 'critical'
          }
        }),
        prisma.adminUrlScan.count({
          where: {
            scanDate: { gte: startDate },
            riskLevel: 'high'
          }
        }),
        prisma.adminUrlScan.findMany({
          where: { scanDate: { gte: startDate } },
          orderBy: { scanDate: 'asc' },
          select: {
            scanDate: true,
            riskLevel: true,
            finalScore: true
          }
        }),
        prisma.adminUrlScan.aggregate({
          where: { scanDate: { gte: startDate } },
          _avg: {
            finalScore: true,
            baseScore: true,
            aiMultiplier: true,
            duration: true
          }
        })
      ]);

      // Group scans by day
      const scansByDay = this.groupScansByDay(recentScans);

      const overview = {
        period: `${daysNum} days`,
        totalScans,
        criticalCount,
        highCount,
        criticalPercentage: totalScans > 0 ? ((criticalCount / totalScans) * 100).toFixed(1) : '0.0',
        averages: {
          finalScore: Math.round(avgMetrics._avg.finalScore || 0),
          baseScore: Math.round(avgMetrics._avg.baseScore || 0),
          aiMultiplier: parseFloat((avgMetrics._avg.aiMultiplier || 1.0).toFixed(2)),
          duration: Math.round(avgMetrics._avg.duration || 0)
        },
        scansByDay
      };

      logger.info('[Admin Analytics] Retrieved overview');

      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      logger.error('[Admin Analytics] Error getting overview:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get analytics overview'
      });
    }
  }

  /**
   * GET /api/admin/analytics/timeseries
   * Get time-series data for scans
   */
  async getTimeSeries(req: Request, res: Response) {
    try {
      const { days = '30', interval = 'day' } = req.query;
      const daysNum = parseInt(days as string);
      const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

      const scans = await prisma.adminUrlScan.findMany({
        where: {
          scanDate: { gte: startDate }
        },
        orderBy: { scanDate: 'asc' },
        select: {
          scanDate: true,
          riskLevel: true,
          finalScore: true,
          duration: true
        }
      });

      const timeSeries = this.groupByInterval(scans, interval as string);

      logger.info('[Admin Analytics] Retrieved time series data');

      res.json({
        success: true,
        data: timeSeries
      });
    } catch (error) {
      logger.error('[Admin Analytics] Error getting time series:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get time series data'
      });
    }
  }

  /**
   * GET /api/admin/analytics/categories
   * Get category performance analytics
   */
  async getCategoryAnalytics(req: Request, res: Response) {
    try {
      const { days = '30' } = req.query;
      const daysNum = parseInt(days as string);
      const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

      const scans = await prisma.adminUrlScan.findMany({
        where: {
          scanDate: { gte: startDate }
        },
        select: {
          categoryResults: true
        }
      });

      // Aggregate category scores
      const categoryStats: Record<string, { total: number; count: number; max: number }> = {};

      for (const scan of scans) {
        const categories = scan.categoryResults as any[];
        if (!categories) continue;

        for (const category of categories) {
          if (!categoryStats[category.categoryName]) {
            categoryStats[category.categoryName] = { total: 0, count: 0, max: category.maxWeight || 0 };
          }
          categoryStats[category.categoryName].total += category.score || 0;
          categoryStats[category.categoryName].count++;
        }
      }

      // Calculate averages
      const categoryAnalytics = Object.entries(categoryStats).map(([name, stats]) => ({
        categoryName: name,
        avgScore: stats.count > 0 ? (stats.total / stats.count).toFixed(2) : '0',
        maxWeight: stats.max,
        utilizationRate: stats.max > 0 ? ((stats.total / stats.count / stats.max) * 100).toFixed(1) : '0',
        scanCount: stats.count
      })).sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));

      logger.info('[Admin Analytics] Retrieved category analytics');

      res.json({
        success: true,
        data: categoryAnalytics
      });
    } catch (error) {
      logger.error('[Admin Analytics] Error getting category analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get category analytics'
      });
    }
  }

  /**
   * GET /api/admin/analytics/ti-sources
   * Get TI source effectiveness analytics
   */
  async getTISourceAnalytics(req: Request, res: Response) {
    try {
      const { days = '30' } = req.query;
      const daysNum = parseInt(days as string);
      const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

      const scans = await prisma.adminUrlScan.findMany({
        where: {
          scanDate: { gte: startDate }
        },
        select: {
          tiResults: true
        }
      });

      // Aggregate TI source results
      const sourceStats: Record<string, {
        malicious: number;
        suspicious: number;
        safe: number;
        error: number;
        totalDuration: number;
      }> = {};

      for (const scan of scans) {
        const tiResults = scan.tiResults as any[];
        if (!tiResults) continue;

        for (const result of tiResults) {
          if (!sourceStats[result.source]) {
            sourceStats[result.source] = {
              malicious: 0,
              suspicious: 0,
              safe: 0,
              error: 0,
              totalDuration: 0
            };
          }

          const stats = sourceStats[result.source];
          if (result.verdict === 'malicious') stats.malicious++;
          else if (result.verdict === 'suspicious') stats.suspicious++;
          else if (result.verdict === 'safe') stats.safe++;
          else if (result.verdict === 'error') stats.error++;

          stats.totalDuration += result.duration || 0;
        }
      }

      // Calculate metrics
      const tiAnalytics = Object.entries(sourceStats).map(([source, stats]) => {
        const total = stats.malicious + stats.suspicious + stats.safe + stats.error;
        return {
          source,
          verdicts: stats,
          totalChecks: total,
          errorRate: total > 0 ? ((stats.error / total) * 100).toFixed(1) : '0',
          avgDuration: total > 0 ? Math.round(stats.totalDuration / total) : 0,
          detectionRate: total > 0 ? (((stats.malicious + stats.suspicious) / total) * 100).toFixed(1) : '0'
        };
      }).sort((a, b) => parseFloat(b.detectionRate) - parseFloat(a.detectionRate));

      logger.info('[Admin Analytics] Retrieved TI source analytics');

      res.json({
        success: true,
        data: tiAnalytics
      });
    } catch (error) {
      logger.error('[Admin Analytics] Error getting TI analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get TI source analytics'
      });
    }
  }

  /**
   * GET /api/admin/analytics/ai-consensus
   * Get AI consensus metrics
   */
  async getAIConsensusAnalytics(req: Request, res: Response) {
    try {
      const { days = '30' } = req.query;
      const daysNum = parseInt(days as string);
      const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

      const scans = await prisma.adminUrlScan.findMany({
        where: {
          scanDate: { gte: startDate }
        },
        select: {
          aiAnalysis: true,
          aiMultiplier: true
        }
      });

      let totalAgreement = 0;
      let totalConfidence = 0;
      let count = 0;
      const multiplierDistribution = { increase: 0, neutral: 0, decrease: 0 };
      const modelStats: Record<string, { total: number; avgMultiplier: number }> = {};

      for (const scan of scans) {
        const aiAnalysis = scan.aiAnalysis as any;
        if (!aiAnalysis) continue;

        totalAgreement += aiAnalysis.agreementRate || 0;
        totalConfidence += aiAnalysis.averageConfidence || 0;
        count++;

        // Multiplier distribution
        const multiplier = scan.aiMultiplier;
        if (multiplier > 1.05) multiplierDistribution.increase++;
        else if (multiplier < 0.95) multiplierDistribution.decrease++;
        else multiplierDistribution.neutral++;

        // Model statistics
        if (aiAnalysis.models) {
          for (const model of aiAnalysis.models) {
            if (!modelStats[model.modelName]) {
              modelStats[model.modelName] = { total: 0, avgMultiplier: 0 };
            }
            modelStats[model.modelName].total++;
            modelStats[model.modelName].avgMultiplier += model.suggestedMultiplier || 1.0;
          }
        }
      }

      const avgAgreement = count > 0 ? (totalAgreement / count).toFixed(1) : '0';
      const avgConfidence = count > 0 ? (totalConfidence / count).toFixed(1) : '0';

      const modelAnalytics = Object.entries(modelStats).map(([model, stats]) => ({
        modelName: model,
        totalAnalyses: stats.total,
        avgMultiplier: stats.total > 0 ? (stats.avgMultiplier / stats.total).toFixed(2) : '1.00'
      }));

      logger.info('[Admin Analytics] Retrieved AI consensus analytics');

      res.json({
        success: true,
        data: {
          avgAgreementRate: avgAgreement,
          avgConfidence: avgConfidence,
          totalAnalyses: count,
          multiplierDistribution,
          modelAnalytics
        }
      });
    } catch (error) {
      logger.error('[Admin Analytics] Error getting AI consensus analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get AI consensus analytics'
      });
    }
  }

  /**
   * Helper: Group scans by day
   */
  private groupScansByDay(scans: any[]): any[] {
    const grouped: Record<string, any> = {};

    for (const scan of scans) {
      const date = new Date(scan.scanDate).toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = {
          date,
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          safe: 0,
          avgScore: 0,
          totalScore: 0
        };
      }

      grouped[date].total++;
      grouped[date][scan.riskLevel] = (grouped[date][scan.riskLevel] || 0) + 1;
      grouped[date].totalScore += scan.finalScore || 0;
    }

    // Calculate averages
    return Object.values(grouped).map(day => ({
      ...day,
      avgScore: day.total > 0 ? Math.round(day.totalScore / day.total) : 0
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Helper: Group by interval (day/hour)
   */
  private groupByInterval(scans: any[], interval: string): any[] {
    // Simplified - just group by day for now
    return this.groupScansByDay(scans);
  }
}
