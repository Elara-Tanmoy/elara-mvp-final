/**
 * Category 15: Legal & Compliance (35 points)
 *
 * Checks:
 * - Jurisdiction risk (high-risk countries: 15 pts)
 * - Missing Terms of Service (10 pts)
 * - Gambling/adult content without age verification (8 pts)
 * - COPPA violations (children's data: 7 pts)
 * - Misleading business practices (5 pts)
 *
 * Runs in: FULL, PASSIVE pipelines (partial DNS-based checks)
 */

import {
  CategoryAnalyzer,
  CategoryResult,
  CategoryContext,
  Finding
} from '../categoryBase.js';
import { ReachabilityState } from '../types.js';
import { logger } from '../../../config/logger.js';

export class LegalComplianceCategory extends CategoryAnalyzer {
  // High-risk jurisdiction TLDs and country codes
  private static readonly HIGH_RISK_JURISDICTIONS = new Set([
    'ru', 'cn', 'ir', 'kp', 'sy',  // Sanctioned/high-risk countries
    'tk', 'ml', 'ga', 'cf', 'gq'   // Unregulated free TLDs
  ]);

  // Medium-risk jurisdictions (limited regulation)
  private static readonly MEDIUM_RISK_JURISDICTIONS = new Set([
    'bz', 'ws', 'to', 'cc', 'tv', 'cx'
  ]);

  // Terms of Service patterns
  private static readonly TOS_PATTERNS = [
    /terms\s+(of\s+)?(service|use)/i,
    /terms\s+and\s+conditions/i,
    /user\s+agreement/i,
    /tos\.html/i,
    /terms\.html/i
  ];

  // Gambling/betting indicators
  private static readonly GAMBLING_PATTERNS = [
    /casino|poker|blackjack|roulette|slots/i,
    /betting|wager|gamble/i,
    /lottery|jackpot|prize/i,
    /sports\s+betting|horse\s+racing/i
  ];

  // Adult content indicators
  private static readonly ADULT_CONTENT_PATTERNS = [
    /xxx|adult|porn|sex|nude/i,
    /18\+|21\+|adult\s+content/i,
    /escort|webcam|dating/i
  ];

  // Age verification patterns
  private static readonly AGE_VERIFICATION_PATTERNS = [
    /age\s+verification/i,
    /are\s+you\s+18/i,
    /must\s+be\s+(\d+)\+/i,
    /enter\s+your\s+(birth)?date/i
  ];

  // Children's content indicators (COPPA)
  private static readonly CHILDREN_CONTENT_PATTERNS = [
    /kids|children|child/i,
    /cartoon|toy|game/i,
    /educational|learning/i,
    /age\s+3-12|ages\s+\d+-\d+/i
  ];

  constructor() {
    super('legalCompliance', 'Legal & Compliance');
  }

  shouldRun(reachabilityState: ReachabilityState, pipelineType: string): boolean {
    // Can run in FULL and PASSIVE (some checks are TLD-based)
    return reachabilityState === ReachabilityState.ONLINE ||
           reachabilityState === ReachabilityState.OFFLINE;
  }

  async analyze(context: CategoryContext): Promise<CategoryResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const config = context.config.legalCompliance;

    logger.debug(`[Legal Compliance] Analyzing compliance for: ${context.url}`);

    // Check 1: Jurisdiction Risk (TLD-based, always available)
    const jurisdictionFindings = this.checkJurisdiction(
      context.urlComponents.tld,
      context.whoisData,
      config.checkWeights
    );
    findings.push(...jurisdictionFindings);

    // HTTP-based checks (only if ONLINE)
    if (context.httpResponse?.body) {
      const body = context.httpResponse.body;

      // Check 2: Terms of Service
      const tosFindings = this.checkTermsOfService(body, config.checkWeights);
      findings.push(...tosFindings);

      // Check 3: Gambling/Adult Content
      const restrictedContentFindings = this.checkRestrictedContent(body, config.checkWeights);
      findings.push(...restrictedContentFindings);

      // Check 4: COPPA Compliance
      const coppaFindings = this.checkCOPPACompliance(body, config.checkWeights);
      findings.push(...coppaFindings);

      // Check 5: Misleading Business Practices
      const misleadingFindings = this.checkMisleadingPractices(body, config.checkWeights);
      findings.push(...misleadingFindings);
    }

    const score = this.calculateScore(findings, config.maxWeight);
    const duration = Date.now() - startTime;

    logger.info(`[Legal Compliance] Complete: ${score}/${config.maxWeight} points, ${findings.length} findings (${duration}ms)`);

