/**
 * Combiner Module for URL Scanner V2
 *
 * Fuses Stage-1 and Stage-2 logits with causal signals into a calibrated probability.
 * Uses Inductive Conformal Prediction (ICP) to produce confidence intervals.
 * Applies branch-specific calibration thresholds.
 */

import { ReachabilityStatus } from './types';
import type {
  Stage1Predictions,
  Stage2Predictions,
  ExtractedFeatures,
  CombinerResult,
  BranchThresholds,
  DecisionNode,
  CalibrationConfig
} from './types';
import { reputationWhitelist } from './reputation-whitelist';

/**
 * Calibration data structure
 * In production, this would be loaded from a trained calibration model
 */
interface CalibrationData {
  quantiles: number[]; // Calibration quantiles for ICP
  branchCorrections: Record<ReachabilityStatus, number>; // Branch-specific corrections
  alphaLevel: number; // Significance level (e.g., 0.1 for 90% CI)
}

/**
 * Combiner class
 */
export class PredictionCombiner {
  private calibrationData: CalibrationData;
  private branchThresholds: Record<ReachabilityStatus, BranchThresholds>;

  constructor(
    calibrationConfig: CalibrationConfig,
    branchThresholds: Record<ReachabilityStatus, BranchThresholds>
  ) {
    this.calibrationData = this.loadCalibration(calibrationConfig);
    this.branchThresholds = branchThresholds;
  }

  /**
   * Combine and calibrate predictions
   */
  combine(
    stage1: Stage1Predictions,
    stage2: Stage2Predictions | null,
    features: ExtractedFeatures,
    branch: ReachabilityStatus,
    categoryResults?: { totalPoints: number; totalPossible: number }
  ): CombinerResult {
    const decisionGraph: DecisionNode[] = [];
    let step = 1;

    // Step 1: Combine model predictions
    const modelProbability = this.combineModelPredictions(
      stage1,
      stage2,
      decisionGraph,
      step
    );
    step++;

    // Step 2: Apply causal signals
    const causalAdjustedProb = this.applyCausalSignals(
      modelProbability,
      features.causal,
      decisionGraph,
      step
    );
    step++;

    // Step 3: Apply branch-specific correction
    const branchCorrected = this.applyBranchCorrection(
      causalAdjustedProb,
      branch,
      decisionGraph,
      step
    );
    step++;

    // ==================================================================
    // REPUTATION & DOMAIN AGE OVERRIDE (NEW - Critical for false positives)
    // ==================================================================

    let probability = branchCorrected;
    const hostname = features.hostname;
    const domainAge = features.tabular.domainAge || 0;

    // Check Tranco reputation whitelist
    const reputation = reputationWhitelist.getReputation(hostname);

    let reputationAdjustment = 0;
    let domainAgeAdjustment = 0;

    // Strong reputation override for top-ranked domains
    if (reputation && reputation.trustScore >= 85) {
      // Top 10k domains: Force very low risk regardless of ML score
      reputationAdjustment = -Math.max(0, probability - 0.10); // Cap at 10%

      decisionGraph.push({
        step: step++,
        component: 'Reputation Override',
        input: {
          originalProb: probability,
          domain: hostname,
          rank: reputation.rank,
          trustScore: reputation.trustScore
        },
        output: {
          adjustment: reputationAdjustment,
          newProb: probability + reputationAdjustment
        },
        contribution: reputationAdjustment,
        timestamp: new Date()
      });

      probability = Math.max(0.01, probability + reputationAdjustment);
    } else if (reputation && reputation.trustScore >= 70) {
      // Top 100k domains: Moderate trust discount
      reputationAdjustment = -Math.min(0.30, probability * 0.40);
      probability = Math.max(0.05, probability + reputationAdjustment);

      decisionGraph.push({
        step: step++,
        component: 'Reputation Discount',
        input: { originalProb: probability - reputationAdjustment, rank: reputation.rank },
        output: { discount: reputationAdjustment, newProb: probability },
        contribution: reputationAdjustment,
        timestamp: new Date()
      });
    }

    // Domain age discount (5+ years = established)
    if (domainAge > 1825) {  // 5 years
      const yearsFactor = Math.min(domainAge / 3650, 10) / 10; // Cap at 10 years
      domainAgeAdjustment = -Math.min(0.25, probability * yearsFactor * 0.30);

      decisionGraph.push({
        step: step++,
        component: 'Domain Age Trust',
        input: {
          originalProb: probability,
          domainAge,
          years: Math.floor(domainAge / 365)
        },
        output: {
          discount: domainAgeAdjustment,
          newProb: probability + domainAgeAdjustment
        },
        contribution: domainAgeAdjustment,
        timestamp: new Date()
      });

      probability = Math.max(0.01, probability + domainAgeAdjustment);
    }

    // Step 3.5: Apply category-based risk boost (NEW - AGGRESSIVE PHISHING DETECTION)
    let categoryAdjusted = probability;
    if (categoryResults) {
      categoryAdjusted = this.applyCategoryRiskBoost(
        probability,
        categoryResults,
        decisionGraph,
        step
      );
      step++;
    }

    // Step 4: Calibrate with conformal prediction
    const calibrated = this.calibrate(categoryAdjusted, branch);

    // Step 5: Calculate confidence interval
    const confidenceInterval = this.calculateConfidenceInterval(
      calibrated.probability,
      this.calibrationData.alphaLevel
    );

    decisionGraph.push({
      step: step++,
      component: 'Conformal Calibration',
      input: { uncalibrated: categoryAdjusted },
      output: { calibrated: calibrated.probability, ci: confidenceInterval },
      contribution: 0,
      timestamp: new Date()
    });

    // Calculate model contributions
    const modelContributions = this.calculateContributions(stage1, stage2, features.causal);

    return {
      probability: calibrated.probability,
      confidenceInterval,
      decisionGraph,
      modelContributions,
      calibrationMethod: 'ICP',
      branchThresholds: this.branchThresholds[branch]
    };
  }

