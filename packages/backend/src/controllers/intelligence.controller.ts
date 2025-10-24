/**
 * DATA INTELLIGENCE ADMIN CONTROLLER
 *
 * Admin-only endpoints for accessing captured intelligence data
 * Used for LLM training, analytics, and research
 *
 * SECURITY: All endpoints require admin role
 */

import { Request, Response } from 'express';
import { dataCaptureService } from '../services/intelligence/dataCapture.service.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';

export class IntelligenceController {
  /**
   * GET /api/v2/intelligence/stats
   * Get dataset statistics and overview
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('[Intelligence API] Stats requested');

      const stats = await dataCaptureService.getDatasetStats();

      res.json({
        success: true,
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[Intelligence API] Failed to get stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve statistics',
        details: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/v2/intelligence/events
   * Get recent events with filtering
   */
  async getEvents(req: Request, res: Response): Promise<void> {
    try {
      const {
        eventType,
        startDate,
        endDate,
        limit = '100',
        offset = '0',
        riskLevel,
      } = req.query;

      logger.info(`[Intelligence API] Events requested - Type: ${eventType || 'all'}`);

      // Build where clause
      const where: any = {};

      if (eventType && typeof eventType === 'string') {
        where.eventType = eventType;
      }

      if (riskLevel && typeof riskLevel === 'string') {
        where.riskLevel = riskLevel;
      }

      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate && typeof startDate === 'string') {
          where.timestamp.gte = new Date(startDate);
        }
        if (endDate && typeof endDate === 'string') {
          where.timestamp.lte = new Date(endDate);
        }
      }

      // Get events
      const [events, total] = await Promise.all([
        prisma.intelligenceData.findMany({
          where,
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
          orderBy: { timestamp: 'desc' },
        }),
        prisma.intelligenceData.count({ where }),
      ]);

