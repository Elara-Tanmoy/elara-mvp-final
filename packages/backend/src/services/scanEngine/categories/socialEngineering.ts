/**
 * Category 7: Social Engineering (30 points)
 *
 * Checks:
 * - Urgency/scarcity tactics (12 pts)
 * - Fake authority indicators (10 pts)
 * - Emotional manipulation (8 pts)
 * - Too-good-to-be-true offers (7 pts)
 * - Social proof manipulation (5 pts)
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

export class SocialEngineeringCategory extends CategoryAnalyzer {
  // Urgency/scarcity tactics
  private static readonly URGENCY_PATTERNS = [
    /act\s+now|right\s+now|immediately|urgent|hurry/i,
    /limited\s+(time|offer|supply|stock)/i,
    /expires?\s+(today|soon|in|tonight)/i,
    /only\s+\d+\s+(left|remaining|available)/i,
    /don't\s+miss|last\s+chance|final\s+(warning|notice)/i,
    /clock\s+is\s+ticking|running\s+out/i
  ];

  // Fake authority indicators
  private static readonly FAKE_AUTHORITY_PATTERNS = [
    /official\s+(notification|alert|warning)/i,
    /your\s+account\s+(will\s+be|has\s+been)\s+(suspended|locked|closed)/i,
    /government\s+(agency|department|official)/i,
    /IRS|FBI|CIA|police|law\s+enforcement/i,
    /verify\s+your\s+(account|identity|information)/i,
    /mandatory\s+(update|action|verification)/i
  ];

  // Emotional manipulation patterns
  private static readonly EMOTIONAL_PATTERNS = [
    /congratulations|you('ve|\s+have)\s+won/i,
    /selected|chosen|lucky|winner/i,
    /amazing|incredible|unbelievable|shocking/i,
    /don't\s+you\s+want|wouldn't\s+you\s+like/i,
    /imagine\s+having|picture\s+yourself/i,
    /fear|worry|concern|risk|danger/i
  ];

  // Too-good-to-be-true offers
  private static readonly TGTBT_PATTERNS = [
    /100%\s+free|completely\s+free|no\s+cost|zero\s+cost/i,
    /guaranteed|money\s+back|no\s+risk/i,
    /earn\s+\$\d+|make\s+\$\d+|\$\d+\s+per\s+(day|hour|week)/i,
    /work\s+from\s+home|get\s+rich|financial\s+freedom/i,
    /lose\s+\d+\s+pounds|miracle\s+(cure|pill|solution)/i,
    /secret\s+(formula|method|system|trick)/i
  ];

  // Fake social proof
  private static readonly SOCIAL_PROOF_PATTERNS = [
    /(\d+,?\d*)\s+(people|users|customers)\s+(bought|joined|trust)/i,
    /as\s+seen\s+on\s+(tv|cnn|bbc|fox)/i,
    /recommended\s+by\s+(doctors|experts|professionals)/i,
    /\d+\s+star\s+rating|5\s+stars/i,
    /trending|viral|everyone\s+is/i
  ];

  // Invitation/referral code patterns (100% scam correlation)
  private static readonly INVITATION_CODE_PATTERNS = [
    /invitation\s+code/i,
    /referral\s+code/i,
    /invite\s+code/i,
    /promo\s+code/i,
    /registration\s+code/i,
    /access\s+code/i,
    /member\s+code/i
  ];

  // Fake CAPTCHA patterns (trick users into notifications/permissions)
  private static readonly FAKE_CAPTCHA_PATTERNS = [
    /verify\s+(you\s+are\s+)?(human|not\s+a\s+robot)/i,
    /click\s+allow\s+to\s+continue/i,
    /enable\s+notifications\s+to/i,
    /prove\s+you\s+are\s+not\s+a\s+robot/i,
    /press\s+allow\s+to\s+(continue|proceed|access)/i,
    /to\s+confirm\s+you\s+are\s+not\s+a\s+robot/i,
    /check\s+the\s+box\s+to\s+continue/i
  ];

  // Legitimate CAPTCHA services (whitelist)
  private static readonly LEGITIMATE_CAPTCHA_DOMAINS = [
    'recaptcha.net',
    'google.com/recaptcha',
    'hcaptcha.com',
    'captcha.com',
    'funcaptcha.com'
  ];

  constructor() {
    super('socialEngineering', 'Social Engineering');
  }

  shouldRun(reachabilityState: ReachabilityState, pipelineType: string): boolean {
    return reachabilityState === ReachabilityState.ONLINE ||
           reachabilityState === ReachabilityState.PARKED;
  }

  async analyze(context: CategoryContext): Promise<CategoryResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const config = context.config.socialEngineering;

    if (!context.httpResponse?.body) {
      return this.createSkippedResult('No HTTP response body', config.maxWeight);
    }

    const body = context.httpResponse.body;

    logger.debug(`[Social Engineering] Analyzing for: ${context.url}`);

    // Check 1: Urgency/Scarcity Tactics
    const urgencyFindings = this.checkUrgencyTactics(body, config.checkWeights);
    findings.push(...urgencyFindings);

    // Check 2: Fake Authority
    const authorityFindings = this.checkFakeAuthority(body, config.checkWeights);
    findings.push(...authorityFindings);

    // Check 3: Emotional Manipulation
    const emotionalFindings = this.checkEmotionalManipulation(body, config.checkWeights);
    findings.push(...emotionalFindings);

    // Check 4: Too-Good-To-Be-True Offers
    const tgtbtFindings = this.checkTGTBTOffers(body, config.checkWeights);
    findings.push(...tgtbtFindings);

    // Check 5: Social Proof Manipulation
    const socialProofFindings = this.checkSocialProofManipulation(body, config.checkWeights);
    findings.push(...socialProofFindings);

    // Check 6: Invitation Code Detection (ENHANCED - 100% scam correlation)
    const invitationCodeFindings = this.checkInvitationCodeFields(body, config.checkWeights);
    findings.push(...invitationCodeFindings);

    // Check 7: Fake CAPTCHA Detection (ENHANCED - notification/permission scams)
    const fakeCaptchaFindings = this.checkFakeCaptcha(body, context.url, config.checkWeights);
    findings.push(...fakeCaptchaFindings);

    const score = this.calculateScore(findings, config.maxWeight);
    const duration = Date.now() - startTime;

    logger.info(`[Social Engineering] Complete: ${score}/${config.maxWeight} points, ${findings.length} findings (${duration}ms)`);

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
   * Check for urgency/scarcity tactics
   */
  private checkUrgencyTactics(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matches: string[] = [];

    for (const pattern of SocialEngineeringCategory.URGENCY_PATTERNS) {
      if (pattern.test(body)) {
        matches.push(pattern.source);
      }
    }

    if (matches.length >= 3) {
      findings.push(this.createFinding(
        'social_urgency_tactics',
        'Urgency/Scarcity Tactics',
        'high',
        weights.social_urgency_tactics || 12,
        `Uses ${matches.length} urgency/scarcity manipulation tactics`,
        { count: matches.length }
      ));
    } else if (matches.length >= 1) {
      findings.push(this.createFinding(
        'social_urgency_tactics_mild',
        'Mild Urgency Tactics',
        'medium',
        weights.social_urgency_tactics_mild || 6,
        `Uses ${matches.length} urgency indicator(s)`,
        { count: matches.length }
      ));
    }

    return findings;
  }

  /**
   * Check for fake authority indicators
   */
  private checkFakeAuthority(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matches: string[] = [];

    for (const pattern of SocialEngineeringCategory.FAKE_AUTHORITY_PATTERNS) {
      if (pattern.test(body)) {
        matches.push(pattern.source);
      }
    }

    if (matches.length >= 2) {
      findings.push(this.createFinding(
        'social_fake_authority',
        'Fake Authority Indicators',
        'critical',
        weights.social_fake_authority || 15,
        `Uses ${matches.length} fake authority tactics`,
        { count: matches.length }
      ));
    }

    return findings;
  }

  /**
   * Check for emotional manipulation
   */
  private checkEmotionalManipulation(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matches: string[] = [];

    for (const pattern of SocialEngineeringCategory.EMOTIONAL_PATTERNS) {
      if (pattern.test(body)) {
        matches.push(pattern.source);
      }
    }

    if (matches.length >= 3) {
      findings.push(this.createFinding(
        'social_emotional_manipulation',
        'Emotional Manipulation',
        'high',
        weights.social_emotional_manipulation || 10,
        `Uses ${matches.length} emotional manipulation tactics`,
        { count: matches.length }
      ));
    }

    return findings;
  }

  /**
   * Check for too-good-to-be-true offers
   */
  private checkTGTBTOffers(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matches: string[] = [];

    for (const pattern of SocialEngineeringCategory.TGTBT_PATTERNS) {
      if (pattern.test(body)) {
        matches.push(pattern.source);
      }
    }

    if (matches.length >= 2) {
      findings.push(this.createFinding(
        'social_tgtbt_offers',
        'Too-Good-To-Be-True Offers',
        'high',
        weights.social_tgtbt_offers || 10,
        `Contains ${matches.length} unrealistic offer patterns`,
        { count: matches.length }
      ));
    }

    return findings;
  }

  /**
   * Check for social proof manipulation
   */
  private checkSocialProofManipulation(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matches: string[] = [];

    for (const pattern of SocialEngineeringCategory.SOCIAL_PROOF_PATTERNS) {
      if (pattern.test(body)) {
        matches.push(pattern.source);
      }
    }

    if (matches.length >= 2) {
      findings.push(this.createFinding(
        'social_proof_manipulation',
        'Social Proof Manipulation',
        'medium',
        weights.social_proof_manipulation || 7,
        `Uses ${matches.length} fake social proof indicators`,
        { count: matches.length }
      ));
    }

    return findings;
  }

  /**
   * ENHANCED: Check for invitation/referral code fields (100% scam correlation)
   * Detects login/registration pages with invitation code fields - common in job/mining/investment scams
   */
  private checkInvitationCodeFields(body: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matchedPatterns: string[] = [];
    const contexts: string[] = [];

    // Check for invitation code patterns in page content
    for (const pattern of SocialEngineeringCategory.INVITATION_CODE_PATTERNS) {
      const matches = body.match(pattern);
      if (matches) {
        matchedPatterns.push(matches[0]);
      }
    }

    if (matchedPatterns.length > 0) {
      // Check context - is this a login/registration page?
      const isLoginPage = /login|sign\s+in|log\s+in|signin/i.test(body);
      const isRegistrationPage = /register|sign\s+up|signup|create\s+account|join\s+now/i.test(body);

      if (isLoginPage) contexts.push('login page');
      if (isRegistrationPage) contexts.push('registration page');

      // Check for form fields with invitation code input
      const hasInvitationInput = /<input[^>]*(invitation|referral|invite|promo|access)[^>]*>/i.test(body) ||
                                 /<label[^>]*(invitation|referral|invite|promo|access)[^>]*>/i.test(body);

      if (hasInvitationInput) {
        const severity = (isLoginPage || isRegistrationPage) ? 'high' : 'medium';
        const score = (isLoginPage || isRegistrationPage) ? 12 : 8;

        findings.push(this.createFinding(
          'social_invitation_code_field',
          'Invitation Code Detection',
          severity,
          weights.social_invitation_code_field || score,
          `Page contains invitation/referral code field - 100% correlation with job/mining/investment scams`,
          {
            matchedPatterns: matchedPatterns.slice(0, 3),
            contexts: contexts.length > 0 ? contexts : ['unknown context'],
            hasFormField: hasInvitationInput
          }
        ));
      }
    }

    return findings;
  }

  /**
   * ENHANCED: Check for fake CAPTCHA prompts (notification/permission scams)
   * Detects fake verification prompts that trick users into enabling notifications or permissions
   */
  private checkFakeCaptcha(body: string, url: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matchedPatterns: string[] = [];

    // First check if this is a legitimate CAPTCHA service
    const isLegitimate = SocialEngineeringCategory.LEGITIMATE_CAPTCHA_DOMAINS.some(domain =>
      url.includes(domain)
    );

    if (isLegitimate) {
      return findings; // Skip check for legitimate CAPTCHA services
    }

    // Check for fake CAPTCHA patterns
    for (const pattern of SocialEngineeringCategory.FAKE_CAPTCHA_PATTERNS) {
      const matches = body.match(pattern);
      if (matches) {
        matchedPatterns.push(matches[0]);
      }
    }

    if (matchedPatterns.length > 0) {
      // Check if page references legitimate CAPTCHA services in HTML
      const hasLegitCaptchaReference = SocialEngineeringCategory.LEGITIMATE_CAPTCHA_DOMAINS.some(domain =>
        body.includes(domain)
      );

      // If no legitimate CAPTCHA service referenced but has CAPTCHA-like text, it's fake
      if (!hasLegitCaptchaReference) {
        findings.push(this.createFinding(
          'social_fake_captcha',
          'Fake CAPTCHA Detection',
          'high',
          weights.social_fake_captcha || 15,
          `Detected fake CAPTCHA/verification prompt (${matchedPatterns.length} pattern(s)) - likely notification/permission scam`,
          {
            matchedPatterns: matchedPatterns.slice(0, 3),
            hasLegitReference: hasLegitCaptchaReference,
            suspiciousReason: 'CAPTCHA-like language without legitimate CAPTCHA service'
          }
        ));
      }
    }

    return findings;
  }
}
