/**
 * ELARA DATA INTELLIGENCE - DATA CAPTURE SERVICE
 *
 * Captures all user activity for:
 * - LLM training dataset
 * - Threat intelligence research
 * - Analytics and insights
 * - Compliance and audit
 *
 * PRIVACY: All data is anonymized before storage
 */

import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import crypto from 'crypto';

export interface CapturedSearch {
  userId: string;
  organizationId: string | null;
  query: string;
  searchType: 'url' | 'domain' | 'message' | 'file' | 'profile';
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
}

export interface CapturedScan {
  userId: string;
  organizationId: string | null;
  scanType: 'url' | 'message' | 'file' | 'profile';
  inputData: any; // Raw input
  scanResults: any; // Full scan results
  riskScore: number;
  riskLevel: string;
  findings: any[];
  scanDuration: number;
  timestamp: Date;
  metadata: any;
}

export interface CapturedInteraction {
  userId: string;
  organizationId: string | null;
  interactionType: string;
  data: any;
  timestamp: Date;
}

class DataCaptureService {
  private readonly anonymizePII: boolean;

  constructor() {
    // Enable PII anonymization in production
    this.anonymizePII = process.env.NODE_ENV === 'production';
  }

  /**
   * Capture a search/query event
   */
  async captureSearch(search: CapturedSearch): Promise<void> {
    try {
      // Anonymize if needed
      const anonymizedUserId = this.anonymizePII
        ? this.anonymizeId(search.userId)
        : search.userId;

      await prisma.intelligenceData.create({
        data: {
          eventType: 'search',
          userId: anonymizedUserId,
          organizationId: search.organizationId,
          data: {
            query: search.query,
            searchType: search.searchType,
            userAgent: search.userAgent,
            ipAddressHash: search.ipAddress ? this.hashIP(search.ipAddress) : null,
            sessionId: search.sessionId,
          },
          timestamp: search.timestamp,
        },
      });

      logger.debug(`[Data Intelligence] Captured search: ${search.searchType}`);
    } catch (error) {
      logger.error('[Data Intelligence] Failed to capture search:', error);
      // Don't throw - data capture should never break main flow
    }
  }

  /**
   * Capture a scan event with full results
   */
  async captureScan(scan: CapturedScan): Promise<string> {
    try {
      const anonymizedUserId = this.anonymizePII
        ? this.anonymizeId(scan.userId)
        : scan.userId;

      const record = await prisma.intelligenceData.create({
        data: {
          eventType: 'scan',
          userId: anonymizedUserId,
          organizationId: scan.organizationId,
          data: {
            scanType: scan.scanType,
            inputData: scan.inputData,
            scanResults: scan.scanResults,
            riskScore: scan.riskScore,
            riskLevel: scan.riskLevel,
            findings: scan.findings,
            scanDuration: scan.scanDuration,
            metadata: scan.metadata,
          },
          riskScore: scan.riskScore,
          riskLevel: scan.riskLevel,
          timestamp: scan.timestamp,
        },
      });

      logger.info(`[Data Intelligence] Captured scan: ${scan.scanType} (ID: ${record.id})`);

      return record.id;
    } catch (error) {
      logger.error('[Data Intelligence] Failed to capture scan:', error);
      throw error;
    }
  }

  /**
   * Capture any user interaction (chatbot, features, etc.)
   */
  async captureInteraction(interaction: CapturedInteraction): Promise<void> {
    try {
      const anonymizedUserId = this.anonymizePII
        ? this.anonymizeId(interaction.userId)
        : interaction.userId;

      await prisma.intelligenceData.create({
        data: {
          eventType: 'interaction',
          userId: anonymizedUserId,
          organizationId: interaction.organizationId,
          data: {
            interactionType: interaction.interactionType,
            ...interaction.data,
          },
          timestamp: interaction.timestamp,
        },
      });

      logger.debug(`[Data Intelligence] Captured interaction: ${interaction.interactionType}`);
    } catch (error) {
      logger.error('[Data Intelligence] Failed to capture interaction:', error);
    }
  }

