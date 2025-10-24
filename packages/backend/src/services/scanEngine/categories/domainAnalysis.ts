/**
 * Category 1: Domain, WHOIS & TLD Analysis (40 points)
 *
 * Checks:
 * - Domain age (0-7 days: 20 pts, 8-30 days: 15 pts, 31-90 days: 10 pts)
 * - TLD risk (high-risk TLDs: 15 pts)
 * - WHOIS privacy protection (suspicious patterns: 10 pts)
 * - Registration patterns (bulk registration indicators: 8 pts)
 * - Subdomain depth (suspicious depth: 5 pts)
 * - Numeric/random patterns in domain (7 pts)
 *
 * Runs in: ALL pipelines (FULL, PASSIVE, PARKED, WAF)
 */

import {
  CategoryAnalyzer,
  CategoryResult,
  CategoryContext,
  Finding
} from '../categoryBase.js';
import { ReachabilityState } from '../types.js';
import { logger } from '../../../config/logger.js';

export class DomainAnalysisCategory extends CategoryAnalyzer {
  // High-risk TLDs (frequently abused for phishing/malware)
  private static readonly HIGH_RISK_TLDS = new Set([
    'tk', 'ml', 'ga', 'cf', 'gq',  // Free TLDs from Freenom
    'xyz', 'top', 'work', 'click', 'link',
    'pw', 'loan', 'win', 'bid', 'stream',
    'download', 'racing', 'accountant', 'science',
    'cricket', 'review', 'party', 'trade', 'webcam'
  ]);

  // Medium-risk TLDs
  private static readonly MEDIUM_RISK_TLDS = new Set([
    'info', 'biz', 'cc', 'ws', 'mobi',
    'name', 'pro', 'tel', 'asia', 'club'
  ]);

  // Suspicious patterns in domain names
  private static readonly SUSPICIOUS_PATTERNS = [
    /paypal|paypai|paypa1/i,
    /amazon|amaz0n|amazom/i,
    /google|g00gle|gooogle/i,
    /microsoft|micros0ft/i,
    /apple|app1e/i,
    /facebook|faceb00k/i,
    /instagram|insta9ram/i,
    /netflix|netf1ix/i,
    /secure|verify|account|update|login|signin/i,
    /bank|banking|wallet|crypto/i,
    /support|help|service/i
  ];

  // Known brands for doppelganger domain detection (typosquatting)
  private static readonly KNOWN_BRANDS = [
    'amazon', 'paypal', 'microsoft', 'apple', 'google',
    'facebook', 'instagram', 'twitter', 'linkedin', 'youtube',
    'netflix', 'spotify', 'adobe', 'salesforce', 'zoom',
    'coinbase', 'binance', 'kraken', 'blockchain', 'metamask',
    'walmart', 'target', 'ebay', 'bestbuy', 'shopify',
    'chase', 'bankofamerica', 'wellsfargo', 'citibank', 'usbank'
  ];

  // Homoglyph mappings (visually similar characters)
  private static readonly HOMOGLYPHS: Record<string, string[]> = {
    'a': ['а', 'ạ', 'ā', 'à', 'á', 'â', 'ã', 'ä'],
    'e': ['е', 'ė', 'ē', 'è', 'é', 'ê', 'ë'],
    'i': ['і', '1', 'l', 'ï', 'ì', 'í', 'î'],
    'o': ['о', '0', 'ọ', 'ō', 'ò', 'ó', 'ô', 'õ', 'ö'],
    'u': ['υ', 'ū', 'ù', 'ú', 'û', 'ü'],
    'c': ['с', 'ċ', 'ç'],
    'p': ['р'],
    'x': ['х'],
    'y': ['у', 'ý', 'ÿ'],
    's': ['ѕ'],
    'n': ['ո'],
    'm': ['м'],
    'h': ['һ'],
    'l': ['1', 'i', '|'],
    '0': ['o', 'O'],
    '1': ['l', 'i', 'I']
  };

  constructor() {
    super('domainAnalysis', 'Domain, WHOIS & TLD Analysis');
  }

  shouldRun(reachabilityState: ReachabilityState, pipelineType: string): boolean {
    // Always run domain analysis (works without HTTP)
    return true;
  }

  async analyze(context: CategoryContext): Promise<CategoryResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const config = context.config.domainAnalysis;

