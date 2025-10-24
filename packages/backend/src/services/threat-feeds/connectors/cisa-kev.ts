/**
 * CISA KEV (Known Exploited Vulnerabilities) Connector
 * Source: https://www.cisa.gov/known-exploited-vulnerabilities-catalog
 * No API key required - public catalog
 */

import axios from 'axios';
import { logger } from '../../../config/logger.js';
import { batchProcessThreats } from '../deduplication.js';

const CISA_KEV_API = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const TIMEOUT = 30000;

interface CISAKEVStats {
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  errors: number;
}

/**
 * Sync CISA Known Exploited Vulnerabilities catalog
 */
export async function syncCISAKEV(sourceId: string): Promise<CISAKEVStats> {
  logger.info('[CISA KEV] Starting sync...');

  try {
    const response = await axios.get(CISA_KEV_API, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const vulnerabilities = response.data.vulnerabilities || [];
    logger.info(`[CISA KEV] Fetched ${vulnerabilities.length} known exploited vulnerabilities`);

    const indicators = vulnerabilities.map((vuln: any) => {
      // Calculate severity based on presence of ransomware or known exploit
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'high';
      const ransomwareUse = String(vuln.knownRansomwareCampaignUse || '').toLowerCase();

      if (ransomwareUse === 'known') {
        severity = 'critical';
      } else if (ransomwareUse === 'unknown') {
        severity = 'high';
      }

      return {
        type: 'vulnerability',
        value: vuln.cveID,
        severity,
        confidence: 100, // CISA verified
        description: `CISA KEV - ${vuln.vulnerabilityName}: ${vuln.shortDescription}`,
        tags: ['cisa', 'kev', 'vulnerability', 'exploited', vuln.product || 'unknown'],
        metadata: {
          source: 'cisa-kev',
          cve_id: String(vuln.cveID || ''),
          vendor_project: String(vuln.vendorProject || ''),
          product: String(vuln.product || ''),
          vulnerability_name: String(vuln.vulnerabilityName || ''),
          date_added: String(vuln.dateAdded || ''),
          short_description: String(vuln.shortDescription || ''),
          required_action: String(vuln.requiredAction || ''),
          due_date: String(vuln.dueDate || ''),
          known_ransomware_campaign_use: String(vuln.knownRansomwareCampaignUse || ''),
          notes: String(vuln.notes || ''),
          discovered_at: new Date().toISOString()
        }
      };
    });

    const stats = await batchProcessThreats(indicators, sourceId, 1000);

    logger.info(`[CISA KEV] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[CISA KEV] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Test CISA KEV connection
 */
export async function testCISAKEVConnection(): Promise<{ success: boolean; sample?: any[]; error?: string }> {
  try {
    const response = await axios.get(CISA_KEV_API, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    if (response.data && response.data.vulnerabilities) {
      const sample = response.data.vulnerabilities.slice(0, 3);
      return {
        success: true,
        sample: sample.map((vuln: any) => ({
          cve: vuln.cveID,
          name: vuln.vulnerabilityName,
          vendor: vuln.vendorProject
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
