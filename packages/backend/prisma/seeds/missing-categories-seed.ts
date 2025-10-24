/**
 * Missing Categories Check Definitions Seed
 *
 * Seeds check definitions for categories that don't have any yet:
 * - Trust Graph & Network
 * - Data Protection & Privacy
 * - Email Security (SPF/DMARC/DKIM)
 * - Legal & Compliance
 * - Security Headers
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedMissingCategories() {
  console.log('🔍 Seeding missing category check definitions...');

  const checkTypes = [
    // ═══════════════════════════════════════════════════════════════════════
    // Trust Graph & Network (6 checks)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'Domain Backlink Analysis',
      category: 'Trust Graph & Network',
      description: 'Analyze quality and quantity of backlinks pointing to the domain',
      severity: 'medium',
      pointsDeducted: 8,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'moz-api',
      apiEndpoint: 'https://lsapi.seomoz.com/v2/url_metrics',
      credentialsRequired: true,
      config: {
        apiKeyEnvVar: 'MOZ_ACCESS_ID',
        apiSecretEnvVar: 'MOZ_SECRET_KEY',
        metrics: ['domain_authority', 'spam_score', 'root_domains_to_root_domain'],
        thresholds: {
          minDomainAuthority: 20,
          maxSpamScore: 30,
          minBacklinks: 5
        }
      }
    },
    {
      name: 'Alexa/Similarweb Traffic Rank',
      category: 'Trust Graph & Network',
      description: 'Check website traffic ranking and popularity metrics',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'similarweb-api',
      apiEndpoint: 'https://api.similarweb.com/v1/website/{domain}/total-traffic-and-engagement/visits',
      credentialsRequired: true,
      config: {
        apiKeyEnvVar: 'SIMILARWEB_API_KEY',
        suspiciousRankThreshold: 1000000,
        checkGlobalRank: true,
        checkCountryRank: true
      }
    },
    {
      name: 'Hosting Provider Reputation',
      category: 'Trust Graph & Network',
      description: 'Analyze reputation of hosting provider and data center',
      severity: 'medium',
      pointsDeducted: 7,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'ipinfo',
      apiEndpoint: 'https://ipinfo.io/{ip}/json',
      credentialsRequired: true,
      config: {
        apiKeyEnvVar: 'IPINFO_API_KEY',
        suspiciousHosters: ['bulletproof', 'offshore', 'privacy'],
        checkASN: true,
        checkCompany: true,
        checkCountry: true
      }
    },
    {
      name: 'Historical Domain Changes',
      category: 'Trust Graph & Network',
      description: 'Track domain ownership changes, IP changes, and content modifications',
      severity: 'high',
      pointsDeducted: 12,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'wayback-machine',
      apiEndpoint: 'https://archive.org/wayback/available',
      credentialsRequired: false,
      config: {
        checkOwnershipChanges: true,
        checkIPChanges: true,
        checkContentChanges: true,
        suspiciousChangeWindow: 30 // days
      }
    },
    {
      name: 'Social Media Presence',
      category: 'Trust Graph & Network',
      description: 'Verify legitimate social media accounts and followers',
      severity: 'low',
      pointsDeducted: 4,
      enabled: true,
      automationCapable: false,
      requiresManualReview: true,
      apiIntegration: null,
      config: {
        platforms: ['facebook', 'twitter', 'linkedin', 'instagram'],
        minFollowers: 100,
        checkVerification: true
      }
    },
    {
      name: 'CDN Usage Analysis',
      category: 'Trust Graph & Network',
      description: 'Identify CDN usage and reputation (Cloudflare, Akamai, etc.)',
      severity: 'low',
      pointsDeducted: 3,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'node:dns',
      config: {
        legitimateCDNs: ['cloudflare', 'akamai', 'fastly', 'cloudfront'],
        checkCNAME: true,
        checkSSL: true
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Data Protection & Privacy (8 checks)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'Privacy Policy Presence',
      category: 'Data Protection & Privacy',
      description: 'Check if website has a privacy policy and verify its completeness',
      severity: 'high',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        requiredKeywords: ['privacy policy', 'data collection', 'cookies', 'third parties'],
        minLength: 500,
        checkLastUpdated: true
      }
    },
    {
      name: 'GDPR Compliance Check',
      category: 'Data Protection & Privacy',
      description: 'Verify GDPR compliance indicators (cookie consent, data rights, etc.)',
      severity: 'high',
      pointsDeducted: 12,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        requiredElements: ['cookie-consent', 'gdpr-notice', 'data-rights'],
        checkEU: true,
        requiredRights: ['access', 'rectification', 'erasure', 'portability']
      }
    },
    {
      name: 'Cookie Consent Banner',
      category: 'Data Protection & Privacy',
      description: 'Verify proper cookie consent implementation',
      severity: 'medium',
      pointsDeducted: 8,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        requiredActions: ['accept', 'reject', 'customize'],
        checkBeforeCollection: true,
        allowGranularControl: true
      }
    },
    {
      name: 'Excessive Data Collection',
      category: 'Data Protection & Privacy',
      description: 'Detect forms collecting unnecessary personal information',
      severity: 'high',
      pointsDeducted: 15,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        suspiciousFields: ['ssn', 'passport', 'drivers_license', 'credit_card'],
        checkJustification: true,
        maxFieldCount: 15
      }
    },
    {
      name: 'Third-Party Tracker Analysis',
      category: 'Data Protection & Privacy',
      description: 'Identify excessive third-party tracking scripts',
      severity: 'medium',
      pointsDeducted: 7,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        maxTrackers: 10,
        knownTrackers: ['google-analytics', 'facebook-pixel', 'hotjar'],
        checkDisclosure: true
      }
    },
    {
      name: 'Data Breach History',
      category: 'Data Protection & Privacy',
      description: 'Check if domain has history of data breaches',
      severity: 'critical',
      pointsDeducted: 25,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'haveibeenpwned',
      apiEndpoint: 'https://haveibeenpwned.com/api/v3/breaches',
      credentialsRequired: true,
      config: {
        apiKeyEnvVar: 'HIBP_API_KEY',
        checkDomain: true,
        checkRecent: true,
        recentWindow: 365 // days
      }
    },
    {
      name: 'Unencrypted Data Transmission',
      category: 'Data Protection & Privacy',
      description: 'Detect forms submitting sensitive data over HTTP',
      severity: 'critical',
      pointsDeducted: 20,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        checkFormSubmission: true,
        sensitiveFields: ['password', 'email', 'phone', 'address'],
        requireHTTPS: true
      }
    },
    {
      name: 'Data Retention Policy',
      category: 'Data Protection & Privacy',
      description: 'Check if website discloses data retention periods',
      severity: 'medium',
      pointsDeducted: 6,
      enabled: true,
      automationCapable: false,
      requiresManualReview: true,
      apiIntegration: null,
      config: {
        requiredDisclosures: ['retention-period', 'deletion-process'],
        checkAutomatedDeletion: true
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Email Security (SPF/DMARC/DKIM) (4 checks)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'SPF Record Validation',
      category: 'Email Security (SPF/DMARC/DKIM)',
      description: 'Verify Sender Policy Framework (SPF) DNS record exists and is properly configured',
      severity: 'high',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'node:dns',
      config: {
        checkSPFRecord: true,
        allowedMechanisms: ['ip4', 'ip6', 'include', 'a', 'mx'],
        maxDNSLookups: 10,
        requireAll: '-all' // Hard fail
      }
    },
    {
      name: 'DMARC Policy Check',
      category: 'Email Security (SPF/DMARC/DKIM)',
      description: 'Check Domain-based Message Authentication, Reporting & Conformance policy',
      severity: 'high',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'node:dns',
      config: {
        checkDMARCRecord: true,
        lookupHost: '_dmarc',
        requiredTags: ['v', 'p'],
        recommendedPolicy: 'reject',
        checkReporting: true
      }
    },
    {
      name: 'DKIM Signature Verification',
      category: 'Email Security (SPF/DMARC/DKIM)',
      description: 'Verify DomainKeys Identified Mail (DKIM) signature configuration',
      severity: 'medium',
      pointsDeducted: 8,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'node:dns',
      config: {
        checkDKIMRecord: true,
        commonSelectors: ['default', 'google', 'k1', 'selector1'],
        requirePublicKey: true,
        minKeyLength: 1024
      }
    },
    {
      name: 'Email Spoofing Vulnerability',
      category: 'Email Security (SPF/DMARC/DKIM)',
      description: 'Test domain for email spoofing vulnerabilities',
      severity: 'critical',
      pointsDeducted: 15,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'node:dns',
      config: {
        testSPF: true,
        testDMARC: true,
        testDKIM: true,
        simulateSpoofing: false // Don't actually send emails
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Legal & Compliance (7 checks)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'Terms of Service Presence',
      category: 'Legal & Compliance',
      description: 'Verify website has terms of service/terms and conditions',
      severity: 'high',
      pointsDeducted: 8,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        requiredLinks: ['terms', 'terms-of-service', 'tos', 'terms-and-conditions'],
        minLength: 300,
        checkLastUpdated: true
      }
    },
    {
      name: 'CCPA Compliance (California)',
      category: 'Legal & Compliance',
      description: 'Check California Consumer Privacy Act compliance',
      severity: 'high',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        requiredLinks: ['do-not-sell', 'ccpa', 'california-privacy'],
        checkOptOut: true,
        checkDataAccess: true
      }
    },
    {
      name: 'COPPA Compliance (Children)',
      category: 'Legal & Compliance',
      description: "Verify Children's Online Privacy Protection Act compliance if targeting children",
      severity: 'critical',
      pointsDeducted: 20,
      enabled: true,
      automationCapable: false,
      requiresManualReview: true,
      apiIntegration: null,
      config: {
        ageGateRequired: true,
        parentalConsentRequired: true,
        targetAge: 13
      }
    },
    {
      name: 'Gambling/Casino Content',
      category: 'Legal & Compliance',
      description: 'Detect gambling or casino content with age verification',
      severity: 'high',
      pointsDeducted: 12,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        keywords: ['casino', 'gambling', 'poker', 'slots', 'bet'],
        requireAgeGate: true,
        checkLicense: true
      }
    },
    {
      name: 'Adult Content Detection',
      category: 'Legal & Compliance',
      description: 'Detect adult/explicit content without proper age verification',
      severity: 'critical',
      pointsDeducted: 18,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'nudenet',
      config: {
        checkImages: true,
        checkText: true,
        requireAgeGate: true,
        threshold: 0.8
      }
    },
    {
      name: 'Jurisdiction Risk Analysis',
      category: 'Legal & Compliance',
      description: 'Analyze legal jurisdiction and associated risks',
      severity: 'medium',
      pointsDeducted: 7,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'whois-json',
      config: {
        highRiskCountries: ['CN', 'RU', 'KP', 'IR'],
        checkRegistrantCountry: true,
        checkHostingCountry: true,
        checkCompanyRegistration: true
      }
    },
    {
      name: 'Cryptocurrency/Financial Licensing',
      category: 'Legal & Compliance',
      description: 'Verify financial service licensing for crypto/trading platforms',
      severity: 'critical',
      pointsDeducted: 22,
      enabled: true,
      automationCapable: false,
      requiresManualReview: true,
      apiIntegration: null,
      config: {
        requiredLicenses: ['MSB', 'FinCEN', 'FCA', 'SEC'],
        checkDisclosure: true,
        checkRegistration: true
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Security Headers (Already exists in HTTP Security Headers category)
    // Map these to "SSL/TLS Security" category
    // ═══════════════════════════════════════════════════════════════════════
  ];

  let created = 0;
  for (const checkType of checkTypes) {
    try {
      await prisma.checkType.upsert({
        where: {
          name_category: {
            name: checkType.name,
            category: checkType.category
          }
        },
        create: checkType,
        update: checkType
      });
      console.log(`  ✓ ${checkType.name}`);
      created++;
    } catch (error: any) {
      console.error(`  ✗ Failed to seed ${checkType.name}:`, error.message);
    }
  }

  console.log(`\n✅ Missing categories seed complete: ${created}/${checkTypes.length} definitions created\n`);

  // Show summary
  const totalChecks = await prisma.checkType.count();
  console.log(`📊 Total Check Types in Database: ${totalChecks}`);

  const byCategory = await prisma.checkType.groupBy({
    by: ['category'],
    _count: true
  });

  console.log('\n📋 Checks by Category:');
  byCategory.forEach((cat: any) => {
    console.log(`   ${cat.category}: ${cat._count} checks`);
  });
}

seedMissingCategories()
  .catch((error) => {
    console.error('Error seeding missing categories:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