      res.json({
        success: true,
        events,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: total > parseInt(offset as string) + events.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[Intelligence API] Failed to get events:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve events',
        details: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/v2/intelligence/search
   * Search events with complex queries
   */
  async searchEvents(req: Request, res: Response): Promise<void> {
    try {
      const { query, filters, limit = 100, offset = 0 } = req.body;

      logger.info('[Intelligence API] Search requested');

      // Build where clause from filters
      const where: any = {};

      if (filters?.eventType) {
        where.eventType = filters.eventType;
      }

      if (filters?.riskLevel) {
        where.riskLevel = filters.riskLevel;
      }

      if (filters?.dateRange) {
        where.timestamp = {
          gte: new Date(filters.dateRange.start),
          lte: new Date(filters.dateRange.end),
        };
      }

      // JSONB search if query provided
      if (query && typeof query === 'string') {
        // Search in JSONB data field
        // This uses PostgreSQL's JSONB operators
        where.data = {
          path: '$',
          string_contains: query,
        };
      }

      const [events, total] = await Promise.all([
        prisma.intelligenceData.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { timestamp: 'desc' },
        }),
        prisma.intelligenceData.count({ where }),
      ]);

      res.json({
        success: true,
        query,
        results: events,
        pagination: {
          total,
          limit,
          offset,
          hasMore: total > offset + events.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[Intelligence API] Search failed:', error);
      res.status(500).json({
        success: false,
        error: 'Search failed',
        details: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/v2/intelligence/query
   * Advanced query builder (SQL-like)
   */
  async customQuery(req: Request, res: Response): Promise<void> {
    try {
      const { sql, params } = req.body;

      logger.info('[Intelligence API] Custom query requested');

      // SECURITY: Only allow SELECT queries
      if (!sql || typeof sql !== 'string' || !sql.trim().toLowerCase().startsWith('select')) {
        res.status(400).json({
          success: false,
          error: 'Invalid query - only SELECT statements allowed',
        });
        return;
      }

      // Execute raw query
      const results = await prisma.$queryRawUnsafe(sql, ...(params || []));

      res.json({
        success: true,
        results,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[Intelligence API] Custom query failed:', error);
      res.status(500).json({
        success: false,
        error: 'Query execution failed',
        details: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/v2/intelligence/export
   * Export dataset for LLM training
   */
  async exportDataset(req: Request, res: Response): Promise<void> {
    try {
      const {
        eventType,
        startDate,
        endDate,
        limit = '10000',
        format = 'json',
      } = req.query;

      logger.info(`[Intelligence API] Export requested - Format: ${format}`);

      // Get dataset
      const dataset = await dataCaptureService.exportDataset({
        eventType: eventType as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parseInt(limit as string),
        format: format as 'json' | 'jsonl' | 'csv',
        includeRaw: true,
      });

      // Format based on requested format
      if (format === 'jsonl') {
        // JSON Lines format (one JSON object per line)
        const jsonl = dataset.map((record) => JSON.stringify(record)).join('\n');
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="elara-intelligence-${Date.now()}.jsonl"`
        );
        res.send(jsonl);
      } else if (format === 'csv') {
        // CSV format
        const headers = ['id', 'eventType', 'userId', 'timestamp', 'riskScore', 'riskLevel', 'data'];
        const csv = [
          headers.join(','),
          ...dataset.map((record) =>
            [
              record.id,
              record.eventType,
              record.userId,
              record.timestamp,
              record.riskScore || '',
              record.riskLevel || '',
              JSON.stringify(record.data).replace(/"/g, '""'), // Escape quotes
            ].join(',')
          ),
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="elara-intelligence-${Date.now()}.csv"`
        );
        res.send(csv);
      } else {
        // JSON format (default)
        res.json({
          success: true,
          format: 'json',
          recordCount: dataset.length,
          dataset,
          exportedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('[Intelligence API] Export failed:', error);
      res.status(500).json({
        success: false,
        error: 'Export failed',
        details: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/v2/intelligence/analytics
   * Get analytics and insights from captured data
   */
  async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { period = '7d' } = req.query;

      logger.info(`[Intelligence API] Analytics requested - Period: ${period}`);

      // Calculate date range
      const now = new Date();
      const daysBack = parseInt((period as string).replace('d', '')) || 7;
      const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

      // Get analytics data
      const [
        eventTrends,
        topSearches,
        riskDistribution,
        scanTypeDistribution,
      ] = await Promise.all([
        // Event trends over time
        prisma.$queryRaw`
          SELECT
            DATE(timestamp) as date,
            event_type,
            COUNT(*) as count
          FROM intelligence_data
          WHERE timestamp >= ${startDate}
          GROUP BY DATE(timestamp), event_type
          ORDER BY date DESC
        `,

        // Top searches
        prisma.$queryRaw`
          SELECT
            data->>'query' as query,
            data->>'searchType' as search_type,
            COUNT(*) as count
          FROM intelligence_data
          WHERE event_type = 'search'
            AND timestamp >= ${startDate}
            AND data->>'query' IS NOT NULL
          GROUP BY data->>'query', data->>'searchType'
          ORDER BY count DESC
          LIMIT 20
        `,

        // Risk distribution
        prisma.intelligenceData.groupBy({
          by: ['riskLevel'],
          where: {
            eventType: 'scan',
            timestamp: { gte: startDate },
          },
          _count: true,
          _avg: { riskScore: true },
        }),

        // Scan type distribution
        prisma.$queryRaw`
          SELECT
            data->>'scanType' as scan_type,
            COUNT(*) as count,
            AVG((data->>'riskScore')::float) as avg_risk_score
          FROM intelligence_data
          WHERE event_type = 'scan'
            AND timestamp >= ${startDate}
            AND data->>'scanType' IS NOT NULL
          GROUP BY data->>'scanType'
          ORDER BY count DESC
        `,
      ]);

      res.json({
        success: true,
        period,
        analytics: {
          eventTrends,
          topSearches,
          riskDistribution: riskDistribution.map((r) => ({
            level: r.riskLevel || 'unknown',
            count: r._count,
            avgScore: r._avg.riskScore,
          })),
          scanTypeDistribution,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[Intelligence API] Analytics failed:', error);
      res.status(500).json({
        success: false,
        error: 'Analytics generation failed',
        details: (error as Error).message,
      });
    }
  }

  /**
   * DELETE /api/v2/intelligence/cleanup
   * Clean old data based on retention policy
   */
  async cleanupOldData(req: Request, res: Response): Promise<void> {
    try {
      const { retentionDays = 365 } = req.body;

      logger.info(`[Intelligence API] Cleanup requested - Retention: ${retentionDays} days`);

      const deletedCount = await dataCaptureService.cleanOldData(retentionDays);

      res.json({
        success: true,
        deletedCount,
        retentionDays,
        message: `Cleaned ${deletedCount} records older than ${retentionDays} days`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[Intelligence API] Cleanup failed:', error);
      res.status(500).json({
        success: false,
        error: 'Cleanup failed',
        details: (error as Error).message,
      });
    }
  }
}

export const intelligenceController = new IntelligenceController();