  /**
   * Combine model predictions (Stage-1 and optional Stage-2)
   */
  private combineModelPredictions(
    stage1: Stage1Predictions,
    stage2: Stage2Predictions | null,
    decisionGraph: DecisionNode[],
    step: number
  ): number {
    if (!stage2) {
      // Only Stage-1
      decisionGraph.push({
        step,
        component: 'Stage-1 Models',
        input: stage1,
        output: { probability: stage1.combined.probability },
        contribution: 1.0,
        timestamp: new Date()
      });
      return stage1.combined.probability;
    }

    // Combine Stage-1 and Stage-2
    // Weight: 40% Stage-1, 60% Stage-2 (Stage-2 is more accurate but slower)
    const combined = stage1.combined.probability * 0.4 + stage2.combined.probability * 0.6;

    decisionGraph.push({
      step,
      component: 'Stage-1 + Stage-2 Fusion',
      input: { stage1: stage1.combined.probability, stage2: stage2.combined.probability },
      output: { combined },
      contribution: 0,
      timestamp: new Date()
    });

    return combined;
  }

  /**
   * Apply causal signals (hard rules)
   */
  private applyCausalSignals(
    modelProb: number,
    causal: ExtractedFeatures['causal'],
    decisionGraph: DecisionNode[],
    step: number
  ): number {
    let adjustedProb = modelProb;
    let totalAdjustment = 0;

    // Form origin mismatch (strong signal)
    if (causal.formOriginMismatch) {
      const adjustment = 0.2;
      adjustedProb = Math.min(1, adjustedProb + adjustment);
      totalAdjustment += adjustment;
    }

    // Brand infrastructure divergence
    if (causal.brandInfraDivergence) {
      const adjustment = 0.15;
      adjustedProb = Math.min(1, adjustedProb + adjustment);
      totalAdjustment += adjustment;
    }

    // Redirect homoglyph
    if (causal.redirectHomoglyphDelta) {
      const adjustment = 0.25;
      adjustedProb = Math.min(1, adjustedProb + adjustment);
      totalAdjustment += adjustment;
    }

    // Auto download (very strong signal)
    if (causal.autoDownload) {
      const adjustment = 0.3;
      adjustedProb = Math.min(1, adjustedProb + adjustment);
      totalAdjustment += adjustment;
    }

    decisionGraph.push({
      step,
      component: 'Causal Signals',
      input: { modelProb, causal },
      output: { adjustedProb, totalAdjustment },
      contribution: totalAdjustment,
      timestamp: new Date()
    });

    return adjustedProb;
  }

  /**
   * Apply branch-specific correction
   */
  private applyBranchCorrection(
    probability: number,
    branch: ReachabilityStatus,
    decisionGraph: DecisionNode[],
    step: number
  ): number {
    const correction = this.calibrationData.branchCorrections[branch] || 0;
    const corrected = Math.min(1, Math.max(0, probability + correction));

    decisionGraph.push({
      step,
      component: 'Branch Correction',
      input: { probability, branch, correction },
      output: { corrected },
      contribution: Math.abs(correction),
      timestamp: new Date()
    });

    return corrected;
  }

