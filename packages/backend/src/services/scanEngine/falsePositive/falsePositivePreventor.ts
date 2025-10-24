/**
 * False Positive Prevention System
 *
 * Orchestrates all false positive checks to prevent legitimate sites
 * from being flagged as malicious
 *
 * Checks Performed:
 * 1. CDN Detection - Major CDN providers
 * 2. RIOT Feed - Known good IP addresses
 * 3. Government/Educational - .gov, .mil, .edu domains
 * 4. Legitimacy Indicators - Aggregated trust signals
 *
 * Output: Legitimacy score (0-100) and recommended score adjustment
 */

import { CDNDetector, CDNDetectionResult } from './cdnDetector.js';
import { RIOTChecker, RIOTCheckResult } from './riotChecker.js';
import { GovChecker, GovCheckResult } from './govChecker.js';
import { logger } from '../../../config/logger.js';

export interface FalsePositiveCheckResult {
  legitimacyScore: number;      // 0-100 (higher = more legitimate)
  scoreAdjustment: number;       // Recommended score reduction (0-100 points)
  adjustmentMultiplier: number;  // Recommended multiplier (0.1-1.0)
  cdnCheck: CDNDetectionResult;
  riotCheck: RIOTCheckResult;
  govCheck: GovCheckResult;
  legitimacyIndicators: number;  // Count of positive indicators
  recommendation: string;
  evidence: string[];
}

export class FalsePositivePreventor {
  private cdnDetector: CDNDetector;
  private riotChecker: RIOTChecker;
  private govChecker: GovChecker;

  constructor() {
    this.cdnDetector = new CDNDetector();
    this.riotChecker = new RIOTChecker();
    this.govChecker = new GovChecker();
  }

  /**
   * Execute all false positive checks
   */
  async execute(
    domain: string,
    ip?: string,
    nameservers?: string[]
  ): Promise<FalsePositiveCheckResult> {
    logger.info(`[FP Preventor] Running false positive checks for: ${domain}`);

    // Execute all checks in parallel
    const [cdnCheck, riotCheckDomain, riotCheckIP, govCheck] = await Promise.all([
      this.cdnDetector.detect(domain, nameservers),
      this.riotChecker.checkDomain(domain),
      ip ? this.riotChecker.check(ip) : Promise.resolve({ isRIOT: false, confidence: 0 }),
      this.govChecker.check(domain)
    ]);

    // Combine RIOT results (domain + IP)
    const riotCheck: RIOTCheckResult = {
      isRIOT: riotCheckDomain.isRIOT || riotCheckIP.isRIOT,
      category: (riotCheckDomain as any).category || (riotCheckIP as any).category,
      description: (riotCheckDomain as any).description || (riotCheckIP as any).description,
      confidence: Math.max(riotCheckDomain.confidence, riotCheckIP.confidence)
    };

    // Calculate legitimacy indicators
    const indicators = this.calculateLegitimacyIndicators(cdnCheck, riotCheck, govCheck);

    // Calculate legitimacy score
    const legitimacyScore = this.calculateLegitimacyScore(cdnCheck, riotCheck, govCheck);

    // Determine score adjustment
    const { scoreAdjustment, adjustmentMultiplier, recommendation } =
      this.calculateScoreAdjustment(legitimacyScore, cdnCheck, riotCheck, govCheck);

    // Collect all evidence
    const evidence = [
      ...cdnCheck.evidence,
      ...(riotCheck.isRIOT ? [`RIOT: ${riotCheck.description}`] : []),
      ...govCheck.evidence
    ];

    const result: FalsePositiveCheckResult = {
      legitimacyScore,
      scoreAdjustment,
      adjustmentMultiplier,
      cdnCheck,
      riotCheck,
      govCheck,
      legitimacyIndicators: indicators,
      recommendation,
      evidence
    };

    logger.info(`[FP Preventor] Legitimacy Score: ${legitimacyScore}/100, Adjustment: ${adjustmentMultiplier.toFixed(2)}×`);
    logger.info(`[FP Preventor] Recommendation: ${recommendation}`);

    return result;
  }

  /**
   * Calculate number of legitimacy indicators
   */
  private calculateLegitimacyIndicators(
    cdnCheck: CDNDetectionResult,
    riotCheck: RIOTCheckResult,
    govCheck: GovCheckResult
  ): number {
    let count = 0;

    if (cdnCheck.isCDN) count++;
    if (riotCheck.isRIOT) count++;
    if (govCheck.isGovernment) count++;
    if (govCheck.isEducational) count++;
    if (govCheck.isInternational) count++;

    return count;
  }

