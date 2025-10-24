/**
 * Update Threat Intel Source Configurations
 * Populates database with ACTUAL API endpoint configurations from code
 */

import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

interface SourceConfig {
  name: string;
  url: string;
  method: string;
  requiresAuth: boolean;
  authHeaderName?: string;
  envVarName?: string;
  headers: Record<string, string>;
  queryParams?: Record<string, string>;
  bodyParams?: string;
  timeout: number;
  description: string;
}

const SOURCE_CONFIGS: SourceConfig[] = [
  {
    name: 'URLhaus',
    url: 'https://urlhaus-api.abuse.ch/v1/urls/recent/',
    method: 'GET',
    requiresAuth: true,
    authHeaderName: 'Auth-Key',
    envVarName: 'ABUSECH_API_KEY',
    headers: {
      'Auth-Key': '{ABUSECH_API_KEY}',
      'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
    },
    timeout: 30000,
    description: 'Abuse.ch URLhaus - Recent malware distribution URLs. Requires API key from https://auth.abuse.ch/'
  },
  {
    name: 'ThreatFox',
    url: 'https://threatfox-api.abuse.ch/api/v1/',
    method: 'POST',
    requiresAuth: true,
    authHeaderName: 'Auth-Key',
    envVarName: 'ABUSECH_API_KEY',
    headers: {
      'Auth-Key': '{ABUSECH_API_KEY}',
      'Content-Type': 'application/json',
      'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
    },
    bodyParams: '{"query":"get_iocs","days":1}',
    timeout: 30000,
    description: 'Abuse.ch ThreatFox - Indicators of Compromise (IOCs). Requires API key from https://auth.abuse.ch/'
  },
  {
    name: 'MalwareBazaar',
    url: 'https://mb-api.abuse.ch/api/v1/',
    method: 'POST',
    requiresAuth: true,
    authHeaderName: 'Auth-Key',
    envVarName: 'ABUSECH_API_KEY',
    headers: {
      'Auth-Key': '{ABUSECH_API_KEY}',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
    },
    bodyParams: 'query=get_recent&selector=100',
    timeout: 30000,
    description: 'Abuse.ch MalwareBazaar - Malware sample hashes. Requires API key from https://auth.abuse.ch/'
  },
  {
    name: 'SSL Blacklist',
    url: 'https://sslbl.abuse.ch/blacklist/sslblacklist.csv',
    method: 'GET',
    requiresAuth: false,
    authHeaderName: 'API-KEY',
    envVarName: 'ABUSECH_API_KEY',
    headers: {
      'API-KEY': '{ABUSECH_API_KEY}',
      'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
    },
    timeout: 30000,
    description: 'Abuse.ch SSL Blacklist - Malicious SSL certificate fingerprints. API key optional.'
  },
  {
    name: 'AbuseIPDB',
    url: 'https://api.abuseipdb.com/api/v2/blacklist',
    method: 'GET',
    requiresAuth: true,
    authHeaderName: 'Key',
    envVarName: 'ABUSEIPDB_API_KEY',
    headers: {
      'Key': '{ABUSEIPDB_API_KEY}',
      'Accept': 'application/json'
    },
    queryParams: {
      'confidenceMinimum': '90',
      'limit': '10000'
    },
    timeout: 30000,
    description: 'AbuseIPDB Blacklist - Abusive IP addresses. Requires API key from https://www.abuseipdb.com/account/api'
  },
  {
    name: 'AlienVault OTX',
    url: 'https://otx.alienvault.com/api/v1/pulses/subscribed',
    method: 'GET',
    requiresAuth: true,
    authHeaderName: 'X-OTX-API-KEY',
    envVarName: 'ALIENVAULT_OTX_API_KEY',
    headers: {
      'X-OTX-API-KEY': '{ALIENVAULT_OTX_API_KEY}'
    },
    queryParams: {
      'limit': '50'
    },
    timeout: 30000,
    description: 'AlienVault Open Threat Exchange - Threat intelligence pulses. Requires API key from https://otx.alienvault.com/api'
  },
  {
    name: 'PhishTank',
    url: 'https://data.phishtank.com/data/online-valid.json',
    method: 'GET',
    requiresAuth: false,
    headers: {
      'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
    },
    timeout: 60000,
    description: 'PhishTank - Verified phishing URLs. Public feed, no API key required.'
  },
  {
    name: 'OpenPhish',
    url: 'https://openphish.com/feed.txt',
    method: 'GET',
    requiresAuth: false,
    headers: {
      'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
    },
    timeout: 30000,
    description: 'OpenPhish - Active phishing URLs. Public feed, no API key required.'
  },
  {
    name: 'GreyNoise',
    url: 'https://api.greynoise.io/v3/community',
    method: 'GET',
    requiresAuth: true,
    authHeaderName: 'key',
    envVarName: 'GREYNOISE_API_KEY',
    headers: {
      'key': '{GREYNOISE_API_KEY}'
    },
    timeout: 30000,
    description: 'GreyNoise - Internet-wide scan detection. Community API requires specific IP lookups. Enterprise API recommended for bulk feeds. Get key from https://viz.greynoise.io/account'
  }
];