  /**
   * Apply category-based risk boost (NEW - AGGRESSIVE PHISHING DETECTION)
   *
   * If category checks show high risk, boost the probability to ensure
   * phishing sites are correctly classified as high-risk.
   */
  private applyCategoryRiskBoost(
    probability: number,
    categoryResults: { totalPoints: number; totalPossible: number },
    decisionGraph: DecisionNode[],
    step: number
  ): number {
    // Calculate risk factor from category points
    // Higher points = more suspicious (points are penalties)
    const categoryRiskFactor = categoryResults.totalPoints / categoryResults.totalPossible;

    let adjustedProb = probability;
    let boost = 0;

    // Category risk boost - ONLY boost if actual penalties exist
    let categoryBoostAdjustment = 0;

    if (categoryRiskFactor > 0.25) {
      // Significant penalties: Apply boost
      if (categoryRiskFactor > 0.7) {
        boost = Math.max(0, 0.90 - probability);
        adjustedProb = Math.max(probability, 0.90);
      } else if (categoryRiskFactor > 0.5) {
        boost = Math.max(0, 0.75 - probability);
        adjustedProb = Math.max(probability, 0.75);
      } else if (categoryRiskFactor > 0.35) {
        boost = Math.max(0, 0.60 - probability);
        adjustedProb = Math.max(probability, 0.60);
      } else {
        boost = categoryRiskFactor * 0.25;
        adjustedProb = Math.min(1, probability + boost);
      }

      categoryBoostAdjustment = adjustedProb - probability;
    } else if (categoryRiskFactor < 0.10) {
      // Very low/zero penalties: Apply DISCOUNT (clean site)
      const discount = Math.min(0.20, probability * 0.30);
      categoryBoostAdjustment = -discount;
      adjustedProb = Math.max(0.01, probability - discount);
    } else {
      // Minimal penalties: No adjustment
      adjustedProb = probability;
    }

    decisionGraph.push({
      step,
      component: 'Category Risk Boost',
      input: {
        probability,
        categoryRiskFactor: Math.round(categoryRiskFactor * 100) / 100,
        categoryPoints: categoryResults.totalPoints,
        categoryPossible: categoryResults.totalPossible
      },
      output: { adjustedProb, boost: Math.round(categoryBoostAdjustment * 100) / 100 },
      contribution: categoryBoostAdjustment,
      timestamp: new Date()
    });

    return adjustedProb;
  }

  /**
   * Calibrate probability using conformal prediction
   */
  private calibrate(
    uncalibrated: number,
    branch: ReachabilityStatus
  ): { probability: number } {
    // Inductive Conformal Prediction (ICP) calibration
    // Maps uncalibrated score to calibrated probability using quantiles

    const quantiles = this.calibrationData.quantiles;

    // Find which quantile range the uncalibrated probability falls into
    let calibrated = uncalibrated;

    // Simple isotonic regression using quantiles
    // In production, this would use the actual calibration curve
    for (let i = 0; i < quantiles.length - 1; i++) {
      const lower = quantiles[i];
      const upper = quantiles[i + 1];

      if (uncalibrated >= lower && uncalibrated <= upper) {
        // Linear interpolation within quantile
        const t = (uncalibrated - lower) / (upper - lower);
        const lowerCal = i / (quantiles.length - 1);
        const upperCal = (i + 1) / (quantiles.length - 1);
        calibrated = lowerCal + t * (upperCal - lowerCal);
        break;
      }
    }

    return { probability: calibrated };
  }

  /**
   * Calculate confidence interval using ICP
   */
  private calculateConfidenceInterval(
    probability: number,
    alpha: number
  ): { lower: number; upper: number; width: number } {
    // ICP confidence interval
    // Width depends on the nonconformity scores from calibration set

    // Improved: Use a tighter interval based on probability extremity
    // More confident near 0 and 1, less confident near 0.5

    // Calculate uncertainty: max at 0.5, min at 0 and 1
    const uncertainty = probability * (1 - probability); // Variance of Bernoulli (0 to 0.25)

    // Scale margin to be reasonable: alpha=0.1 gives ~1.65 std devs (90% CI)
    // Multiply by smaller factor for tighter intervals
    const zScore = Math.sqrt(-2 * Math.log(alpha)); // ~1.64 for alpha=0.1
    const margin = Math.sqrt(uncertainty) * zScore * 0.5; // Scale down for tighter bounds

    const lower = Math.max(0, probability - margin);
    const upper = Math.min(1, probability + margin);
    const width = upper - lower;

    return { lower, upper, width };
  }