  /**
   * Calculate overall legitimacy score (0-100)
   */
  private calculateLegitimacyScore(
    cdnCheck: CDNDetectionResult,
    riotCheck: RIOTCheckResult,
    govCheck: GovCheckResult
  ): number {
    let score = 0;

    // Government/Educational/International: Highest trust (80-100 points)
    if (govCheck.isGovernment || govCheck.isInternational) {
      score = Math.max(score, 95);
    } else if (govCheck.isEducational) {
      score = Math.max(score, 90);
    }

    // RIOT Feed: High trust (70-90 points)
    if (riotCheck.isRIOT) {
      const riotScore = 70 + (riotCheck.confidence * 0.2); // 70-90
      score = Math.max(score, riotScore);
    }

    // CDN: Moderate trust (50-75 points)
    if (cdnCheck.isCDN) {
      const cdnScore = 50 + (cdnCheck.confidence * 0.25); // 50-75
      score = Math.max(score, cdnScore);
    }

    return Math.round(score);
  }

  /**
   * Calculate recommended score adjustment
   */
  private calculateScoreAdjustment(
    legitimacyScore: number,
    cdnCheck: CDNDetectionResult,
    riotCheck: RIOTCheckResult,
    govCheck: GovCheckResult
  ): {
    scoreAdjustment: number;
    adjustmentMultiplier: number;
    recommendation: string;
  } {
    // Government/Educational/International: Massive reduction
    if (govCheck.isGovernment || govCheck.isInternational) {
      return {
        scoreAdjustment: 200,
        adjustmentMultiplier: 0.1,  // 90% reduction
        recommendation: 'WHITELIST: Government/International domain - reduce score by 90%'
      };
    }

    if (govCheck.isEducational) {
      return {
        scoreAdjustment: 150,
        adjustmentMultiplier: 0.2,  // 80% reduction
        recommendation: 'WHITELIST: Educational institution - reduce score by 80%'
      };
    }

    // RIOT Feed: Significant reduction
    if (riotCheck.isRIOT && riotCheck.confidence >= 90) {
      return {
        scoreAdjustment: 100,
        adjustmentMultiplier: 0.3,  // 70% reduction
        recommendation: 'WHITELIST: RIOT feed (known good service) - reduce score by 70%'
      };
    }

    if (riotCheck.isRIOT && riotCheck.confidence >= 70) {
      return {
        scoreAdjustment: 75,
        adjustmentMultiplier: 0.4,  // 60% reduction
        recommendation: 'WHITELIST: RIOT feed (likely legitimate) - reduce score by 60%'
      };
    }

    // CDN: Moderate reduction
    if (cdnCheck.isCDN && cdnCheck.confidence >= 90) {
      return {
        scoreAdjustment: 50,
        adjustmentMultiplier: 0.6,  // 40% reduction
        recommendation: 'CDN detected (high confidence) - reduce score by 40%'
      };
    }

    if (cdnCheck.isCDN && cdnCheck.confidence >= 70) {
      return {
        scoreAdjustment: 30,
        adjustmentMultiplier: 0.7,  // 30% reduction
        recommendation: 'CDN detected (moderate confidence) - reduce score by 30%'
      };
    }

    // Legitimacy score based adjustment
    if (legitimacyScore >= 80) {
      return {
        scoreAdjustment: 40,
        adjustmentMultiplier: 0.65,
        recommendation: 'High legitimacy indicators - reduce score by 35%'
      };
    }

    if (legitimacyScore >= 60) {
      return {
        scoreAdjustment: 25,
        adjustmentMultiplier: 0.75,
        recommendation: 'Moderate legitimacy indicators - reduce score by 25%'
      };
    }

    if (legitimacyScore >= 40) {
      return {
        scoreAdjustment: 15,
        adjustmentMultiplier: 0.85,
        recommendation: 'Some legitimacy indicators - reduce score by 15%'
      };
    }

    // No adjustment
    return {
      scoreAdjustment: 0,
      adjustmentMultiplier: 1.0,
      recommendation: 'No false positive indicators detected'
    };
  }

  /**
   * Apply false positive adjustment to score
   */
  applyAdjustment(
    baseScore: number,
    fpResult: FalsePositiveCheckResult
  ): {
    adjustedScore: number;
    reduction: number;
  } {
    // Apply multiplier adjustment
    const adjustedScore = Math.round(baseScore * fpResult.adjustmentMultiplier);
    const reduction = baseScore - adjustedScore;

    logger.info(`[FP Preventor] Score adjustment: ${baseScore} → ${adjustedScore} (reduced by ${reduction} pts)`);

    return {
      adjustedScore,
      reduction
    };
  }

  /**
   * Quick check if domain should be whitelisted
   */
  async shouldWhitelist(domain: string): Promise<boolean> {
    const govCheck = await this.govChecker.check(domain);

    // Whitelist government, educational, international domains
    return govCheck.isGovernment ||
           govCheck.isEducational ||
           govCheck.isInternational;
  }
}
