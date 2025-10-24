/**
 * Threat Intelligence Sources Seed
 *
 * Seeds all 7 threat intelligence feed sources into the database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const THREAT_INTEL_SOURCES = [
  {
    name: 'URLhaus',
    description: 'URLhaus is a project from abuse.ch with the goal of sharing malicious URLs that are being used for malware distribution.',
    type: 'api',
    url: 'https://urlhaus-api.abuse.ch/v1/urls/recent/',
    enabled: true,
    updateFrequency: 5, // 5 minutes
    credentialsRequired: false,
    priority: 1,
    tags: ['malware', 'urls', 'free'],
    config: {
      format: 'json',
      timeout: 30000,
      rateLimit: '1000/day'
    }
  },
  {
    name: 'ThreatFox',
    description: 'ThreatFox is a free platform from abuse.ch to share indicators of compromise (IOCs).',
    type: 'api',
    url: 'https://threatfox-api.abuse.ch/api/v1/',
    enabled: true,
    updateFrequency: 10, // 10 minutes
    credentialsRequired: false,
    priority: 1,
    tags: ['iocs', 'malware', 'free'],
    config: {
      format: 'json',
      timeout: 30000
    }
  },
  {
    name: 'MalwareBazaar',
    description: 'MalwareBazaar is a project from abuse.ch to share malware samples with the infosec community.',
    type: 'api',
    url: 'https://mb-api.abuse.ch/api/v1/',
    enabled: true,
    updateFrequency: 1440, // Daily
    credentialsRequired: false,
    priority: 2,
    tags: ['malware', 'hashes', 'free'],
    config: {
      format: 'json',
      timeout: 30000
    }
  },
  {
    name: 'OpenPhish',
    description: 'OpenPhish is a fully automated platform for phishing intelligence. It provides actionable intelligence data through feeds.',
    type: 'feed',
    url: 'https://openphish.com/feed.txt',
    enabled: true,
    updateFrequency: 30, // 30 minutes
    credentialsRequired: false,
    priority: 1,
    tags: ['phishing', 'urls', 'free'],
    config: {
      format: 'txt',
      timeout: 30000
    }
  },
  {
    name: 'PhishTank',
    description: 'PhishTank is a collaborative clearing house for data and information about phishing on the Internet.',
    type: 'feed',
    url: 'http://data.phishtank.com/data/online-valid.json',
    enabled: true,
    updateFrequency: 60, // 60 minutes
    credentialsRequired: false,
    priority: 1,
    tags: ['phishing', 'urls', 'free'],
    config: {
      format: 'json',
      timeout: 60000
    }
  },
  {
    name: 'AlienVault OTX',
    description: 'AlienVault Open Threat Exchange is an open threat information sharing and analysis network. Free API with 10K calls/month.',
    type: 'api',
    url: 'https://otx.alienvault.com/api/v1/pulses/subscribed',
    enabled: true, // Free API key available at otx.alienvault.com
    updateFrequency: 30, // 30 minutes
    credentialsRequired: true,
    priority: 2,
    tags: ['threat-intelligence', 'multi-source', 'free-api-key'],
    config: {
      format: 'json',
      timeout: 30000,
      requiresApiKey: true,
      signupUrl: 'https://otx.alienvault.com/api'
    }
  },
  {
    name: 'Emerging Threats',
    description: 'Proofpoint Emerging Threats provides intelligence on malicious IPs and domains.',
    type: 'feed',
    url: 'https://rules.emergingthreats.net/blockrules/compromised-ips.txt',
    enabled: true,
    updateFrequency: 1440, // Daily
    credentialsRequired: false,
    priority: 3,
    tags: ['ips', 'malware', 'free'],
    config: {
      format: 'txt',
      timeout: 30000
    }
  }
];

async function seedThreatIntelSources() {
  console.log('🌱 Seeding threat intelligence sources...');

  let created = 0;
  let updated = 0;

  for (const source of THREAT_INTEL_SOURCES) {
    try {
      const existing = await prisma.threatIntelSource.findFirst({
        where: { name: source.name }
      });

      if (existing) {
        await prisma.threatIntelSource.update({
          where: { id: existing.id },
          data: {
            description: source.description,
            type: source.type,
            url: source.url,
            enabled: source.enabled,
            updateFrequency: source.updateFrequency,
            credentialsRequired: source.credentialsRequired,
            priority: source.priority,
            tags: source.tags,
            config: source.config as any
          }
        });
        updated++;
        console.log(`  ✓ Updated: ${source.name}`);
      } else {
        await prisma.threatIntelSource.create({
          data: {
            name: source.name,
            description: source.description,
            type: source.type,
            url: source.url,
            enabled: source.enabled,
            updateFrequency: source.updateFrequency,
            credentialsRequired: source.credentialsRequired,
            priority: source.priority,
            tags: source.tags,
            config: source.config as any,
            totalIndicators: 0,
            consecutiveFailures: 0
          }
        });
        created++;
        console.log(`  ✓ Created: ${source.name}`);
      }
    } catch (error: any) {
      console.error(`  ✗ Error processing ${source.name}:`, error.message);
    }
  }

  console.log(`\n✅ Threat intel sources seeded successfully!`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Total: ${THREAT_INTEL_SOURCES.length}`);

  console.log(`\n📊 Enabled sources (ready to sync):`);
  const enabledSources = THREAT_INTEL_SOURCES.filter(s => s.enabled);
  enabledSources.forEach(s => {
    console.log(`   - ${s.name} (every ${s.updateFrequency} minutes)`);
  });
}

export { seedThreatIntelSources };
