/**
 * Category 11: Brand Impersonation (20 points)
 *
 * Checks:
 * - Domain typosquatting (8 pts)
 * - Brand keyword in content but not domain (7 pts)
 * - Favicon from legitimate site (5 pts)
 * - Copyright/trademark violations (4 pts)
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

export class BrandImpersonationCategory extends CategoryAnalyzer {
  // Major brands commonly impersonated
  private static readonly MAJOR_BRANDS = [
    { name: 'PayPal', domain: 'paypal.com', keywords: ['paypal', 'paypai', 'paypa1'] },
    { name: 'Amazon', domain: 'amazon.com', keywords: ['amazon', 'amaz0n', 'amazom'] },
    { name: 'Microsoft', domain: 'microsoft.com', keywords: ['microsoft', 'micros0ft', 'micosoft'] },
    { name: 'Apple', domain: 'apple.com', keywords: ['apple', 'app1e', 'appl3'] },
    { name: 'Google', domain: 'google.com', keywords: ['google', 'g00gle', 'gooogle'] },
    { name: 'Facebook', domain: 'facebook.com', keywords: ['facebook', 'faceb00k', 'facebok'] },
    { name: 'Netflix', domain: 'netflix.com', keywords: ['netflix', 'netf1ix', 'netflx'] },
    { name: 'Instagram', domain: 'instagram.com', keywords: ['instagram', 'insta9ram', 'instgram'] },
    { name: 'Bank of America', domain: 'bankofamerica.com', keywords: ['bankofamerica', 'bank-of-america'] },
    { name: 'Chase', domain: 'chase.com', keywords: ['chase', 'chas3', 'chasebank'] },
    { name: 'Wells Fargo', domain: 'wellsfargo.com', keywords: ['wellsfargo', 'wells-fargo'] },
    { name: 'LinkedIn', domain: 'linkedin.com', keywords: ['linkedin', 'link3din', 'linkedln'] }
  ];

  // Typosquatting techniques
  private static readonly TYPOSQUAT_PATTERNS = [
    (brand: string) => brand.replace(/o/g, '0'),    // o -> 0
    (brand: string) => brand.replace(/i/g, '1'),    // i -> 1
    (brand: string) => brand.replace(/e/g, '3'),    // e -> 3
    (brand: string) => brand.replace(/l/g, '1'),    // l -> 1
    (brand: string) => brand.replace(/a/g, '@'),    // a -> @
    (brand: string) => brand + '-secure',            // append -secure
    (brand: string) => brand + '-verify',            // append -verify
    (brand: string) => 'secure-' + brand,            // prepend secure-
    (brand: string) => brand + '-login',             // append -login
  ];

  constructor() {
    super('brandImpersonation', 'Brand Impersonation');
  }

  shouldRun(reachabilityState: ReachabilityState, pipelineType: string): boolean {
    return reachabilityState === ReachabilityState.ONLINE ||
           reachabilityState === ReachabilityState.PARKED;
  }

  async analyze(context: CategoryContext): Promise<CategoryResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const config = context.config.brandImpersonation;

    logger.debug(`[Brand Impersonation] Analyzing for: ${context.urlComponents.domain}`);

    // Check 1: Domain Typosquatting
    const typosquatFindings = this.checkTyposquatting(
      context.urlComponents.domain,
      config.checkWeights
    );
    findings.push(...typosquatFindings);

    // HTTP-based checks
    if (context.httpResponse?.body) {
      const body = context.httpResponse.body;

      // Check 2: Brand Content Mismatch
      const contentFindings = this.checkBrandContentMismatch(
        body,
        context.urlComponents.domain,
        config.checkWeights
      );
      findings.push(...contentFindings);

      // Check 3: Favicon Analysis
      const faviconFindings = this.checkFavicon(
        body,
        context.urlComponents.domain,
        config.checkWeights
      );
      findings.push(...faviconFindings);

      // Check 4: Copyright/Trademark Violations
      const copyrightFindings = this.checkCopyrightViolations(
        body,
        context.urlComponents.domain,
        config.checkWeights
      );
      findings.push(...copyrightFindings);
    }

    const score = this.calculateScore(findings, config.maxWeight);
    const duration = Date.now() - startTime;

    logger.info(`[Brand Impersonation] Complete: ${score}/${config.maxWeight} points, ${findings.length} findings (${duration}ms)`);

    return {
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      score,
      maxWeight: config.maxWeight,
      findings,
      metadata: {
        checksRun: context.httpResponse?.body ? 4 : 1,
        checksSkipped: context.httpResponse?.body ? 0 : 3,
        duration,
        skipped: false
      }
    };
  }

  /**
   * Check for domain typosquatting
   */
  private checkTyposquatting(
    domain: string,
    weights: Record<string, number>
  ): Finding[] {
    const findings: Finding[] = [];
    const domainLower = domain.toLowerCase();

    for (const brand of BrandImpersonationCategory.MAJOR_BRANDS) {
      // Check if domain matches brand
      if (domainLower.includes(brand.domain)) {
        // Exact match or legitimate subdomain - skip
        continue;
      }

      // Check for typosquatting patterns
      for (const keyword of brand.keywords) {
        if (domainLower.includes(keyword) && keyword !== brand.domain) {
          findings.push(this.createFinding(
            'brand_typosquatting',
            'Domain Typosquatting Detected',
            'high',
            weights.brand_typosquatting || 10,
            `Domain impersonates ${brand.name} (${brand.domain})`,
            { brand: brand.name, legitimateDomain: brand.domain, domain }
          ));
          return findings; // Only report once
        }
      }
    }

    return findings;
  }

  /**
   * Check for brand mentions in content without matching domain
   */
  private checkBrandContentMismatch(
    body: string,
    domain: string,
    weights: Record<string, number>
  ): Finding[] {
    const findings: Finding[] = [];
    const bodyLower = body.toLowerCase();
    const domainLower = domain.toLowerCase();

    for (const brand of BrandImpersonationCategory.MAJOR_BRANDS) {
      // Skip if domain legitimately matches brand
      if (domainLower.includes(brand.domain.replace('.com', ''))) {
        continue;
      }

      // Check if content mentions brand
      const brandMentioned = brand.keywords.some(keyword =>
        bodyLower.includes(keyword)
      );

      if (brandMentioned) {
        // Extract title for evidence
        const titleMatch = body.match(/<title[^>]*>([\s\S]{0,100})/i);
        const title = titleMatch ? titleMatch[1].slice(0, 50) : '';

        findings.push(this.createFinding(
          'brand_content_mismatch',
          'Brand Content Mismatch',
          'high',
          weights.brand_content_mismatch || 8,
          `Content impersonates ${brand.name} but domain doesn't match`,
          { brand: brand.name, domain, title }
        ));
        return findings; // Only report once
      }
    }

    return findings;
  }

  /**
   * Check for favicon from legitimate sites (hotlinking)
   */
  private checkFavicon(
    body: string,
    domain: string,
    weights: Record<string, number>
  ): Finding[] {
    const findings: Finding[] = [];

    // Extract favicon links
    const faviconMatches = body.match(/<link[^>]*rel\s*=\s*["'](?:shortcut )?icon["'][^>]*>/gi) || [];

    for (const faviconLink of faviconMatches) {
      const hrefMatch = faviconLink.match(/href\s*=\s*["']([^"']+)["']/i);
      if (hrefMatch) {
        const faviconUrl = hrefMatch[1];

        // Check if favicon is from a different major domain
        for (const brand of BrandImpersonationCategory.MAJOR_BRANDS) {
          if (faviconUrl.includes(brand.domain) && !domain.includes(brand.domain.replace('.com', ''))) {
            findings.push(this.createFinding(
              'brand_favicon_hotlink',
              'Favicon Hotlinked from Legitimate Site',
              'medium',
              weights.brand_favicon_hotlink || 6,
              `Favicon loaded from ${brand.name} (${brand.domain})`,
              { brand: brand.name, faviconUrl }
            ));
            return findings;
          }
        }
      }
    }

    return findings;
  }

  /**
   * Check for copyright/trademark violations
   */
  private checkCopyrightViolations(
    body: string,
    domain: string,
    weights: Record<string, number>
  ): Finding[] {
    const findings: Finding[] = [];

    // Look for copyright statements
    const copyrightMatches = body.match(/©.*?(?:<|$)/gi) ||
                            body.match(/copyright.*?(?:<|$)/gi) || [];

    for (const copyrightText of copyrightMatches) {
      for (const brand of BrandImpersonationCategory.MAJOR_BRANDS) {
        // If copyright mentions brand but domain doesn't match
        if (copyrightText.toLowerCase().includes(brand.name.toLowerCase()) &&
            !domain.includes(brand.domain.replace('.com', ''))) {

          findings.push(this.createFinding(
            'brand_copyright_violation',
            'Copyright/Trademark Violation',
            'medium',
            weights.brand_copyright_violation || 5,
            `Uses ${brand.name} copyright/trademark without authorization`,
            { brand: brand.name, copyrightText: copyrightText.slice(0, 50) }
          ));
          return findings;
        }
      }
    }

    return findings;
  }
}
