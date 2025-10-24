/**
 * Default 570-Point URL Scan Configuration
 * Enterprise-Grade Threat Detection System
 */

export const defaultScanConfiguration = {
  name: "Production Default (570-Point System)",
  description: "Enterprise-grade 570-point scoring system with 17 internal categories, 11 TI sources, and 3-model AI consensus",
  version: "1.0.0",
  isActive: true,
  isDefault: true,
  maxScore: 570,

  // ========================================================================
  // CATEGORY WEIGHTS (17 Categories = 515 Points Internal + 55 Points TI)
  // ========================================================================
  categoryWeights: {
    // Internal Analysis Categories (515 points)
    domainAnalysis: 40,
    sslSecurity: 45,
    contentAnalysis: 40,
    phishingPatterns: 50,
    malwareDetection: 45,
    behavioralJS: 25,
    socialEngineering: 30,
    financialFraud: 25,       // Conditional: only if financial keywords detected
    identityTheft: 20,        // Conditional: only if collection forms detected
    technicalExploits: 15,    // Conditional: only if suspicious code patterns
    brandImpersonation: 20,
    trustGraph: 30,
    dataProtection: 50,
    emailSecurity: 25,        // Conditional: only if MX records exist
    legalCompliance: 35,
    securityHeaders: 25,
    redirectChain: 15,

    // Threat Intelligence Layer (55 points)
    threatIntelligence: 55
  },

  // ========================================================================
  // CHECK WEIGHTS (100+ Individual Checks)
  // ========================================================================
  checkWeights: {
    // CATEGORY 1: Domain/WHOIS/TLD Analysis (40 points)
    domainAge_0_7_days: 20,
    domainAge_8_30_days: 15,
    domainAge_31_90_days: 10,
    domainAge_91_180_days: 5,
    whoisPrivacy: 6,
    suspiciousRegistrar: 4,
    bulkRegistration: 5,
    recentOwnershipChange: 8,
    highRiskTLD: 8,

    // CATEGORY 2: SSL/TLS Security (45 points)
    noHTTPS: 15,
    selfSignedCert: 12,
    expiredCert: 10,
    weakTLSVersion: 6,
    missingHSTS: 8,
    invalidCertChain: 7,
    certMismatch: 10,

    // CATEGORY 3: Content Analysis (40 points)
    minimalContent: 8,
    excessiveExternalLinks: 6,
    hiddenElements: 8,
    iframeInjection: 10,
    base64Content: 5,
    suspiciousMetaRefresh: 7,

    // CATEGORY 4: Phishing Patterns (50 points)
    credentialHarvestingForm: 12,
    urgencyKeywords: 8,
    authorityImpersonation: 10,
    fakeLoginPage: 15,
    passwordFieldNoContext: 8,
    suspiciousFormAction: 7,

    // CATEGORY 5: Malware Detection (45 points)
    executableDownload: 15,
    driveByDownload: 12,
    exploitKitSignature: 10,
    maliciousIframe: 8,
    knownMalwareDomain: 10,

    // CATEGORY 6: Behavioral/JavaScript (25 points)
    evalUsage: 6,
    documentWriteManipulation: 4,
    obfuscatedJS: 8,
    autoRedirectScript: 5,
    browserFingerprinting: 4,

    // CATEGORY 7: Social Engineering (30 points)
    fearTactics: 8,
    falseScarcity: 6,
    fakeEndorsements: 6,
    prizeRewardClaims: 8,
    sensit

iveActionRequest: 7,

    // CATEGORY 8: Financial Fraud (25 points - Conditional)
    fakePaymentForm: 10,
    cryptocurrencyScam: 8,
    investmentFraudLanguage: 7,
    unrealisticReturns: 6,

    // CATEGORY 9: Identity Theft (20 points - Conditional)
    ssnCollection: 8,
    idDocumentUpload: 7,
    biometricDataRequest: 8,
    multipleIdentityFields: 5,

    // CATEGORY 10: Technical Exploits (15 points - Conditional)
    sqlInjectionAttempt: 6,
    xssVulnerability: 5,
    missingCSRFToken: 4,
    pathTraversalAttempt: 5,

    // CATEGORY 11: Brand Impersonation (20 points)
    typosquatting: 10,
    homographAttack: 8,
    subdomainSpoofing: 6,
    visualSimilarity: 8,

    // CATEGORY 12: Trust Graph/Network (30 points)
    ipReputation: 10,
    suspiciousASN: 8,
    multipleARecords: 7,
    sharedHostingMalicious: 5,
    greyNoiseClassification: 5,

    // CATEGORY 13: Data Protection/Privacy (50 points)
    noPrivacyPolicy: 15,
    noGDPRCompliance: 8,
    insecureForms: 12,
    noInputValidation: 8,
    exposedSensitiveFiles: 10,

    // CATEGORY 14: Email Security/DMARC (25 points - Conditional)
    noSPFRecord: 6,
    noDMARCPolicy: 8,
    weakDMARCPolicy: 4,
    noDKIMSignature: 5,
    suspiciousMXRecords: 4,

    // CATEGORY 15: Legal & Compliance (35 points)
    noTermsOfService: 10,
    noRefundPolicy: 4,
    noContactInfo: 8,
    noBusinessRegistration: 6,
    noPhysicalAddress: 4,
    noCopyrightNotice: 3,

    // CATEGORY 16: Security Headers (25 points)
    noCSP: 6,
    noXFrameOptions: 4,
    noXContentTypeOptions: 3,
    insecureCookies: 4,
    noReferrerPolicy: 3,
    noPermissionsPolicy: 3,
    noSecurityTxt: 2,

    // CATEGORY 17: Redirect Chain Analysis (15 points)
    excessiveRedirects: 6,
    crossDomainRedirects: 5,
    httpToHTTPSDowngrade: 8,
    redirectToSuspicious: 7,

    // THREAT INTELLIGENCE LAYER (55 points)
    googleSafeBrowsing_malicious: 15,
    googleSafeBrowsing_suspicious: 8,
    virusTotal_10plus: 15,
    virusTotal_5to9: 10,
    virusTotal_1to4: 5,
    phishTank_90plus: 10,
    phishTank_70to89: 6,
    urlhaus_active: 5,
    abuseIPDB_80plus: 5,
    abuseIPDB_50to80: 3,
    alienVaultOTX_10plus: 2,
    spamhaus_listed: 1,
    surbl_listed: 1,
    openPhish_listed: 0.5,
    netcraft_reported: 0.25,
    bitdefender_flagged: 0.25
  },

  // ========================================================================
  // ALGORITHM CONFIGURATION
  // ========================================================================
  algorithmConfig: {
    scoringMethod: "contextual",  // "contextual" | "additive" | "weighted"
    enableDynamicScaling: true,   // Auto-adjust max score when categories skip
    enableCompensatoryWeights: true, // Redistribute weights when categories skip
    enableFalsePositivePrevention: true, // CDN/RIOT/Gov checks

    // Risk Level Thresholds (Percentage of active max score)
    riskThresholds: {
      safe: 15,      // 0-15%   (0-85 pts on 570 scale)
      low: 30,       // 15-30%  (86-170 pts)
      medium: 60,    // 30-60%  (171-341 pts)
      high: 80,      // 60-80%  (342-456 pts)
      critical: 100  // 80-100% (457-570 pts)
    },

    // Absolute Thresholds (570-point scale)
    absoluteThresholds: {
      safe: 85,
      low: 170,
      medium: 341,
      high: 456,
      critical: 570
    }
  },

  // ========================================================================
  // AI MODEL CONFIGURATION
  // ========================================================================
  aiModelConfig: {
    models: ["claude-sonnet-4.5", "gpt-4", "gemini-1.5-flash"],

    consensusWeights: {
      claude: 0.35,
      gpt4: 0.35,
      gemini: 0.30
    },

    multiplierRange: {
      min: 0.7,   // All models say SAFE
      max: 1.3    // All models say CRITICAL
    },

    verdictMultipliers: {
      SAFE: 0.7,
      SUSPICIOUS: 0.9,
      PHISHING: 1.1,
      MALWARE: 1.2,
      CRITICAL: 1.3
    },

    parallelExecution: true,
    timeout: 30000,  // 30 seconds
    maxRetries: 2,
    enableFallback: true
  },

  // ========================================================================
  // THREAT INTELLIGENCE CONFIGURATION (11 Sources)
  // ========================================================================
  tiConfig: {
    googleSafeBrowsing: {
      enabled: true,
      weight: 15,
      timeout: 1500,
      maxRetries: 2,
      cacheTTL: 1800,     // 30 minutes
      usePreGate: true    // Check before full scan
    },

    virusTotal: {
      enabled: true,
      weight: 15,
      timeout: 2000,
      maxRetries: 2,
      cacheTTL: 1800,
      minDetections: 1,    // Minimum detections to flag
      usePreGate: true
    },

    phishTank: {
      enabled: true,
      weight: 10,
      timeout: 1500,
      maxRetries: 2,
      cacheTTL: 3600,      // 1 hour
      minConfidence: 70,   // 0-100%
      usePreGate: true
    },

    urlhaus: {
      enabled: true,
      weight: 5,
      timeout: 1500,
      maxRetries: 2,
      cacheTTL: 900,       // 15 minutes
      usePreGate: true
    },

    abuseIPDB: {
      enabled: true,
      weight: 5,
      timeout: 2000,
      maxRetries: 2,
      cacheTTL: 3600,
      minConfidence: 50    // 0-100%
    },

    alienVaultOTX: {
      enabled: true,
      weight: 2,
      timeout: 2000,
      maxRetries: 1,
      cacheTTL: 7200,      // 2 hours
      minPulses: 1
    },

    spamhaus: {
      enabled: true,
      weight: 1,
      timeout: 1000,
      maxRetries: 1,
      cacheTTL: 10800      // 3 hours
    },

    surbl: {
      enabled: true,
      weight: 1,
      timeout: 1000,
      maxRetries: 1,
      cacheTTL: 10800
    },

    openPhish: {
      enabled: true,
      weight: 0.5,
      timeout: 1000,
      maxRetries: 1,
      cacheTTL: 3600
    },

    netcraft: {
      enabled: false,      // Disabled by default (requires subscription)
      weight: 0.25,
      timeout: 2000,
      maxRetries: 1,
      cacheTTL: 7200
    },

    bitdefender: {
      enabled: false,      // Disabled by default (requires subscription)
      weight: 0.25,
      timeout: 2000,
      maxRetries: 1,
      cacheTTL: 7200
    },

    // Pre-gate configuration
    preGate: {
      enabled: true,
      timeout: 2000,       // Total timeout for pre-gate checks
      stopOnMalicious: true, // Stop scan if any pre-gate confirms malicious
      sources: ["googleSafeBrowsing", "virusTotal", "phishTank", "urlhaus"]
    }
  },

  // ========================================================================
  // REACHABILITY CONFIGURATION
  // ========================================================================
  reachabilityConfig: {
    dns: {
      timeout: 2000,       // 2 seconds
      maxRetries: 1
    },

    tcp: {
      timeout: 2000,
      maxRetries: 1,
      ports: [443, 80]     // Try HTTPS first, fallback to HTTP
    },

    http: {
      timeout: 3000,
      maxRetries: 1,
      followRedirects: true,
      maxRedirects: 3
    },

    detection: {
      enableParkingDetection: true,
      enableSinkholeDetection: true,
      enableWAFDetection: true
    },

    cache: {
      enabled: true,
      ttl: 3600            // 1 hour
    },

    parkingPatterns: [
      "domain for sale",
      "buy this domain",
      "godaddy",
      "sedo",
      "parked free"
    ],

    sinkholePatterns: [
      "seized",
      "taken down",
      "suspended by",
      "icann",
      "abuse"
    ],

    wafPatterns: [
      "cloudflare",
      "checking your browser",
      "captcha",
      "ray id"
    ]
  },

  // ========================================================================
  // FALSE POSITIVE PREVENTION
  // ========================================================================
  whitelistRules: [
    {
      type: "cdn_ip",
      description: "Auto-whitelist CDN IPs",
      action: "override_ip_score",
      value: 0
    },
    {
      type: "riot_benign",
      description: "GreyNoise RIOT benign services",
      action: "override_trust_score",
      value: 0
    },
    {
      type: "gov_domain",
      description: "Verified government domains",
      action: "reduce_all_scores",
      multiplier: 0.5
    },
    {
      type: "legitimacy_indicators",
      description: "New domains with legitimacy signs",
      minIndicators: 3,
      action: "reduce_age_penalty",
      multiplier: 0.5
    }
  ],

  blacklistRules: [],  // Empty by default, populated by admin

  metadata: {
    createdBy: "system",
    description: "Default production configuration with contextual scoring, false positive prevention, and enterprise-grade accuracy"
  }
};
