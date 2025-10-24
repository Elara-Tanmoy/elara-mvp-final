/**
 * Critical Path Security Intelligence Feeds Connector
 * Source: https://github.com/CriticalPathSecurity/Public-Intelligence-Feeds
 * Format: Intel format (tab-separated: indicator, type, description)
 *
 * Aggregated and normalized feeds from public sources including:
 * - CobaltStrike C2 servers
 * - Compromised IPs
 * - Emerging Threats blocklist
 * - SANS ISC feed
 */

import axios from 'axios';
import { logger } from '../../../config/logger.js';
import { batchProcessThreats } from '../deduplication.js';

const CPS_BASE_URL = 'https://raw.githubusercontent.com/CriticalPathSecurity/Public-Intelligence-Feeds/master/';
const TIMEOUT = 30000;

interface CPSStats {
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  errors: number;
}

/**
 * Parse Intel format feed
 * Format: indicator\ttype\tdescription
 */
function parseIntelFeed(data: string): Array<{ indicator: string; type: string; description: string }> {
  return data
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        return {
          indicator: parts[0].trim(),
          type: parts[1].trim(),
          description: parts[2]?.trim() || 'Critical Path Security threat indicator'
        };
      }
      return null;
    })
    .filter(Boolean) as Array<{ indicator: string; type: string; description: string }>;
}

/**
 * Sync CriticalPathSecurity compromised IPs feed
 */
export async function syncCPSCompromisedIPs(sourceId: string): Promise<CPSStats> {
  logger.info('[CPS] Starting compromised IPs sync...');

  try {
    const response = await axios.get(`${CPS_BASE_URL}compromised-ips.txt`, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const parsed = parseIntelFeed(response.data);
    logger.info(`[CPS] Fetched ${parsed.length} compromised IPs`);

    const indicators = parsed.map(item => ({
      type: 'ip',
      value: item.indicator,
      severity: 'high',
      confidence: 80,
      description: item.description,
      tags: ['compromised', 'critical-path-security', 'ip'],
      metadata: {
        source: 'critical-path-security',
        category: 'compromised',
        discovered_at: new Date().toISOString()
      }
    }));

    const stats = await batchProcessThreats(indicators, sourceId, 1000);

    logger.info(`[CPS Compromised IPs] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[CPS Compromised IPs] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Sync CriticalPathSecurity Illuminate feed
 */
export async function syncCPSIlluminate(sourceId: string): Promise<CPSStats> {
  logger.info('[CPS] Starting Illuminate feed sync...');

  try {
    const response = await axios.get(`${CPS_BASE_URL}illuminate.txt`, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const parsed = parseIntelFeed(response.data);
    logger.info(`[CPS] Fetched ${parsed.length} Illuminate indicators`);

    const indicators = parsed.map(item => {
      // Determine type from intel format
      let type = 'domain';
      if (/^\d+\.\d+\.\d+\.\d+$/.test(item.indicator)) {
        type = 'ip';
      } else if (item.indicator.startsWith('http')) {
        type = 'url';
      }

      return {
        type,
        value: item.indicator,
        severity: 'medium',
        confidence: 75,
        description: item.description,
        tags: ['illuminate', 'critical-path-security'],
        metadata: {
          source: 'critical-path-security-illuminate',
          discovered_at: new Date().toISOString()
        }
      };
    });

    const stats = await batchProcessThreats(indicators, sourceId, 1000);

    logger.info(`[CPS Illuminate] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[CPS Illuminate] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Test CriticalPathSecurity connection
 */
export async function testCPSConnection(): Promise<{ success: boolean; sample?: any[]; error?: string }> {
  try {
    const response = await axios.get(`${CPS_BASE_URL}compromised-ips.txt`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const parsed = parseIntelFeed(response.data).slice(0, 5);

    return {
      success: true,
      sample: parsed
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
