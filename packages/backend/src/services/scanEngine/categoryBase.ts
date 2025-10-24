/**
 * Category Base: Abstract interfaces for all 17 analysis categories
 * Each category returns findings and a score (0 to max weight)
 */

import { URLComponents, ReachabilityProbeResult, ReachabilityState } from './types.js';

/**
 * Base result structure for all categories
 */
export interface CategoryResult {
  categoryId: string;
  categoryName: string;
  score: number;          // Raw score (0 to maxWeight)
  maxWeight: number;      // Maximum possible score for this category
  findings: Finding[];    // List of detected issues
  metadata: {
    checksRun: number;
    checksSkipped: number;
    duration: number;
    skipped: boolean;
    skipReason?: string;
  };
}

/**
 * Individual finding within a category
 */
export interface Finding {
  checkId: string;
  checkName: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  score: number;          // Points added by this finding
  message: string;
  evidence?: any;         // Supporting data (optional)
  metadata?: Record<string, any>;
}

/**
 * Context passed to all category analyzers
 */
export interface CategoryContext {
  url: string;
  urlComponents: URLComponents;
  reachability: ReachabilityProbeResult;
  config: CategoryConfig;
  httpResponse?: {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    redirectChain?: string[];
  };
  dnsRecords?: {
    A?: string[];
    AAAA?: string[];
    MX?: any[];
    TXT?: string[];
    NS?: string[];
    CNAME?: string[];
  };
  whoisData?: any;
  sslCertificate?: any;
  screenshot?: Buffer;
  domTree?: any;
}

/**
 * Category-specific configuration
 */
export interface CategoryConfig {
  categoryId: string;
  enabled: boolean;
  maxWeight: number;
  checkWeights: Record<string, number>;
  thresholds?: Record<string, any>;
  customConfig?: Record<string, any>;
}

/**
 * Abstract base class for all category analyzers
 */
export abstract class CategoryAnalyzer {
  protected categoryId: string;
  protected categoryName: string;

  constructor(categoryId: string, categoryName: string) {
    this.categoryId = categoryId;
    this.categoryName = categoryName;
  }

  /**
   * Determine if this category should run based on pipeline/reachability
   */
  abstract shouldRun(reachabilityState: ReachabilityState, pipelineType: string): boolean;

  /**
   * Execute category analysis
   */
  abstract analyze(context: CategoryContext): Promise<CategoryResult>;

  /**
   * Helper to create a skipped result
   */
  protected createSkippedResult(reason: string, maxWeight: number): CategoryResult {
    return {
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      score: 0,
      maxWeight,
      findings: [],
      metadata: {
        checksRun: 0,
        checksSkipped: 0,
        duration: 0,
        skipped: true,
        skipReason: reason
      }
    };
  }

  /**
   * Helper to create a finding
   */
  protected createFinding(
    checkId: string,
    checkName: string,
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
    score: number,
    message: string,
    evidence?: any
  ): Finding {
    return {
      checkId,
      checkName,
      severity,
      score,
      message,
      evidence
    };
  }

  /**
   * Helper to calculate total score from findings
   */
  protected calculateScore(findings: Finding[], maxWeight: number): number {
    const totalScore = findings.reduce((sum, f) => sum + f.score, 0);
    return Math.min(totalScore, maxWeight);
  }
}

/**
 * Pipeline definitions for category execution
 */
export enum Pipeline {
  FULL = 'FULL',           // All 17 categories (ONLINE)
  PASSIVE = 'PASSIVE',     // 4 categories only (OFFLINE)
  PARKED = 'PARKED',       // Parked domain analysis
  WAF = 'WAF',             // WAF challenge analysis
  SINKHOLE = 'SINKHOLE'    // Fast-path critical (no categories run)
}

/**
 * Category execution plan based on pipeline
 */
export const PIPELINE_CATEGORY_MAP: Record<Pipeline, string[]> = {
  [Pipeline.FULL]: [
    'domainAnalysis',
    'sslSecurity',
    'contentAnalysis',
    'phishingPatterns',
    'malwareDetection',
    'behavioralJS',
    'socialEngineering',
    'financialFraud',
    'identityTheft',
    'technicalExploits',
    'brandImpersonation',
    'trustGraph',
    'dataProtection',
    'emailSecurity',
    'legalCompliance',
    'securityHeaders',
    'redirectChain'
  ],
  [Pipeline.PASSIVE]: [
    'domainAnalysis',      // Can analyze domain without HTTP
    'emailSecurity',       // DNS-based (SPF/DMARC/DKIM)
    'trustGraph',          // Historical trust data
    'legalCompliance'      // TLD/jurisdiction checks
  ],
  [Pipeline.PARKED]: [
    'domainAnalysis',
    'contentAnalysis',     // Detect parking patterns
    'brandImpersonation',  // Check for brand abuse
    'trustGraph'
  ],
  [Pipeline.WAF]: [
    'domainAnalysis',
    'sslSecurity',
    'securityHeaders',
    'contentAnalysis',     // Limited content analysis
    'trustGraph'
  ],
  [Pipeline.SINKHOLE]: []  // No categories run, auto-critical
};

/**
 * Category metadata (descriptions, requirements)
 */
