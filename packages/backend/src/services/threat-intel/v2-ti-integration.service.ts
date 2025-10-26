/**
 * V2 Threat Intelligence Integration Service
 *
 * Provides TI data specifically formatted for V2 scanner feature extraction:
 * - Total TI hit counts
 * - Tier-1 TI source hits
 * - Dual tier-1 detection (policy rule trigger)
 * - TI data for tabular features
 *
 * Integrates with existing 18 TI sources
 */

import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import crypto from 'crypto';

/**
 * TI tiers for weighted scoring
 */
const TI_SOURCE_TIERS = {
  // Tier 1: Highly trusted sources
  tier1: [
    'Google Safe Browsing',
    'VirusTotal',
    'PhishTank',
    'URLhaus',
    'Cloudflare Radar'
  ],
  // Tier 2: Trusted sources
  tier2: [
    'OpenPhish',
    'CertStream',
    'AlienVault OTX',
    'Abuse.ch',
    'ThreatFox'
  ],
  // Tier 3: Community sources
  tier3: [
    'DigitalSide',
    'CriticalPath Security',
    'Phishing Database',
    'Spamhaus',
    'SURBL'
  ]
};

/**
 * V2 TI Data structure
 */
export interface V2TIData {
  totalHits: number;
  tier1Hits: number;
  tier1Sources: Array<{
    source: string;
    lastSeen: Date;
    severity: string;
  }>;
  hasDualTier1: boolean; // True if >= 2 tier-1 hits within 7 days
  sourceBreakdown: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
  metadata: {
    checkedAt: Date;
    lookupLatency: number;
  };
}

/**
 * V2 TI Integration Service
 */
