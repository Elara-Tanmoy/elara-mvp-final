/**
 * Threat Indicator Deduplication System
 *
 * Handles normalization and deduplication of threat indicators across multiple sources.
 * Uses SHA-256 hashing and Redis bloom filters for efficient duplicate detection.
 */

import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';

/**
 * Normalize threat indicator value for consistent comparison
 */
export function normalizeIndicator(type: string, value: string): string {
  try {
    switch (type.toLowerCase()) {
      case 'url':
        return normalizeURL(value);
      case 'domain':
        return normalizeDomain(value);
      case 'ipv4':
      case 'ipv6':
      case 'ip':
        return normalizeIP(value);
      case 'md5':
      case 'sha1':
      case 'sha256':
      case 'hash':
        return normalizeHash(value);
      default:
        return value.trim().toLowerCase();
    }
  } catch (error) {
    logger.warn(`[Deduplication] Failed to normalize ${type}:`, error);
    return value.trim().toLowerCase();
  }
}

/**
 * Normalize URL for deduplication
 * - Remove protocol (http/https)
 * - Remove www prefix
 * - Remove trailing slash
 * - Lowercase domain
 * - Sort query parameters
 */
function normalizeURL(url: string): string {
  try {
    let normalized = url.trim().toLowerCase();

    // Remove protocol
    normalized = normalized.replace(/^https?:\/\//, '');

    // Remove www
    normalized = normalized.replace(/^www\./, '');

    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');

    // Parse and sort query parameters if present
    if (normalized.includes('?')) {
      const [base, queryString] = normalized.split('?');
      const params = new URLSearchParams(queryString);
      const sortedParams = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => `${key}=${val}`)
        .join('&');
      normalized = sortedParams ? `${base}?${sortedParams}` : base;
    }

    return normalized;
  } catch (error) {
    return url.trim().toLowerCase();
  }
}

/**
 * Normalize domain
 * - Lowercase
 * - Remove www prefix
 * - Trim whitespace
 */
function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, '');
}

/**
 * Normalize IP address
 * - Trim whitespace
 * - Remove leading zeros in octets (for IPv4)
 */
function normalizeIP(ip: string): string {
  const trimmed = ip.trim();

  // IPv4 normalization
  if (trimmed.includes('.') && !trimmed.includes(':')) {
    return trimmed
      .split('.')
      .map(octet => parseInt(octet, 10).toString())
      .join('.');
  }

  // IPv6 normalization (basic)
  return trimmed.toLowerCase();
}

/**
 * Normalize hash
 * - Lowercase
 * - Trim whitespace
 */
function normalizeHash(hash: string): string {
  return hash.trim().toLowerCase();
}

/**
 * Generate SHA-256 hash for threat indicator
 * Format: "type:normalized_value"
 */
export function generateThreatHash(type: string, normalizedValue: string): string {
  const input = `${type.toLowerCase()}:${normalizedValue}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Find or create threat indicator with deduplication
 *
 * @returns Object with threat indicator and isNew flag
 */
export async function findOrCreateThreat(params: {
  type: string;
  value: string;
  severity: string;
  confidence: number;
  sourceId: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}): Promise<{ threat: any; isNew: boolean; updated: boolean }> {
  const { type, value, severity, confidence, sourceId, description, tags = [], metadata = {} } = params;

  try {
    // Step 1: Normalize the indicator value
    const normalizedValue = normalizeIndicator(type, value);
    const valueHash = generateThreatHash(type, normalizedValue);

    logger.debug(`[Deduplication] Checking threat: ${type}:${value} -> hash:${valueHash}`);

    // Step 2: Check if threat already exists for this source
    let threat = await prisma.threatIndicator.findFirst({
      where: {
        valueHash,
        sourceId
      }
    });

    let isNew = false;
    let updated = false;

    if (threat) {
      // Step 3: Update existing threat indicator
      logger.debug(`[Deduplication] Found existing threat: ${threat.id}`);

      threat = await prisma.threatIndicator.update({
        where: { id: threat.id },
        data: {
          lastSeen: new Date(),
          confidence,
          severity,
          description: description || threat.description,
          tags: tags.length > 0 ? tags : threat.tags,
          metadata: metadata as any,
          active: true
        }
      });

      updated = true;
      logger.debug(`[Deduplication] Updated threat indicator ${threat.id}`);

    } else {
      // Step 4: Create new threat indicator
      logger.debug(`[Deduplication] Creating new threat indicator`);

      threat = await prisma.threatIndicator.create({
        data: {
          type,
          value: normalizedValue,
          valueHash,
          threatType: severity,
          severity,
          confidence,
          description: description || `${type} indicator from ${sourceId}`,
          tags,
          firstSeen: new Date(),
          lastSeen: new Date(),
          sourceId,
          metadata: metadata as any,
          active: true
        }
      });

      isNew = true;
      logger.info(`[Deduplication] Created new threat: ${threat.id} (${type}:${value})`);
    }

    return { threat, isNew, updated };

  } catch (error: any) {
    logger.error(`[Deduplication] Error in findOrCreateThreat:`, error);
    throw error;
  }
}

/**
 * Batch process threat indicators with deduplication
 *
 * @param indicators Array of threat indicators to process
 * @param sourceId Source ID
 * @param batchSize Number of threats to process in each batch
 * @returns Statistics about processing
 */
export async function batchProcessThreats(
  indicators: Array<{
    type: string;
    value: string;
    severity: string;
    confidence: number;
    description?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }>,
  sourceId: string,
  batchSize: number = 1000
): Promise<{
  processed: number;
  added: number;
  updated: number;
  skipped: number;
  errors: number;
}> {
  const stats = {
    processed: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    errors: 0
  };

  // Process in batches
  for (let i = 0; i < indicators.length; i += batchSize) {
    const batch = indicators.slice(i, i + batchSize);
    logger.info(`[Deduplication] Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} indicators)`);

    for (const indicator of batch) {
      try {
        const result = await findOrCreateThreat({
          ...indicator,
          sourceId
        });

        stats.processed++;

        if (result.isNew) {
          stats.added++;
        } else if (result.updated) {
          stats.updated++;
        } else {
          stats.skipped++;
        }

      } catch (error: any) {
        stats.errors++;
        logger.warn(`[Deduplication] Error processing indicator ${indicator.value}:`, error.message);
      }
    }
  }

  logger.info(`[Deduplication] Batch processing complete:`, stats);
  return stats;
}

/**
 * Clean up old threat indicators (older than retention period)
 *
 * @param retentionDays Number of days to keep indicators
 * @returns Number of indicators removed
 */
export async function cleanupOldThreats(retentionDays: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.threatIndicator.deleteMany({
      where: {
        lastSeen: {
          lt: cutoffDate
        },
        active: true
      }
    });

    logger.info(`[Deduplication] Cleaned up ${result.count} old threat indicators`);
    return result.count;

  } catch (error: any) {
    logger.error(`[Deduplication] Error cleaning up old threats:`, error);
    throw error;
  }
}
