/**
 * Category 17: Redirect Chain Analysis (15 points)
 *
 * Checks:
 * - Excessive redirects (>3: 7 pts)
 * - Cross-domain redirects (5 pts)
 * - URL shortener usage (4 pts)
 * - Cloaking/redirect mismatch (5 pts)
 *
 * Runs in: FULL, PARKED pipelines
 */

import {
  CategoryAnalyzer,
  CategoryResult,
  CategoryContext,
  Finding
} from '../categoryBase.js';
import { ReachabilityState } from '../types.js';
import { logger } from '../../../config/logger.js';

export class RedirectChainCategory extends CategoryAnalyzer {
  // Known URL shortener domains
  private static readonly URL_SHORTENERS = new Set([
    'bit.ly', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd',
    't.co', 'buff.ly', 'adf.ly', 'bc.vc', 'soo.gd',
    'short.link', 'cutt.ly', 'rb.gy', 'tiny.cc'
  ]);

  constructor() {
    super('redirectChain', 'Redirect Chain Analysis');
  }

  shouldRun(reachabilityState: ReachabilityState, pipelineType: string): boolean {
    return reachabilityState === ReachabilityState.ONLINE ||
           reachabilityState === ReachabilityState.PARKED;
  }

  async analyze(context: CategoryContext): Promise<CategoryResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const config = context.config.redirectChain;

    if (!context.httpResponse) {
      return this.createSkippedResult('No HTTP response', config.maxWeight);
    }

    logger.debug(`[Redirect Chain] Analyzing redirects for: ${context.url}`);

    const redirectChain = context.httpResponse.redirectChain || [];
    const redirectCount = redirectChain.length - 1; // Subtract original URL

    // Check 1: Excessive Redirects
    if (redirectCount >= 3) {
      findings.push(this.createFinding(
        'redirect_excessive',
        'Excessive Redirect Chain',
        'medium',
        config.checkWeights.redirect_excessive || 7,
        `${redirectCount} redirects detected (potential cloaking)`,
        { count: redirectCount, chain: redirectChain }
      ));
    }

    // Check 2: Cross-Domain Redirects
    if (redirectCount > 0) {
      const crossDomainFindings = this.checkCrossDomainRedirects(
        redirectChain,
        config.checkWeights
      );
      findings.push(...crossDomainFindings);
    }

    // Check 3: URL Shortener Usage
    const shortenerFindings = this.checkURLShorteners(
      redirectChain,
      config.checkWeights
    );
    findings.push(...shortenerFindings);

    // Check 4: Cloaking/Redirect Mismatch
    if (redirectCount > 0) {
      const cloakingFindings = this.checkCloaking(
        context.urlComponents.canonical,
        redirectChain,
        config.checkWeights
      );
      findings.push(...cloakingFindings);
    }

    const score = this.calculateScore(findings, config.maxWeight);
    const duration = Date.now() - startTime;

    logger.info(`[Redirect Chain] Complete: ${score}/${config.maxWeight} points, ${findings.length} findings (${duration}ms)`);

    return {
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      score,
      maxWeight: config.maxWeight,
      findings,
      metadata: {
        checksRun: 4,
        checksSkipped: 0,
        duration,
        skipped: false
      }
    };
  }

  /**
   * Check for cross-domain redirects
   */
  private checkCrossDomainRedirects(
    chain: string[],
    weights: Record<string, number>
  ): Finding[] {
    const findings: Finding[] = [];
    const domains = chain.map(url => {
      try {
        return new URL(url).hostname;
      } catch {
        return '';
      }
    }).filter(d => d);

    const uniqueDomains = new Set(domains);

    if (uniqueDomains.size >= 3) {
      findings.push(this.createFinding(
        'redirect_cross_domain',
        'Multiple Cross-Domain Redirects',
        'medium',
        weights.redirect_cross_domain || 6,
        `Redirects across ${uniqueDomains.size} different domains`,
        { domains: Array.from(uniqueDomains) }
      ));
    }

    return findings;
  }

  /**
   * Check for URL shortener usage
   */
  private checkURLShorteners(
    chain: string[],
    weights: Record<string, number>
  ): Finding[] {
    const findings: Finding[] = [];
    const usedShorteners: string[] = [];

    for (const url of chain) {
      try {
        const hostname = new URL(url).hostname;
        if (RedirectChainCategory.URL_SHORTENERS.has(hostname)) {
          usedShorteners.push(hostname);
        }
      } catch {
        continue;
      }
    }

    if (usedShorteners.length > 0) {
      findings.push(this.createFinding(
        'redirect_url_shortener',
        'URL Shortener Detected',
        'low',
        weights.redirect_url_shortener || 4,
        `Uses URL shortener(s): ${usedShorteners.join(', ')}`,
        { shorteners: usedShorteners }
      ));
    }

    return findings;
  }

  /**
   * Check for cloaking (original URL vs final destination mismatch)
   */
  private checkCloaking(
    originalUrl: string,
    chain: string[],
    weights: Record<string, number>
  ): Finding[] {
    const findings: Finding[] = [];

    if (chain.length < 2) return findings;

    try {
      const originalDomain = new URL(originalUrl).hostname;
      const finalUrl = chain[chain.length - 1];
      const finalDomain = new URL(finalUrl).hostname;

      // Check if final domain is completely different (not just subdomain)
      const originalBaseDomain = originalDomain.split('.').slice(-2).join('.');
      const finalBaseDomain = finalDomain.split('.').slice(-2).join('.');

      if (originalBaseDomain !== finalBaseDomain) {
        findings.push(this.createFinding(
          'redirect_cloaking',
          'Potential Cloaking Detected',
          'medium',
          weights.redirect_cloaking || 5,
          `Original domain (${originalDomain}) redirects to different domain (${finalDomain})`,
          { originalDomain, finalDomain }
        ));
      }
    } catch (error) {
      // Ignore URL parsing errors
    }

    return findings;
  }
}
