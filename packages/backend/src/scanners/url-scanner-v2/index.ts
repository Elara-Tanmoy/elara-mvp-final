/**
 * URL Scanner V2 - Main Orchestrator
 *
 * Coordinates the complete V2 scanning pipeline:
 * 1. URL canonicalization
 * 2. TI gate check
 * 3. Reachability probe
 * 4. Evidence collection
 * 5. Feature extraction
 * 6. Stage-1 models (with early exit)
 * 7. Stage-2 models (if needed)
 * 8. Combiner + calibration
 * 9. Policy engine
 * 10. Result formatting
 */

import { URL } from 'url';
import { createReachabilityChecker } from './reachability';
import { createEvidenceCollector } from './evidence';
import { createFeatureExtractor, loadTIDataForFeatures } from './feature-extract';
import { createStage1Runner, hasVertexAIConfigured } from './stage1';
import { createStage2Runner, shouldSkipStage2 } from './stage2';
import { createCombiner, getDefaultBranchThresholds } from './combiner';
import { createPolicyEngine, probabilityToRiskLevel } from './policy';
// External API services removed - using only Vertex AI and internal checks
import { geminiScanSummarizerService } from '../../services/ai/gemini-scan-summarizer.service.js';
import { ReachabilityStatus, RiskLevel } from './types';
import type {
  EnhancedScanResult,
  V2ScanOptions,
  V2Config
} from './types';

/**
 * URL Scanner V2 class
 */
export class URLScannerV2 {
  private config: V2Config;

  constructor(config: V2Config) {
    this.config = config;
  }