export class V2TIIntegrationService {
  /**
   * Get TI data for V2 feature extraction
   */
  async getTIDataForURL(url: string): Promise<V2TIData> {
    const startTime = Date.now();

    try {
      // Normalize URL for lookup
      const normalizedUrl = this.normalizeURL(url);
      const urlHash = this.computeHash(normalizedUrl);

      // Query all TI indicators for this URL
      const indicators = await prisma.threatIndicator.findMany({
        where: {
          OR: [
            { valueHash: urlHash },
            { value: normalizedUrl },
            { value: url }
          ]
        },
        include: {
          source: true
        },
        orderBy: {
          lastSeen: 'desc'
        }
      });

      // Process indicators
      let totalHits = 0;
      let tier1Hits = 0;
      const tier1Sources: Array<{ source: string; lastSeen: Date; severity: string }> = [];
      const sourceBreakdown = { tier1: 0, tier2: 0, tier3: 0 };

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const seenSources = new Set<string>();

      for (const indicator of indicators) {
        const sourceName = indicator.source.name;

        // Skip duplicates from same source
        if (seenSources.has(sourceName)) {
          continue;
        }
        seenSources.add(sourceName);

        totalHits++;

        // Determine tier
        const tier = this.getSourceTier(sourceName);

        if (tier === 1) {
          tier1Hits++;
          sourceBreakdown.tier1++;

          // Track tier-1 sources for dual-tier-1 detection
          if (indicator.lastSeen >= sevenDaysAgo) {
            tier1Sources.push({
              source: sourceName,
              lastSeen: indicator.lastSeen,
              severity: indicator.severity
            });
          }
        } else if (tier === 2) {
          sourceBreakdown.tier2++;
        } else {
          sourceBreakdown.tier3++;
        }
      }

      // Check for dual tier-1 hits (policy rule trigger)
      const recentTier1Count = tier1Sources.length;
      const hasDualTier1 = recentTier1Count >= 2;

      const lookupLatency = Date.now() - startTime;

      return {
        totalHits,
        tier1Hits,
        tier1Sources,
        hasDualTier1,
        sourceBreakdown,
        metadata: {
          checkedAt: new Date(),
          lookupLatency
        }
      };

    } catch (error) {
      logger.error('[V2 TI Integration] Error fetching TI data:', error);

      // Return empty result on error
      return {
        totalHits: 0,
        tier1Hits: 0,
        tier1Sources: [],
        hasDualTier1: false,
        sourceBreakdown: { tier1: 0, tier2: 0, tier3: 0 },
        metadata: {
          checkedAt: new Date(),
          lookupLatency: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Batch get TI data for multiple URLs (for training data preparation)
   */
  async batchGetTIData(urls: string[]): Promise<Map<string, V2TIData>> {
    const results = new Map<string, V2TIData>();

    // Process in batches of 100 to avoid overwhelming DB
    const batchSize = 100;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(url => this.getTIDataForURL(url))
      );

      batch.forEach((url, index) => {
        results.set(url, batchResults[index]);
      });
    }

    return results;
  }

  /**
   * Get source tier (1, 2, or 3)
   */
  private getSourceTier(sourceName: string): number {
    if (TI_SOURCE_TIERS.tier1.some(t1 => sourceName.toLowerCase().includes(t1.toLowerCase()))) {
      return 1;
    }
    if (TI_SOURCE_TIERS.tier2.some(t2 => sourceName.toLowerCase().includes(t2.toLowerCase()))) {
      return 2;
    }
    return 3;
  }

  /**
   * Normalize URL for consistent lookup
   */
  private normalizeURL(url: string): string {
    try {
      const parsed = new URL(url);

      // Remove protocol
      let normalized = parsed.hostname + parsed.pathname;

      // Remove trailing slash
      if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }

      // Lowercase
      normalized = normalized.toLowerCase();

      return normalized;
    } catch {
      return url.toLowerCase();
    }
  }

  /**
   * Compute SHA-256 hash
   */
  private computeHash(value: string): string {
    return crypto.createHash('sha256').update(value.toLowerCase()).digest('hex');
  }

  /**
   * Get TI statistics for monitoring
   */
  async getStats(): Promise<{
    totalIndicators: number;
    tier1Sources: number;
    tier2Sources: number;
    tier3Sources: number;
    lastSyncTime: Date | null;
  }> {
    const [totalIndicators, sources] = await Promise.all([
      prisma.threatIndicator.count(),
      prisma.threatIntelSource.findMany({
        select: { name: true, lastSyncedAt: true }
      })
    ]);

    let tier1Count = 0;
    let tier2Count = 0;
    let tier3Count = 0;
    let lastSyncTime: Date | null = null;

    for (const source of sources) {
      const tier = this.getSourceTier(source.name);
      if (tier === 1) tier1Count++;
      else if (tier === 2) tier2Count++;
      else tier3Count++;

      if (source.lastSyncedAt && (!lastSyncTime || source.lastSyncedAt > lastSyncTime)) {
        lastSyncTime = source.lastSyncedAt;
      }
    }

    return {
      totalIndicators,
      tier1Sources: tier1Count,
      tier2Sources: tier2Count,
      tier3Sources: tier3Count,
      lastSyncTime
    };
  }
}

/**
 * Singleton instance
 */
let v2TIService: V2TIIntegrationService | null = null;

/**
 * Get V2 TI Integration Service instance
 */
export function getV2TIService(): V2TIIntegrationService {
  if (!v2TIService) {
    v2TIService = new V2TIIntegrationService();
  }
  return v2TIService;
}

/**
 * Helper function for V2 feature extraction
 * Simplified return format for use in feature extraction
 */
export async function loadTIDataForV2Features(url: string): Promise<{
  totalHits: number;
  tier1Hits: number;
}> {
  const service = getV2TIService();
  const tiData = await service.getTIDataForURL(url);

  return {
    totalHits: tiData.totalHits,
    tier1Hits: tiData.tier1Hits
  };
}

/**
 * Helper function to get full TI data (for V2 scanner policy engine)
 */
export async function getFullTIData(url: string): Promise<V2TIData> {
  const service = getV2TIService();
  return await service.getTIDataForURL(url);
}