    return {
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      score,
      maxWeight: config.maxWeight,
      findings,
      metadata: {
        checksRun: context.httpResponse?.body ? 5 : 1,
        checksSkipped: context.httpResponse?.body ? 0 : 4,
        duration,
        skipped: false
      }
    };
  }

  /**
   * Check jurisdiction risk based on TLD and WHOIS
   */
  private checkJurisdiction(
    tld: string,
    whoisData: any,
    weights: Record<string, number>
  ): Finding[] {
    const findings: Finding[] = [];

    if (LegalComplianceCategory.HIGH_RISK_JURISDICTIONS.has(tld)) {
      findings.push(this.createFinding(
        'legal_high_risk_jurisdiction',
        'High-Risk Jurisdiction',
        'high',
        weights.legal_high_risk_jurisdiction || 15,
        `Domain registered in high-risk jurisdiction (.${tld})`,
        { tld, riskLevel: 'high' }
      ));
    } else if (LegalComplianceCategory.MEDIUM_RISK_JURISDICTIONS.has(tld)) {
      findings.push(this.createFinding(
        'legal_medium_risk_jurisdiction',
        'Medium-Risk Jurisdiction',
        'medium',
        weights.legal_medium_risk_jurisdiction || 8,
        `Domain registered in jurisdiction with limited regulation (.${tld})`,
        { tld, riskLevel: 'medium' }
      ));
    }

    // Check WHOIS country if available
    if (whoisData?.country) {
      const countryCode = whoisData.country.toLowerCase();
      if (LegalComplianceCategory.HIGH_RISK_JURISDICTIONS.has(countryCode)) {
        findings.push(this.createFinding(
          'legal_high_risk_whois_country',
          'High-Risk WHOIS Country',
          'medium',
          weights.legal_high_risk_whois_country || 10,
          `Registrant country: ${countryCode.toUpperCase()}`,
          { country: countryCode }
        ));
      }
    }

    return findings;
  }

  /**
   * Check for Terms of Service
   */
  private checkTermsOfService(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    let hasToS = false;

    for (const pattern of LegalComplianceCategory.TOS_PATTERNS) {
      if (pattern.test(body)) {
        hasToS = true;
        break;
      }
    }

    if (!hasToS) {
      findings.push(this.createFinding(
        'legal_no_terms_of_service',
        'No Terms of Service',
        'medium',
        weights.legal_no_terms_of_service || 10,
        'No Terms of Service found',
        {}
      ));
    }

    return findings;
  }

  /**
   * Check for restricted content (gambling/adult) without age verification
   */
  private checkRestrictedContent(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Check for gambling content
    const hasGamblingContent = LegalComplianceCategory.GAMBLING_PATTERNS.some(p => p.test(body));

    // Check for adult content
    const hasAdultContent = LegalComplianceCategory.ADULT_CONTENT_PATTERNS.some(p => p.test(body));

    // Check for age verification
    const hasAgeVerification = LegalComplianceCategory.AGE_VERIFICATION_PATTERNS.some(p => p.test(body));

    if (hasGamblingContent && !hasAgeVerification) {
      findings.push(this.createFinding(
        'legal_gambling_no_age_verification',
        'Gambling Without Age Verification',
        'high',
        weights.legal_gambling_no_age_verification || 12,
        'Gambling content without age verification',
        {}
      ));
    }

    if (hasAdultContent && !hasAgeVerification) {
      findings.push(this.createFinding(
        'legal_adult_content_no_age_verification',
        'Adult Content Without Age Verification',
        'high',
        weights.legal_adult_content_no_age_verification || 10,
        'Adult content without age verification',
        {}
      ));
    }

    return findings;
  }

  /**
   * Check COPPA compliance (children's content)
   */
  private checkCOPPACompliance(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    // Check if site targets children
    const targetsChildren = LegalComplianceCategory.CHILDREN_CONTENT_PATTERNS.some(p => p.test(body));

    if (targetsChildren) {
      // Check for data collection from children
      const hasEmailInput = /<input[^>]*type\s*=\s*["']email["'][^>]*>/i.test(body);
      const hasRegistration = /sign\s+up|register|create\s+account/i.test(body);

      if (hasEmailInput || hasRegistration) {
        // Check for parental consent
        const hasParentalConsent = /parent|guardian|consent/i.test(body);

        if (!hasParentalConsent) {
          findings.push(this.createFinding(
            'legal_coppa_violation',
            'Potential COPPA Violation',
            'high',
            weights.legal_coppa_violation || 12,
            'Collects data from children without parental consent notice',
            {}
          ));
        }
      }
    }

    return findings;
  }

  /**
   * Check for misleading business practices
   */
  private checkMisleadingPractices(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];

    const misleadingPatterns = [
      /100% free|completely free|no cost/i,
      /guaranteed|money back|no risk/i,
      /limited time|expires soon|act now/i,
      /as seen on (tv|cnn|bbc)/i,
      /miracle|secret|breakthrough/i
    ];

    let matchCount = 0;
    for (const pattern of misleadingPatterns) {
      if (pattern.test(body)) {
        matchCount++;
      }
    }

    if (matchCount >= 3) {
      findings.push(this.createFinding(
        'legal_misleading_practices',
        'Potentially Misleading Claims',
        'medium',
        weights.legal_misleading_practices || 7,
        `Found ${matchCount} potentially misleading marketing claims`,
        { count: matchCount }
      ));
    }

    return findings;
  }
}
