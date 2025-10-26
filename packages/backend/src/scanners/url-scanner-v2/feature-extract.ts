/**
 * Feature Extraction Module for URL Scanner V2
 *
 * Converts raw evidence into structured features for ML models:
 * - Lexical features (char n-grams, entropy, URL patterns)
 * - Tabular features (domain age, TLD risk, TI hits, TLS score)
 * - Causal signals (hard rules like form origin mismatch)
 * - Text aggregation for Stage-2 models
 */

import { URL } from 'url';
import type {
  EvidenceData,
  ExtractedFeatures,
  ReachabilityResult
} from './types';

/**
 * High-risk TLDs
 */
const HIGH_RISK_TLDS = new Set([
  'tk', 'ml', 'ga', 'cf', 'gq', // Freenom domains
  'xyz', 'top', 'work', 'date', 'download',
  'bid', 'win', 'review', 'trade', 'racing'
]);

/**
 * Medium-risk TLDs
 */
const MEDIUM_RISK_TLDS = new Set([
  'info', 'biz', 'club', 'online', 'site',
  'website', 'space', 'live', 'tech'
]);

/**
 * Homoglyph characters (Unicode lookalikes)
 */
const HOMOGLYPH_CHARS = /[аеорсухАЕРОСУХ]/; // Cyrillic lookalikes

/**
 * Feature Extractor class
 */
export class FeatureExtractor {
  /**
   * Extract all features from evidence
   */
  extract(
    url: string,
    evidence: EvidenceData,
    reachability: ReachabilityResult,
    tiData?: {
      totalHits: number;
      tier1Hits: number;
    }
  ): ExtractedFeatures {
    const parsedUrl = new URL(url);

    // Extract features in parallel conceptually (all are sync operations)
    const lexical = this.extractLexicalFeatures(url, parsedUrl);
    const tabular = this.extractTabularFeatures(evidence, reachability, tiData);
    const causal = this.extractCausalSignals(url, evidence, parsedUrl, reachability);
    const text = this.extractTextFeatures(evidence);
    const screenshot = evidence.screenshot?.url ? {
      imageUrl: evidence.screenshot.url,
      preprocessed: false
    } : undefined;

    return {
      lexical,
      tabular,
      causal,
      text,
      screenshot
    };
  }

  /**
   * Extract lexical features for URL encoding models
   */
  private extractLexicalFeatures(url: string, parsedUrl: URL) {
    // Character n-grams (3-grams for XGBoost)
    const charNgrams = this.extractCharNgrams(url, 3);

    // URL tokens for BERT (split by special chars)
    const urlTokens = this.tokenizeURL(url);

    // Entropy
    const entropy = this.calculateEntropy(url);

    // Length metrics
    const lengthMetrics = {
      totalLength: url.length,
      domainLength: parsedUrl.hostname.length,
      pathLength: parsedUrl.pathname.length,
      queryLength: parsedUrl.search.length,
      subdomainCount: parsedUrl.hostname.split('.').length - 2 // Exclude TLD and domain
    };

    // Suspicious patterns
    const suspiciousPatterns = {
      ipInUrl: this.hasIPAddress(parsedUrl.hostname),
      excessiveDashes: (parsedUrl.hostname.match(/-/g) || []).length > 3,
      excessiveDots: (parsedUrl.hostname.match(/\./g) || []).length > 4,
      homoglyphs: HOMOGLYPH_CHARS.test(parsedUrl.hostname),
      randomStrings: this.hasRandomStrings(url)
    };

    return {
      charNgrams,
      urlTokens,
      entropy,
      lengthMetrics,
      suspiciousPatterns
    };
  }

