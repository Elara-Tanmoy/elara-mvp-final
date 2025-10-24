/**
 * AbuseIPDB Threat Intel Connector
 * Source: https://www.abuseipdb.com/
 * API Docs: https://docs.abuseipdb.com/
 *
 * API Key: Get from https://www.abuseipdb.com/account/api
 * Set ABUSEIPDB_API_KEY environment variable
 */

import axios from 'axios';
import { logger } from '../../../config/logger.js';
import { batchProcessThreats } from '../deduplication.js';

const ABUSEIPDB_API = 'https://api.abuseipdb.com/api/v2/blacklist';
const TIMEOUT = 30000;
const API_KEY = process.env.ABUSEIPDB_API_KEY || '';

interface AbuseIPDBStats {
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  errors: number;
}

/**
 * Sync AbuseIPDB blacklist
 * Returns IPs with confidence score >= 90 (highly abusive)
 */
export async function syncAbuseIPDB(sourceId: string): Promise<AbuseIPDBStats> {
  logger.info('[AbuseIPDB] Starting sync...');

  if (!API_KEY) {
    logger.warn('[AbuseIPDB] No API key provided, skipping sync');
    return {
      recordsProcessed: 0,
      recordsAdded: 0,
      recordsUpdated: 0,
      errors: 0
    };
  }

  try {
    const response = await axios.get(ABUSEIPDB_API, {
      timeout: TIMEOUT,
      headers: {
        'Key': API_KEY,
        'Accept': 'application/json'
      },
      params: {
        confidenceMinimum: 90, // Only highly abusive IPs
        limit: 10000 // Max limit
      }
    });

    const data = response.data;

    if (!data || !data.data) {
      logger.warn('[AbuseIPDB] No data returned from API');
      return {
        recordsProcessed: 0,
        recordsAdded: 0,
        recordsUpdated: 0,
        errors: 0
      };
    }

    const ips = data.data;
    logger.info(`[AbuseIPDB] Fetched ${ips.length} abusive IPs`);

    const indicators = ips.map((item: any) => {
      // Calculate severity based on abuse confidence score
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'high';
      const score = item.abuseConfidenceScore || 90;

      if (score >= 95) {
        severity = 'critical';
      } else if (score >= 90) {
        severity = 'high';
      } else if (score >= 75) {
        severity = 'medium';
      } else {
        severity = 'low';
      }

      return {
        type: 'ip',
        value: item.ipAddress,
        severity,
        confidence: Math.min(score, 100),
        description: `AbuseIPDB blacklisted IP - ${item.usageType || 'Unknown usage'} (${item.countryCode || 'Unknown'})`,
        tags: ['abuseipdb', 'blacklist', 'abusive', item.usageType || 'unknown', item.countryCode || 'unknown'],
        metadata: {
          source: 'abuseipdb',
          abuse_confidence_score: Number(score),
          country_code: String(item.countryCode || ''),
          usage_type: String(item.usageType || ''),
          isp: String(item.isp || ''),
          domain: String(item.domain || ''),
          total_reports: Number(item.totalReports) || 0,
          num_distinct_users: Number(item.numDistinctUsers) || 0,
          last_reported_at: String(item.lastReportedAt || ''),
          discovered_at: new Date().toISOString()
        }
      };
    });

    const stats = await batchProcessThreats(indicators, sourceId, 1000);

    logger.info(`[AbuseIPDB] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[AbuseIPDB] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Test AbuseIPDB connection
 */
export async function testAbuseIPDBConnection(): Promise<{ success: boolean; sample?: any[]; error?: string }> {
  if (!API_KEY) {
    return {
      success: false,
      error: 'API key not configured'
    };
  }

  try {
    const response = await axios.get(ABUSEIPDB_API, {
      timeout: 10000,
      headers: {
        'Key': API_KEY,
        'Accept': 'application/json'
      },
      params: {
        confidenceMinimum: 90,
        limit: 5
      }
    });

    if (response.data && response.data.data) {
      return {
        success: true,
        sample: response.data.data.map((ip: any) => ({
          ip: ip.ipAddress,
          score: ip.abuseConfidenceScore,
          country: ip.countryCode
        }))
      };
    }

    return {
      success: false,
      error: 'No data returned from API'
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