export const CATEGORY_METADATA: Record<string, {
  name: string;
  description: string;
  defaultWeight: number;
  requiresHTTP: boolean;
  requiresSSL: boolean;
  requiresDNS: boolean;
  requiresWhois: boolean;
}> = {
  domainAnalysis: {
    name: 'Domain, WHOIS & TLD Analysis',
    description: 'Domain age, registration patterns, TLD risk, WHOIS privacy',
    defaultWeight: 40,
    requiresHTTP: false,
    requiresSSL: false,
    requiresDNS: true,
    requiresWhois: true
  },
  sslSecurity: {
    name: 'SSL/TLS Security',
    description: 'Certificate validity, issuer trust, protocol version, cipher strength',
    defaultWeight: 45,
    requiresHTTP: true,
    requiresSSL: true,
    requiresDNS: false,
    requiresWhois: false
  },
  contentAnalysis: {
    name: 'Content Analysis',
    description: 'HTML structure, suspicious keywords, obfuscation, resource analysis',
    defaultWeight: 40,
    requiresHTTP: true,
    requiresSSL: false,
    requiresDNS: false,
    requiresWhois: false
  },
  phishingPatterns: {
    name: 'Phishing Patterns',
    description: 'Login forms, credential harvesting, brand mimicry, social engineering',
    defaultWeight: 50,
    requiresHTTP: true,
    requiresSSL: false,
    requiresDNS: false,
    requiresWhois: false
  },
  malwareDetection: {
    name: 'Malware Detection',
    description: 'Suspicious scripts, exploit kits, malicious downloads, iframe injections',
    defaultWeight: 45,
    requiresHTTP: true,
    requiresSSL: false,
    requiresDNS: false,
    requiresWhois: false
  },
  behavioralJS: {
    name: 'Behavioral JavaScript',
    description: 'Dynamic analysis, popup behavior, auto-downloads, clipboard access',
    defaultWeight: 25,
    requiresHTTP: true,
    requiresSSL: false,
    requiresDNS: false,
    requiresWhois: false
  },
  socialEngineering: {
    name: 'Social Engineering',
    description: 'Urgency tactics, fake warnings, prize/lottery scams, tech support',
    defaultWeight: 30,
    requiresHTTP: true,
    requiresSSL: false,
    requiresDNS: false,
    requiresWhois: false
  },
  financialFraud: {
    name: 'Financial Fraud',
    description: 'Payment form analysis, cryptocurrency scams, investment fraud',
    defaultWeight: 25,
    requiresHTTP: true,
    requiresSSL: false,
    requiresDNS: false,
    requiresWhois: false
  },
  identityTheft: {
    name: 'Identity Theft',
    description: 'PII collection, document uploads, verification scams',
    defaultWeight: 20,
    requiresHTTP: true,
    requiresSSL: false,
    requiresDNS: false,
    requiresWhois: false
  },
  technicalExploits: {
    name: 'Technical Exploits',
    description: 'XSS, CSRF, clickjacking, protocol handler abuse',
    defaultWeight: 15,
    requiresHTTP: true,
    requiresSSL: false,
    requiresDNS: false,
    requiresWhois: false
  },
  brandImpersonation: {
    name: 'Brand Impersonation',
    description: 'Logo detection, visual similarity, typosquatting, favicon analysis',
    defaultWeight: 20,
    requiresHTTP: true,
    requiresSSL: false,
    requiresDNS: false,
    requiresWhois: false
  },
  trustGraph: {
    name: 'Trust Graph & Network',
    description: 'Historical reputation, backlinks, traffic patterns, hosting analysis',
    defaultWeight: 30,
    requiresHTTP: false,
    requiresSSL: false,
    requiresDNS: true,
    requiresWhois: false
  },
  dataProtection: {
    name: 'Data Protection & Privacy',
    description: 'Privacy policy, GDPR compliance, cookie consent, data collection',
    defaultWeight: 50,
    requiresHTTP: true,
    requiresSSL: false,
    requiresDNS: false,
    requiresWhois: false
  },
  emailSecurity: {
    name: 'Email Security (SPF/DMARC/DKIM)',
    description: 'Email authentication, spoofing protection, domain reputation',
    defaultWeight: 25,
    requiresHTTP: false,
    requiresSSL: false,
    requiresDNS: true,
    requiresWhois: false
  },
  legalCompliance: {
    name: 'Legal & Compliance',
    description: 'Terms of service, CCPA/COPPA, jurisdiction risk, gambling/adult content',
    defaultWeight: 35,
    requiresHTTP: true,
    requiresSSL: false,
    requiresDNS: false,
    requiresWhois: true
  },
  securityHeaders: {
    name: 'Security Headers',
    description: 'CSP, HSTS, X-Frame-Options, referrer policy, CORS',
    defaultWeight: 25,
    requiresHTTP: true,
    requiresSSL: false,
    requiresDNS: false,
    requiresWhois: false
  },
  redirectChain: {
    name: 'Redirect Chain Analysis',
    description: 'Redirect patterns, URL shorteners, open redirects, cloaking',
    defaultWeight: 15,
    requiresHTTP: true,
    requiresSSL: false,
    requiresDNS: false,
    requiresWhois: false
  }
};
