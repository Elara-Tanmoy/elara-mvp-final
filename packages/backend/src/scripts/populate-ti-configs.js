/**
 * Populate Threat Intel Source API Configurations
 * Run this script to update database with actual API endpoint details
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const configs = [
  {
    name: 'URLhaus',
    url: 'https://urlhaus-api.abuse.ch/v1/urls/recent/',
    requiresAuth: true,
    description: 'Abuse.ch URLhaus - Recent malware distribution URLs. Requires API key from https://auth.abuse.ch/',
    apiConfig: {
      method: 'GET',
      timeout: 30000,
      headers: {
        'Auth-Key': '{ABUSECH_API_KEY}',
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      },
      queryParams: {},
      bodyParams: null,
      authHeaderName: 'Auth-Key',
      envVarName: 'ABUSECH_API_KEY'
    }
  },
  {
    name: 'ThreatFox',
    url: 'https://threatfox-api.abuse.ch/api/v1/',
    requiresAuth: true,
    description: 'Abuse.ch ThreatFox - Indicators of Compromise (IOCs). Requires API key from https://auth.abuse.ch/',
    apiConfig: {
      method: 'POST',
      timeout: 30000,
      headers: {
        'Auth-Key': '{ABUSECH_API_KEY}',
        'Content-Type': 'application/json',
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      },
      queryParams: {},
      bodyParams: '{"query":"get_iocs","days":1}',
      authHeaderName: 'Auth-Key',
      envVarName: 'ABUSECH_API_KEY'
    }
  },
  {
    name: 'MalwareBazaar',
    url: 'https://mb-api.abuse.ch/api/v1/',
    requiresAuth: true,
    description: 'Abuse.ch MalwareBazaar - Malware sample hashes. Requires API key from https://auth.abuse.ch/',
    apiConfig: {
      method: 'POST',
      timeout: 30000,
      headers: {
        'Auth-Key': '{ABUSECH_API_KEY}',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      },
      queryParams: {},
      bodyParams: 'query=get_recent&selector=100',
      authHeaderName: 'Auth-Key',
      envVarName: 'ABUSECH_API_KEY'
    }
  },
  {
    name: 'SSL Blacklist',
    url: 'https://sslbl.abuse.ch/blacklist/sslblacklist.csv',
    requiresAuth: false,
    description: 'Abuse.ch SSL Blacklist - Malicious SSL certificate fingerprints. API key optional.',
    apiConfig: {
      method: 'GET',
      timeout: 30000,
      headers: {
        'API-KEY': '{ABUSECH_API_KEY}',
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      },
      queryParams: {},
      bodyParams: null,
      authHeaderName: 'API-KEY',
      envVarName: 'ABUSECH_API_KEY'
    }
  },
  {
    name: 'AbuseIPDB',
    url: 'https://api.abuseipdb.com/api/v2/blacklist',
    requiresAuth: true,
    description: 'AbuseIPDB Blacklist - Abusive IP addresses. Requires API key from https://www.abuseipdb.com/account/api',
    apiConfig: {
      method: 'GET',
      timeout: 30000,
      headers: {
        'Key': '{ABUSEIPDB_API_KEY}',
        'Accept': 'application/json'
      },
      queryParams: {
        confidenceMinimum: '90',
        limit: '10000'
      },
      bodyParams: null,
      authHeaderName: 'Key',
      envVarName: 'ABUSEIPDB_API_KEY'
    }
  },
  {
    name: 'AlienVault OTX',
    url: 'https://otx.alienvault.com/api/v1/pulses/subscribed',
    requiresAuth: true,
    description: 'AlienVault Open Threat Exchange - Threat intelligence pulses. Requires API key from https://otx.alienvault.com/api',
    apiConfig: {
      method: 'GET',
      timeout: 30000,
      headers: {
        'X-OTX-API-KEY': '{ALIENVAULT_OTX_API_KEY}'
      },
      queryParams: {
        limit: '50'
      },
      bodyParams: null,
      authHeaderName: 'X-OTX-API-KEY',
      envVarName: 'ALIENVAULT_OTX_API_KEY'
    }
  },
  {
    name: 'PhishTank',
    url: 'https://data.phishtank.com/data/online-valid.json',
    requiresAuth: false,
    description: 'PhishTank - Verified phishing URLs. Public feed, no API key required.',
    apiConfig: {
      method: 'GET',
      timeout: 60000,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      },
      queryParams: {},
      bodyParams: null,
      authHeaderName: null,
      envVarName: null
    }
  },
  {
    name: 'OpenPhish',
    url: 'https://openphish.com/feed.txt',
    requiresAuth: false,
    description: 'OpenPhish - Active phishing URLs. Public feed, no API key required.',
    apiConfig: {
      method: 'GET',
      timeout: 30000,
      headers: {
        'User-Agent': 'Elara-Cybersecurity-Platform/1.0'
      },
      queryParams: {},
      bodyParams: null,
      authHeaderName: null,
      envVarName: null
    }
  },
  {
    name: 'GreyNoise',
    url: 'https://api.greynoise.io/v3/community',
    requiresAuth: true,
    description: 'GreyNoise - Internet-wide scan detection. Community API requires specific IP lookups.',
    apiConfig: {
      method: 'GET',
      timeout: 30000,
      headers: {
        'key': '{GREYNOISE_API_KEY}'
      },
      queryParams: {},
      bodyParams: null,
      authHeaderName: 'key',
      envVarName: 'GREYNOISE_API_KEY'
    }
  }
];

async function populateConfigs() {
  console.log('Populating Threat Intel API configurations...\n');

  let updated = 0;
  let errors = 0;

  for (const config of configs) {
    try {
      const result = await prisma.threatIntelSource.updateMany({
        where: { name: config.name },
        data: {
          url: config.url,
          requiresAuth: config.requiresAuth,
          description: config.description,
          metadata: {
            ...(await prisma.threatIntelSource.findFirst({ where: { name: config.name } }).then(s => s?.metadata || {})),
            apiConfig: config.apiConfig
          }
        }
      });

      if (result.count > 0) {
        console.log(`✓ Updated ${config.name}`);
        updated++;
      } else {
        console.log(`⚠ ${config.name} not found in database`);
      }
    } catch (error) {
      console.error(`✗ Failed to update ${config.name}:`, error.message);
      errors++;
    }
  }

  console.log(`\nComplete: ${updated} updated, ${errors} errors`);

  // Verify
  const sources = await prisma.threatIntelSource.findMany({
    select: {
      name: true,
      url: true,
      requiresAuth: true,
      metadata: true
    },
    orderBy: { name: 'asc' }
  });

  console.log('\n=== Verification ===');
  sources.forEach(s => {
    const apiConfig = s.metadata?.apiConfig;
    console.log(`${s.name}: ${apiConfig?.method || 'NO METHOD'} ${s.url || 'NO URL'}`);
  });
}

populateConfigs()
  .then(() => {
    console.log('\n✅ Configuration population complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Configuration population failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