  /**
   * Extract tabular features for monotonic XGBoost
   */
  private extractTabularFeatures(
    evidence: EvidenceData,
    reachability: ReachabilityResult,
    tiData?: { totalHits: number; tier1Hits: number }
  ) {
    const parsedUrl = new URL('http://example.com'); // Will be overridden by caller

    // Domain age (days)
    const domainAge = evidence.whois.domainAge;

    // TLD risk score (0-100)
    const tldRiskScore = this.calculateTLDRisk(parsedUrl.hostname);

    // ASN reputation score (0-100, higher is riskier)
    const asnReputation = this.scoreASNReputation(evidence.asn);

    // TI hits
    const tiHitCount = tiData?.totalHits || 0;
    const tiTier1Hits = tiData?.tier1Hits || 0;

    // TLS score (0-100, lower is riskier)
    const tlsScore = this.scoreTLS(evidence.tls);

    // DNS health score (0-100, lower is riskier)
    const dnsHealthScore = this.scoreDNS(evidence.dns);

    // Certificate age (days)
    const certificateAge = evidence.tls.validFrom
      ? Math.floor((Date.now() - evidence.tls.validFrom.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Redirect count
    const redirectCount = evidence.redirectChain.length;

    // External domain count
    const externalDomainCount = evidence.har.externalDomains.length;

    return {
      domainAge,
      tldRiskScore,
      asnReputation,
      tiHitCount,
      tiTier1Hits,
      tlsScore,
      dnsHealthScore,
      certificateAge,
      redirectCount,
      externalDomainCount
    };
  }

  /**
   * Extract causal signals (hard rules)
   */
  private extractCausalSignals(url: string, evidence: EvidenceData, parsedUrl: URL, reachability: ReachabilityData) {
    // Form origin mismatch
    const formOriginMismatch = evidence.dom.forms.some(f => f.submitsToExternal);

    // Brand infrastructure divergence (simplified)
    // Real implementation would check against known brand infrastructure
    const brandInfraDivergence = this.detectBrandInfraDivergence(evidence);

    // Redirect homoglyph delta
    const redirectHomoglyphDelta = evidence.redirectChain.some(r => r.homoglyphDetected);

    // Auto download
    const autoDownload = evidence.autoDownload;

    // Tombstone (404, 410, etc.)
    const tombstone = false; // Would check HTTP status

    // Sinkhole
    const sinkhole = reachability.details.sinkholeIndicators ?
      reachability.details.sinkholeIndicators.length > 0 : false;

    // Dual tier-1 TI hits (determined by TI data passed to scanner)
    // This will be checked by the policy engine using the tiData parameter
    const dualTier1Hits = tiData ? tiData.tier1Hits >= 2 : false;

    return {
      formOriginMismatch,
      brandInfraDivergence,
      redirectHomoglyphDelta,
      autoDownload,
      tombstone,
      sinkhole,
      dualTier1Hits
    };
  }

  /**
   * Extract text features for Stage-2 analysis
   */
  private extractTextFeatures(evidence: EvidenceData) {
    // Aggregate visible text from DOM
    const aggregatedText = [
      evidence.dom.title,
      ...evidence.dom.links.map(l => l.text),
      ...Object.values(evidence.dom.metaTags)
    ].join(' ').slice(0, 10000); // Limit to 10k chars

    // Alt text from images
    const altText = evidence.dom.images
      .map(img => img.alt)
      .filter(alt => alt.length > 0);

    // Title attributes
    const titleAttributes: string[] = []; // Would extract from DOM

    // Script hints (comments, string literals)
    const scriptHints = evidence.dom.scripts
      .filter(s => s.inline)
      .flatMap(s => s.suspiciousPatterns);

    return {
      aggregatedText,
      altText,
      titleAttributes,
      scriptHints
    };
  }

  /**
   * Extract character n-grams
   */
  private extractCharNgrams(url: string, n: number): number[] {
    const ngrams = new Map<string, number>();
    const cleanUrl = url.toLowerCase();

    for (let i = 0; i <= cleanUrl.length - n; i++) {
      const ngram = cleanUrl.slice(i, i + n);
      ngrams.set(ngram, (ngrams.get(ngram) || 0) + 1);
    }

    // Convert to frequency vector (top 1000 n-grams)
    // In production, this would use a pre-defined vocabulary
    const vector = Array.from(ngrams.values()).slice(0, 1000);

    // Pad to 1000 dimensions
    while (vector.length < 1000) {
      vector.push(0);
    }

    return vector;
  }

  /**
   * Tokenize URL for BERT model
   */
  private tokenizeURL(url: string): string[] {
    // Split by special characters while preserving structure
    return url
      .toLowerCase()
      .replace(/([/:?=&._-])/g, ' $1 ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  /**
   * Calculate Shannon entropy
   */
  private calculateEntropy(str: string): number {
    const len = str.length;
    const frequencies = new Map<string, number>();

    for (const char of str) {
      frequencies.set(char, (frequencies.get(char) || 0) + 1);
    }

    let entropy = 0;
    for (const count of frequencies.values()) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Check if hostname contains IP address
   */
  private hasIPAddress(hostname: string): boolean {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;

    return ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname);
  }

  /**
   * Detect random-looking strings
   */
  private hasRandomStrings(url: string): boolean {
    const parsedUrl = new URL(url);
    const parts = [
      ...parsedUrl.hostname.split('.'),
      ...parsedUrl.pathname.split('/')
    ];

    for (const part of parts) {
      if (part.length < 5) continue;

      // Calculate vowel ratio
      const vowels = (part.match(/[aeiou]/gi) || []).length;
      const vowelRatio = vowels / part.length;

      // Random strings have low vowel ratio (<15%)
      if (vowelRatio < 0.15) return true;

      // Check for consonant clusters (4+ consecutive consonants)
      if (/[^aeiou]{4,}/i.test(part)) return true;
    }

    return false;
  }

  /**
   * Calculate TLD risk score
   */
  private calculateTLDRisk(hostname: string): number {
    const tld = hostname.split('.').pop()?.toLowerCase() || '';

    if (HIGH_RISK_TLDS.has(tld)) return 100;
    if (MEDIUM_RISK_TLDS.has(tld)) return 60;
    if (['com', 'org', 'net', 'edu', 'gov'].includes(tld)) return 10;

    return 30; // Unknown TLD
  }

  /**
   * Score ASN reputation
   */
  private scoreASNReputation(asn: EvidenceData['asn']): number {
    if (asn.reputation === 'bad') return 100;
    if (asn.reputation === 'neutral') return 50;
    return 0; // good
  }

  /**
   * Score TLS certificate
   */
  private scoreTLS(tls: EvidenceData['tls']): number {
    let score = 100; // Start with perfect score

    if (!tls.valid) score -= 50;
    if (tls.selfSigned) score -= 30;
    if (tls.daysUntilExpiry < 30) score -= 20;
    if (tls.anomalies.length > 0) score -= 10 * tls.anomalies.length;

    return Math.max(0, score);
  }

  /**
   * Score DNS health
   */
  private scoreDNS(dns: EvidenceData['dns']): number {
    let score = 100;

    if (dns.aRecords.length === 0) score -= 40;
    if (dns.mxRecords.length === 0) score -= 20;
    if (!dns.spfValid) score -= 20;
    if (!dns.dmarcValid) score -= 20;

    return Math.max(0, score);
  }

  /**
   * Detect brand infrastructure divergence
   */
  private detectBrandInfraDivergence(evidence: EvidenceData): boolean {
    // Simplified: Check if page has brand logos but ASN doesn't match known brand ASNs
    const hasBrandLogos = evidence.dom.images.some(img => img.isLogo);
    const isKnownHosting = evidence.asn.isHosting || evidence.asn.isCDN;

    // If has brand logos but hosted on generic hosting (not brand's own infra)
    // This is a simplified heuristic - real implementation would check against database
    return hasBrandLogos && !isKnownHosting;
  }
}

/**
 * Factory function
 */
export function createFeatureExtractor(): FeatureExtractor {
  return new FeatureExtractor();
}

/**
 * Utility: Load TI data for feature extraction
 * Integrates with V2 TI Integration Service
 */
export async function loadTIDataForFeatures(url: string): Promise<{
  totalHits: number;
  tier1Hits: number;
}> {
  // Use V2 TI Integration Service
  const { loadTIDataForV2Features } = await import('../../services/threat-intel/v2-ti-integration.service.js');
  return await loadTIDataForV2Features(url);
}