  /**
   * Main scan method
   */
  async scan(url: string, options: V2ScanOptions = {}): Promise<EnhancedScanResult> {
    const scanId = this.generateScanId();
    const startTime = Date.now();
    const latency = {
      total: 0,
      reachability: 0,
      evidence: 0,
      featureExtraction: 0,
      stage1: 0,
      stage2: 0,
      combiner: 0,
      policy: 0
    };

    console.log(`\n========== V2 URL SCANNER START ==========`);
    console.log(`[V2Scanner] Scan ID: ${scanId}`);
    console.log(`[V2Scanner] URL: ${url}`);
    console.log(`[V2Scanner] Options:`, options);

    try {
      // Step 1: Canonicalize URL
      const canonicalUrl = this.canonicalizeURL(url);
      console.log(`[V2Scanner] Canonicalized URL: ${canonicalUrl}`);

      // Step 2: TI Gate Check (fast lookup)
      const tiData = await this.checkTIGate(canonicalUrl);

      // Early exit if dual tier-1 hits
      if (tiData.tier1Hits >= 2) {
        console.log(`[V2Scanner] EARLY EXIT: Dual tier-1 threat intelligence hits detected`);
        return this.buildBlockedResult(
          scanId,
          canonicalUrl,
          'Dual tier-1 threat intelligence hits',
          latency
        );
      }

      // Step 3: Reachability Probe
      console.log(`[V2Scanner] Step 3: Reachability Probe...`);
      const reachabilityStart = Date.now();
      const reachabilityChecker = createReachabilityChecker(
        this.config.timeouts.reachability
      );
      const reachability = await reachabilityChecker.check(canonicalUrl);
      latency.reachability = Date.now() - reachabilityStart;
      console.log(`[V2Scanner] Reachability: ${reachability.status} (${latency.reachability}ms)`);

      // Early exit if sinkhole
      if (reachability.status === ReachabilityStatus.SINKHOLE) {
        return this.buildBlockedResult(
          scanId,
          canonicalUrl,
          'URL points to known sinkhole',
          latency
        );
      }

      // Step 4: Evidence Collection
      console.log(`[V2Scanner] Step 4: Evidence Collection...`);
      const evidenceStart = Date.now();
      const evidenceCollector = createEvidenceCollector(
        this.config.timeouts.evidence
      );
      const evidence = await evidenceCollector.collect(
        canonicalUrl,
        reachability,
        {
          skipScreenshot: options.skipScreenshot,
          skipTLS: options.skipTLS,
          skipWHOIS: options.skipWHOIS
        }
      );
      latency.evidence = Date.now() - evidenceStart;
      console.log(`[V2Scanner] Evidence collected: DOM elements: ${evidence.dom.forms.length} forms, ${evidence.dom.scripts.length} scripts (${latency.evidence}ms)`);

      // Step 5: Feature Extraction
      console.log(`[V2Scanner] Step 5: Feature Extraction...`);
      const featureStart = Date.now();
      const featureExtractor = createFeatureExtractor();
      const features = featureExtractor.extract(
        canonicalUrl,
        evidence,
        reachability,
        tiData
      );
      latency.featureExtraction = Date.now() - featureStart;
      console.log(`[V2Scanner] Features extracted: entropy=${features.lexical.entropy.toFixed(2)}, domain_age=${features.tabular.domainAge}d, tld_risk=${features.tabular.tldRiskScore} (${latency.featureExtraction}ms)`);

      // Step 6: Stage-1 Models
      console.log(`[V2Scanner] Step 6: Stage-1 Models...`);
      const stage1Start = Date.now();
      const stage1Runner = createStage1Runner(
        this.config.vertexEndpoints,
        this.config.stage2Threshold,
        this.config.timeouts.stage1
      );
      const stage1Predictions = await stage1Runner.predict(features);
      latency.stage1 = Date.now() - stage1Start;
      console.log(`[V2Scanner] Stage-1 Results:`);
      console.log(`  - URL Lexical A: ${(stage1Predictions.urlLexicalA.probability * 100).toFixed(1)}% (conf: ${stage1Predictions.urlLexicalA.confidence.toFixed(2)})`);
      console.log(`  - URL Lexical B: ${(stage1Predictions.urlLexicalB.probability * 100).toFixed(1)}% (conf: ${stage1Predictions.urlLexicalB.confidence.toFixed(2)})`);
      console.log(`  - Tabular Risk: ${(stage1Predictions.tabularRisk.probability * 100).toFixed(1)}% (conf: ${stage1Predictions.tabularRisk.confidence.toFixed(2)})`);
      console.log(`  - Combined: ${(stage1Predictions.combined.probability * 100).toFixed(1)}% (conf: ${stage1Predictions.combined.confidence.toFixed(2)})`);
      console.log(`  - Should Exit: ${stage1Predictions.shouldExit} (${latency.stage1}ms)`);

      // Step 7: Stage-2 Models (conditional)
      let stage2Predictions = null;
      const skipStage2 = options.skipStage2 ||
        shouldSkipStage2(stage1Predictions.combined.confidence, this.config.stage2Threshold, features);

      if (!skipStage2 && !stage1Predictions.shouldExit) {
        console.log(`[V2Scanner] Step 7: Stage-2 Models (deep analysis)...`);
        const stage2Start = Date.now();
        const stage2Runner = createStage2Runner(
          this.config.vertexEndpoints,
          this.config.timeouts.stage2
        );
        stage2Predictions = await stage2Runner.predict(features, {
          skipScreenshot: options.skipScreenshot
        });
        latency.stage2 = Date.now() - stage2Start;
        console.log(`[V2Scanner] Stage-2 Results:`);
        console.log(`  - Text Persuasion: ${(stage2Predictions.textPersuasion.probability * 100).toFixed(1)}%`);
        console.log(`  - Screenshot CNN: ${(stage2Predictions.screenshotCnn.probability * 100).toFixed(1)}%`);
        console.log(`  - Combined: ${(stage2Predictions.combined.probability * 100).toFixed(1)}% (${latency.stage2}ms)`);
      } else {
        console.log(`[V2Scanner] Step 7: Stage-2 SKIPPED (confidence=${stage1Predictions.combined.confidence.toFixed(2)}, threshold=${this.config.stage2Threshold})`);
      }

      // Step 8: Combiner + Calibration
      console.log(`[V2Scanner] Step 8: Combiner + Calibration...`);
      const combinerStart = Date.now();
      const combiner = createCombiner(
        this.config.calibration,
        this.config.branchThresholds
      );
      const combinerResult = combiner.combine(
        stage1Predictions,
        stage2Predictions,
        features,
        reachability.status
      );
      latency.combiner = Date.now() - combinerStart;
      console.log(`[V2Scanner] Combined probability: ${(combinerResult.probability * 100).toFixed(1)}%, CI: [${(combinerResult.confidenceInterval.lower * 100).toFixed(1)}%, ${(combinerResult.confidenceInterval.upper * 100).toFixed(1)}%] (${latency.combiner}ms)`);

      // Step 9: Policy Engine
      console.log(`[V2Scanner] Step 9: Policy Engine...`);
      const policyStart = Date.now();
      const policyEngine = createPolicyEngine();
      const policyResult = policyEngine.apply(
        combinerResult,
        features,
        reachability.status,
        tiData
      );
      latency.policy = Date.now() - policyStart;
      console.log(`[V2Scanner] Policy decision: overridden=${policyResult.overridden}, action=${policyResult.action || 'none'} (${latency.policy}ms)`);

      // Step 9.5: External API checks removed - using only Vertex AI models and internal TI sources

      // Determine final risk level
      let riskLevel: RiskLevel;
      if (policyResult.overridden && policyResult.riskLevel) {
        riskLevel = policyResult.riskLevel;
        console.log(`[V2Scanner] Final Risk Level: ${riskLevel} (POLICY OVERRIDE)`);
      } else {
        const thresholds = this.config.branchThresholds[reachability.status];
        riskLevel = probabilityToRiskLevel(combinerResult.probability, thresholds);
        console.log(`[V2Scanner] Final Risk Level: ${riskLevel} (from probability)`);
      }

      // Get recommended actions
      const recommendedActions = policyEngine.getRecommendedActions(
        policyResult,
        combinerResult
      );

      // Step 10: Build preliminary result
      latency.total = Date.now() - startTime;
      console.log(`[V2Scanner] Total scan time: ${latency.total}ms`);

      const preliminaryResult: EnhancedScanResult = {
        url: canonicalUrl,
        scanId,
        timestamp: new Date(),
        version: 'v2',

        riskScore: Math.round(combinerResult.probability * 100),
        riskLevel,
        probability: combinerResult.probability,
        confidenceInterval: combinerResult.confidenceInterval,

        reachability: reachability.status,

        stage1: stage1Predictions,
        stage2: stage2Predictions || undefined,

        policyOverride: policyResult.overridden ? policyResult : undefined,

        evidenceSummary: {
          domainAge: evidence.whois.domainAge,
          tlsValid: evidence.tls.valid,
          tiHits: tiData.totalHits,
          hasLoginForm: evidence.dom.forms.some(f =>
            f.inputs.some(input => input.type === 'password')
          ),
          autoDownload: evidence.autoDownload
        },

        decisionGraph: combinerResult.decisionGraph,
        recommendedActions,

        screenshotUrl: evidence.screenshot?.url,
        skippedChecks: this.getSkippedChecks(options, reachability.status),

        latency,

        // Backward compatibility
        verdict: this.mapRiskLevelToVerdict(riskLevel),
        confidence: combinerResult.confidenceInterval.width < 0.2 ? 'high' :
          combinerResult.confidenceInterval.width < 0.4 ? 'medium' : 'low'
      };

      // Step 11: Generate AI summary (optional, don't fail scan if it errors)
      console.log(`[V2Scanner] Step 11: Generating AI summary...`);
      let aiSummary;
      try {
        aiSummary = await geminiScanSummarizerService.summarizeScan(preliminaryResult);
        console.log(`[V2Scanner] AI summary generated successfully`);
      } catch (error: any) {
        console.warn('[V2Scanner] Failed to generate AI summary:', error.message);
        aiSummary = undefined;
      }

      // Build final result with AI summary
      const result: EnhancedScanResult = {
        ...preliminaryResult,
        aiSummary
      };

      console.log(`\n========== V2 SCAN COMPLETE ==========`);
      console.log(`[V2Scanner] Verdict: ${result.verdict} | Risk: ${result.riskLevel} | Score: ${result.riskScore}%`);
      console.log(`=========================================\n`);

      return result;

    } catch (error) {
      console.error('V2 Scan error:', error);

      // Return error result
      return this.buildErrorResult(
        scanId,
        url,
        error instanceof Error ? error.message : 'Unknown error',
        latency
      );
    }
  }