    logger.debug(`[Domain Analysis] Starting analysis for: ${context.urlComponents.domain}`);

    // Check 1: Domain Age (WHOIS required)
    if (context.whoisData?.registrationDate) {
      const ageFindings = this.checkDomainAge(
        context.whoisData.registrationDate,
        config.checkWeights
      );
      findings.push(...ageFindings);
    }

    // Check 2: TLD Risk
    const tldFindings = this.checkTLDRisk(
      context.urlComponents.tld,
      config.checkWeights
    );
    findings.push(...tldFindings);

    // Check 3: WHOIS Privacy Protection
    if (context.whoisData) {
      const privacyFindings = this.checkWhoisPrivacy(
        context.whoisData,
        config.checkWeights
      );
      findings.push(...privacyFindings);
    }

    // Check 4: Registration Patterns
    if (context.whoisData) {
      const registrationFindings = this.checkRegistrationPatterns(
        context.whoisData,
        config.checkWeights
      );
      findings.push(...registrationFindings);
    }

    // Check 5: Subdomain Depth
    const subdomainFindings = this.checkSubdomainDepth(
      context.urlComponents.hostname,
      config.checkWeights
    );
    findings.push(...subdomainFindings);

    // Check 6: Domain Name Patterns (suspicious strings, typosquatting)
    const patternFindings = this.checkDomainPatterns(
      context.urlComponents.domain,
      config.checkWeights
    );
    findings.push(...patternFindings);

    // Check 7: Numeric/Random Character Detection
    const randomnessFindings = this.checkRandomness(
      context.urlComponents.domain,
      config.checkWeights
    );
    findings.push(...randomnessFindings);

    // Check 8: Doppelganger Domain Detection (ENHANCED - typosquatting)
    const doppelgangerFindings = this.checkDoppelgangerDomain(
      context.urlComponents.domain,
      config.checkWeights
    );
    findings.push(...doppelgangerFindings);

    // Calculate final score
    const score = this.calculateScore(findings, config.maxWeight);
    const duration = Date.now() - startTime;

    logger.info(`[Domain Analysis] Complete: ${score}/${config.maxWeight} points, ${findings.length} findings (${duration}ms)`);

