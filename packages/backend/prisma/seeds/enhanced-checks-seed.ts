/**
 * ENHANCED CHECK DEFINITIONS SEED
 * Adds sophisticated detection rules based on real-world scam patterns
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedEnhancedChecks() {
  console.log('🔍 Seeding Enhanced Check Definitions...\n');

  const enhancedChecks = [
    // ========================================================================
    // BEHAVIORAL JAVASCRIPT - DOM-LEVEL TRACKING
    // ========================================================================
    {
      name: 'Popup/Window.open Detection',
      category: 'Behavioral JavaScript',
      description: 'Detects automatic popups or window.open() calls that redirect users',
      severity: 'high',
      pointsDeducted: 12,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        checkFor: ['window.open', 'popup', 'addEventListener("load")'],
        threshold: 'any'
      }
    },
    {
      name: 'Clipboard Access Detection',
      category: 'Behavioral JavaScript',
      description: 'Detects navigator.clipboard API usage for stealing/modifying clipboard',
      severity: 'critical',
      pointsDeducted: 15,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        checkFor: ['navigator.clipboard.writeText', 'navigator.clipboard.readText', 'document.execCommand("copy")'],
        suspicious: true
      }
    },
    {
      name: 'WebSocket Connection Detection',
      category: 'Behavioral JavaScript',
      description: 'Detects WebSocket connections that may exfiltrate data',
      severity: 'medium',
      pointsDeducted: 8,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        checkFor: ['new WebSocket', 'ws://', 'wss://'],
        requireDomainMatch: false
      }
    },
    {
      name: 'Hidden Timer Detection',
      category: 'Behavioral JavaScript',
      description: 'Detects setTimeout/setInterval with suspicious delayed actions',
      severity: 'medium',
      pointsDeducted: 7,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        checkFor: ['setTimeout', 'setInterval'],
        delayThreshold: 3000,
        actionTypes: ['redirect', 'form.submit', 'location.href']
      }
    },

    // ========================================================================
    // SOCIAL ENGINEERING - UX CUES
    // ========================================================================
    {
      name: 'Fake Browser Chrome Detection',
      category: 'Social Engineering Indicators',
      description: 'Detects fake browser UI elements (address bar, security indicators)',
      severity: 'critical',
      pointsDeducted: 18,
      enabled: true,
      automationCapable: true,
      requiresManualReview: true,
      apiIntegration: 'puppeteer',
      config: {
        checkFor: ['fake-chrome', 'browser-ui', 'address-bar-overlay', 'security-badge'],
        cssPatterns: ['position: fixed', 'z-index: 9999', 'top: 0']
      }
    },
    {
      name: 'Fake CAPTCHA Detection',
      category: 'Social Engineering Indicators',
      description: 'Detects fake CAPTCHA/verification prompts to trick users',
      severity: 'high',
      pointsDeducted: 15,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        keywords: ['verify you are human', 'click allow to continue', 'enable notifications', 'prove you are not a robot'],
        excludeLegit: ['recaptcha.net', 'hcaptcha.com']
      }
    },
    {
      name: 'Overlayed Warning Detection',
      category: 'Social Engineering Indicators',
      description: 'Detects fake security warnings/alerts overlayed on page',
      severity: 'critical',
      pointsDeducted: 20,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        keywords: ['your computer is infected', 'virus detected', 'call microsoft', 'system alert', 'security breach'],
        cssPatterns: ['modal', 'overlay', 'alert']
      }
    },

    // ========================================================================
    // FINANCIAL FRAUD - PAYMENT IMPERSONATION
    // ========================================================================
    {
      name: 'Payment Processor Impersonation',
      category: 'Financial Fraud',
      description: 'Detects fake PayPal, Stripe, Square payment forms',
      severity: 'critical',
      pointsDeducted: 25,
      enabled: true,
      automationCapable: true,
      requiresManualReview: true,
      apiIntegration: 'puppeteer',
      config: {
        keywords: ['paypal', 'stripe', 'square', 'payment', 'checkout'],
        verifyDomain: true,
        legitimateDomains: ['paypal.com', 'stripe.com', 'squareup.com']
      }
    },
    {
      name: 'Fake POS Terminal Detection',
      category: 'Financial Fraud',
      description: 'Detects fake point-of-sale or card processing interfaces',
      severity: 'critical',
      pointsDeducted: 22,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        formFields: ['card number', 'cvv', 'expiry', 'billing address'],
        requiredCount: 3,
        missingSSL: true
      }
    },
    {
      name: 'Phishing Invoice Detection',
      category: 'Financial Fraud',
      description: 'Detects fake invoices mimicking known brands',
      severity: 'high',
      pointsDeducted: 18,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        keywords: ['invoice', 'payment due', 'overdue', 'account suspended', 'verify payment'],
        brandNames: ['amazon', 'ebay', 'apple', 'microsoft']
      }
    },

    // ========================================================================
    // IDENTITY THEFT - FORM STRUCTURE ANALYSIS
    // ========================================================================
    {
      name: 'ID/Passport Upload Form Detection',
      category: 'Identity Theft',
      description: 'Detects forms requesting government ID or passport uploads',
      severity: 'critical',
      pointsDeducted: 25,
      enabled: true,
      automationCapable: true,
      requiresManualReview: true,
      apiIntegration: 'puppeteer',
      config: {
        inputTypes: ['file'],
        labels: ['upload id', 'passport', 'driver license', 'government id', 'identity document'],
        suspicious: true
      }
    },
    {
      name: 'Selfie/Verification Photo Request',
      category: 'Identity Theft',
      description: 'Detects forms requesting selfie or verification photos',
      severity: 'high',
      pointsDeducted: 18,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        keywords: ['upload selfie', 'take a photo', 'verification photo', 'hold your id', 'face verification'],
        context: 'non-kyc-site'
      }
    },

    // ========================================================================
    // TECHNICAL EXPLOITS
    // ========================================================================
    {
      name: 'Clickjacking Detection',
      category: 'Advanced Threat Detection',
      description: 'Detects transparent iframes overlaying legitimate content',
      severity: 'critical',
      pointsDeducted: 20,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        checkFor: ['iframe[style*="opacity: 0"]', 'iframe[style*="visibility: hidden"]', 'iframe[style*="position: absolute"]'],
        cssPatterns: ['z-index', 'pointer-events']
      }
    },
    {
      name: 'Iframe Overlay Detection',
      category: 'Advanced Threat Detection',
      description: 'Detects iframes positioned over clickable elements',
      severity: 'high',
      pointsDeducted: 15,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        checkFor: ['iframe'],
        cssChecks: ['position: absolute', 'position: fixed', 'z-index > 1000']
      }
    },
    {
      name: 'Protocol Handler Abuse Detection',
      category: 'Advanced Threat Detection',
      description: 'Detects abusive use of mailto:, tel:, or custom protocol handlers',
      severity: 'medium',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'axios',
      config: {
        protocols: ['mailto:', 'tel:', 'skype:', 'whatsapp:', 'bitcoin:'],
        contextCheck: 'unexpected-usage'
      }
    },

    // ========================================================================
    // LANGUAGE & CONTENT DETECTION
    // ========================================================================
    {
      name: 'Foreign Language Script Detection',
      category: 'Content Analysis',
      description: 'Detects non-English scripts in JavaScript (common in scam reuse)',
      severity: 'medium',
      pointsDeducted: 8,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'axios',
      config: {
        detectLanguages: ['zh', 'ru', 'ar', 'vi', 'th'],
        inScripts: true,
        inComments: true
      }
    },
    {
      name: 'Invitation Code Detection',
      category: 'Social Engineering Indicators',
      description: 'Detects login pages with invitation/referral code fields (scam pattern)',
      severity: 'medium',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        formFields: ['invitation code', 'referral code', 'invite code', 'promo code'],
        contextCheck: 'login-page',
        threshold: 1
      }
    },

    // ========================================================================
    // BRAND IMPERSONATION
    // ========================================================================
    {
      name: 'Doppelganger Domain Detection',
      category: 'Domain Age and Registration',
      description: 'Detects domains visually similar to known brands (typosquatting)',
      severity: 'critical',
      pointsDeducted: 25,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'node:dns',
      config: {
        algorithms: ['levenshtein', 'homoglyph', 'keyboard-proximity'],
        brandList: ['amazon', 'paypal', 'microsoft', 'apple', 'google', 'facebook', 'instagram', 'coinbase', 'binance'],
        threshold: 2
      }
    },
    {
      name: 'Logo/Brand Asset Theft Detection',
      category: 'Brand Impersonation',
      description: 'Detects use of official brand logos without authorization',
      severity: 'high',
      pointsDeducted: 18,
      enabled: true,
      automationCapable: true,
      requiresManualReview: true,
      apiIntegration: 'puppeteer',
      config: {
        checkImages: true,
        verifyDomain: true,
        brands: ['paypal', 'amazon', 'apple', 'microsoft', 'bank logos']
      }
    },

    // ========================================================================
    // TRUST GRAPH & NETWORK ANALYSIS
    // ========================================================================
    {
      name: 'ASN Reputation Check',
      category: 'DNS Record Analysis',
      description: 'Checks hosting provider reputation (bulletproof hosting detection)',
      severity: 'high',
      pointsDeducted: 15,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'abuseipdb',
      apiEndpoint: 'https://api.abuseipdb.com/api/v2/check',
      credentialsRequired: true,
      config: {
        checkASN: true,
        blacklistedASNs: [],
        reputationThreshold: 75
      }
    },
    {
      name: 'IP Clustering Detection',
      category: 'DNS Record Analysis',
      description: 'Detects if site shares IP with known malicious domains',
      severity: 'high',
      pointsDeducted: 12,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'virustotal',
      config: {
        checkSharedIP: true,
        maliciousThreshold: 3
      }
    },
    {
      name: 'Reverse DNS Correlation',
      category: 'DNS Record Analysis',
      description: 'Verifies reverse DNS matches forward lookup (hosting integrity)',
      severity: 'medium',
      pointsDeducted: 8,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'node:dns',
      config: {
        verifyPTR: true,
        mismatchPenalty: true
      }
    }
  ];

  let addedCount = 0;
  let skippedCount = 0;

  for (const check of enhancedChecks) {
    try {
      await prisma.checkType.upsert({
        where: {
          name_category: {
            name: check.name,
            category: check.category
          }
        },
        update: check,
        create: check
      });
      console.log(`✅ ${check.name} (${check.category})`);
      addedCount++;
    } catch (error) {
      console.log(`⚠️  Skipped ${check.name}: ${error}`);
      skippedCount++;
    }
  }

  console.log(`\n📊 Enhanced Checks Summary:`);
  console.log(`   Added/Updated: ${addedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Total: ${enhancedChecks.length}`);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       ENHANCED CHECK DEFINITIONS SEED                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    await seedEnhancedChecks();

    const totalChecks = await prisma.checkType.count();
    console.log(`\n✅ Total Check Types in Database: ${totalChecks}\n`);
  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
