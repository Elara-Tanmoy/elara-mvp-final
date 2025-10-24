/**
 * Stage 0.2: Tombstone Checker
 * Fast-path for confirmed malicious URLs (sinkholes, takedowns, known threats)
 */

import { prisma } from '../../config/database.js';
import { TombstoneCheckResult } from './types.js';
import { logger } from '../../config/logger.js';

export class TombstoneChecker {
  /**
   * Check if URL is in tombstone database (known malicious)
   * Returns instant CRITICAL verdict if found
   */
  static async check(urlHash: string): Promise<TombstoneCheckResult> {
    try {
      const tombstone = await prisma.scanTombstone.findUnique({
        where: { urlHash }
      });

      if (tombstone) {
        logger.warn(`[Tombstone] HIT for ${urlHash.slice(0, 8)}... - ${tombstone.source} (confidence: ${tombstone.confidence}%)`);

        return {
          found: true,
          verdict: tombstone.verdict,
          source: tombstone.source,
          confidence: tombstone.confidence
        };
      }

      return {
        found: false
      };
    } catch (error) {
      logger.error('[Tombstone] Error checking tombstone database:', error);
      return {
        found: false
      };
    }
  }

  /**
   * Create tombstone entry for confirmed malicious URL
   * Used when:
   * - Sinkhole detected
   * - Multiple TI sources confirm malicious
   * - Manual admin addition
   */
  static async create(
    urlHash: string,
    url: string,
    source: 'sinkhole' | 'manual' | 'ti_consensus' | 'admin',
    confidence: number = 100
  ): Promise<boolean> {
    try {
      await prisma.scanTombstone.create({
        data: {
          urlHash,
          url,
          verdict: 'critical',
          source,
          confidence,
          confirmedDate: new Date(),
          metadata: {
            createdAt: new Date().toISOString(),
            autoCreated: source !== 'manual' && source !== 'admin'
          }
        }
      });

      logger.warn(`[Tombstone] CREATED for ${urlHash.slice(0, 8)}... - ${source} (confidence: ${confidence}%)`);

      return true;
    } catch (error) {
      // Ignore unique constraint violations (already exists)
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        logger.debug(`[Tombstone] Already exists for ${urlHash.slice(0, 8)}...`);
        return true;
      }

      logger.error('[Tombstone] Error creating tombstone:', error);
      return false;
    }
  }

  /**
   * Check if URL should be tombstoned based on TI consensus
   * Creates tombstone if 5+ TI sources confirm malicious
   */
  static async checkTIConsensus(
    urlHash: string,
    url: string,
    tiResults: Array<{ source: string; verdict: string; confidence: number }>
  ): Promise<boolean> {
    // Count malicious verdicts
    const maliciousCount = tiResults.filter(r =>
      r.verdict === 'malicious' && r.confidence >= 80
    ).length;

    // If 5+ high-confidence sources say malicious, create tombstone
    if (maliciousCount >= 5) {
      const avgConfidence = Math.round(
        tiResults
          .filter(r => r.verdict === 'malicious')
          .reduce((sum, r) => sum + r.confidence, 0) / maliciousCount
      );

      await this.create(urlHash, url, 'ti_consensus', avgConfidence);
      return true;
    }

    return false;
  }

  /**
   * List recent tombstones (for admin dashboard)
   */
  static async listRecent(limit: number = 100): Promise<any[]> {
    try {
      return await prisma.scanTombstone.findMany({
        take: limit,
        orderBy: { confirmedDate: 'desc' }
      });
    } catch (error) {
      logger.error('[Tombstone] Error listing tombstones:', error);
      return [];
    }
  }

  /**
   * Remove tombstone (for false positive corrections)
   */
  static async remove(urlHash: string): Promise<boolean> {
    try {
      await prisma.scanTombstone.delete({
        where: { urlHash }
      });

      logger.info(`[Tombstone] REMOVED for ${urlHash.slice(0, 8)}...`);

      return true;
    } catch (error) {
      logger.error('[Tombstone] Error removing tombstone:', error);
      return false;
    }
  }

  /**
   * Get statistics (for admin dashboard)
   */
  static async getStats(): Promise<{
    total: number;
    bySources: Record<string, number>;
    last24h: number;
  }> {
    try {
      const [total, recent, all] = await Promise.all([
        prisma.scanTombstone.count(),
        prisma.scanTombstone.count({
          where: {
            confirmedDate: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        }),
        prisma.scanTombstone.findMany({
          select: { source: true }
        })
      ]);

      // Count by source
      const bySources: Record<string, number> = {};
      all.forEach((t: any) => {
        bySources[t.source] = (bySources[t.source] || 0) + 1;
      });

      return {
        total,
        bySources,
        last24h: recent
      };
    } catch (error) {
      logger.error('[Tombstone] Error getting stats:', error);
      return {
        total: 0,
        bySources: {},
        last24h: 0
      };
    }
  }
}