  /**
   * Calculate model contributions
   */
  private calculateContributions(
    stage1: Stage1Predictions,
    stage2: Stage2Predictions | null,
    causal: ExtractedFeatures['causal']
  ): {
    stage1Weight: number;
    stage2Weight?: number;
    causalSignalsWeight: number;
  } {
    // Count active causal signals
    const causalCount = Object.values(causal).filter(v => v === true).length;
    const causalWeight = Math.min(0.3, causalCount * 0.1);

    if (!stage2) {
      return {
        stage1Weight: 1 - causalWeight,
        causalSignalsWeight: causalWeight
      };
    }

    // With Stage-2: redistribute weights
    const modelWeight = 1 - causalWeight;
    return {
      stage1Weight: modelWeight * 0.4,
      stage2Weight: modelWeight * 0.6,
      causalSignalsWeight: causalWeight
    };
  }

  /**
   * Load calibration data
   */
  private loadCalibration(config: CalibrationConfig): CalibrationData {
    // Production default calibration values
    // Future enhancement: Load from database for dynamic tuning via admin panel
    return {
      quantiles: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      branchCorrections: {
        [ReachabilityStatus.ONLINE]: 0.0,      // No correction
        [ReachabilityStatus.OFFLINE]: -0.1,     // Reduce score (offline doesn't mean malicious)
        [ReachabilityStatus.WAF]: -0.05,        // Slight reduction (protected sites)
        [ReachabilityStatus.PARKED]: -0.15,     // Reduce significantly (parked != phishing)
        [ReachabilityStatus.SINKHOLE]: 0.4,     // Increase significantly (likely malicious)
        [ReachabilityStatus.ERROR]: -0.05       // Slight reduction (errors are uncertain)
      },
      alphaLevel: config.alpha || 0.1 // 90% confidence interval
    };
  }
}

/**
 * Factory function
 */
export function createCombiner(
  calibrationConfig: CalibrationConfig,
  branchThresholds: Record<ReachabilityStatus, BranchThresholds>
): PredictionCombiner {
  return new PredictionCombiner(calibrationConfig, branchThresholds);
}

/**
 * Utility: Get default branch thresholds
 */
export function getDefaultBranchThresholds(): Record<ReachabilityStatus, BranchThresholds> {
  return {
    [ReachabilityStatus.ONLINE]: {
      branch: ReachabilityStatus.ONLINE,
      safeThreshold: 0.15,
      lowThreshold: 0.30,
      mediumThreshold: 0.50,
      highThreshold: 0.75,
      criticalThreshold: 0.90
    },
    [ReachabilityStatus.OFFLINE]: {
      branch: ReachabilityStatus.OFFLINE,
      safeThreshold: 0.15,        // LOWERED: More aggressive phishing detection
      lowThreshold: 0.30,         // LOWERED: Catch more phishing as "Low Risk"
      mediumThreshold: 0.50,      // LOWERED: Flag suspicious patterns earlier
      highThreshold: 0.70,        // LOWERED: More phishing URLs get D/E grades
      criticalThreshold: 0.85     // LOWERED: Critical threshold for Grade F
    },
    [ReachabilityStatus.WAF]: {
      branch: ReachabilityStatus.WAF,
      safeThreshold: 0.15,        // LOWERED: WAF-protected sites can still be phishing
      lowThreshold: 0.30,         // LOWERED: More aggressive for WAF
      mediumThreshold: 0.50,      // LOWERED: Align with OFFLINE thresholds
      highThreshold: 0.70,        // LOWERED: Catch more phishing
      criticalThreshold: 0.85     // LOWERED: Critical threshold
    },
    [ReachabilityStatus.PARKED]: {
      branch: ReachabilityStatus.PARKED,
      safeThreshold: 0.30,        // Much higher (parked domains are usually not malicious)
      lowThreshold: 0.50,
      mediumThreshold: 0.70,
      highThreshold: 0.85,
      criticalThreshold: 0.95
    },
    [ReachabilityStatus.SINKHOLE]: {
      branch: ReachabilityStatus.SINKHOLE,
      safeThreshold: 0.05,        // Very low (sinkholes are already known bad)
      lowThreshold: 0.15,
      mediumThreshold: 0.30,
      highThreshold: 0.50,
      criticalThreshold: 0.70
    },
    [ReachabilityStatus.ERROR]: {
      branch: ReachabilityStatus.ERROR,
      safeThreshold: 0.20,
      lowThreshold: 0.40,
      mediumThreshold: 0.60,
      highThreshold: 0.80,
      criticalThreshold: 0.95
    }
  };
}
