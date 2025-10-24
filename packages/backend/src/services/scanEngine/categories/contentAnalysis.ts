/**
 * Category 3: Content Analysis (40 points)
 *
 * Checks:
 * - Suspicious keywords (malware, phishing terms: 12 pts)
 * - Code obfuscation (base64, eval: 10 pts)
 * - Suspicious external resources (8 pts)
 * - Minimal/empty content (landing page scam: 7 pts)
 * - Content-domain mismatch (6 pts)
 * - Excessive redirects in HTML (5 pts)
 * - Suspicious meta tags (auto-refresh: 5 pts)
 *
 * Runs in: FULL, PARKED, WAF pipelines (requires HTTP response)
 */

import {
  CategoryAnalyzer,
  CategoryResult,
  CategoryContext,
  Finding
} from '../categoryBase.js';
import { ReachabilityState } from '../types.js';
import { logger } from '../../../config/logger.js';

export class ContentAnalysisCategory extends CategoryAnalyzer {
  // Suspicious keywords (malware/scam indicators)
  private static readonly SUSPICIOUS_KEYWORDS = [
    'download.exe', 'install.exe', 'setup.exe', 'crack', 'keygen',
    'warez', 'torrent', 'free download', 'casino', 'poker',
    'viagra', 'cialis', 'pharmacy', 'weight loss', 'diet pills',
    'make money fast', 'work from home', 'get rich', 'million dollars',
    'nigerian prince', 'inheritance', 'lottery winner', 'tax refund'
  ];

