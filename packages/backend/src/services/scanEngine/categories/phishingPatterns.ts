/**
 * Category 4: Phishing Patterns (50 points)
 *
 * Checks:
 * - Login/password forms (unsolicited: 20 pts)
 * - Credential harvesting patterns (15 pts)
 * - Brand impersonation (visual + text: 15 pts)
 * - Urgency/scare tactics (12 pts)
 * - Suspicious form actions (external POST: 10 pts)
 * - Hidden iframes for credential theft (8 pts)
 * - Fake security indicators (7 pts)
 *
 * Runs in: FULL, PARKED pipelines (requires HTTP response)
 */

import {
  CategoryAnalyzer,
  CategoryResult,
  CategoryContext,
  Finding
} from '../categoryBase.js';
import { ReachabilityState } from '../types.js';
import { logger } from '../../../config/logger.js';

export class PhishingPatternsCategory extends CategoryAnalyzer {
  // Urgency/scare tactic patterns
  private static readonly URGENCY_PATTERNS = [
    /urgent|immediately|act now|limited time|expires today/i,
    /verify (your )?account|confirm (your )?identity|update (your )?information/i,
    /suspended|locked|blocked|restricted|compromised|unauthorized/i,
    /security (alert|warning|notice)|unusual activity/i,
    /claim (your )?prize|you('ve| have) won|congratulations/i,
    /click here (now|immediately)|act within|final (notice|warning)/i,
    /refund|tax return|payment (failed|declined|pending)/i
  ];

  // Brand impersonation keywords (commonly phished brands)
  private static readonly BRAND_KEYWORDS = [
    'paypal', 'amazon', 'microsoft', 'apple', 'google',
    'facebook', 'netflix', 'ebay', 'instagram', 'twitter',
    'linkedin', 'bank', 'wells fargo', 'chase', 'citibank',
    'irs', 'fedex', 'ups', 'dhl', 'usps'
  ];

  // Suspicious form field names (credential harvesting)
  private static readonly CREDENTIAL_FIELD_PATTERNS = [
    /password|passwd|pwd/i,
    /(user)?name|login|email|username/i,
    /ssn|social.?security/i,
    /card.?number|cvv|cvc|credit.?card/i,
    /pin|account.?number|routing.?number/i,
    /mother.?maiden|security.?question/i
  ];

  // Fake security indicator patterns
  private static readonly FAKE_SECURITY_PATTERNS = [
    /secured? by|protected by|verified by|trusted by/i,
    /ssl.?(secured?|protected|encrypted)/i,
    /100% safe|100% secure|bank.?level security/i,
    /norton|mcafee|verisign|truste/i  // Fake security badges
  ];

  constructor() {
    super('phishingPatterns', 'Phishing Patterns');
  }

  shouldRun(reachabilityState: ReachabilityState, pipelineType: string): boolean {
    // Requires HTTP response body
    return reachabilityState === ReachabilityState.ONLINE ||
           reachabilityState === ReachabilityState.PARKED;
  }

  async analyze(context: CategoryContext): Promise<CategoryResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const config = context.config.phishingPatterns;

    if (!context.httpResponse?.body) {
      return this.createSkippedResult('No HTTP response body', config.maxWeight);
    }

    const body = context.httpResponse.body;
    const bodyLower = body.toLowerCase();

    logger.debug(`[Phishing Patterns] Starting analysis for: ${context.url}`);

    // Check 1: Login/Password Forms
    const formFindings = this.checkLoginForms(
      body,
      context.urlComponents.hostname,
      config.checkWeights
    );
    findings.push(...formFindings);

    // Check 2: Credential Harvesting Patterns
    const credentialFindings = this.checkCredentialHarvesting(
      body,
      config.checkWeights
    );
    findings.push(...credentialFindings);

    // Check 3: Brand Impersonation
    const brandFindings = this.checkBrandImpersonation(
      body,
      context.urlComponents.domain,
      config.checkWeights
    );
    findings.push(...brandFindings);

    // Check 4: Urgency/Scare Tactics
    const urgencyFindings = this.checkUrgencyTactics(
      body,
      config.checkWeights
    );
    findings.push(...urgencyFindings);

    // Check 5: Suspicious Form Actions
    const formActionFindings = this.checkFormActions(
      body,
      context.urlComponents.hostname,
      config.checkWeights
    );
    findings.push(...formActionFindings);

    // Check 6: Hidden iframes
    const iframeFindings = this.checkHiddenIframes(
      body,
      config.checkWeights
    );
    findings.push(...iframeFindings);

    // Check 7: Fake Security Indicators
    const fakeSecurityFindings = this.checkFakeSecurityIndicators(
      body,
      config.checkWeights
    );
    findings.push(...fakeSecurityFindings);

    // Calculate final score
    const score = this.calculateScore(findings, config.maxWeight);
    const duration = Date.now() - startTime;

    logger.info(`[Phishing Patterns] Complete: ${score}/${config.maxWeight} points, ${findings.length} findings (${duration}ms)`);

    return {
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      score,
      maxWeight: config.maxWeight,
      findings,
      metadata: {
        checksRun: 7,
        checksSkipped: 0,
        duration,
        skipped: false
      }
    };
  }

