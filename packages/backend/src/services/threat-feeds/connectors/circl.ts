/**
 * CIRCL Vulnerability Lookup Connector
 * Source: https://vulnerability.circl.lu/
 * No API key required - public service
 */

import axios from 'axios';
import { logger } from '../../../config/logger.js';
import { batchProcessThreats } from '../deduplication.js';

const CIRCL_API = 'https://vulnerability.circl.lu/api/last';
const TIMEOUT = 30000;

interface CIRCLStats {
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  errors: number;
}

/**
 * Sync CIRCL recent vulnerabilities
 */
export async function syncCIRCL(sourceId: string): Promise<CIRCLStats> {
  logger.info('[CIRCL] Starting sync...');

  try {
    // Get last 100 vulnerabilities
    const response = await axios.get(`${CIRCL_API}/100`, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const vulnerabilities = response.data || [];
    logger.info(`[CIRCL] Fetched ${vulnerabilities.length} recent vulnerabilities`);

    const indicators = vulnerabilities.map((vuln: any) => {
      // Calculate severity from CVSS score
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      const cvssScore = Number(vuln.cvss) || 0;

      if (cvssScore >= 9.0) {
        severity = 'critical';
      } else if (cvssScore >= 7.0) {
        severity = 'high';
      } else if (cvssScore >= 4.0) {
        severity = 'medium';
      } else {
        severity = 'low';
      }

      return {
        type: 'vulnerability',
        value: vuln.id,
        severity,
        confidence: 85,
        description: `CIRCL - ${vuln.summary || 'Vulnerability'}`,
        tags: ['circl', 'vulnerability', 'cve'],
        metadata: {
          source: 'circl',
          cve_id: String(vuln.id || ''),
          cvss_score: Number(cvssScore),
          published: String(vuln.Published || ''),
          modified: String(vuln.Modified || ''),
          summary: String(vuln.summary || ''),
          discovered_at: new Date().toISOString()
        }
      };
    });

    const stats = await batchProcessThreats(indicators, sourceId, 1000);

    logger.info(`[CIRCL] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[CIRCL] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Test CIRCL connection
 */
export async function testCIRCLConnection(): Promise<{ success: boolean; sample?: any[]; error?: string }> {
  try {
    const response = await axios.get(`${CIRCL_API}/5`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    if (response.data && Array.isArray(response.data)) {
      return {
        success: true,
        sample: response.data.map((vuln: any) => ({
          cve: vuln.id,
          cvss: vuln.cvss
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