  // Obfuscation patterns
  private static readonly OBFUSCATION_PATTERNS = [
    /eval\s*\(/gi,
    /document\.write\s*\(/gi,
    /fromCharCode/gi,
    /unescape\s*\(/gi,
    /atob\s*\(/gi,  // base64 decode
    /String\.fromCharCode/gi,
    /\\x[0-9a-f]{2}/gi,  // hex encoding
    /\\u[0-9a-f]{4}/gi   // unicode encoding
  ];

  // Suspicious URL patterns in content
  private static readonly SUSPICIOUS_URL_PATTERNS = [
    /bit\.ly|tinyurl|goo\.gl|ow\.ly|is\.gd/i,  // URL shorteners
    /\.tk|\.ml|\.ga|\.cf|\.gq/i,               // Free TLDs
    /\/\/(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\./  // IP addresses
  ];

  // Foreign language Unicode ranges (for scam code reuse detection)
  private static readonly FOREIGN_LANGUAGE_PATTERNS = {
    chinese: /[\u4E00-\u9FFF\u3400-\u4DBF]/g,  // Chinese (Simplified & Traditional)
    russian: /[\u0400-\u04FF]/g,                // Cyrillic (Russian)
    arabic: /[\u0600-\u06FF]/g,                 // Arabic
    vietnamese: /[\u1EA0-\u1EF9]/g,            // Vietnamese
    thai: /[\u0E00-\u0E7F]/g                   // Thai
  };

  constructor() {
    super('contentAnalysis', 'Content Analysis');
  }

  shouldRun(reachabilityState: ReachabilityState, pipelineType: string): boolean {
    // Requires HTTP response
    return reachabilityState === ReachabilityState.ONLINE ||
           reachabilityState === ReachabilityState.PARKED ||
           reachabilityState === ReachabilityState.WAF_CHALLENGE;
  }

  async analyze(context: CategoryContext): Promise<CategoryResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const config = context.config.contentAnalysis;

    if (!context.httpResponse?.body) {
      return this.createSkippedResult('No HTTP response body', config.maxWeight);
    }

    const body = context.httpResponse.body;
    const bodyLower = body.toLowerCase();

    logger.debug(`[Content Analysis] Starting analysis for: ${context.url}`);

    // Check 1: Suspicious Keywords
    const keywordFindings = this.checkSuspiciousKeywords(
      bodyLower,
      config.checkWeights
    );
    findings.push(...keywordFindings);

    // Check 2: Code Obfuscation
    const obfuscationFindings = this.checkObfuscation(
      body,
      config.checkWeights
    );
    findings.push(...obfuscationFindings);

    // Check 3: Suspicious External Resources
    const resourceFindings = this.checkExternalResources(
      body,
      context.urlComponents.hostname,
      config.checkWeights
    );
    findings.push(...resourceFindings);

    // Check 4: Minimal/Empty Content
    const contentFindings = this.checkContentQuality(
      body,
      config.checkWeights
    );
    findings.push(...contentFindings);

    // Check 5: Content-Domain Mismatch
    const mismatchFindings = this.checkContentDomainMismatch(
      body,
      context.urlComponents.domain,
      config.checkWeights
    );
    findings.push(...mismatchFindings);

    // Check 6: Suspicious Meta Tags
    const metaFindings = this.checkSuspiciousMetaTags(
      body,
      config.checkWeights
    );
    findings.push(...metaFindings);

    // Check 7: Excessive Redirects in HTML
    const redirectFindings = this.checkHTMLRedirects(
      body,
      config.checkWeights
    );
    findings.push(...redirectFindings);

    // Check 8: Foreign Language Script Detection (ENHANCED)
    const foreignLangFindings = this.checkForeignLanguageScripts(
      body,
      config.checkWeights
    );
    findings.push(...foreignLangFindings);

    // Calculate final score
    const score = this.calculateScore(findings, config.maxWeight);
    const duration = Date.now() - startTime;

    logger.info(`[Content Analysis] Complete: ${score}/${config.maxWeight} points, ${findings.length} findings (${duration}ms)`);

    return {
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      score,
      maxWeight: config.maxWeight,
      findings,
      metadata: {
        checksRun: 8,
        checksSkipped: 0,
        duration,
        skipped: false
      }
    };
  }

  /**
   * Check for suspicious keywords
   */
  private checkSuspiciousKeywords(bodyLower: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matchedKeywords: string[] = [];

    for (const keyword of ContentAnalysisCategory.SUSPICIOUS_KEYWORDS) {
      if (bodyLower.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }

    if (matchedKeywords.length > 0) {
      const severity = matchedKeywords.length >= 3 ? 'high' : 'medium';
      const score = matchedKeywords.length >= 3 ? 12 : 8;

      findings.push(this.createFinding(
        'content_suspicious_keywords',
        'Suspicious Keywords Detected',
        severity,
        weights.content_suspicious_keywords || score,
        `Found ${matchedKeywords.length} suspicious keyword(s)`,
        { keywords: matchedKeywords.slice(0, 5) } // Limit to first 5
      ));
    }

    return findings;
  }

  /**
   * Check for code obfuscation
   */
  private checkObfuscation(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matchedPatterns: string[] = [];

    for (const pattern of ContentAnalysisCategory.OBFUSCATION_PATTERNS) {
      const matches = body.match(pattern);
      if (matches && matches.length > 0) {
        matchedPatterns.push(`${pattern.source} (${matches.length}x)`);
      }
    }

    if (matchedPatterns.length >= 2) {
      findings.push(this.createFinding(
        'content_code_obfuscation',
        'Code Obfuscation Detected',
        'high',
        weights.content_code_obfuscation || 10,
        `Found ${matchedPatterns.length} obfuscation patterns`,
        { patterns: matchedPatterns }
      ));
    }

    // Check for base64-encoded scripts (large base64 strings in JS)
    const base64InScript = body.match(/<script[^>]*>[\s\S]*?[A-Za-z0-9+/]{100,}=*[\s\S]*?<\/script>/gi);
    if (base64InScript && base64InScript.length > 0) {
      findings.push(this.createFinding(
        'content_base64_in_script',
        'Base64-Encoded Script Content',
        'high',
        weights.content_base64_in_script || 10,
        'Found suspicious base64-encoded content in scripts',
        { count: base64InScript.length }
      ));
    }

    return findings;
  }

  /**
   * Check for suspicious external resources
   */
  private checkExternalResources(body: string, hostname: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Extract all external URLs (src, href)
    const urlMatches = body.match(/(src|href)\s*=\s*["']https?:\/\/[^"']+["']/gi) || [];
    const externalUrls: string[] = [];
    const suspiciousUrls: string[] = [];

    for (const match of urlMatches) {
      const urlMatch = match.match(/["'](https?:\/\/[^"']+)["']/);
      if (urlMatch) {
        const url = urlMatch[1];
        const urlHostname = new URL(url).hostname;

        // Check if external (different domain)
        if (!urlHostname.includes(hostname) && !hostname.includes(urlHostname)) {
          externalUrls.push(url);

          // Check if suspicious
          for (const pattern of ContentAnalysisCategory.SUSPICIOUS_URL_PATTERNS) {
            if (pattern.test(url)) {
              suspiciousUrls.push(url);
              break;
            }
          }
        }
      }
    }

    // If loading resources from suspicious sources
    if (suspiciousUrls.length > 0) {
      findings.push(this.createFinding(
        'content_suspicious_external_resources',
        'Suspicious External Resources',
        'high',
        weights.content_suspicious_external_resources || 10,
        `Loads ${suspiciousUrls.length} resource(s) from suspicious domains`,
        { suspiciousUrls: suspiciousUrls.slice(0, 3) }
      ));
    }

    // If loading many external resources (potential tracking/malware)
    if (externalUrls.length >= 10) {
      findings.push(this.createFinding(
        'content_excessive_external_resources',
        'Excessive External Resources',
        'low',
        weights.content_excessive_external_resources || 5,
        `Loads ${externalUrls.length} external resources`,
        { count: externalUrls.length }
      ));
    }

    return findings;
  }

  /**
   * Check content quality (minimal/empty content)
   */
  private checkContentQuality(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Remove HTML tags to get text content
    const textContent = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const textLength = textContent.length;

    // Very minimal content (< 100 characters)
    if (textLength < 100) {
      findings.push(this.createFinding(
        'content_minimal_content',
        'Minimal Content',
        'medium',
        weights.content_minimal_content || 7,
        `Page has very little content (${textLength} characters)`,
        { textLength }
      ));
    }

    // Check for parking page indicators
    const parkingIndicators = [
      'domain for sale',
      'buy this domain',
      'parked free',
      'domain parking'
    ];

    for (const indicator of parkingIndicators) {
      if (textContent.toLowerCase().includes(indicator)) {
        findings.push(this.createFinding(
          'content_parking_page',
          'Parking Page Detected',
          'medium',
          weights.content_parking_page || 6,
          'Page appears to be a domain parking page',
          { indicator }
        ));
        break;
      }
    }

    return findings;
  }

  /**
   * Check for content-domain mismatch
   */
  private checkContentDomainMismatch(body: string, domain: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Extract title
    const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1].toLowerCase();
      const domainLower = domain.toLowerCase();

      // Check if title mentions a different brand/company
      const commonBrands = ['paypal', 'amazon', 'google', 'microsoft', 'apple', 'facebook'];
      for (const brand of commonBrands) {
        if (title.includes(brand) && !domainLower.includes(brand)) {
          findings.push(this.createFinding(
            'content_domain_mismatch',
            'Content-Domain Mismatch',
            'medium',
            weights.content_domain_mismatch || 8,
            `Title mentions "${brand}" but domain is "${domain}"`,
            { title: title.slice(0, 50), domain, brand }
          ));
          break;
        }
      }
    }

    return findings;
  }

  /**
   * Check for suspicious meta tags
   */
  private checkSuspiciousMetaTags(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Check for meta refresh (auto-redirect)
    const metaRefresh = body.match(/<meta[^>]*http-equiv\s*=\s*["']refresh["'][^>]*>/gi);
    if (metaRefresh && metaRefresh.length > 0) {
      findings.push(this.createFinding(
        'content_meta_refresh',
        'Meta Refresh Redirect',
        'medium',
        weights.content_meta_refresh || 6,
        'Page uses meta refresh for auto-redirect (potential cloaking)',
        { count: metaRefresh.length }
      ));
    }

    return findings;
  }

  /**
   * Check for excessive HTML redirects
   */
  private checkHTMLRedirects(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Check for JavaScript redirects
    const jsRedirects = body.match(/window\.location\s*=|location\.href\s*=|location\.replace/gi);
    if (jsRedirects && jsRedirects.length >= 2) {
      findings.push(this.createFinding(
        'content_multiple_js_redirects',
        'Multiple JavaScript Redirects',
        'medium',
        weights.content_multiple_js_redirects || 7,
        `Found ${jsRedirects.length} JavaScript redirect(s) (potential cloaking)`,
        { count: jsRedirects.length }
      ));
    }

    return findings;
  }

  /**
   * ENHANCED: Check for foreign language scripts (scam code reuse indicator)
   * Detects non-English characters in JavaScript code - common in scam template reuse
   */
  private checkForeignLanguageScripts(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Extract <script> tags content
    const scriptTags = body.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
    const scriptContent = scriptTags.join('\n');

    // Also check JavaScript event handlers in HTML
    const inlineJS = body.match(/on\w+\s*=\s*["'][^"']*["']/gi) || [];
    const inlineJSContent = inlineJS.join('\n');

    const allJS = scriptContent + '\n' + inlineJSContent;

    // Detect foreign language characters in scripts
    const detectedLanguages: { language: string; count: number; samples: string[] }[] = [];

    for (const [langName, pattern] of Object.entries(ContentAnalysisCategory.FOREIGN_LANGUAGE_PATTERNS)) {
      const matches = allJS.match(pattern);
      if (matches && matches.length > 0) {
        detectedLanguages.push({
          language: langName,
          count: matches.length,
          samples: Array.from(new Set(matches)).slice(0, 5) // First 5 unique chars
        });
      }
    }

    if (detectedLanguages.length > 0) {
      const totalChars = detectedLanguages.reduce((sum, lang) => sum + lang.count, 0);
      const languages = detectedLanguages.map(l => l.language).join(', ');

      // Severity based on number of foreign characters
      let severity: 'high' | 'medium' | 'low' = 'low';
      let score = 5;

      if (totalChars > 50) {
        severity = 'high';
        score = 10;
      } else if (totalChars > 10) {
        severity = 'medium';
        score = 8;
      }

      findings.push(this.createFinding(
        'content_foreign_language_script',
        'Foreign Language Script Detection',
        severity,
        weights.content_foreign_language_script || score,
        `Detected ${languages} characters in JavaScript code (${totalChars} chars) - common in scam template reuse`,
        {
          detectedLanguages,
          totalChars,
          scriptTagCount: scriptTags.length
        }
      ));
    }

    return findings;
  }
}