async function updateSourceConfigs() {
  logger.info('Starting Threat Intel source configuration update...');

  let updated = 0;
  let errors = 0;

  for (const config of SOURCE_CONFIGS) {
    try {
      logger.info(`Updating source: ${config.name}...`);

      await prisma.threatIntelSource.upsert({
        where: { name: config.name },
        update: {
          url: config.url,
          requiresAuth: config.requiresAuth,
          description: config.description,
          metadata: {
            method: config.method,
            timeout: config.timeout,
            headers: config.headers,
            queryParams: config.queryParams || {},
            bodyParams: config.bodyParams || null,
            authHeaderName: config.authHeaderName || null,
            envVarName: config.envVarName || null,
            implementationFile: `connectors/${config.name.toLowerCase().replace(/\s+/g, '')}.ts`
          }
        },
        create: {
          name: config.name,
          type: determineType(config.name),
          url: config.url,
          requiresAuth: config.requiresAuth,
          enabled: true,
          description: config.description,
          syncFrequency: determineSyncFrequency(config.name),
          metadata: {
            method: config.method,
            timeout: config.timeout,
            headers: config.headers,
            queryParams: config.queryParams || {},
            bodyParams: config.bodyParams || null,
            authHeaderName: config.authHeaderName || null,
            envVarName: config.envVarName || null,
            implementationFile: `connectors/${config.name.toLowerCase().replace(/\s+/g, '')}.ts`
          }
        }
      });

      logger.info(`✓ Updated ${config.name}`);
      updated++;
    } catch (error: any) {
      logger.error(`✗ Failed to update ${config.name}:`, error.message);
      errors++;
    }
  }

  logger.info(`\nUpdate complete: ${updated} sources updated, ${errors} errors`);
}

function determineType(name: string): string {
  if (name.includes('Phish')) return 'phishing';
  if (name.includes('Malware') || name.includes('Bazaar')) return 'malware';
  if (name.includes('IP') || name.includes('GreyNoise')) return 'ip-reputation';
  if (name.includes('SSL')) return 'certificate';
  if (name.includes('URL')) return 'url';
  return 'general';
}

function determineSyncFrequency(name: string): number {
  const frequencies: Record<string, number> = {
    'URLhaus': 300,           // 5 minutes
    'ThreatFox': 600,          // 10 minutes
    'MalwareBazaar': 86400,    // 24 hours
    'SSL Blacklist': 86400,    // 24 hours
    'AbuseIPDB': 21600,        // 6 hours
    'AlienVault OTX': 1800,    // 30 minutes
    'PhishTank': 3600,         // 1 hour
    'OpenPhish': 1800,         // 30 minutes
    'GreyNoise': 86400         // 24 hours
  };
  return frequencies[name] || 3600; // Default 1 hour
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateSourceConfigs()
    .then(() => {
      logger.info('Configuration update completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Configuration update failed:', error);
      process.exit(1);
    });
}

export { updateSourceConfigs };
