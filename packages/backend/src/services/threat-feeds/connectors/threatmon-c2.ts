/**
 * ThreatMon C2 Feeds Connector
 * Source: https://github.com/ThreatMon/ThreatMon-Daily-C2-Feeds
 * Format: CSV with C2 server data
 *
 * Daily Command & Control infrastructure tracking including:
 * - C2 server IPs and domains
 * - Associated malware families
 * - Confidence scores
 */

import axios from 'axios';
import { logger } from '../../../config/logger.js';
import { batchProcessThreats } from '../deduplication.js';

const THREATMON_C2_DOMAINS_URL = 'https://raw.githubusercontent.com/ThreatMon/ThreatMon-Daily-C2-Feeds/main/C2-Feeds-domains.csv';
const THREATMON_C2_IPS_URL = 'https://raw.githubusercontent.com/ThreatMon/ThreatMon-Daily-C2-Feeds/main/C2-Feeds-ips.csv';
const TIMEOUT = 30000;

interface ThreatMonStats {
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  errors: number;
}

/**
 * Parse ThreatMon CSV format
 * Format: domain/ip,malware_family,first_seen,last_seen,confidence
 */
function parseThreatMonCSV(data: string): Array<{
  indicator: string;
  malwareFamily: string;
  firstSeen: string;
  lastSeen: string;
  confidence: number;
}> {
  const lines = data.split('\n').filter(line => line && !line.startsWith('#'));

  // Skip header if present
  const dataLines = lines[0].includes('domain') || lines[0].includes('ip') ? lines.slice(1) : lines;

  return dataLines
    .map(line => {
      const parts = line.split(',');
      if (parts.length >= 3) {
        return {
          indicator: parts[0].trim(),
          malwareFamily: parts[1]?.trim() || 'unknown',
          firstSeen: parts[2]?.trim() || '',
          lastSeen: parts[3]?.trim() || '',
          confidence: parseInt(parts[4]) || 75
        };
      }
      return null;
    })
    .filter(Boolean) as Array<any>;
}

/**
 * Sync ThreatMon C2 domains
 */
export async function syncThreatMonC2Domains(sourceId: string): Promise<ThreatMonStats> {
  logger.info('[ThreatMon] Starting C2 domains sync...');

  try {
    const response = await axios.get(THREATMON_C2_DOMAINS_URL, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const parsed = parseThreatMonCSV(response.data);
    logger.info(`[ThreatMon] Fetched ${parsed.length} C2 domains`);

    const indicators = parsed.map(item => ({
      type: 'domain',
      value: item.indicator,
      severity: 'critical',
      confidence: item.confidence,
      description: `C2 server for ${item.malwareFamily} malware`,
      tags: ['c2', 'command-control', 'threatmon', item.malwareFamily.toLowerCase()],
      metadata: {
        source: 'threatmon-c2',
        malwareFamily: item.malwareFamily,
        firstSeen: item.firstSeen,
        lastSeen: item.lastSeen,
        discovered_at: new Date().toISOString()
      }
    }));

    const stats = await batchProcessThreats(indicators, sourceId, 1000);

    logger.info(`[ThreatMon C2 Domains] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[ThreatMon C2 Domains] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Sync ThreatMon C2 IPs
 */
export async function syncThreatMonC2IPs(sourceId: string): Promise<ThreatMonStats> {
  logger.info('[ThreatMon] Starting C2 IPs sync...');

  try {
    const response = await axios.get(THREATMON_C2_IPS_URL, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const parsed = parseThreatMonCSV(response.data);
    logger.info(`[ThreatMon] Fetched ${parsed.length} C2 IPs`);

    const indicators = parsed.map(item => ({
      type: 'ip',
      value: item.indicator,
      severity: 'critical',
      confidence: item.confidence,
      description: `C2 server IP for ${item.malwareFamily} malware`,
      tags: ['c2', 'command-control', 'threatmon', item.malwareFamily.toLowerCase()],
      metadata: {
        source: 'threatmon-c2',
        malwareFamily: item.malwareFamily,
        firstSeen: item.firstSeen,
        lastSeen: item.lastSeen,
        discovered_at: new Date().toISOString()
      }
    }));

    const stats = await batchProcessThreats(indicators, sourceId, 1000);

    logger.info(`[ThreatMon C2 IPs] Sync complete:`, stats);

    return {
      recordsProcessed: stats.processed,
      recordsAdded: stats.added,
      recordsUpdated: stats.updated,
      errors: stats.errors
    };

  } catch (error: any) {
    logger.error('[ThreatMon C2 IPs] Sync failed:', error.message);
    throw error;
  }
}

/**
 * Test ThreatMon connection
 */
export async function testThreatMonConnection(): Promise<{ success: boolean; sample?: any[]; error?: string }> {
  try {
    const response = await axios.get(THREATMON_C2_DOMAINS_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      }
    });

    const parsed = parseThreatMonCSV(response.data).slice(0, 5);

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
