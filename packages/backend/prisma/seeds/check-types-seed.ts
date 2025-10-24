/**
 * Check Types Seed - Comprehensive URL Scan Check Definitions
 *
 * Populates all 17 scan categories with actual working check definitions
 * Includes API integration details, credentials, and configuration
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCheckTypes() {
  console.log('🔍 Seeding comprehensive check type definitions...');

  const checkTypes = [
    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 1: SSL/TLS Certificate Validation (30 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'SSL Certificate Validity Check',
      category: 'SSL/TLS Certificate Validation',
      description: 'Verify SSL certificate is valid and not expired',
      severity: 'high',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'node:tls',
      config: {
        checkExpiry: true,
        checkChain: true,
        allowSelfSigned: false,
        minDaysBeforeExpiry: 30
      }
    },
    {
      name: 'Certificate Chain Validation',
      category: 'SSL/TLS Certificate Validation',
      description: 'Validate complete certificate chain to trusted root CA',
      severity: 'high',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'node:tls',
      config: {
        checkIntermediateCAs: true,
        verifyRootCA: true
      }
    },
    {
      name: 'SSL Protocol Version Check',
      category: 'SSL/TLS Certificate Validation',
      description: 'Ensure modern TLS version (1.2 or 1.3) is used',
      severity: 'medium',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'node:tls',
      config: {
        minimumVersion: 'TLSv1.2',
        recommended: 'TLSv1.3',
        blacklist: ['SSLv2', 'SSLv3', 'TLSv1.0', 'TLSv1.1']
      }
    },
    {
      name: 'Certificate Revocation Check (CRL/OCSP)',
      category: 'SSL/TLS Certificate Validation',
      description: 'Check if certificate has been revoked',
      severity: 'high',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'node:tls',
      config: {
        checkOCSP: true,
        checkCRL: true,
        timeout: 5000
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 2: Domain Age and Registration (25 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'WHOIS Domain Age Check',
      category: 'Domain Age and Registration',
      description: 'Check domain registration age (newer domains more suspicious)',
      severity: 'medium',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'whois-json',
      apiEndpoint: 'https://www.whoisxmlapi.com/whoisserver/WhoisService',
      credentialsRequired: true,
      config: {
        apiKeyEnvVar: 'WHOIS_API_KEY',
        suspiciousIfYoungerThanDays: 30,
        highRiskIfYoungerThanDays: 7
      }
    },
    {
      name: 'Domain Registrar Verification',
      category: 'Domain Age and Registration',
      description: 'Verify domain registrar is reputable',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'whois-json',
      config: {
        blacklistedRegistrars: ['suspicious-registrar.com'],
        trustedRegistrars: ['GoDaddy', 'Namecheap', 'Google Domains', 'Cloudflare']
      }
    },
    {
      name: 'Domain Expiry Date Check',
      category: 'Domain Age and Registration',
      description: 'Check if domain is close to expiration (phishing sites often short-lived)',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'whois-json',
      config: {
        suspiciousIfExpiresWithinDays: 30
      }
    },
    {
      name: 'Privacy Protection Check',
      category: 'Domain Age and Registration',
      description: 'Flag if WHOIS privacy protection is enabled (common for malicious sites)',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'whois-json',
      config: {
        flagPrivacyProtection: true
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 3: DNS Record Analysis (30 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'DNS A Record Lookup',
      category: 'DNS Record Analysis',
      description: 'Resolve domain to IP address and validate',
      severity: 'high',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'node:dns',
      config: {
        timeout: 5000,
        checkMultipleRecords: true
      }
    },
    {
      name: 'DNS MX Record Check',
      category: 'DNS Record Analysis',
      description: 'Check if domain has valid email (MX) records',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'node:dns',
      config: {
        expectMXRecords: true
      }
    },
    {
      name: 'DNSSEC Validation',
      category: 'DNS Record Analysis',
      description: 'Verify DNSSEC is properly configured',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'google-dns-api',
      apiEndpoint: 'https://dns.google/resolve',
      config: {
        checkDNSSEC: true
      }
    },
    {
      name: 'DNS Blacklist Check (RBL)',
      category: 'DNS Record Analysis',
      description: 'Check if domain/IP is on DNS blacklists',
      severity: 'high',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'custom',
      config: {
        blacklists: [
          'zen.spamhaus.org',
          'bl.spamcop.net',
          'dnsbl.sorbs.net'
        ],
        timeout: 3000
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 4: URL Structure Pattern Analysis (35 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'Suspicious TLD Detection',
      category: 'URL Structure Pattern Analysis',
      description: 'Flag suspicious top-level domains often used for phishing',
      severity: 'medium',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'builtin',
      config: {
        suspiciousTLDs: ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work', '.click', '.link']
      }
    },
    {
      name: 'URL Length Analysis',
      category: 'URL Structure Pattern Analysis',
      description: 'Flag extremely long URLs (often used to hide malicious domains)',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'builtin',
      config: {
        maxSafeLength: 75,
        suspiciousLength: 100
      }
    },
    {
      name: 'IP Address in URL Check',
      category: 'URL Structure Pattern Analysis',
      description: 'Flag URLs using IP addresses instead of domains',
      severity: 'high',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'builtin',
      config: {
        allowLocalhost: true,
        allowPrivateIPs: false
      }
    },
    {
      name: 'Subdomain Depth Analysis',
      category: 'URL Structure Pattern Analysis',
      description: 'Flag excessive subdomain levels (e.g., a.b.c.d.e.example.com)',
      severity: 'medium',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'builtin',
      config: {
        maxSafeSubdomains: 3,
        suspiciousSubdomains: 5
      }
    },
    {
      name: 'Homoglyph/IDN Attack Detection',
      category: 'URL Structure Pattern Analysis',
      description: 'Detect internationalized domain names used to impersonate legitimate sites',
      severity: 'high',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'builtin',
      config: {
        checkPunycode: true,
        flagMixedScripts: true
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 5: Content Security Policy (CSP) (30 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'CSP Header Presence Check',
      category: 'Content Security Policy (CSP)',
      description: 'Verify Content-Security-Policy header exists',
      severity: 'medium',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'http-fetch',
      config: {
        headerName: 'Content-Security-Policy',
        alsoCheck: ['Content-Security-Policy-Report-Only']
      }
    },
    {
      name: 'CSP Unsafe Directives Check',
      category: 'Content Security Policy (CSP)',
      description: 'Flag unsafe CSP directives (unsafe-inline, unsafe-eval)',
      severity: 'medium',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'http-fetch',
      config: {
        flagUnsafeInline: true,
        flagUnsafeEval: true,
        flagWildcardSources: true
      }
    },
    {
      name: 'CSP Frame Ancestors Check',
      category: 'Content Security Policy (CSP)',
      description: 'Verify frame-ancestors directive to prevent clickjacking',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'http-fetch',
      config: {
        checkFrameAncestors: true
      }
    },
    {
      name: 'CSP Default-Src Directive',
      category: 'Content Security Policy (CSP)',
      description: 'Check for restrictive default-src directive',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'http-fetch',
      config: {
        preferSelfOnly: true
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 6: HTTP Security Headers (35 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'HSTS Header Check',
      category: 'HTTP Security Headers',
      description: 'Verify Strict-Transport-Security header',
      severity: 'high',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'http-fetch',
      config: {
        minMaxAge: 31536000, // 1 year
        checkIncludeSubDomains: true,
        checkPreload: true
      }
    },
    {
      name: 'X-Frame-Options Header',
      category: 'HTTP Security Headers',
      description: 'Check for clickjacking protection',
      severity: 'medium',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'http-fetch',
      config: {
        acceptedValues: ['DENY', 'SAMEORIGIN']
      }
    },
    {
      name: 'X-Content-Type-Options Header',
      category: 'HTTP Security Headers',
      description: 'Verify nosniff protection against MIME type confusion',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'http-fetch',
      config: {
        expectedValue: 'nosniff'
      }
    },
    {
      name: 'Referrer-Policy Header',
      category: 'HTTP Security Headers',
      description: 'Check for privacy-preserving referrer policy',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'http-fetch',
      config: {
        recommendedPolicies: ['no-referrer', 'strict-origin-when-cross-origin']
      }
    },
    {
      name: 'Permissions-Policy Header',
      category: 'HTTP Security Headers',
      description: 'Verify Feature-Policy/Permissions-Policy for browser features',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'http-fetch',
      config: {
        checkGeolocation: true,
        checkCamera: true,
        checkMicrophone: true
      }
    },
    {
      name: 'X-XSS-Protection Header',
      category: 'HTTP Security Headers',
      description: 'Check for legacy XSS protection header',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'http-fetch',
      config: {
        expectedValue: '1; mode=block'
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 7: Redirect Chain Analysis (25 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'Redirect Count Check',
      category: 'Redirect Chain Analysis',
      description: 'Flag excessive redirects (common in phishing)',
      severity: 'medium',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'http-fetch',
      config: {
        maxSafeRedirects: 3,
        suspiciousRedirects: 5
      }
    },
    {
      name: 'Cross-Domain Redirect Detection',
      category: 'Redirect Chain Analysis',
      description: 'Detect redirects to different domains',
      severity: 'medium',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'http-fetch',
      config: {
        flagCrossDomain: true,
        allowSubdomains: true
      }
    },
    {
      name: 'Open Redirect Vulnerability Check',
      category: 'Redirect Chain Analysis',
      description: 'Test for open redirect vulnerabilities',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: true,
      apiIntegration: 'custom',
      config: {
        testPayloads: ['?url=http://evil.com', '?redirect=//evil.com']
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 8: Behavioral JavaScript Analysis (40 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'Obfuscated JavaScript Detection',
      category: 'Behavioral JavaScript',
      description: 'Detect heavily obfuscated or packed JavaScript code',
      severity: 'high',
      pointsDeducted: 15,
      enabled: true,
      automationCapable: true,
      requiresManualReview: true,
      apiIntegration: 'puppeteer',
      config: {
        checkForPackers: ['eval', 'Function', 'unescape'],
        entropyThreshold: 4.5,
        minifiedRatio: 0.8
      }
    },
    {
      name: 'Malicious JavaScript Patterns',
      category: 'Behavioral JavaScript',
      description: 'Scan for known malicious JavaScript patterns (crypto miners, keyloggers)',
      severity: 'critical',
      pointsDeducted: 15,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        patterns: [
          'document.addEventListener.*keypress',
          'CryptoNight',
          'coinhive',
          'eval\\(atob\\(',
          'fromCharCode'
        ]
      }
    },
    {
      name: 'External Script Loading Analysis',
      category: 'Behavioral JavaScript',
      description: 'Analyze external scripts loaded by the page',
      severity: 'medium',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        maxExternalScripts: 20,
        checkScriptIntegrity: true
      }
    },
    {
      name: 'Dynamic DOM Manipulation Check',
      category: 'Behavioral JavaScript',
      description: 'Detect suspicious DOM manipulation (hidden iframes, fake overlays)',
      severity: 'high',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: true,
      apiIntegration: 'puppeteer',
      config: {
        detectHiddenIframes: true,
        detectOverlays: true,
        detectDynamicForms: true
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 9: Form and Input Analysis (35 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'Credential Harvesting Form Detection',
      category: 'Form and Input Analysis',
      description: 'Detect forms requesting sensitive information',
      severity: 'critical',
      pointsDeducted: 15,
      enabled: true,
      automationCapable: true,
      requiresManualReview: true,
      apiIntegration: 'puppeteer',
      config: {
        sensitiveFields: ['password', 'ssn', 'credit-card', 'cvv', 'pin'],
        checkFormAction: true,
        flagNonHTTPS: true
      }
    },
    {
      name: 'Form Submission Endpoint Analysis',
      category: 'Form and Input Analysis',
      description: 'Verify form submission goes to legitimate endpoint',
      severity: 'high',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        checkCrossDomain: true,
        checkHTTPS: true
      }
    },
    {
      name: 'Hidden Form Fields Check',
      category: 'Form and Input Analysis',
      description: 'Detect hidden input fields with suspicious values',
      severity: 'medium',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        maxHiddenFields: 10
      }
    },
    {
      name: 'Autocomplete Attribute Check',
      category: 'Form and Input Analysis',
      description: 'Verify sensitive fields have autocomplete disabled',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        sensitiveFields: ['password', 'credit-card']
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 10: External Resource Loading (30 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'Third-Party Resource Audit',
      category: 'External Resource Loading',
      description: 'Catalog all third-party resources and flag suspicious ones',
      severity: 'medium',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        maxThirdPartyResources: 30,
        blacklistedDomains: []
      }
    },
    {
      name: 'Subresource Integrity (SRI) Check',
      category: 'External Resource Loading',
      description: 'Verify external scripts/styles have integrity attributes',
      severity: 'medium',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        checkScripts: true,
        checkStylesheets: true
      }
    },
    {
      name: 'CDN Usage Analysis',
      category: 'External Resource Loading',
      description: 'Verify resources loaded from reputable CDNs',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        trustedCDNs: ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com']
      }
    },
    {
      name: 'Mixed Content Detection',
      category: 'External Resource Loading',
      description: 'Detect HTTP resources loaded on HTTPS pages',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        flagMixedContent: true
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 11: Cookie and Storage Analysis (25 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'Cookie Security Attributes',
      category: 'Cookie and Storage Analysis',
      description: 'Verify cookies have Secure, HttpOnly, SameSite attributes',
      severity: 'medium',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        checkSecure: true,
        checkHttpOnly: true,
        checkSameSite: true
      }
    },
    {
      name: 'Excessive Cookie Usage',
      category: 'Cookie and Storage Analysis',
      description: 'Flag excessive cookie setting (tracking)',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        maxCookies: 20
      }
    },
    {
      name: 'LocalStorage Usage Analysis',
      category: 'Cookie and Storage Analysis',
      description: 'Check for sensitive data in localStorage',
      severity: 'medium',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        sensitivePatterns: ['token', 'password', 'api_key', 'secret']
      }
    },
    {
      name: 'Third-Party Cookie Check',
      category: 'Cookie and Storage Analysis',
      description: 'Detect third-party tracking cookies',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        flagThirdPartyCookies: true
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 12: Browser Fingerprinting Detection (25 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'Canvas Fingerprinting Detection',
      category: 'Browser Fingerprinting Detection',
      description: 'Detect canvas-based browser fingerprinting',
      severity: 'medium',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        detectCanvasAccess: true
      }
    },
    {
      name: 'WebGL Fingerprinting Detection',
      category: 'Browser Fingerprinting Detection',
      description: 'Detect WebGL-based fingerprinting',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        detectWebGLAccess: true
      }
    },
    {
      name: 'Font Enumeration Check',
      category: 'Browser Fingerprinting Detection',
      description: 'Detect attempts to enumerate installed fonts',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        detectFontAccess: true
      }
    },
    {
      name: 'Battery Status API Abuse',
      category: 'Browser Fingerprinting Detection',
      description: 'Detect use of Battery Status API for fingerprinting',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        detectBatteryAPI: true
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 13: Social Engineering Indicators (40 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'Urgency Language Detection',
      category: 'Social Engineering Indicators',
      description: 'Detect urgent/threatening language common in phishing',
      severity: 'high',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: true,
      apiIntegration: 'nlp-analysis',
      config: {
        keywords: [
          'urgent', 'immediate action', 'suspended', 'verify now',
          'limited time', 'act now', 'expire', 'locked'
        ]
      }
    },
    {
      name: 'Brand Impersonation Check',
      category: 'Social Engineering Indicators',
      description: 'Detect impersonation of popular brands',
      severity: 'critical',
      pointsDeducted: 15,
      enabled: true,
      automationCapable: true,
      requiresManualReview: true,
      apiIntegration: 'vision-api',
      apiEndpoint: 'https://vision.googleapis.com/v1/images:annotate',
      credentialsRequired: true,
      config: {
        apiKeyEnvVar: 'GOOGLE_VISION_API_KEY',
        brands: ['PayPal', 'Amazon', 'Microsoft', 'Google', 'Apple', 'Facebook']
      }
    },
    {
      name: 'Fake Login Page Detection',
      category: 'Social Engineering Indicators',
      description: 'Detect pages mimicking legitimate login forms',
      severity: 'critical',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: true,
      apiIntegration: 'puppeteer',
      config: {
        checkLoginForms: true,
        compareBrandLogos: true
      }
    },
    {
      name: 'Spelling/Grammar Quality Check',
      category: 'Social Engineering Indicators',
      description: 'Flag poor spelling/grammar (common in phishing)',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'grammar-check-api',
      config: {
        minQualityScore: 70
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 14: Content Analysis (35 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'Pornographic Content Detection',
      category: 'Content Analysis',
      description: 'Detect adult/pornographic content',
      severity: 'high',
      pointsDeducted: 15,
      enabled: true,
      automationCapable: true,
      requiresManualReview: true,
      apiIntegration: 'vision-api',
      apiEndpoint: 'https://vision.googleapis.com/v1/images:annotate',
      credentialsRequired: true,
      config: {
        apiKeyEnvVar: 'GOOGLE_VISION_API_KEY',
        safeSearchThreshold: 'POSSIBLE'
      }
    },
    {
      name: 'Malware Download Detection',
      category: 'Content Analysis',
      description: 'Detect downloadable files that may contain malware',
      severity: 'critical',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'virustotal',
      apiEndpoint: 'https://www.virustotal.com/api/v3/urls',
      credentialsRequired: true,
      config: {
        apiKeyEnvVar: 'VIRUSTOTAL_API_KEY',
        suspiciousExtensions: ['.exe', '.dll', '.bat', '.cmd', '.scr', '.vbs']
      }
    },
    {
      name: 'Fake News/Misinformation Indicators',
      category: 'Content Analysis',
      description: 'Check for indicators of fake news or misinformation',
      severity: 'medium',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: true,
      apiIntegration: 'nlp-analysis',
      config: {
        checkSources: true,
        checkFactCheckers: true
      }
    },
    {
      name: 'Duplicate Content Check',
      category: 'Content Analysis',
      description: 'Detect scraped/duplicate content from legitimate sites',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'copyscape-api',
      config: {
        minSimilarityThreshold: 80
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 15: Performance Metrics (20 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'Page Load Time Analysis',
      category: 'Performance Metrics',
      description: 'Measure page load performance (slow sites may be compromised)',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        slowLoadThreshold: 10000, // 10 seconds
        timeout: 30000
      }
    },
    {
      name: 'Resource Size Analysis',
      category: 'Performance Metrics',
      description: 'Check for excessively large resources',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        maxPageSize: 10485760, // 10MB
        maxScriptSize: 1048576 // 1MB
      }
    },
    {
      name: 'Network Request Count',
      category: 'Performance Metrics',
      description: 'Flag excessive network requests',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        maxRequests: 100
      }
    },
    {
      name: 'Failed Request Detection',
      category: 'Performance Metrics',
      description: 'Detect high rate of failed requests (broken site)',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        maxFailedRequests: 10
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 16: SEO and Metadata (20 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'Meta Description Check',
      category: 'SEO and Metadata',
      description: 'Verify meta description exists and is appropriate',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        minLength: 50,
        maxLength: 160
      }
    },
    {
      name: 'Open Graph Tags',
      category: 'SEO and Metadata',
      description: 'Check for social media metadata (legitimate sites usually have this)',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'puppeteer',
      config: {
        requiredTags: ['og:title', 'og:description', 'og:image']
      }
    },
    {
      name: 'Robots.txt Check',
      category: 'SEO and Metadata',
      description: 'Verify robots.txt exists and is properly configured',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'http-fetch',
      config: {
        checkExists: true,
        flagDisallowAll: true
      }
    },
    {
      name: 'Sitemap.xml Check',
      category: 'SEO and Metadata',
      description: 'Check for sitemap (legitimate sites usually have one)',
      severity: 'low',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'http-fetch',
      config: {
        checkExists: true
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORY 17: Advanced Threat Detection (50 points)
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'VirusTotal URL Reputation',
      category: 'Advanced Threat Detection',
      description: 'Check URL against VirusTotal database',
      severity: 'critical',
      pointsDeducted: 20,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'virustotal',
      apiEndpoint: 'https://www.virustotal.com/api/v3/urls',
      credentialsRequired: true,
      config: {
        apiKeyEnvVar: 'VIRUSTOTAL_API_KEY',
        maxDetections: 0
      }
    },
    {
      name: 'Google Safe Browsing Check',
      category: 'Advanced Threat Detection',
      description: 'Check against Google Safe Browsing API',
      severity: 'critical',
      pointsDeducted: 15,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'google-safe-browsing',
      apiEndpoint: 'https://safebrowsing.googleapis.com/v4/threatMatches:find',
      credentialsRequired: true,
      config: {
        apiKeyEnvVar: 'GOOGLE_SAFE_BROWSING_API_KEY',
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE']
      }
    },
    {
      name: 'PhishTank Database Check',
      category: 'Advanced Threat Detection',
      description: 'Check against PhishTank phishing database',
      severity: 'critical',
      pointsDeducted: 10,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'phishtank',
      apiEndpoint: 'https://checkurl.phishtank.com/checkurl/',
      credentialsRequired: true,
      config: {
        apiKeyEnvVar: 'PHISHTANK_API_KEY'
      }
    },
    {
      name: 'URLhaus Malware Database',
      category: 'Advanced Threat Detection',
      description: 'Check against URLhaus malware URL database',
      severity: 'critical',
      pointsDeducted: 5,
      enabled: true,
      automationCapable: true,
      requiresManualReview: false,
      apiIntegration: 'urlhaus',
      apiEndpoint: 'https://urlhaus-api.abuse.ch/v1/url/',
      config: {
        checkMalwarePayloads: true
      }
    }

  ];

  console.log(`  Creating ${checkTypes.length} check type definitions...`);

  for (const checkType of checkTypes) {
    try {
      await prisma.checkType.upsert({
        where: {
          // Composite unique constraint
          name_category: {
            name: checkType.name,
            category: checkType.category
          }
        },
        update: checkType,
        create: checkType
      });
      console.log(`  ✓ ${checkType.name}`);
    } catch (error) {
      console.error(`  ✗ Failed to create ${checkType.name}:`, error.message);
    }
  }

  console.log(`\n✅ Check types seed complete: ${checkTypes.length} definitions created`);
}

async function main() {
  try {
    await seedCheckTypes();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      console.log('\n🎉 Seed completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Seed failed:', error);
      process.exit(1);
    });
}

export { seedCheckTypes };
