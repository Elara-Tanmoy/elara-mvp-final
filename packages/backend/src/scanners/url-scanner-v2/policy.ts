/**
 * Policy Engine for URL Scanner V2
 *
 * Applies hard rules after the combiner to override ML predictions.
 * Policy rules are deterministic and take precedence over model outputs.
 *
 * Rules:
 * 1. Tombstone or sinkhole → BLOCK
 * 2. Dual tier-1 TI hits (within 7 days) → BLOCK
 * 3. Form origin mismatch + brand infra divergence + domain age < 30 days → HIGH/CRITICAL
 */

import { ReachabilityStatus, RiskLevel } from './types';
import type {
  PolicyResult,
  ExtractedFeatures,
  CombinerResult
} from './types';

/**
 * Threat Intelligence hit data
 */
export interface TIHitData {
  totalHits: number;
  tier1Hits: number;
  tier1Sources: Array<{
    source: string;
    lastSeen: Date;
  }>;
}

/**
 * Policy Engine class
 */
export class PolicyEngine {
  /**
   * Apply policy rules
   */
  apply(
    combinerResult: CombinerResult,
    features: ExtractedFeatures,
    reachability: ReachabilityStatus,
    tiData?: TIHitData
  ): PolicyResult {
    // Rule 1: Tombstone/Sinkhole → BLOCK
    if (features.causal.tombstone || features.causal.sinkhole) {
      return {
        overridden: true,
        riskLevel: RiskLevel.F,
        reason: features.causal.sinkhole
          ? 'URL points to a known sinkhole (malicious infrastructure)'
          : 'URL is tombstoned (404/410)',
        rule: 'RULE_TOMBSTONE_SINKHOLE',
        action: 'BLOCK'
      };
    }

    // Rule 2: Dual tier-1 TI hits → BLOCK
    if (tiData && this.hasDualTier1Hits(tiData)) {
      return {
        overridden: true,
        riskLevel: RiskLevel.F,
        reason: `URL flagged by ${tiData.tier1Hits} top-tier threat intelligence sources within 7 days`,
        rule: 'RULE_DUAL_TIER1_TI',
        action: 'BLOCK'
      };
    }

    // Rule 2.5: ANY TI hit + suspicious characteristics → HIGH RISK
    if (tiData && tiData.totalHits > 0) {
      // If URL is in TI database at all, it's suspicious
      // Combine with other factors for severity
      const suspiciousFactors = [
        features.tabular.domainAge < 30,
        features.tabular.tldRiskScore > 5,
        reachability === ReachabilityStatus.OFFLINE
      ].filter(Boolean).length;

      if (suspiciousFactors >= 2) {
        return {
          overridden: true,
          riskLevel: RiskLevel.E,
          reason: `URL found in threat intelligence database (${tiData.totalHits} source${tiData.totalHits > 1 ? 's' : ''}) with suspicious characteristics: ${suspiciousFactors >= 3 ? 'newly registered domain, high-risk TLD, currently offline' : suspiciousFactors === 2 ? 'newly registered domain, high-risk TLD or offline' : 'suspicious domain characteristics'}`,
          rule: 'RULE_TI_HIT_WITH_SUSPICIOUS_FACTORS',
          action: 'BLOCK'
        };
      } else if (tiData.totalHits >= 2) {
        // Multiple TI sources = high risk even without other factors
        return {
          overridden: true,
          riskLevel: RiskLevel.E,
          reason: `URL reported by multiple threat intelligence sources (${tiData.totalHits} sources)`,
          rule: 'RULE_MULTIPLE_TI_HITS',
          action: 'BLOCK'
        };
      }
    }

    // Rule 3: Phishing trinity → HIGH/CRITICAL
    if (this.isPhishingTrinity(features)) {
      const riskLevel = combinerResult.probability > 0.8 ? RiskLevel.F : RiskLevel.E;

      return {
        overridden: true,
        riskLevel,
        reason: 'Form submits to external domain + brand impersonation detected + newly registered domain (< 30 days)',
        rule: 'RULE_PHISHING_TRINITY',
        action: 'BLOCK'
      };
    }

    // Rule 4: Auto-download + suspicious domain → CRITICAL
    if (features.causal.autoDownload && features.tabular.domainAge < 7) {
      return {
        overridden: true,
        riskLevel: RiskLevel.F,
        reason: 'Automatic file download detected on newly registered domain (< 7 days)',
        rule: 'RULE_AUTO_DOWNLOAD_NEW_DOMAIN',
        action: 'BLOCK'
      };
    }

    // Rule 5: Redirect homoglyph → HIGH
    if (features.causal.redirectHomoglyphDelta && combinerResult.probability > 0.5) {
      return {
        overridden: true,
        riskLevel: RiskLevel.E,
        reason: 'Homoglyph attack detected in redirect chain (Unicode lookalike characters)',
        rule: 'RULE_REDIRECT_HOMOGLYPH',
        action: 'BLOCK'
      };
    }

    // Rule 6: Parked domain with low risk → ALLOW
    if (reachability === ReachabilityStatus.PARKED && combinerResult.probability < 0.3) {
      return {
        overridden: true,
        riskLevel: RiskLevel.A,
        reason: 'Domain is parked (for sale) with no malicious indicators',
        rule: 'RULE_PARKED_DOMAIN',
        action: 'ALLOW'
      };
    }

    // No policy override
    return {
      overridden: false,
      action: 'NONE'
    };
  }