  /**
   * Check for login/password forms
   */
  private checkLoginForms(body: string, hostname: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Check for password input fields
    const passwordFields = body.match(/<input[^>]*type\s*=\s*["']password["'][^>]*>/gi) || [];

    if (passwordFields.length > 0) {
      // Multiple password fields = registration or credential harvesting
      if (passwordFields.length >= 2) {
        findings.push(this.createFinding(
          'phishing_multiple_password_fields',
          'Multiple Password Fields',
          'high',
          weights.phishing_multiple_password_fields || 15,
          `Found ${passwordFields.length} password fields (potential credential harvesting)`,
          { count: passwordFields.length }
        ));
      } else {
        // Single password field
        findings.push(this.createFinding(
          'phishing_login_form',
          'Login Form Present',
          'medium',
          weights.phishing_login_form || 10,
          'Page contains login form',
          { passwordFieldsCount: 1 }
        ));
      }
    }

    return findings;
  }

  /**
   * Check for credential harvesting patterns
   */
  private checkCredentialHarvesting(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Extract all input field names
    const inputFields = body.match(/<input[^>]*name\s*=\s*["']([^"']+)["'][^>]*>/gi) || [];
    const fieldNames = inputFields.map(input => {
      const match = input.match(/name\s*=\s*["']([^"']+)["']/i);
      return match ? match[1].toLowerCase() : '';
    });

    // Count sensitive fields
    let sensitiveFieldCount = 0;
    const detectedSensitiveFields: string[] = [];

    for (const fieldName of fieldNames) {
      for (const pattern of PhishingPatternsCategory.CREDENTIAL_FIELD_PATTERNS) {
        if (pattern.test(fieldName)) {
          sensitiveFieldCount++;
          detectedSensitiveFields.push(fieldName);
          break;
        }
      }
    }

    // If collecting many sensitive fields = credential harvesting
    if (sensitiveFieldCount >= 3) {
      findings.push(this.createFinding(
        'phishing_credential_harvesting',
        'Credential Harvesting Pattern',
        'critical',
        weights.phishing_credential_harvesting || 20,
        `Collects ${sensitiveFieldCount} sensitive fields`,
        { sensitiveFieldCount, fields: detectedSensitiveFields }
      ));
    }

    return findings;
  }

  /**
   * Check for brand impersonation
   */
  private checkBrandImpersonation(body: string, domain: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const bodyLower = body.toLowerCase();
    const domainLower = domain.toLowerCase();

    // Check if domain doesn't contain brand but content does
    for (const brand of PhishingPatternsCategory.BRAND_KEYWORDS) {
      if (bodyLower.includes(brand) && !domainLower.includes(brand)) {
        // Found brand mention without matching domain = potential impersonation
        findings.push(this.createFinding(
          'phishing_brand_impersonation',
          'Potential Brand Impersonation',
          'high',
          weights.phishing_brand_impersonation || 15,
          `Content mentions "${brand}" but domain doesn't match`,
          { brand, domain }
        ));
        break; // Only report once
      }
    }

    return findings;
  }

  /**
   * Check for urgency/scare tactics
   */
  private checkUrgencyTactics(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matchedPatterns: string[] = [];

    for (const pattern of PhishingPatternsCategory.URGENCY_PATTERNS) {
      if (pattern.test(body)) {
        matchedPatterns.push(pattern.source);
      }
    }

    if (matchedPatterns.length >= 2) {
      findings.push(this.createFinding(
        'phishing_urgency_tactics',
        'Urgency/Scare Tactics Detected',
        'high',
        weights.phishing_urgency_tactics || 12,
        `Found ${matchedPatterns.length} urgency indicators`,
        { count: matchedPatterns.length, patterns: matchedPatterns }
      ));
    }

    return findings;
  }

  /**
   * Check for suspicious form actions (external POST)
   */
  private checkFormActions(body: string, hostname: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Extract form actions
    const forms = body.match(/<form[^>]*>/gi) || [];

    for (const form of forms) {
      const actionMatch = form.match(/action\s*=\s*["']([^"']+)["']/i);
      const methodMatch = form.match(/method\s*=\s*["'](post|get)["']/i);

      if (actionMatch && methodMatch && methodMatch[1].toLowerCase() === 'post') {
        const action = actionMatch[1];

        // Check if action is external (different domain)
        if (action.startsWith('http') && !action.includes(hostname)) {
          findings.push(this.createFinding(
            'phishing_external_form_post',
            'External Form POST',
            'critical',
            weights.phishing_external_form_post || 18,
            `Form POSTs to external domain: ${action}`,
            { action, method: 'POST' }
          ));
        }
      }
    }

    return findings;
  }

  /**
   * Check for hidden iframes (credential theft)
   */
  private checkHiddenIframes(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Check for iframes with hidden/zero size
    const iframes = body.match(/<iframe[^>]*>/gi) || [];

    for (const iframe of iframes) {
      const isHidden = /style\s*=\s*["'][^"']*display\s*:\s*none[^"']*["']/i.test(iframe) ||
                       /style\s*=\s*["'][^"']*visibility\s*:\s*hidden[^"']*["']/i.test(iframe) ||
                       /width\s*=\s*["']0["']/i.test(iframe) ||
                       /height\s*=\s*["']0["']/i.test(iframe);

      if (isHidden) {
        findings.push(this.createFinding(
          'phishing_hidden_iframe',
          'Hidden iframe Detected',
          'high',
          weights.phishing_hidden_iframe || 12,
          'Page contains hidden iframe (potential credential theft)',
          { iframe: iframe.slice(0, 100) }
        ));
        break; // Only report once
      }
    }

    return findings;
  }

  /**
   * Check for fake security indicators
   */
  private checkFakeSecurityIndicators(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matchedPatterns: string[] = [];

    for (const pattern of PhishingPatternsCategory.FAKE_SECURITY_PATTERNS) {
      if (pattern.test(body)) {
        matchedPatterns.push(pattern.source);
      }
    }

    if (matchedPatterns.length >= 2) {
      findings.push(this.createFinding(
        'phishing_fake_security_indicators',
        'Fake Security Indicators',
        'medium',
        weights.phishing_fake_security_indicators || 8,
        `Found ${matchedPatterns.length} fake security claims`,
        { count: matchedPatterns.length }
      ));
    }

    return findings;
  }
}
