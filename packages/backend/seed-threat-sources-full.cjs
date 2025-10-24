const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL }
  }
});

const SOURCES = [
  // Original 7
  { name: 'URLhaus', description: 'URLhaus malware URLs from abuse.ch', type: 'api', url: 'https://urlhaus-api.abuse.ch/v1/urls/recent/', enabled: true, syncFrequency: 5, priority: 1, metadata: { tags: ['malware', 'urls'] } },
  { name: 'ThreatFox', description: 'ThreatFox IOCs from abuse.ch', type: 'api', url: 'https://threatfox-api.abuse.ch/api/v1/', enabled: true, syncFrequency: 10, priority: 1, metadata: { tags: ['iocs', 'malware'] } },
  { name: 'MalwareBazaar', description: 'MalwareBazaar malware samples', type: 'api', url: 'https://mb-api.abuse.ch/api/v1/', enabled: true, syncFrequency: 1440, priority: 2, metadata: { tags: ['malware', 'hashes'] } },
  { name: 'OpenPhish', description: 'OpenPhish phishing URLs', type: 'feed', url: 'https://openphish.com/feed.txt', enabled: true, syncFrequency: 30, priority: 1, metadata: { tags: ['phishing', 'urls'] } },
  { name: 'PhishTank', description: 'PhishTank phishing URLs', type: 'feed', url: 'http://data.phishtank.com/data/online-valid.json', enabled: true, syncFrequency: 60, priority: 1, metadata: { tags: ['phishing', 'urls'] } },
  { name: 'AlienVault OTX', description: 'AlienVault Open Threat Exchange', type: 'api', url: 'https://otx.alienvault.com/api/v1/pulses/subscribed', enabled: true, syncFrequency: 30, priority: 2, metadata: { tags: ['threat-intelligence'] } },
  { name: 'Emerging Threats', description: 'Proofpoint Emerging Threats compromised IPs', type: 'feed', url: 'https://rules.emergingthreats.net/blockrules/compromised-ips.txt', enabled: true, syncFrequency: 1440, priority: 3, metadata: { tags: ['ips', 'malware'] } },

  // GitHub sources
  { name: 'DigitalSide - Domains', description: 'DigitalSide malware domains', type: 'feed', url: 'https://osint.digitalside.it/Threat-Intel/lists/latestdomains.txt', enabled: false, syncFrequency: 360, priority: 1, metadata: { tags: ['malware', 'domains', 'github'] } },
  { name: 'DigitalSide - IPs', description: 'DigitalSide malware IPs', type: 'feed', url: 'https://osint.digitalside.it/Threat-Intel/lists/latestips.txt', enabled: false, syncFrequency: 360, priority: 1, metadata: { tags: ['malware', 'ips', 'github'] } },
  { name: 'CriticalPath - Compromised IPs', description: 'Critical Path Security compromised IPs', type: 'feed', url: 'https://raw.githubusercontent.com/CriticalPathSecurity/Public-Intelligence-Feeds/master/compromised-ips.txt', enabled: true, syncFrequency: 720, priority: 1, metadata: { tags: ['compromised', 'ips', 'github'] } },
  { name: 'CriticalPath - Illuminate', description: 'Critical Path Security Illuminate feed', type: 'feed', url: 'https://raw.githubusercontent.com/CriticalPathSecurity/Public-Intelligence-Feeds/master/illuminate.txt', enabled: true, syncFrequency: 720, priority: 2, metadata: { tags: ['multi-type', 'github'] } },
  { name: 'ThreatMon - C2 Domains', description: 'ThreatMon C2 domains', type: 'feed', url: 'https://raw.githubusercontent.com/ThreatMon/ThreatMon-Daily-C2-Feeds/main/C2-Feeds-domains.csv', enabled: false, syncFrequency: 1440, priority: 1, metadata: { tags: ['c2', 'domains'] } },
  { name: 'ThreatMon - C2 IPs', description: 'ThreatMon C2 IPs', type: 'feed', url: 'https://raw.githubusercontent.com/ThreatMon/ThreatMon-Daily-C2-Feeds/main/C2-Feeds-ips.csv', enabled: false, syncFrequency: 1440, priority: 1, metadata: { tags: ['c2', 'ips'] } },

  // API key sources
  { name: 'SSL Blacklist', description: 'abuse.ch SSL Blacklist', type: 'feed', url: 'https://sslbl.abuse.ch/blacklist/sslblacklist.csv', enabled: true, syncFrequency: 1440, priority: 2, metadata: { tags: ['ssl', 'c2'] } },
  { name: 'AbuseIPDB', description: 'AbuseIPDB malicious IPs', type: 'api', url: 'https://api.abuseipdb.com/api/v2/blacklist', enabled: true, syncFrequency: 360, priority: 1, metadata: { tags: ['ips', 'abuse'] } },
  { name: 'GreyNoise', description: 'GreyNoise benign vs malicious traffic', type: 'api', url: 'https://api.greynoise.io/v3/community', enabled: false, syncFrequency: 1440, priority: 3, metadata: { tags: ['ips', 'noise-reduction'] } },
  { name: 'CISA KEV', description: 'CISA Known Exploited Vulnerabilities', type: 'feed', url: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', enabled: true, syncFrequency: 1440, priority: 1, metadata: { tags: ['vulnerabilities', 'cve'] } },
  { name: 'CIRCL', description: 'CIRCL Vulnerability Lookup', type: 'api', url: 'https://vulnerability.circl.lu/api/last', enabled: true, syncFrequency: 1440, priority: 2, metadata: { tags: ['vulnerabilities', 'cve'] } }
];

async function main() {
  console.log('🌱 Seeding 18 threat intelligence sources...\n');

  let created = 0;
  let updated = 0;

  for (const source of SOURCES) {
    try {
      const existing = await prisma.threatIntelSource.findFirst({
        where: { name: source.name }
      });

      if (existing) {
        await prisma.threatIntelSource.update({
          where: { id: existing.id },
          data: source
        });
        updated++;
        console.log(`  ✓ Updated: ${source.name}`);
      } else {
        await prisma.threatIntelSource.create({ data: source });
        created++;
        console.log(`  ✓ Created: ${source.name}`);
      }
    } catch (error) {
      console.error(`  ✗ Error with ${source.name}:`, error.message);
    }
  }

  console.log(`\n✅ Done! Created: ${created}, Updated: ${updated}, Total: ${SOURCES.length}`);
  await prisma.$disconnect();
}

main().catch(console.error);
