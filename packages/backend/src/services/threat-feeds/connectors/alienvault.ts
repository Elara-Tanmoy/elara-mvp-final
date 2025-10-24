/**
 * AlienVault OTX (Open Threat Exchange) Connector
 * Source: https://otx.alienvault.com/
 * API Docs: https://otx.alienvault.com/api
 *
 * API Key: Get from https://otx.alienvault.com/api
 * Set ALIENVAULT_OTX_API_KEY environment variable
 */

import axios from 'axios';
import { logger } from '../../../config/logger.js';
import { batchProcessThreats } from '../deduplication.js';

const OTX_API = 'https://otx.alienvault.com/api/v1/pulses/subscribed';
const TIMEOUT = 30000;
const API_KEY = process.env.ALIENVAULT_OTX_API_KEY || '';

interface AlienVaultStats {
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  errors: number;
}

/**
 * Sync AlienVault OTX pulses (threat intelligence feeds)
 */
export async function syncAlienVault(sourceId: string): Promise<AlienVaultStats> {
  logger.info('[AlienVault OTX] Starting sync...');

  if (!API_KEY) {
    logger.warn('[AlienVault OTX] No API key provided, skipping sync');
    return {
      recordsProcessed: 0,
      recordsAdded: 0,
      recordsUpdated: 0,
      errors: 0
    };
  }

  try {
    const response = await axios.get(OTX_API, {
      timeout: TIMEOUT,
      headers: {
        'X-OTX-API-KEY': API_KEY
      },
      params: {
        limit: 50, // Get last 50 pulses
        modified_since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Last 24 hours
      }
    });

    const pulses = response.data.results || [];
    logger.info(`[AlienVault OTX] Fetched ${pulses.length} pulses`);

    // Extract indicators from all pulses
    const allIndicators: any[] = [];

    for (const pulse of pulses) {
      const indicators = (pulse.indicators || []).map((indicator: any) => {
        let type = 'domain';
        if (indicator.type === 'IPv4' || indicator.type === 'IPv6') {
          type = 'ip';
        } else if (indicator.type === 'URL') {
          type = 'url';
        } else if (indicator.type === 'FileHash-MD5' || indicator.type === 'FileHash-SHA256') {
          type = 'hash';
        } else if (indicator.type === 'domain' || indicator.type === 'hostname') {
          type = 'domain';
        }

        // Calculate severity from TLP
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
        if (pulse.TLP === 'red') {
          severity = 'critical';
        } else if (pulse.TLP === 'amber') {
          severity = 'high';
        } else if (pulse.TLP === 'green') {
          severity = 'medium';
        } else {
          severity = 'low';
        }

        return {
          type,
          value: indicator.indicator,
          severity,
          confidence: 80,
          description: `AlienVault OTX - ${pulse.name}`,
          tags: ['alienvault', 'otx', ...(pulse.tags || [])],
          metadata: {
            source: 'alienvault-otx',
            pulse_id: String(pulse.id || ''),
            pulse_name: String(pulse.name || ''),
            indicator_type: String(indicator.type || ''),
            tlp: String(pulse.TLP || ''),
            description: String(indicator.description || ''),
            discovered_at: new Date().toISOString()
          }
        };
      });

      allIndicators.push(...indicators);
    }

    logger.info(`[AlienVault OTX] Extracted ${allIndicators.length} indicators from pulses`);

    const stats = await batchProcessThreats(allIndicators, sourceId, 1000);

    logger.info(`[AlienVault OTX] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[AlienVault OTX] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Test AlienVault OTX connection
 */
export async function testAlienVaultConnection(): Promise<{ success: boolean; sample?: any[]; error?: string }> {
  if (!API_KEY) {
    return {
      success: false,
      error: 'API key not configured'
    };
  }

  try {
    const response = await axios.get(OTX_API, {
      timeout: 10000,
      headers: {
        'X-OTX-API-KEY': API_KEY
      },
      params: {
        limit: 3
      }
    });

    if (response.data && response.data.results) {
      return {
        success: true,
        sample: response.data.results.map((pulse: any) => ({
          name: pulse.name,
          indicators: pulse.indicator_count
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