  /**
   * Batch capture multiple events (for performance)
   */
  async captureBatch(events: Array<CapturedSearch | CapturedScan | CapturedInteraction>): Promise<void> {
    try {
      const records = events.map((event) => {
        const anonymizedUserId = this.anonymizePII
          ? this.anonymizeId((event as any).userId)
          : (event as any).userId;

        let eventType: string;
        let data: any;

        if ('query' in event) {
          eventType = 'search';
          data = {
            query: event.query,
            searchType: event.searchType,
          };
        } else if ('scanResults' in event) {
          eventType = 'scan';
          data = {
            scanType: event.scanType,
            inputData: event.inputData,
            scanResults: event.scanResults,
            riskScore: event.riskScore,
            riskLevel: event.riskLevel,
          };
        } else {
          eventType = 'interaction';
          data = {
            interactionType: (event as CapturedInteraction).interactionType,
            ...(event as CapturedInteraction).data,
          };
        }

        return {
          eventType,
          userId: anonymizedUserId,
          organizationId: (event as any).organizationId,
          data,
          timestamp: (event as any).timestamp,
        };
      });

      await prisma.intelligenceData.createMany({
        data: records,
      });

      logger.info(`[Data Intelligence] Batch captured ${events.length} events`);
    } catch (error) {
      logger.error('[Data Intelligence] Failed to capture batch:', error);
    }
  }

  /**
   * Get dataset statistics
   */
  async getDatasetStats(): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    totalScans: number;
    avgRiskScore: number;
    dateRange: { earliest: Date; latest: Date };
    topRiskLevels: Array<{ level: string; count: number }>;
  }> {
    try {
      const [
        totalEvents,
        eventsByType,
        scans,
        riskLevels,
        dateRange,
      ] = await Promise.all([
        prisma.intelligenceData.count(),

        prisma.intelligenceData.groupBy({
          by: ['eventType'],
          _count: true,
        }),

        prisma.intelligenceData.aggregate({
          where: { eventType: 'scan' },
          _count: true,
          _avg: { riskScore: true },
        }),

        prisma.intelligenceData.groupBy({
          by: ['riskLevel'],
          where: { eventType: 'scan' },
          _count: true,
          orderBy: { _count: { riskLevel: 'desc' } },
          take: 5,
        }),

        prisma.intelligenceData.aggregate({
          _min: { timestamp: true },
          _max: { timestamp: true },
        }),
      ]);

      return {
        totalEvents,
        eventsByType: eventsByType.reduce((acc, item) => {
          acc[item.eventType] = item._count;
          return acc;
        }, {} as Record<string, number>),
        totalScans: scans._count,
        avgRiskScore: scans._avg.riskScore || 0,
        dateRange: {
          earliest: dateRange._min.timestamp || new Date(),
          latest: dateRange._max.timestamp || new Date(),
        },
        topRiskLevels: riskLevels.map((r) => ({
          level: r.riskLevel || 'unknown',
          count: r._count,
        })),
      };
    } catch (error) {
      logger.error('[Data Intelligence] Failed to get stats:', error);
      throw error;
    }
  }

  /**
   * Export dataset for LLM training
   */
  async exportDataset(options: {
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    format: 'json' | 'jsonl' | 'csv';
    includeRaw?: boolean;
  }): Promise<any[]> {
    try {
      const where: any = {};

      if (options.eventType) {
        where.eventType = options.eventType;
      }

      if (options.startDate || options.endDate) {
        where.timestamp = {};
        if (options.startDate) where.timestamp.gte = options.startDate;
        if (options.endDate) where.timestamp.lte = options.endDate;
      }

      const records = await prisma.intelligenceData.findMany({
        where,
        take: options.limit || 10000,
        orderBy: { timestamp: 'desc' },
      });

      logger.info(`[Data Intelligence] Exported ${records.length} records`);

      return records;
    } catch (error) {
      logger.error('[Data Intelligence] Failed to export dataset:', error);
      throw error;
    }
  }

  /**
   * Anonymize user ID with consistent hashing
   */
  private anonymizeId(userId: string): string {
    return crypto
      .createHash('sha256')
      .update(userId + process.env.ANONYMIZATION_SALT || 'elara-salt-2024')
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Hash IP address for privacy
   */
  private hashIP(ipAddress: string): string {
    return crypto
      .createHash('sha256')
      .update(ipAddress + process.env.IP_SALT || 'elara-ip-salt-2024')
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Clean old data (data retention policy)
   */
  async cleanOldData(retentionDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.intelligenceData.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      logger.info(`[Data Intelligence] Cleaned ${result.count} old records (>${retentionDays} days)`);

      return result.count;
    } catch (error) {
      logger.error('[Data Intelligence] Failed to clean old data:', error);
      throw error;
    }
  }
}

export const dataCaptureService = new DataCaptureService();