  /**
   * Canonicalize URL
   */
  private canonicalizeURL(url: string): string {
    try {
      const parsed = new URL(url);

      // Normalize protocol
      if (!parsed.protocol) {
        parsed.protocol = 'https:';
      }

      // Remove fragments
      parsed.hash = '';

      // Sort query params
      const params = new URLSearchParams(parsed.search);
      const sortedParams = new URLSearchParams(
        Array.from(params.entries()).sort()
      );
      parsed.search = sortedParams.toString();

      // Lowercase domain
      parsed.hostname = parsed.hostname.toLowerCase();

      return parsed.toString();

    } catch (error) {
      // If URL parsing fails, return original
      return url;
    }
  }

  /**
   * Check threat intelligence gate
   * Uses V2 TI Integration Service for real TI lookups
   */
  private async checkTIGate(url: string): Promise<{
    totalHits: number;
    tier1Hits: number;
    tier1Sources: Array<{ source: string; lastSeen: Date }>;
  }> {
    try {
      // Import V2 TI Integration Service
      const { getFullTIData } = await import('../../services/threat-intel/v2-ti-integration.service.js');

      // Get full TI data from V2 TI service
      const fullTIData = await getFullTIData(url);

      console.log(`[V2Scanner] TI Gate Check for ${url}:`);
      console.log(`  - Total TI Hits: ${fullTIData.totalHits}`);
      console.log(`  - Tier-1 Hits: ${fullTIData.tier1Hits}`);
      console.log(`  - Has Dual Tier-1: ${fullTIData.hasDualTier1}`);

      if (fullTIData.tier1Sources.length > 0) {
        console.log(`  - Tier-1 Sources:`);
        fullTIData.tier1Sources.forEach(src => {
          console.log(`    * ${src.source} (severity: ${src.severity}, last seen: ${src.lastSeen.toISOString()})`);
        });
      }

      return {
        totalHits: fullTIData.totalHits,
        tier1Hits: fullTIData.tier1Hits,
        tier1Sources: fullTIData.tier1Sources
      };
    } catch (error) {
      console.error('[V2Scanner] TI Gate Check failed:', error);
      // Return empty TI data on error
      return {
        totalHits: 0,
        tier1Hits: 0,
        tier1Sources: []
      };
    }
  }

