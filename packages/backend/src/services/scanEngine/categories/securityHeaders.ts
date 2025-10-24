/**
 * Category 16: Security Headers (25 points)
 *
 * Checks:
 * - Missing HSTS (8 pts)
 * - Missing CSP (7 pts)
 * - Missing X-Frame-Options (5 pts)
 * - Missing X-Content-Type-Options (3 pts)
 * - Weak/missing Referrer-Policy (2 pts)
 *
 * Runs in: FULL, WAF pipelines
 */

import {
  CategoryAnalyzer,
  CategoryResult,
  CategoryContext,
  Finding
} from '../categoryBase.js';
import { ReachabilityState } from '../types.js';
import { logger } from '../../../config/logger.js';

export class SecurityHeadersCategory extends CategoryAnalyzer {
  constructor() {
    super('securityHeaders', 'Security Headers');
  }

  shouldRun(reachabilityState: ReachabilityState, pipelineType: string): boolean {
    return reachabilityState === ReachabilityState.ONLINE ||
           reachabilityState === ReachabilityState.WAF_CHALLENGE;
  }

  async analyze(context: CategoryContext): Promise<CategoryResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const config = context.config.securityHeaders;

    if (!context.httpResponse?.headers) {
      return this.createSkippedResult('No HTTP headers', config.maxWeight);
    }

    const headers = context.httpResponse.headers;
    const headersLower: Record<string, string> = {};
    Object.keys(headers).forEach(key => {
      headersLower[key.toLowerCase()] = headers[key];
    });

    logger.debug(`[Security Headers] Analyzing headers for: ${context.url}`);

    // Check HSTS
    if (!headersLower['strict-transport-security']) {
      findings.push(this.createFinding(
        'security_header_missing_hsts',
        'Missing HSTS Header',
        'medium',
        config.checkWeights.security_header_missing_hsts || 8,
        'Strict-Transport-Security header not set',
        {}
      ));
    }

    // Check CSP
    if (!headersLower['content-security-policy']) {
      findings.push(this.createFinding(
        'security_header_missing_csp',
        'Missing CSP Header',
        'medium',
        config.checkWeights.security_header_missing_csp || 7,
        'Content-Security-Policy header not set',
        {}
      ));
    }

    // Check X-Frame-Options
    if (!headersLower['x-frame-options']) {
      findings.push(this.createFinding(
        'security_header_missing_xfo',
        'Missing X-Frame-Options',
        'medium',
        config.checkWeights.security_header_missing_xfo || 5,
        'X-Frame-Options header not set (clickjacking risk)',
        {}
      ));
    }

    // Check X-Content-Type-Options
    if (!headersLower['x-content-type-options']) {
      findings.push(this.createFinding(
        'security_header_missing_xcto',
        'Missing X-Content-Type-Options',
        'low',
        config.checkWeights.security_header_missing_xcto || 3,
        'X-Content-Type-Options header not set',
        {}
      ));
    }

    // Check Referrer-Policy
    if (!headersLower['referrer-policy']) {
      findings.push(this.createFinding(
        'security_header_missing_referrer',
        'Missing Referrer-Policy',
        'low',
        config.checkWeights.security_header_missing_referrer || 2,
        'Referrer-Policy header not set',
        {}
      ));
    }

    const score = this.calculateScore(findings, config.maxWeight);
    const duration = Date.now() - startTime;

    logger.info(`[Security Headers] Complete: ${score}/${config.maxWeight} points, ${findings.length} findings (${duration}ms)`);

    return {
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      score,
      maxWeight: config.maxWeight,
      findings,
      metadata: {
        checksRun: 5,
        checksSkipped: 0,
        duration,
        skipped: false
      }
    };
  }
}
