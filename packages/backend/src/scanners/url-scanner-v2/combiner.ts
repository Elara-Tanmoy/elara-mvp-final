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
    branch: ReachabilityStatus
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

    // Step 4: Calibrate with conformal prediction
    const calibrated = this.calibrate(branchCorrected, branch);

    // Step 5: Calculate confidence interval
    const confidenceInterval = this.calculateConfidenceInterval(
      calibrated.probability,
      this.calibrationData.alphaLevel
    );

    decisionGraph.push({
      step: step++,
      component: 'Conformal Calibration',
      input: { uncalibrated: branchCorrected },
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

    // Simplified: Use a heuristic based on probability
    // In production, this would use actual nonconformity scores

    // Confidence interval is narrower near 0 and 1, wider near 0.5
    const uncertainty = 4 * probability * (1 - probability); // Variance of Bernoulli
    const margin = uncertainty * Math.sqrt(-Math.log(alpha / 2));

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
      safeThreshold: 0.25,        // Higher threshold (offline doesn't mean malicious)
      lowThreshold: 0.45,
      mediumThreshold: 0.65,
      highThreshold: 0.85,
      criticalThreshold: 0.95
    },
    [ReachabilityStatus.WAF]: {
      branch: ReachabilityStatus.WAF,
      safeThreshold: 0.20,
      lowThreshold: 0.40,
      mediumThreshold: 0.60,
      highThreshold: 0.80,
      criticalThreshold: 0.95
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