  /**
   * Get skipped checks
   */
  private getSkippedChecks(options: V2ScanOptions, reachability: ReachabilityStatus): string[] {
    const skipped: string[] = [];

    if (options.skipScreenshot) skipped.push('screenshot_analysis');
    if (options.skipTLS) skipped.push('tls_validation');
    if (options.skipWHOIS) skipped.push('whois_lookup');
    if (options.skipStage2) skipped.push('stage2_deep_analysis');

    if (reachability === ReachabilityStatus.OFFLINE) {
      skipped.push('html_analysis', 'form_analysis', 'script_analysis');
    }

    return skipped;
  }

  /**
   * Map risk level to verdict
   */
  private mapRiskLevelToVerdict(riskLevel: RiskLevel): string {
    const mapping: Record<RiskLevel, string> = {
      [RiskLevel.A]: 'safe',
      [RiskLevel.B]: 'low_risk',
      [RiskLevel.C]: 'medium_risk',
      [RiskLevel.D]: 'high_risk',
      [RiskLevel.E]: 'critical',
      [RiskLevel.F]: 'malicious'
    };
    return mapping[riskLevel];
  }

  /**
   * Build blocked result
   */
  private buildBlockedResult(
    scanId: string,
    url: string,
    reason: string,
    latency: any
  ): EnhancedScanResult {
    latency.total = Date.now() - (Date.now() - latency.total);

    return {
      url,
      scanId,
      timestamp: new Date(),
      version: 'v2',
      riskScore: 100,
      riskLevel: RiskLevel.F,
      probability: 1.0,
      confidenceInterval: { lower: 0.95, upper: 1.0, width: 0.05 },
      reachability: ReachabilityStatus.SINKHOLE,
      stage1: {
        urlLexicalA: { probability: 1.0, confidence: 1.0 },
        urlLexicalB: { probability: 1.0, confidence: 1.0 },
        tabularRisk: { probability: 1.0, confidence: 1.0, featureImportance: {} },
        combined: { probability: 1.0, confidence: 1.0 },
        shouldExit: true,
        latency: 0
      },
      evidenceSummary: {
        domainAge: 0,
        tlsValid: false,
        tiHits: 2,
        hasLoginForm: false,
        autoDownload: false
      },
      decisionGraph: [{
        step: 1,
        component: 'Policy Override',
        input: {},
        output: { blocked: true, reason },
        contribution: 1.0,
        timestamp: new Date()
      }],
      recommendedActions: [
        '⛔ Block access immediately',
        '📢 Report to security team',
        `Reason: ${reason}`
      ],
      skippedChecks: ['evidence_collection', 'feature_extraction', 'stage2_analysis'],
      latency,
      verdict: 'malicious',
      confidence: 'high'
    };
  }

