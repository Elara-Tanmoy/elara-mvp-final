/**
 * DigitalSide Threat Intel Connector
 * Source: https://osint.digitalside.it/Threat-Intel/
 * Format: STIX 2.0 JSON bundles
 *
 * DigitalSide is a personal malware analysis lab providing daily IOCs
 * including compromised URLs, IPs, domains from malware analysis.
 */

import axios from 'axios';
import { logger } from '../../../config/logger.js';
import { batchProcessThreats } from '../deduplication.js';

const DIGITALSIDE_URL = 'https://osint.digitalside.it/Threat-Intel/lists/latestdomains.txt';
const DIGITALSIDE_IPS_URL = 'https://osint.digitalside.it/Threat-Intel/lists/latestips.txt';
const TIMEOUT = 30000;

interface DigitalSideStats {
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  errors: number;
}

/**
 * Sync DigitalSide domains feed
 */
export async function syncDigitalSideDomains(sourceId: string): Promise<DigitalSideStats> {
  logger.info('[DigitalSide] Starting domains sync...');

  try {
    const response = await axios.get(DIGITALSIDE_URL, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const domains = response.data
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line && !line.startsWith('#') && line.includes('.'));

    logger.info(`[DigitalSide] Fetched ${domains.length} malicious domains`);

    const indicators = domains.map((domain: string) => ({
      type: 'domain',
      value: domain,
      severity: 'high',
      confidence: 85,
      description: 'Malicious domain from DigitalSide malware analysis lab',
      tags: ['malware', 'digitalside', 'domain'],
      metadata: {
        source: 'digitalside',
        category: 'malware',
        discovered_at: new Date().toISOString()
      }
    }));

    const stats = await batchProcessThreats(indicators, sourceId, 1000);

    logger.info(`[DigitalSide Domains] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[DigitalSide Domains] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Sync DigitalSide IPs feed
 */
export async function syncDigitalSideIPs(sourceId: string): Promise<DigitalSideStats> {
  logger.info('[DigitalSide] Starting IPs sync...');

  try {
    const response = await axios.get(DIGITALSIDE_IPS_URL, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const ips = response.data
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line && !line.startsWith('#') && /^\d+\.\d+\.\d+\.\d+$/.test(line));

    logger.info(`[DigitalSide] Fetched ${ips.length} malicious IPs`);

    const indicators = ips.map((ip: string) => ({
      type: 'ip',
      value: ip,
      severity: 'high',
      confidence: 85,
      description: 'Malicious IP from DigitalSide malware analysis lab',
      tags: ['malware', 'digitalside', 'ip'],
      metadata: {
        source: 'digitalside',
        category: 'malware',
        discovered_at: new Date().toISOString()
      }
    }));

    const stats = await batchProcessThreats(indicators, sourceId, 1000);

    logger.info(`[DigitalSide IPs] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[DigitalSide IPs] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Test DigitalSide connection
 */
export async function testDigitalSideConnection(): Promise<{ success: boolean; sample?: any[]; error?: string }> {
  try {
    const response = await axios.get(DIGITALSIDE_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const domains = response.data
      .split('\n')
      .filter((line: string) => line && !line.startsWith('#'))
      .slice(0, 5);

    return {
      success: true,
      sample: domains.map((domain: string) => ({ domain }))
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