  /**
   * Check for dual tier-1 TI hits within 7 days
   */
  private hasDualTier1Hits(tiData: TIHitData): boolean {
    if (tiData.tier1Hits < 2) {
      return false;
    }

    // Check if at least 2 tier-1 sources reported within 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentHits = tiData.tier1Sources.filter(
      hit => hit.lastSeen >= sevenDaysAgo
    ).length;

    return recentHits >= 2;
  }

  /**
   * Check for phishing trinity:
   * - Form origin mismatch
   * - Brand infrastructure divergence
   * - Domain age < 30 days
   */
  private isPhishingTrinity(features: ExtractedFeatures): boolean {
    return (
      features.causal.formOriginMismatch &&
      features.causal.brandInfraDivergence &&
      features.tabular.domainAge < 30
    );
  }

  /**
   * Get recommended actions based on policy result
   */
  getRecommendedActions(
    policyResult: PolicyResult,
    combinerResult: CombinerResult
  ): string[] {
    const actions: string[] = [];

    // If policy overridden to BLOCK
    if (policyResult.overridden && policyResult.action === 'BLOCK') {
      actions.push('⛔ Block access to this URL immediately');
      actions.push('📢 Report to threat intelligence feeds');

      if (policyResult.rule === 'RULE_DUAL_TIER1_TI') {
        actions.push('🔍 Investigate related domains and IPs');
      } else if (policyResult.rule === 'RULE_PHISHING_TRINITY') {
        actions.push('🏢 Report to impersonated brand');
        actions.push('🚨 Alert affected users');
      } else if (policyResult.rule === 'RULE_AUTO_DOWNLOAD_NEW_DOMAIN') {
        actions.push('🦠 Scan downloaded file with antivirus');
        actions.push('🔒 Quarantine file immediately');
      }

      return actions;
    }

    // If policy overridden to ALLOW
    if (policyResult.overridden && policyResult.action === 'ALLOW') {
      actions.push('✅ Safe to proceed (parked domain)');
      return actions;
    }

    // No policy override - provide actions based on probability
    const prob = combinerResult.probability;

    if (prob > 0.9) {
      actions.push('⛔ Block access immediately');
      actions.push('📢 Report to threat intelligence');
      actions.push('🚨 Alert security team');
    } else if (prob > 0.75) {
      actions.push('⚠️ Block and investigate');
      actions.push('📋 Review scan evidence');
      actions.push('🔍 Check for similar domains');
    } else if (prob > 0.5) {
      actions.push('⚠️ Proceed with extreme caution');
      actions.push('🔒 Do not enter credentials or payment info');
      actions.push('✉️ Verify sender if URL came from email');
    } else if (prob > 0.3) {
      actions.push('ℹ️ Low risk detected');
      actions.push('👀 Verify URL authenticity before entering sensitive data');
    } else {
      actions.push('✅ Low risk - likely safe');
      actions.push('🔐 Still use HTTPS and verify domain legitimacy');
    }

    // Add confidence interval warning if wide
    if (combinerResult.confidenceInterval.width > 0.3) {
      actions.push('⚠️ High uncertainty - consider additional checks');
    }

    return actions;
  }
}

/**
 * Factory function
 */
export function createPolicyEngine(): PolicyEngine {
  return new PolicyEngine();
}

/**
 * Utility: Map probability to risk level
 */
export function probabilityToRiskLevel(
  probability: number,
  thresholds: {
    safeThreshold: number;
    lowThreshold: number;
    mediumThreshold: number;
    highThreshold: number;
    criticalThreshold: number;
  }
): RiskLevel {
  if (probability < thresholds.safeThreshold) return RiskLevel.A;
  if (probability < thresholds.lowThreshold) return RiskLevel.B;
  if (probability < thresholds.mediumThreshold) return RiskLevel.C;
  if (probability < thresholds.highThreshold) return RiskLevel.D;
  if (probability < thresholds.criticalThreshold) return RiskLevel.E;
  return RiskLevel.F;
}