  /**
   * Build error result
   */
  private buildErrorResult(
    scanId: string,
    url: string,
    errorMessage: string,
    latency: any
  ): EnhancedScanResult {
    latency.total = Date.now() - (Date.now() - latency.total);

    return {
      url,
      scanId,
      timestamp: new Date(),
      version: 'v2',
      riskScore: 50,
      riskLevel: RiskLevel.C,
      probability: 0.5,
      confidenceInterval: { lower: 0.0, upper: 1.0, width: 1.0 },
      reachability: ReachabilityStatus.ERROR,
      stage1: {
        urlLexicalA: { probability: 0.5, confidence: 0.0 },
        urlLexicalB: { probability: 0.5, confidence: 0.0 },
        tabularRisk: { probability: 0.5, confidence: 0.0, featureImportance: {} },
        combined: { probability: 0.5, confidence: 0.0 },
        shouldExit: false,
        latency: 0
      },
      evidenceSummary: {
        domainAge: 0,
        tlsValid: false,
        tiHits: 0,
        hasLoginForm: false,
        autoDownload: false
      },
      decisionGraph: [{
        step: 1,
        component: 'Error Handler',
        input: {},
        output: { error: errorMessage },
        contribution: 0,
        timestamp: new Date()
      }],
      recommendedActions: [
        '⚠️ Scan failed due to error',
        'ℹ️ Unable to determine risk level',
        `Error: ${errorMessage}`
      ],
      skippedChecks: ['all'],
      latency,
      verdict: 'unknown',
      confidence: 'low'
    };
  }

  /**
   * Generate scan ID
   */
  private generateScanId(): string {
    return `v2-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory function
 */
export function createURLScannerV2(config: V2Config): URLScannerV2 {
  return new URLScannerV2(config);
}

/**
 * Get default V2 configuration
 */
export function getDefaultV2Config(): V2Config {
  return {
    enabled: true,
    vertexEndpoints: {
      urlLexicalB: process.env.VERTEX_URL_BERT_ENDPOINT || 'placeholder',
      tabularRisk: process.env.VERTEX_TABULAR_ENDPOINT || 'placeholder',
      textPersuasion: process.env.VERTEX_TEXT_ENDPOINT || 'placeholder',
      screenshotCnn: process.env.VERTEX_SCREENSHOT_ENDPOINT || 'placeholder',
      combiner: process.env.VERTEX_COMBINER_ENDPOINT || 'placeholder'
    },
    featureStore: {
      type: 'firestore',
      firestoreCollection: 'v2_features',
      cacheTTL: 3600 // 1 hour
    },
    calibration: {
      method: 'ICP',
      alpha: 0.1 // 90% confidence interval
    },
    branchThresholds: getDefaultBranchThresholds(),
    stage2Threshold: 0.85, // Skip Stage-2 if Stage-1 confidence > 85%
    timeouts: {
      reachability: 10000,  // 10s
      evidence: 30000,       // 30s
      stage1: 5000,          // 5s
      stage2: 10000,         // 10s
      total: 60000           // 60s
    }
  };
}

// Export all modules
export * from './types';
export * from './reachability';
export * from './evidence';
export * from './feature-extract';
export * from './stage1';
export * from './stage2';
export * from './combiner';
export * from './policy';
