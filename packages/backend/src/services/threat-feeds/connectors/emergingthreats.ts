/**
 * Emerging Threats (Proofpoint) Connector
 * Source: https://rules.emergingthreats.net/
 * Free blocklists for malicious IPs
 */

import axios from 'axios';
import { logger } from '../../../config/logger.js';
import { batchProcessThreats } from '../deduplication.js';

const EMERGING_THREATS_COMPROMISED_IPS = 'https://rules.emergingthreats.net/blockrules/compromised-ips.txt';
const TIMEOUT = 30000;

interface EmergingThreatsStats {
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  errors: number;
}

/**
 * Sync Emerging Threats compromised IPs
 */
export async function syncEmergingThreats(sourceId: string): Promise<EmergingThreatsStats> {
  logger.info('[EmergingThreats] Starting sync...');

  try {
    const response = await axios.get(EMERGING_THREATS_COMPROMISED_IPS, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const ips = response.data
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line && !line.startsWith('#') && /^\d+\.\d+\.\d+\.\d+$/.test(line));

    logger.info(`[EmergingThreats] Fetched ${ips.length} compromised IPs`);

    const indicators = ips.map((ip: string) => ({
      type: 'ip',
      value: ip,
      severity: 'high',
      confidence: 85,
      description: 'Compromised IP from Emerging Threats blocklist',
      tags: ['compromised', 'emerging-threats', 'proofpoint', 'ip'],
      metadata: {
        source: 'emerging-threats',
        category: 'compromised',
        discovered_at: new Date().toISOString()
      }
    }));

    const stats = await batchProcessThreats(indicators, sourceId, 1000);

    logger.info(`[EmergingThreats] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[EmergingThreats] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Test Emerging Threats connection
 */
export async function testEmergingThreatsConnection(): Promise<{ success: boolean; sample?: any[]; error?: string }> {
  try {
    const response = await axios.get(EMERGING_THREATS_COMPROMISED_IPS, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const ips = response.data
      .split('\n')
      .filter((line: string) => line && !line.startsWith('#'))
      .slice(0, 5);

    return {
      success: true,
      sample: ips.map((ip: string) => ({ ip }))
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
