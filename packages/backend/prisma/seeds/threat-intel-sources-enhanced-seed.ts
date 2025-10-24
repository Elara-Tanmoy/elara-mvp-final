/**
 * ENHANCED Threat Intelligence Sources Seed
 *
 * Includes 18 premium FREE sources from research:
 * - Original 7 sources (abuse.ch, OpenPhish, PhishTank, etc.)
 * - GitHub sources (6)
 * - NEW API-key sources (5): SSL Blacklist, AbuseIPDB, GreyNoise, CISA KEV, CIRCL
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ENHANCED_THREAT_INTEL_SOURCES = [
  // ========== ORIGINAL 7 SOURCES ==========
  {
    name: 'URLhaus',
    description: 'URLhaus is a project from abuse.ch with the goal of sharing malicious URLs that are being used for malware distribution.',
    type: 'api',
    url: 'https://urlhaus-api.abuse.ch/v1/urls/recent/',
    enabled: true,
    syncFrequency: 5,
    requiresAuth: false,
    priority: 1,
    metadata: {
      tags: ['malware', 'urls', 'free', 'abuse.ch'],
      config: { format: 'json', timeout: 30000, rateLimit: '1000/day' }
    }
  },
  {
    name: 'ThreatFox',
    description: 'ThreatFox is a free platform from abuse.ch to share indicators of compromise (IOCs).',
    type: 'api',
    url: 'https://threatfox-api.abuse.ch/api/v1/',
    enabled: true,
    syncFrequency: 10,
    requiresAuth: false,
    priority: 1,
    metadata: { tags: ['iocs', 'malware', 'free', 'abuse.ch'] },
    config: { format: 'json', timeout: 30000 }
  },
  {
    name: 'MalwareBazaar',
    description: 'MalwareBazaar is a project from abuse.ch to share malware samples with the infosec community.',
    type: 'api',
    url: 'https://mb-api.abuse.ch/api/v1/',
    enabled: true,
    syncFrequency: 1440,
    requiresAuth: false,
    priority: 2,
    metadata: { tags: ['malware', 'hashes', 'free', 'abuse.ch'] },
    config: { format: 'json', timeout: 30000 }
  },
  {
    name: 'OpenPhish',
    description: 'OpenPhish is a fully automated platform for phishing intelligence. Provides actionable intelligence data through feeds.',
    type: 'feed',
    url: 'https://openphish.com/feed.txt',
    enabled: true,
    syncFrequency: 30,
    requiresAuth: false,
    priority: 1,
    metadata: { tags: ['phishing', 'urls', 'free', 'implemented'] },
    config: { format: 'txt', timeout: 30000 }
  },
  {
    name: 'PhishTank',
    description: 'PhishTank is a collaborative clearing house for data and information about phishing on the Internet.',
    type: 'feed',
    url: 'http://data.phishtank.com/data/online-valid.json',
    enabled: true,
    syncFrequency: 60,
    requiresAuth: false,
    priority: 1,
    metadata: { tags: ['phishing', 'urls', 'free', 'implemented'] },
    config: { format: 'json', timeout: 60000 }
  },
  {
    name: 'AlienVault OTX',
    description: 'AlienVault Open Threat Exchange. Free API with 10K calls/month.',
    type: 'api',
    url: 'https://otx.alienvault.com/api/v1/pulses/subscribed',
    enabled: true,
    syncFrequency: 30,
    requiresAuth: true,
    priority: 2,
    metadata: { tags: ['threat-intelligence', 'multi-source', 'free-api-key'] },
    config: { format: 'json', timeout: 30000, requiresApiKey: true, signupUrl: 'https://otx.alienvault.com/api' }
  },
  {
    name: 'Emerging Threats',
    description: 'Proofpoint Emerging Threats provides intelligence on malicious IPs and domains.',
    type: 'feed',
    url: 'https://rules.emergingthreats.net/blockrules/compromised-ips.txt',
    enabled: true,
    syncFrequency: 1440,
    requiresAuth: false,
    priority: 3,
    metadata: { tags: ['ips', 'malware', 'free'] },
    config: { format: 'txt', timeout: 30000 }
  },

  // ========== NEW GITHUB SOURCES (6) ==========

  // DigitalSide Threat Intel (Personal malware analysis lab)
  // NOTE: DigitalSide server has connectivity issues - disabled until resolved
  {
    name: 'DigitalSide - Domains',
    description: 'DigitalSide malware analysis lab - Malicious domains from daily malware analysis. STIX 2.0 format available. CURRENTLY DISABLED: Server unreachable.',
    type: 'feed',
    url: 'https://osint.digitalside.it/Threat-Intel/lists/latestdomains.txt',
    enabled: false, // Disabled due to connection timeouts
    syncFrequency: 360, // 6 hours
    requiresAuth: false,
    priority: 1,
    metadata: { tags: ['malware', 'domains', 'free', 'github', 'implemented', 'disabled'] },
    config: {
      format: 'txt',
      timeout: 60000, // Increased timeout
      githubRepo: 'https://github.com/davidonzo/Threat-Intel'
    }
  },
  {
    name: 'DigitalSide - IPs',
    description: 'DigitalSide malware analysis lab - Malicious IPs from daily malware analysis. STIX 2.0 format available. CURRENTLY DISABLED: Server unreachable.',
    type: 'feed',
    url: 'https://osint.digitalside.it/Threat-Intel/lists/latestips.txt',
    enabled: false, // Disabled due to connection timeouts
    syncFrequency: 360, // 6 hours
    requiresAuth: false,
    priority: 1,
    metadata: { tags: ['malware', 'ips', 'free', 'github', 'implemented', 'disabled'] },
    config: {
      format: 'txt',
      timeout: 60000, // Increased timeout
      githubRepo: 'https://github.com/davidonzo/Threat-Intel'
    }
  },

  // Critical Path Security (Aggregated & Normalized)
  {
    name: 'CriticalPath - Compromised IPs',
    description: 'Critical Path Security aggregated compromised IP addresses from multiple public sources. Updated daily.',
    type: 'feed',
    url: 'https://raw.githubusercontent.com/CriticalPathSecurity/Public-Intelligence-Feeds/master/compromised-ips.txt',
    enabled: true,
    syncFrequency: 720, // 12 hours
    requiresAuth: false,
    priority: 1,
    metadata: { tags: ['compromised', 'ips', 'free', 'github', 'implemented'] },
    config: {
      format: 'txt',
      timeout: 30000,
      githubRepo: 'https://github.com/CriticalPathSecurity/Public-Intelligence-Feeds'
    }
  },
  {
    name: 'CriticalPath - Illuminate',
    description: 'Critical Path Security Illuminate feed - Multi-type indicators (domains, IPs, URLs) from advanced threat research.',
    type: 'feed',
    url: 'https://raw.githubusercontent.com/CriticalPathSecurity/Public-Intelligence-Feeds/master/illuminate.txt',
    enabled: true,
    syncFrequency: 720, // 12 hours
    requiresAuth: false,
    priority: 2,
    metadata: { tags: ['multi-type', 'research', 'free', 'github', 'implemented'] },
    config: {
      format: 'txt',
      timeout: 30000,
      githubRepo: 'https://github.com/CriticalPathSecurity/Public-Intelligence-Feeds'
    }
  },

  // ThreatMon C2 Feeds (Command & Control tracking)
  // NOTE: Repository appears abandoned - last update Dec 2023. DISABLED.
  {
    name: 'ThreatMon - C2 Domains',
    description: 'ThreatMon daily C2 domain tracking with malware family attribution. CURRENTLY DISABLED: Repository abandoned (last update: 2023-12). No 2024/2025 data available.',
    type: 'feed',
    url: 'https://raw.githubusercontent.com/ThreatMon/ThreatMon-Daily-C2-Feeds/main/C2-Feeds-domains.csv',
    enabled: false, // Disabled due to abandoned repository
    syncFrequency: 1440, // Daily
    requiresAuth: false,
    priority: 1,
    metadata: { tags: ['c2', 'command-control', 'domains', 'free', 'github', 'disabled'] },
    config: {
      format: 'csv',
      timeout: 30000,
      githubRepo: 'https://github.com/ThreatMon/ThreatMon-Daily-C2-Feeds',
      disabledReason: 'Repository abandoned - last update Dec 2023'
    }
  },
  {
    name: 'ThreatMon - C2 IPs',
    description: 'ThreatMon daily C2 IP tracking with malware family attribution. CURRENTLY DISABLED: Repository abandoned (last update: 2023-12). No 2024/2025 data available.',
    type: 'feed',
    url: 'https://raw.githubusercontent.com/ThreatMon/ThreatMon-Daily-C2-Feeds/main/C2-Feeds-ips.csv',
    enabled: false, // Disabled due to abandoned repository
    syncFrequency: 1440, // Daily
    requiresAuth: false,
    priority: 1,
    metadata: { tags: ['c2', 'command-control', 'ips', 'free', 'github', 'disabled'] },
    config: {
      format: 'csv',
      timeout: 30000,
      githubRepo: 'https://github.com/ThreatMon/ThreatMon-Daily-C2-Feeds',
      disabledReason: 'Repository abandoned - last update Dec 2023'
    }
  },

  // ========== NEW API-KEY SOURCES (5) ==========

  // SSL Blacklist (abuse.ch)
  {
    name: 'SSL Blacklist',
    description: 'abuse.ch SSL Blacklist - Malicious SSL certificates used by botnet C&C servers. Free public feed.',
    type: 'feed',
    url: 'https://sslbl.abuse.ch/blacklist/sslblacklist.csv',
    enabled: true,
    syncFrequency: 1440, // Daily
    requiresAuth: false,
    priority: 2,
    metadata: { tags: ['ssl', 'certificates', 'c2', 'botnet', 'abuse.ch', 'implemented'] },
    config: { format: 'csv', timeout: 30000 }
  },

  // AbuseIPDB (Requires API Key)
  {
    name: 'AbuseIPDB',
    description: 'AbuseIPDB blacklist of most-reported malicious IPs. Requires free API key (1000 checks/day limit).',
    type: 'api',
    url: 'https://api.abuseipdb.com/api/v2/blacklist',
    enabled: true,
    syncFrequency: 360, // 6 hours
    requiresAuth: true,
    priority: 1,
    metadata: { tags: ['ips', 'abuse', 'high-confidence', 'free-api-key', 'implemented'] },
    config: {
      format: 'json',
      timeout: 30000,
      requiresApiKey: true,
      signupUrl: 'https://www.abuseipdb.com/register',
      rateLimit: '1000/day (free tier)'
    }
  },

  // GreyNoise (Requires API Key - Placeholder)
  {
    name: 'GreyNoise',
    description: 'GreyNoise identifies benign IPs vs malicious traffic. Requires API key. PLACEHOLDER: Community API has limited bulk access.',
    type: 'api',
    url: 'https://api.greynoise.io/v3/community',
    enabled: false, // Limited functionality with Community API
    syncFrequency: 1440, // Daily
    requiresAuth: true,
    priority: 3,
    metadata: { tags: ['ips', 'noise-reduction', 'free-api-key', 'placeholder'] },
    config: {
      format: 'json',
      timeout: 30000,
      requiresApiKey: true,
      signupUrl: 'https://viz.greynoise.io/account',
      note: 'Community API requires per-IP lookup. Enterprise API needed for bulk feeds.'
    }
  },

  // CISA KEV (Known Exploited Vulnerabilities)
  {
    name: 'CISA KEV',
    description: 'CISA Known Exploited Vulnerabilities Catalog - Authoritative list of CVEs actively exploited in the wild. Updated regularly by US CISA.',
    type: 'feed',
    url: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
    enabled: true,
    syncFrequency: 1440, // Daily
    requiresAuth: false,
    priority: 1,
    metadata: { tags: ['vulnerabilities', 'cve', 'exploited', 'cisa', 'government', 'implemented'] },
    config: { format: 'json', timeout: 30000 }
  },

  // CIRCL (Computer Incident Response Center Luxembourg)
  {
    name: 'CIRCL',
    description: 'CIRCL Vulnerability Lookup - Recent CVE vulnerabilities with CVSS scores. Free public service from Luxembourg CERT.',
    type: 'api',
    url: 'https://vulnerability.circl.lu/api/last',
    enabled: true,
    syncFrequency: 1440, // Daily
    requiresAuth: false,
    priority: 2,
    metadata: { tags: ['vulnerabilities', 'cve', 'cvss', 'circl', 'cert', 'implemented'] },
    config: { format: 'json', timeout: 30000 }
  }
];

export async function seedEnhancedThreatIntelSources() {
  console.log('🌱 Seeding ENHANCED threat intelligence sources (18 total)...\n');

  let created = 0;
  let updated = 0;

  for (const source of ENHANCED_THREAT_INTEL_SOURCES) {
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
            syncFrequency: source.syncFrequency,
            requiresAuth: source.requiresAuth,
            priority: source.priority,
            metadata: source.metadata as any
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
            syncFrequency: source.syncFrequency,
            requiresAuth: source.requiresAuth,
            priority: source.priority,
            metadata: source.metadata as any
          }
        });
        created++;
        console.log(`  ✓ Created: ${source.name}`);
      }
    } catch (error: any) {
      console.error(`  ✗ Error processing ${source.name}:`, error.message);
    }
  }

  console.log(`\n✅ Enhanced threat intel sources seeded!`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Total: ${ENHANCED_THREAT_INTEL_SOURCES.length}`);

  // Summary by category
  console.log(`\n📊 Sources by category:`);
  console.log(`   Original (7): URLhaus, ThreatFox, MalwareBazaar, OpenPhish, PhishTank, AlienVault OTX, Emerging Threats`);
  console.log(`   GitHub (6): DigitalSide x2, CriticalPath x2, ThreatMon x2`);
  console.log(`   NEW API-key (5): SSL Blacklist, AbuseIPDB, GreyNoise, CISA KEV, CIRCL`);

  console.log(`\n✅ Implemented connectors (13/18):`);
  const implemented = ENHANCED_THREAT_INTEL_SOURCES.filter(s => s.metadata?.tags?.includes('implemented'));
  implemented.forEach(s => console.log(`   - ${s.name}`));

  console.log(`\n⏳ Placeholder/Disabled (5/18):`);
  const placeholders = ENHANCED_THREAT_INTEL_SOURCES.filter(s => !s.metadata?.tags?.includes('implemented'));
  placeholders.forEach(s => console.log(`   - ${s.name} ${s.enabled ? '(placeholder)' : '(disabled)'}`));
}