    return {
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      score,
      maxWeight: config.maxWeight,
      findings,
      metadata: {
        checksRun: 8,
        checksSkipped: context.whoisData ? 0 : 3,
        duration,
        skipped: false
      }
    };
  }

  /**
   * Check domain age (newer = more suspicious)
   */
  private checkDomainAge(registrationDate: Date | string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const regDate = new Date(registrationDate);
    const ageInDays = Math.floor((Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24));

    if (ageInDays <= 7) {
      findings.push(this.createFinding(
        'domainAge_0_7_days',
        'Domain Age: 0-7 days',
        'critical',
        weights.domainAge_0_7_days || 20,
        `Domain registered ${ageInDays} day(s) ago (very new)`,
        { ageInDays, registrationDate }
      ));
    } else if (ageInDays <= 30) {
      findings.push(this.createFinding(
        'domainAge_8_30_days',
        'Domain Age: 8-30 days',
        'high',
        weights.domainAge_8_30_days || 15,
        `Domain registered ${ageInDays} day(s) ago (new)`,
        { ageInDays, registrationDate }
      ));
    } else if (ageInDays <= 90) {
      findings.push(this.createFinding(
        'domainAge_31_90_days',
        'Domain Age: 31-90 days',
        'medium',
        weights.domainAge_31_90_days || 10,
        `Domain registered ${ageInDays} day(s) ago (relatively new)`,
        { ageInDays, registrationDate }
      ));
    }

    return findings;
  }

  /**
   * Check TLD risk level
   */
  private checkTLDRisk(tld: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    if (DomainAnalysisCategory.HIGH_RISK_TLDS.has(tld)) {
      findings.push(this.createFinding(
        'tld_high_risk',
        'High-Risk TLD',
        'high',
        weights.tld_high_risk || 15,
        `TLD '.${tld}' is frequently abused for malicious purposes`,
        { tld, riskLevel: 'high' }
      ));
    } else if (DomainAnalysisCategory.MEDIUM_RISK_TLDS.has(tld)) {
      findings.push(this.createFinding(
        'tld_medium_risk',
        'Medium-Risk TLD',
        'medium',
        weights.tld_medium_risk || 8,
        `TLD '.${tld}' has elevated risk profile`,
        { tld, riskLevel: 'medium' }
      ));
    }

    return findings;
  }

  /**
   * Check WHOIS privacy patterns
   */
  private checkWhoisPrivacy(whoisData: any, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Check for WHOIS privacy/protection
    if (whoisData.privacyProtection === true ||
        whoisData.registrant?.includes('Privacy') ||
        whoisData.registrant?.includes('Redacted')) {

      // Privacy is normal for legitimate sites, but combined with new domain = suspicious
      // This is a low-weight indicator
      findings.push(this.createFinding(
        'whois_privacy_protection',
        'WHOIS Privacy Protection Enabled',
        'low',
        weights.whois_privacy_protection || 5,
        'Domain uses privacy protection (common but prevents verification)',
        { privacyEnabled: true }
      ));
    }

    // Check for incomplete WHOIS data (more suspicious)
    if (!whoisData.registrant || !whoisData.registrar) {
      findings.push(this.createFinding(
        'whois_incomplete_data',
        'Incomplete WHOIS Data',
        'medium',
        weights.whois_incomplete_data || 8,
        'WHOIS record is missing key registration information',
        { missingFields: ['registrant', 'registrar'].filter(f => !whoisData[f]) }
      ));
    }

    return findings;
  }

  /**
   * Check registration patterns (bulk registration indicators)
   */
  private checkRegistrationPatterns(whoisData: any, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Check for known bullet-proof registrars (used by criminals)
    const suspiciousRegistrars = [
      'namecheap', // Not inherently bad, but heavily used for phishing
      'godaddy',   // Same as above
      'publicdomainregistry',
      'enom'
    ];

    if (whoisData.registrar) {
      const registrarLower = whoisData.registrar.toLowerCase();
      const isSuspicious = suspiciousRegistrars.some(r => registrarLower.includes(r));

      if (isSuspicious) {
        // Low weight - many legitimate sites use these too
        findings.push(this.createFinding(
          'registrar_frequently_abused',
          'Frequently Abused Registrar',
          'low',
          weights.registrar_frequently_abused || 3,
          `Registrar '${whoisData.registrar}' is commonly used for malicious domains`,
          { registrar: whoisData.registrar }
        ));
      }
    }

    return findings;
  }

  /**
   * Check subdomain depth (excessive subdomains = suspicious)
   */
  private checkSubdomainDepth(hostname: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const parts = hostname.split('.');
    const depth = parts.length - 2; // Subtract base domain and TLD

    if (depth >= 3) {
      findings.push(this.createFinding(
        'subdomain_depth_excessive',
        'Excessive Subdomain Depth',
        'medium',
        weights.subdomain_depth_excessive || 7,
        `Hostname has ${depth} subdomain levels (${hostname})`,
        { depth, hostname }
      ));
    }

    return findings;
  }

  /**
   * Check for suspicious domain patterns (typosquatting, brand abuse)
   */
  private checkDomainPatterns(domain: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    for (const pattern of DomainAnalysisCategory.SUSPICIOUS_PATTERNS) {
      if (pattern.test(domain)) {
        findings.push(this.createFinding(
          'domain_suspicious_pattern',
          'Suspicious Domain Pattern',
          'high',
          weights.domain_suspicious_pattern || 12,
          `Domain contains suspicious keywords: ${domain}`,
          { domain, pattern: pattern.source }
        ));
        break; // Only report once
      }
    }

    return findings;
  }

  /**
   * Check for random/numeric patterns in domain
   */
  private checkRandomness(domain: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Check for excessive numbers
    const numberCount = (domain.match(/\d/g) || []).length;
    const numberRatio = numberCount / domain.length;

    if (numberRatio > 0.3) {
      findings.push(this.createFinding(
        'domain_excessive_numbers',
        'Excessive Numbers in Domain',
        'medium',
        weights.domain_excessive_numbers || 8,
        `Domain has ${Math.round(numberRatio * 100)}% numeric characters`,
        { domain, numberRatio }
      ));
    }

    // Check for random character sequences (low entropy)
    const hasRandomSequence = /([a-z0-9])\1{3,}/i.test(domain) || // Repeated chars: aaaaaa
                              /[0-9]{4,}/.test(domain);           // Long number sequences

    if (hasRandomSequence) {
      findings.push(this.createFinding(
        'domain_random_sequence',
        'Random Character Sequence',
        'medium',
        weights.domain_random_sequence || 7,
        'Domain contains suspicious character patterns',
        { domain }
      ));
    }

    return findings;
  }

  /**
   * ENHANCED: Doppelganger domain detection (typosquatting)
   * Uses Levenshtein distance, homoglyph detection, and keyboard proximity
   */
  private checkDoppelgangerDomain(domain: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const domainLower = domain.toLowerCase();

    for (const brand of DomainAnalysisCategory.KNOWN_BRANDS) {
      // Skip exact matches
      if (domainLower === brand) continue;

      // Skip if domain doesn't contain the brand at all (optimization)
      if (!domainLower.includes(brand.substring(0, 3))) continue;

      let isSuspicious = false;
      let detectionType = '';
      let similarity = 0;

      // Algorithm 1: Levenshtein Distance (edit distance)
      const levenshteinDist = this.calculateLevenshtein(domainLower, brand);
      if (levenshteinDist <= 2) {
        isSuspicious = true;
        detectionType = 'Levenshtein distance';
        similarity = 1 - (levenshteinDist / Math.max(domainLower.length, brand.length));
      }

      // Algorithm 2: Homoglyph Detection (visually similar characters)
      if (!isSuspicious && this.detectHomoglyph(domainLower, brand)) {
        isSuspicious = true;
        detectionType = 'Homoglyph substitution';
        similarity = 0.9;
      }

      // Algorithm 3: Keyboard Proximity (adjacent key typos)
      if (!isSuspicious && this.detectKeyboardProximity(domainLower, brand)) {
        isSuspicious = true;
        detectionType = 'Keyboard proximity typo';
        similarity = 0.85;
      }

      if (isSuspicious) {
        findings.push(this.createFinding(
          'domain_doppelganger_typosquatting',
          'Doppelganger Domain (Typosquatting)',
          'critical',
          weights.domain_doppelganger_typosquatting || 25,
          `Domain '${domain}' is visually similar to brand '${brand}' (${detectionType})`,
          {
            domain,
            targetBrand: brand,
            detectionAlgorithm: detectionType,
            similarityScore: Math.round(similarity * 100)
          }
        ));
        break; // Only report first match
      }
    }

    return findings;
  }

  /**
   * Calculate Levenshtein distance (edit distance) between two strings
   */
  private calculateLevenshtein(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Detect homoglyph substitution (visually similar characters)
   */
  private detectHomoglyph(domain: string, brand: string): boolean {
    // Check if domain contains any homoglyphs of brand characters
    for (let i = 0; i < brand.length; i++) {
      const brandChar = brand[i];
      const homoglyphs = DomainAnalysisCategory.HOMOGLYPHS[brandChar] || [];

      for (const homoglyph of homoglyphs) {
        // Check if replacing this character makes the domain match the brand
        const testDomain = domain.replace(new RegExp(homoglyph, 'g'), brandChar);
        if (testDomain === brand || testDomain.includes(brand)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Detect keyboard proximity typos (adjacent keys)
   */
  private detectKeyboardProximity(domain: string, brand: string): boolean {
    // Keyboard layout (QWERTY)
    const keyboard: Record<string, string> = {
      'q': 'wa', 'w': 'qeas', 'e': 'wrds', 'r': 'etfd', 't': 'rygf', 'y': 'tuhg', 'u': 'yijh', 'i': 'uokj', 'o': 'iplk', 'p': 'ol',
      'a': 'qwsz', 's': 'awedxz', 'd': 'serfcx', 'f': 'drtgvc', 'g': 'ftyhbv', 'h': 'gyujnb', 'j': 'huikmn', 'k': 'jiolm', 'l': 'kop',
      'z': 'asx', 'x': 'zsdc', 'c': 'xdfv', 'v': 'cfgb', 'b': 'vghn', 'n': 'bhjm', 'm': 'njk'
    };

    // Check if domain differs by one keyboard-adjacent character
    if (Math.abs(domain.length - brand.length) > 1) return false;

    let diffCount = 0;
    for (let i = 0; i < Math.min(domain.length, brand.length); i++) {
      if (domain[i] !== brand[i]) {
        const adjacentKeys = keyboard[brand[i]] || '';
        if (!adjacentKeys.includes(domain[i])) {
          diffCount++;
        }
      }
    }

    return diffCount === 1;
  }
}
