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
import { executeCategories } from './categories';
// External API services removed - using only Vertex AI and internal checks
import { geminiScanSummarizerService } from '../../services/ai/gemini-scan-summarizer.service.js';
import { V2GeminiSummarizer } from '../../services/gemini/v2-summarizer.service.js';
import { formatNonTechSummary, formatTechSummary } from './result-formatters';
import { generateScoringExplanation, getReputationInfo } from './scoring-explainer';
import { generateVerdict } from './verdict-generator.js';
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
  private geminiSummarizer: V2GeminiSummarizer;

  constructor(config: V2Config) {
    this.config = config;
    this.geminiSummarizer = new V2GeminiSummarizer();
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

      // Generate Stage-1 Verdict (for transparency)
      const stage1Verdict = {
        stage: 'Stage 1: Lightweight ML Models',
        riskScore: Math.round(stage1Predictions.combined.probability * 100),
        confidence: stage1Predictions.combined.confidence,
        decision: stage1Predictions.shouldExit ? 'EXIT_EARLY' : 'CONTINUE_TO_STAGE_2',
        reasoning: `URL Lexical Model A detected ${(stage1Predictions.urlLexicalA.probability * 100).toFixed(1)}% risk based on character patterns and URL structure. URL Lexical Model B (BERT) found ${(stage1Predictions.urlLexicalB.probability * 100).toFixed(1)}% risk from semantic analysis. Tabular Risk Model calculated ${(stage1Predictions.tabularRisk.probability * 100).toFixed(1)}% risk from domain age (${features.tabular.domainAge} days), TLD risk score (${features.tabular.tldRiskScore}), ASN reputation, and other infrastructure features. Combined confidence of ${(stage1Predictions.combined.confidence * 100).toFixed(1)}% ${stage1Predictions.shouldExit ? 'is high enough to exit early and skip Stage 2' : 'requires Stage 2 deep analysis for higher accuracy'}.`,
        modelBreakdown: {
          urlLexicalA: {
            score: Math.round(stage1Predictions.urlLexicalA.probability * 100),
            confidence: stage1Predictions.urlLexicalA.confidence,
            contribution: '40%',
            method: 'XGBoost character n-gram analysis'
          },
          urlLexicalB: {
            score: Math.round(stage1Predictions.urlLexicalB.probability * 100),
            confidence: stage1Predictions.urlLexicalB.confidence,
            contribution: '30%',
            method: 'BERT semantic URL analysis'
          },
          tabularRisk: {
            score: Math.round(stage1Predictions.tabularRisk.probability * 100),
            confidence: stage1Predictions.tabularRisk.confidence,
            contribution: '30%',
            method: 'Monotonic XGBoost on infrastructure features'
          }
        },
        latencyMs: latency.stage1
      };
      console.log(`[V2Scanner] Stage-1 Verdict generated`);

      // Step 7: Stage-2 Models (conditional)
      let stage2Predictions = null;
      let stage2Verdict = null;
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

        // Generate Stage-2 Verdict (for transparency)
        stage2Verdict = {
          stage: 'Stage 2: Deep ML Models',
          riskScore: Math.round(stage2Predictions.combined.probability * 100),
          confidence: stage2Predictions.combined.confidence,
          reasoning: `Text Persuasion Model (Gemma/Mixtral) analyzed page content for social engineering tactics and detected ${(stage2Predictions.textPersuasion.probability * 100).toFixed(1)}% risk. Found ${stage2Predictions.textPersuasion.persuasionTactics.length} persuasion tactics: ${stage2Predictions.textPersuasion.persuasionTactics.join(', ') || 'none'}. Screenshot CNN (EfficientNet) performed visual analysis on page screenshot and detected ${(stage2Predictions.screenshotCnn.probability * 100).toFixed(1)}% risk. Visual analysis identified ${stage2Predictions.screenshotCnn.detectedBrands.length > 0 ? 'brand impersonation attempts: ' + stage2Predictions.screenshotCnn.detectedBrands.join(', ') : 'no brand impersonation'}. Fake login form detection: ${stage2Predictions.screenshotCnn.isFakeLogin ? 'DETECTED' : 'not detected'}. Combined Stage-2 confidence: ${(stage2Predictions.combined.confidence * 100).toFixed(1)}%.`,
          modelBreakdown: {
            textPersuasion: {
              score: Math.round(stage2Predictions.textPersuasion.probability * 100),
              confidence: stage2Predictions.textPersuasion.confidence,
              contribution: '50%',
              method: 'Gemma 2B LLM social engineering detection',
              persuasionTactics: stage2Predictions.textPersuasion.persuasionTactics
            },
            screenshotCnn: {
              score: Math.round(stage2Predictions.screenshotCnn.probability * 100),
              confidence: stage2Predictions.screenshotCnn.confidence,
              contribution: '50%',
              method: 'EfficientNet CNN visual phishing detection',
              detectedBrands: stage2Predictions.screenshotCnn.detectedBrands,
              isFakeLogin: stage2Predictions.screenshotCnn.isFakeLogin
            }
          },
          latencyMs: latency.stage2
        };
        console.log(`[V2Scanner] Stage-2 Verdict generated`);
      } else {
        console.log(`[V2Scanner] Step 7: Stage-2 SKIPPED (confidence=${stage1Predictions.combined.confidence.toFixed(2)}, threshold=${this.config.stage2Threshold})`);
      }

      // Step 7.5: Execute granular category checks (MOVED BEFORE COMBINER)
      console.log(`[V2Scanner] Step 7.5: Running granular category checks...`);
      const categoryStart = Date.now();
      const categoryResults = executeCategories({
        url: canonicalUrl,
        evidence,
        reachability: reachability.status,
        tiData
      });
      const categoryLatency = Date.now() - categoryStart;
      const categoryRiskFactor = categoryResults.totalPoints / categoryResults.totalPossible;
      console.log(`[V2Scanner] Category checks complete: ${categoryResults.totalCheckPointsEarned}/${categoryResults.totalCheckPointsPossible} points earned (penalty: ${categoryResults.totalPoints}/${categoryResults.totalPossible}, (${(categoryRiskFactor * 100).toFixed(1)}% risk) (${categoryLatency}ms)`);
      console.log(`[V2Scanner] Granular checks tracked: ${categoryResults.allChecks.length}`);

      // Log failed checks for visibility
      const failedChecks = categoryResults.allChecks.filter(c => c.status === 'FAIL');
      if (failedChecks.length > 0) {
        console.log(`[V2Scanner] FAILED CHECKS (${failedChecks.length}):`);
        failedChecks.forEach(check => {
          console.log(`  - [${check.category}] ${check.name}: ${check.description}`);
        });
      }

      // Generate Granular Checks Verdict (for transparency)
      const passChecks = categoryResults.allChecks.filter(c => c.status === 'PASS');
      const warnChecks = categoryResults.allChecks.filter(c => c.status === 'WARNING');
      const infoChecks = categoryResults.allChecks.filter(c => c.status === 'INFO');
      const granularVerdict = {
        stage: 'Granular Security Checks',
        totalPenaltyPoints: categoryResults.totalPoints,
        maxPossiblePenalty: categoryResults.totalPossible,
        riskPercentage: Math.round((categoryResults.totalPoints / categoryResults.totalPossible) * 100),
        reasoning: `Executed ${categoryResults.allChecks.length} granular security checks across ${categoryResults.results.length} categories (Threat Intelligence, Domain Analysis, SSL/TLS, Content Analysis, Phishing Patterns, etc.). Found ${failedChecks.length} failures, ${warnChecks.length} warnings, ${passChecks.length} passes. Total penalty points: ${categoryResults.totalPoints}/${categoryResults.totalPossible}. Category risk factor: ${(categoryRiskFactor * 100).toFixed(1)}%. This comprehensive rule-based analysis complements ML model predictions to catch known attack patterns that may evade statistical models.`,
        categoryBreakdown: categoryResults.results.map(cat => ({
          category: cat.categoryName,
          penaltyPoints: cat.points,
          maxPenalty: cat.maxPoints,
          riskLevel: cat.points === 0 ? 'SAFE' : cat.points < cat.maxPoints * 0.3 ? 'LOW' : cat.points < cat.maxPoints * 0.7 ? 'MEDIUM' : 'HIGH',
          failedChecks: cat.checks.filter(c => c.status === 'FAIL').length,
          totalChecks: cat.checks.length,
          skipped: cat.skipped
        })),
        topThreats: failedChecks.slice(0, 5).map(c => ({
          threat: c.checkId,
          name: c.name,
          description: c.description,
          details: c.details,
          category: c.category
        })),
        checkSummary: {
          totalChecks: categoryResults.allChecks.length,
          passed: passChecks.length,
          failed: failedChecks.length,
          warnings: warnChecks.length,
          info: infoChecks.length
        }
      };
      console.log(`[V2Scanner] Granular Verdict generated`);

      // Step 8: Combiner + Calibration (NOW INCLUDES CATEGORY RISK BOOST)
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
        reachability.status,
        categoryResults // PASS CATEGORY RESULTS FOR RISK BOOST
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

      // OVERRIDE: Very young domains should be at least Level D
      if (evidence.whois.domainAge < 7 && riskLevel < 'D') {
        console.log(`[V2Scanner] Overriding risk level from ${riskLevel} to D (domain age: ${evidence.whois.domainAge} days)`);
        riskLevel = 'D';
      }

      // Get recommended actions
      const recommendedActions = policyEngine.getRecommendedActions(
        policyResult,
        combinerResult
      );

      // Generate Scoring Explanation (for transparency)
      const riskBenchmarks = {
        'A (0-15%)': 'SAFE - Legitimate website with no security concerns',
        'B (15-30%)': 'LOW RISK - Minor concerns but generally safe to visit',
        'C (30-50%)': 'MEDIUM RISK - Multiple warning signs detected, proceed with caution',
        'D (50-75%)': 'HIGH RISK - Strong indicators of phishing or malware',
        'E (75-90%)': 'CRITICAL RISK - Almost certainly malicious, do not visit',
        'F (90-100%)': 'SEVERE RISK - Confirmed threat, block immediately'
      };

      const scoringExplanation = {
        finalRiskScore: Math.round(combinerResult.probability * 100),
        confidenceInterval: {
          lower: Math.round(combinerResult.confidenceInterval.lower * 100),
          upper: Math.round(combinerResult.confidenceInterval.upper * 100),
          width: Math.round(combinerResult.confidenceInterval.width * 100)
        },
        riskLevel: riskLevel,
        verdict: riskLevel <= 'B' ? 'SAFE' : riskLevel <= 'D' ? 'SUSPICIOUS' : 'DANGEROUS',

        calculation: {
          stage1Weight: stage2Predictions ? 0.4 : 1.0,
          stage1Score: Math.round(stage1Predictions.combined.probability * 100),
          stage1Contribution: stage2Predictions
            ? Math.round(stage1Predictions.combined.probability * 0.4 * 100)
            : Math.round(stage1Predictions.combined.probability * 100),

          stage2Weight: stage2Predictions ? 0.6 : 0,
          stage2Score: stage2Predictions ? Math.round(stage2Predictions.combined.probability * 100) : null,
          stage2Contribution: stage2Predictions
            ? Math.round(stage2Predictions.combined.probability * 0.6 * 100)
            : null,

          granularWeight: 0.6,
          granularScore: Math.round((categoryResults.totalPoints / categoryResults.totalPossible) * 100),
          granularContribution: Math.round((categoryResults.totalPoints / categoryResults.totalPossible) * 0.6 * 100),

          formula: stage2Predictions
            ? '(Stage1 * 0.4) + (Stage2 * 0.6) + Granular + Causal + Branch = Final'
            : '(Stage1 * 1.0) + Granular + Causal + Branch = Final',
          breakdown: stage2Predictions
            ? `(${Math.round(stage1Predictions.combined.probability * 100)}% * 0.4) + (${Math.round(stage2Predictions.combined.probability * 100)}% * 0.6) + Category Boost + Causal Signals = ${Math.round(combinerResult.probability * 100)}%`
            : `(${Math.round(stage1Predictions.combined.probability * 100)}% * 1.0) + Category Boost + Causal Signals = ${Math.round(combinerResult.probability * 100)}%`
        },

        benchmarks: riskBenchmarks,
        yourScore: `${Math.round(combinerResult.probability * 100)}% falls in Risk Level ${riskLevel} (${riskLevel <= 'B' ? 'SAFE' : riskLevel <= 'D' ? 'SUSPICIOUS' : 'DANGEROUS'})`,

        contributingFactors: combinerResult.decisionGraph.filter(node => Math.abs(node.contribution) > 0.01).map(node => ({
          component: node.component,
          contribution: Math.round(node.contribution * 100),
          impact: node.contribution > 0 ? 'increased risk' : 'decreased risk'
        }))
      };
      console.log(`[V2Scanner] Scoring explanation generated`);

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

        // Add granular checks
        granularChecks: categoryResults.allChecks,

        // Add category metadata for transparency - WITH DETAILED BREAKDOWN
        categoryResults: {
          totalPoints: categoryResults.totalPoints,
          totalPossible: categoryResults.totalPossible,
          totalCheckPointsEarned: categoryResults.totalCheckPointsEarned,
          totalCheckPointsPossible: categoryResults.totalCheckPointsPossible,
          riskFactor: categoryRiskFactor,
          categories: categoryResults.results.map(r => ({
            categoryName: r.categoryName,
            points: r.points,              // Penalty points
            maxPoints: r.maxPoints,
            earnedPoints: r.earnedPoints,  // Points earned by checks
            possiblePoints: r.possiblePoints, // Max points checks can earn
            percentage: r.possiblePoints > 0
              ? Math.round((r.earnedPoints / r.possiblePoints) * 100)
              : 0,
            checks: r.checks,              // Include all check details
            skipped: r.skipped,
            skipReason: r.skipReason
          }))
        },

        evidenceSummary: {
          domainAge: evidence.whois.domainAge,
          tlsValid: evidence.tls?.valid || false,
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

        // NEW: Comprehensive transparency and detailed analysis
        detailedAnalysis: {
          stage1Verdict,
          stage2Verdict,
          granularVerdict,
          scoringExplanation
        },

        // STAGE-BY-STAGE VERDICTS (for frontend display)
        stageVerdicts: {
          reachability: {
            status: reachability.status,
            explanation: reachability.status === 'ONLINE'
              ? 'Website is online and reachable'
              : reachability.status === 'OFFLINE'
              ? 'Website is offline or unreachable'
              : reachability.status === 'SINKHOLE'
              ? 'Domain points to known sinkhole (confirmed malicious)'
              : `Website status: ${reachability.status}`
          },
          threatIntel: {
            hits: tiData.totalHits,
            tier1Hits: tiData.tier1Hits,
            verdict: tiData.tier1Hits >= 2 ? 'MALICIOUS' :
                     tiData.totalHits > 0 ? 'SUSPICIOUS' : 'CLEAN',
            sources: tiData.tier1Sources.map(s => s.source)
          },
          domainAnalysis: {
            age: evidence.whois.domainAge,
            verdict: evidence.whois.domainAge < 7 ? 'VERY_SUSPICIOUS' :
                     evidence.whois.domainAge < 30 ? 'SUSPICIOUS' :
                     evidence.whois.domainAge < 90 ? 'CAUTIOUS' : 'TRUSTED',
            explanation: `Domain is ${evidence.whois.domainAge} days old`
          },
          contentAnalysis: reachability.status === 'ONLINE' ? {
            hasLoginForm: evidence.dom.forms.some(f =>
              f.inputs.some(input => input.type === 'password')
            ),
            autoDownload: evidence.autoDownload,
            verdict: (evidence.dom.forms.some(f => f.inputs.some(i => i.type === 'password')) || evidence.autoDownload)
              ? 'RISKY' : 'SAFE'
          } : null
        },

        // COMBINER EXPLANATION
        combinerSummary: {
          algorithm: 'Bayesian Risk Combiner with Conformal Prediction',
          finalProbability: combinerResult.probability,
          confidenceInterval: combinerResult.confidenceInterval,
          verdictLogic: `Risk score ${Math.round(combinerResult.probability * 100)}% maps to level ${riskLevel}. ` +
            `Computed from ${categoryResults.totalPoints}/${categoryResults.totalPossible} penalty points across ` +
            `${categoryResults.results.length} categories. Confidence: ${Math.round((1 - combinerResult.confidenceInterval.width) * 100)}%.`,
          decisionGraph: combinerResult.decisionGraph,
          modelContributions: combinerResult.modelContributions
        },

        transparency: {
          totalChecksRun: categoryResults.allChecks.length,
          checksPass: passChecks.length,
          checksFail: failedChecks.length,
          checksWarn: warnChecks.length,
          checksInfo: infoChecks.length,

          topThreats: failedChecks.slice(0, 5).map(c => ({
            threat: c.checkId,
            name: c.name,
            description: c.description,
            details: c.details,
            reasoning: c.reasoning,
            penaltyPoints: c.maxPoints - c.points,
            category: c.category
          })),

          processingTime: {
            totalMs: latency.total,
            reachabilityMs: latency.reachability,
            evidenceMs: latency.evidence,
            featureExtractionMs: latency.featureExtraction,
            stage1Ms: latency.stage1,
            stage2Ms: latency.stage2 || 0,
            granularChecksMs: categoryLatency,
            combinerMs: latency.combiner,
            policyMs: latency.policy
          },

          dataSourcesCrawled: {
            threatIntelligence: true,
            whoisDatabase: !options.skipWHOIS,
            dnsRecords: true,
            tlsCertificate: !options.skipTLS && reachability.status === 'ONLINE',
            htmlContent: reachability.status === 'ONLINE',
            screenshot: !options.skipScreenshot && reachability.status === 'ONLINE'
          }
        },

        latency,

        // Backward compatibility
        verdict: this.mapRiskLevelToVerdict(riskLevel),
        confidence: combinerResult.confidenceInterval.width < 0.2 ? 'high' :
          combinerResult.confidenceInterval.width < 0.4 ? 'medium' : 'low'
      };

      // Step 11: Generate AI summary, scoring explanation, and formatted outputs (optional, don't fail scan if it errors)
      console.log(`[V2Scanner] Step 11: Generating AI summary, scoring explanation, and formatted outputs...`);
      let aiSummary;
      let nonTechSummary;
      let techSummary;
      let reputationInfo;


      try {
        // Generate reputation info
        reputationInfo = getReputationInfo(new URL(canonicalUrl).hostname);
        console.log(`[V2Scanner] Reputation info generated successfully`);
      } catch (error: any) {
        console.warn('[V2Scanner] Failed to generate reputation info:', error.message);
        reputationInfo = undefined;
      }

      try {
        // Generate AI summary using new Gemini service
        aiSummary = await this.geminiSummarizer.generateSummary(preliminaryResult);
        console.log(`[V2Scanner] AI summary generated successfully`);
      } catch (error: any) {
        console.warn('[V2Scanner] Failed to generate AI summary:', error.message);
        aiSummary = undefined;
      }

      try {
        // Generate formatted summaries
        nonTechSummary = formatNonTechSummary(preliminaryResult);
        techSummary = formatTechSummary(preliminaryResult);
        console.log(`[V2Scanner] Formatted summaries generated successfully`);
      } catch (error: any) {
        console.warn('[V2Scanner] Failed to generate formatted summaries:', error.message);
        nonTechSummary = undefined;
        techSummary = undefined;
      }

      // Build preliminary result with all data
      const resultWithExtras: EnhancedScanResult = {
        ...preliminaryResult,
        scoringExplanation,
        reputationInfo,
        aiSummary,
        nonTechSummary,
        techSummary
      };

      // Step 12: Generate final verdict (ScamAdviser style)
      let finalVerdict;
      try {
        console.log(`[V2Scanner] Step 12: Generating final verdict...`);
        finalVerdict = generateVerdict(resultWithExtras);
        console.log(`[V2Scanner] Final verdict: ${finalVerdict.verdict} (Trust Score: ${finalVerdict.trustScore}/100)`);
        console.log(`[V2Scanner] Positive highlights: ${finalVerdict.positiveHighlights.length}`);
        console.log(`[V2Scanner] Negative highlights: ${finalVerdict.negativeHighlights.length}`);
      } catch (error: any) {
        console.warn('[V2Scanner] Failed to generate final verdict:', error.message);
        finalVerdict = undefined;
      }

      // Build final result
      const result: EnhancedScanResult = {
        ...resultWithExtras,
        finalVerdict
      };

      console.log(`\n========== V2 SCAN COMPLETE ==========`);
      console.log(`[V2Scanner] Verdict: ${result.verdict} | Risk: ${result.riskLevel} | Score: ${result.riskScore}%`);
      console.log(`[V2Scanner] Trust Score: ${finalVerdict?.trustScore}/100`);
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
      urlLexicalB: process.env.VERTEX_URL_BERT_ENDPOINT || '',
      tabularRisk: process.env.VERTEX_TABULAR_ENDPOINT || '',
      textPersuasion: process.env.VERTEX_TEXT_ENDPOINT || '',
      screenshotCnn: process.env.VERTEX_SCREENSHOT_ENDPOINT || '',
      combiner: process.env.VERTEX_COMBINER_ENDPOINT || ''
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
