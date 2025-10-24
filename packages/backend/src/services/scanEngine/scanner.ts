/**
 * Main Scanner: Orchestrates complete URL scan flow
 *
 * Complete 7-Stage Workflow:
 * 1. Stage 0: Pre-Flight Checks (reachability, validation, cache)
 * 2. Stage 1: Category Execution (17 categories, 515 pts)
 * 3. Stage 2: Threat Intelligence Layer (11 sources, 55 pts)
 * 4. Stage 3: Base Score Calculation (categories + TI)
 * 5. Stage 4: AI Consensus Engine (3 LLMs, 0.7-1.3× multiplier)
 * 6. Stage 5: False Positive Prevention (legitimacy scoring)
 * 7. Stage 6: Risk Level Determination & Database Save
 */

import { Stage0Orchestrator } from './stage0Orchestrator.js';
import { CategoryExecutor } from './categoryExecutor.js';
import { CacheManager } from './cacheManager.js';
import { TILayer } from './threatIntelligence/tiLayer.js';
import { AIOrchestrator } from './aiConsensus/aiOrchestrator.js';
import { FalsePositivePreventor } from './falsePositive/falsePositivePreventor.js';
import { FinalScanResult, Stage0Result } from './types.js';
import { logger } from '../../config/logger.js';
import { prisma } from '../../config/database.js';
import { ScanEventEmitter } from '../events/scan-event-emitter.service.js';
import { scanLogger } from '../logging/scanLogger.service.js';
import { apiKeyEncryption } from '../apiKeyEncryption.service.js';

// Import category implementations
import { DomainAnalysisCategory } from './categories/domainAnalysis.js';
import { SSLSecurityCategory } from './categories/sslSecurity.js';
import { ContentAnalysisCategory } from './categories/contentAnalysis.js';
import { PhishingPatternsCategory } from './categories/phishingPatterns.js';
import { MalwareDetectionCategory } from './categories/malwareDetection.js';
import { SecurityHeadersCategory } from './categories/securityHeaders.js';
import { EmailSecurityCategory } from './categories/emailSecurity.js';
import { DataProtectionCategory } from './categories/dataProtection.js';
import { LegalComplianceCategory } from './categories/legalCompliance.js';
import { TrustGraphCategory } from './categories/trustGraph.js';
import { SocialEngineeringCategory } from './categories/socialEngineering.js';
import { FinancialFraudCategory } from './categories/financialFraud.js';
import { RedirectChainCategory } from './categories/redirectChain.js';
import { BrandImpersonationCategory } from './categories/brandImpersonation.js';
import { BehavioralJSCategory } from './categories/behavioralJS.js';
import { IdentityTheftCategory } from './categories/identityTheft.js';
import { TechnicalExploitsCategory } from './categories/technicalExploits.js';

export class Scanner {
  private stage0Orchestrator: Stage0Orchestrator;
  private categoryExecutor: CategoryExecutor;
  private tiLayer: TILayer;
  private aiOrchestrator: AIOrchestrator;
  private fpPreventor: FalsePositivePreventor;
  private config: any;
  private eventEmitter?: ScanEventEmitter;

  constructor(scanConfig?: any, eventEmitter?: ScanEventEmitter) {
    // Load or use provided scan configuration
    this.config = scanConfig || this.getDefaultConfig();
    this.eventEmitter = eventEmitter;

    // Initialize Stage 0 orchestrator
    const cacheManager = new CacheManager();
    this.stage0Orchestrator = new Stage0Orchestrator(cacheManager);

    // Initialize Category Executor
    this.categoryExecutor = new CategoryExecutor(this.config, eventEmitter);

    // Initialize Threat Intelligence Layer
    this.tiLayer = new TILayer(eventEmitter);

    // Initialize AI Consensus Engine
    this.aiOrchestrator = new AIOrchestrator();

    // Initialize False Positive Prevention
    this.fpPreventor = new FalsePositivePreventor();

    // Register all implemented categories
    this.registerCategories();

    logger.info('[Scanner] Initialized with max score:', this.config.maxScore);
  }

  /**
   * Register all category analyzers
   */
  private registerCategories(): void {
    // Core security categories
    this.categoryExecutor.registerCategory('domainAnalysis', new DomainAnalysisCategory());
    this.categoryExecutor.registerCategory('sslSecurity', new SSLSecurityCategory());
    this.categoryExecutor.registerCategory('contentAnalysis', new ContentAnalysisCategory());
    this.categoryExecutor.registerCategory('phishingPatterns', new PhishingPatternsCategory());
    this.categoryExecutor.registerCategory('malwareDetection', new MalwareDetectionCategory());
    this.categoryExecutor.registerCategory('securityHeaders', new SecurityHeadersCategory());
    this.categoryExecutor.registerCategory('emailSecurity', new EmailSecurityCategory());

    // Advanced categories (Phase 3.5)
    this.categoryExecutor.registerCategory('dataProtection', new DataProtectionCategory());
    this.categoryExecutor.registerCategory('legalCompliance', new LegalComplianceCategory());
    this.categoryExecutor.registerCategory('trustGraph', new TrustGraphCategory());
    this.categoryExecutor.registerCategory('socialEngineering', new SocialEngineeringCategory());
    this.categoryExecutor.registerCategory('financialFraud', new FinancialFraudCategory());

    // Final categories (Phase 3.6 - 100% internal scoring)
    this.categoryExecutor.registerCategory('behavioralJS', new BehavioralJSCategory());
    this.categoryExecutor.registerCategory('identityTheft', new IdentityTheftCategory());
    this.categoryExecutor.registerCategory('technicalExploits', new TechnicalExploitsCategory());
    this.categoryExecutor.registerCategory('brandImpersonation', new BrandImpersonationCategory());
    this.categoryExecutor.registerCategory('redirectChain', new RedirectChainCategory());

    const stats = this.categoryExecutor.getStats();
    logger.info(`[Scanner] Registered ${stats.totalRegistered} categories: ${stats.categories.join(', ')}`);
  }

  /**
   * Execute complete URL scan
   * @param url - URL to scan
   * @param userId - Optional user ID
   * @param scanId - Optional scan ID for WebSocket real-time logging
   */
  async scan(url: string, userId?: string, scanId?: string): Promise<FinalScanResult> {
    const scanStartTime = Date.now();

    // Generate scanId if not provided (for real-time logging)
    const actualScanId = scanId || this.generateScanId();
    const enableLogging = !!scanId; // Only log if scanId was explicitly provided

    // Start scan logging
    if (enableLogging) {
      scanLogger.startScan(actualScanId, url);
    }

    logger.info(`[Scanner] ═══════════════════════════════════════════════════`);
    logger.info(`[Scanner] Starting scan for: ${url} (scanId: ${actualScanId})`);
    logger.info(`[Scanner] ═══════════════════════════════════════════════════`);

    // Emit scan start log
    this.eventEmitter?.emitLog('info', `Starting scan for: ${url}`);
    this.eventEmitter?.emitProgress(0, 'Initializing scan...', 0, 7);

    if (enableLogging) {
      scanLogger.log(actualScanId, {
        level: 'info',
        category: 'INITIALIZATION',
        message: '🔧 Scanner initialized - Preparing 7-stage scan workflow'
      });
    }

    try {
      // =================================================================
      // STAGE 0: Pre-Flight Checks
      // =================================================================
      logger.info(`[Scanner] [1/7] Executing Stage 0: Pre-Flight Checks...`);
      this.eventEmitter?.emitStageStart(0, 'Pre-Flight Checks', 'Validating URL and checking reachability');
      this.eventEmitter?.emitProgress(5, 'Stage 0: Pre-Flight Checks', 0, 7);

      if (enableLogging) {
        scanLogger.logPhaseStart(actualScanId, 'STAGE 0', 'Pre-Flight Checks - URL Validation & Reachability');
      }

      const stage0 = await this.stage0Orchestrator.execute(url, this.config);

      logger.info(`[Scanner] Stage 0 complete: Pipeline=${stage0.pipeline}, Continue=${stage0.shouldContinue}`);
      this.eventEmitter?.emitStageComplete(0, 'Pre-Flight Checks', {
        pipeline: stage0.pipeline,
        reachabilityState: stage0.reachability.state,
        shouldContinue: stage0.shouldContinue
      });
      this.eventEmitter?.emitProgress(14, 'Stage 0 completed', 1, 7);

      if (enableLogging) {
        scanLogger.logPhaseComplete(actualScanId, 'STAGE 0', Date.now() - scanStartTime, {
          pipeline: stage0.pipeline,
          reachable: stage0.reachability.state === 'reachable',
          ip: stage0.reachability.ip
        });
        scanLogger.log(actualScanId, {
          level: 'info',
          category: 'STAGE_0',
          message: `✅ URL validation complete - Pipeline: ${stage0.pipeline}, IP: ${stage0.reachability.ip || 'N/A'}`,
          data: { state: stage0.reachability.state }
        });
      }

      // If fast-path verdict (cache hit, tombstone, sinkhole)
      if (!stage0.shouldContinue && stage0.fastPathVerdict) {
        logger.info(`[Scanner] Fast-path verdict: ${stage0.fastPathVerdict.riskLevel} (${stage0.fastPathVerdict.reason})`);
        this.eventEmitter?.emitLog('info', `Fast-path verdict: ${stage0.fastPathVerdict.riskLevel} - ${stage0.fastPathVerdict.reason}`);
        const result = await this.createFastPathResult(stage0, scanStartTime);
        await this.saveResult(result, userId);
        this.eventEmitter?.emitScanComplete(result);
        return result;
      }

      // =================================================================
      // STAGE 1: Category Execution
      // =================================================================
      logger.info(`[Scanner] [2/7] Executing Categories (Pipeline: ${stage0.pipeline})...`);
      this.eventEmitter?.emitStageStart(1, 'Category Execution', `Executing 17 security categories (Pipeline: ${stage0.pipeline})`);
      this.eventEmitter?.emitProgress(20, 'Stage 1: Category Execution', 1, 7);

      if (enableLogging) {
        scanLogger.logPhaseStart(actualScanId, 'STAGE 1', 'Category Execution - Analyzing 17 security categories');
      }

      const categoryExecution = await this.categoryExecutor.execute(stage0, actualScanId);

      this.eventEmitter?.emitStageComplete(1, 'Category Execution', {
        baseScore: categoryExecution.baseScore,
        activeMaxScore: categoryExecution.activeMaxScore,
        categoriesExecuted: categoryExecution.categoryResults.length
      });
      this.eventEmitter?.emitProgress(40, 'Stage 1 completed', 2, 7);

      if (enableLogging) {
        scanLogger.logPhaseComplete(actualScanId, 'STAGE 1', Date.now() - scanStartTime, {
          baseScore: categoryExecution.baseScore,
          maxScore: categoryExecution.activeMaxScore,
          categoriesExecuted: categoryExecution.categoryResults.length
        });
        scanLogger.log(actualScanId, {
          level: 'info',
          category: 'STAGE_1',
          message: `✅ Categories analyzed: ${categoryExecution.categoryResults.length} checks - Score: ${categoryExecution.baseScore}/${categoryExecution.activeMaxScore}`,
          data: { categoryResults: categoryExecution.categoryResults.map(c => ({ name: c.category, score: c.score })) }
        });
      }

      // =================================================================
      // STAGE 2: Threat Intelligence Layer
      // =================================================================
      logger.info(`[Scanner] [3/7] Executing Threat Intelligence Layer (11 sources)...`);
      this.eventEmitter?.emitStageStart(2, 'Threat Intelligence', 'Querying 11 threat intelligence sources');
      this.eventEmitter?.emitProgress(45, 'Stage 2: Threat Intelligence Layer', 2, 7);

      if (enableLogging) {
        scanLogger.logPhaseStart(actualScanId, 'STAGE 2', 'Threat Intelligence - Querying 11 external threat databases');
      }

      const tiLayerResult = await this.tiLayer.execute(
        stage0.validation.components!.canonical,
        stage0.validation.components!.hash,
        actualScanId
      );

      this.eventEmitter?.emitStageComplete(2, 'Threat Intelligence', {
        maliciousCount: tiLayerResult.maliciousCount,
        suspiciousCount: tiLayerResult.suspiciousCount,
        totalScore: tiLayerResult.totalScore
      });
      this.eventEmitter?.emitProgress(55, 'Stage 2 completed', 3, 7);

      if (enableLogging) {
        scanLogger.logPhaseComplete(actualScanId, 'STAGE 2', Date.now() - scanStartTime, {
          maliciousCount: tiLayerResult.maliciousCount,
          suspiciousCount: tiLayerResult.suspiciousCount,
          score: tiLayerResult.totalScore
        });
        scanLogger.log(actualScanId, {
          level: tiLayerResult.maliciousCount > 0 ? 'warn' : 'info',
          category: 'STAGE_2',
          message: `📡 Threat Intelligence: ${tiLayerResult.maliciousCount} malicious, ${tiLayerResult.suspiciousCount} suspicious - Score: ${tiLayerResult.totalScore}/${tiLayerResult.maxScore}`,
          data: { sourceResults: tiLayerResult.sourceResults }
        });
      }

      // =================================================================
      // STAGE 3: Base Score Calculation
      // =================================================================
      logger.info(`[Scanner] [4/7] Calculating Base Score...`);
      this.eventEmitter?.emitStageStart(3, 'Base Score Calculation', 'Combining category and TI scores');
      this.eventEmitter?.emitProgress(60, 'Stage 3: Base Score Calculation', 3, 7);

      const baseScore = categoryExecution.baseScore + tiLayerResult.totalScore;
      const activeMaxScore = categoryExecution.activeMaxScore + tiLayerResult.maxScore;

      logger.info(`[Scanner] Base Score: ${baseScore}/${activeMaxScore} (Categories: ${categoryExecution.baseScore}, TI: ${tiLayerResult.totalScore})`);
      this.eventEmitter?.emitStageComplete(3, 'Base Score Calculation', {
        baseScore,
        activeMaxScore,
        categoryScore: categoryExecution.baseScore,
        tiScore: tiLayerResult.totalScore
      });
      this.eventEmitter?.emitLog('info', `Base Score: ${baseScore}/${activeMaxScore} (${((baseScore/activeMaxScore)*100).toFixed(1)}%)`);
      this.eventEmitter?.emitProgress(65, 'Stage 3 completed', 4, 7);

      // =================================================================
      // STAGE 4: AI Consensus Engine (Database-Driven)
      // =================================================================
      logger.info(`[Scanner] [5/7] Executing AI Consensus Engine...`);
      this.eventEmitter?.emitStageStart(4, 'AI Consensus Engine', 'Loading AI models from database');
      this.eventEmitter?.emitProgress(70, 'Stage 4: AI Consensus Engine', 4, 7);

      if (enableLogging) {
        scanLogger.logPhaseStart(actualScanId, 'STAGE 4', 'AI Consensus Engine - Loading models from database');
      }

      // CRITICAL: Load AI models from database (admin panel configuration)
      const dbAIConfig = await this.loadAIModelsFromDatabase();
      const aiOrchestrator = dbAIConfig
        ? new AIOrchestrator(dbAIConfig)  // Use database config
        : this.aiOrchestrator;             // Fallback to default

      const modelCount = dbAIConfig ? Object.keys(dbAIConfig.models).length : 3;
      this.eventEmitter?.emitLog('info', `Using ${modelCount} AI models from ${dbAIConfig ? 'database' : 'defaults'}`);

      if (enableLogging) {
        scanLogger.log(actualScanId, {
          level: 'info',
          category: 'AI_CONSENSUS',
          message: `🤖 Using ${modelCount} AI models from ${dbAIConfig ? 'database configuration' : 'default fallback'}`,
          data: { source: dbAIConfig ? 'database' : 'defaults', modelCount }
        });
      }

      // Prepare input for AI consensus
      const aiInput = this.prepareAIInput(
        stage0,
        categoryExecution,
        tiLayerResult,
        baseScore,
        activeMaxScore
      );

      const aiAnalysis = await aiOrchestrator.execute(aiInput);
      const aiMultiplier = aiAnalysis.finalMultiplier;
      const finalScore = Math.round(baseScore * aiMultiplier);

      logger.info(`[Scanner] AI Consensus: ${aiMultiplier.toFixed(2)}× (agreement: ${aiAnalysis.agreementRate.toFixed(1)}%, confidence: ${aiAnalysis.averageConfidence.toFixed(1)}%)`);
      this.eventEmitter?.emitStageComplete(4, 'AI Consensus Engine', {
        finalMultiplier: aiMultiplier,
        agreementRate: aiAnalysis.agreementRate,
        averageConfidence: aiAnalysis.averageConfidence,
        finalScore
      });
      this.eventEmitter?.emitLog('info', `AI Consensus: ${aiMultiplier.toFixed(2)}× multiplier (${aiAnalysis.agreementRate.toFixed(0)}% agreement)`);
      this.eventEmitter?.emitProgress(80, 'Stage 4 completed', 5, 7);

      if (enableLogging) {
        scanLogger.logPhaseComplete(actualScanId, 'STAGE 4', Date.now() - scanStartTime, {
          multiplier: aiMultiplier,
          agreementRate: aiAnalysis.agreementRate,
          confidence: aiAnalysis.averageConfidence,
          finalScore
        });
        scanLogger.log(actualScanId, {
          level: 'info',
          category: 'AI_CONSENSUS',
          message: `🧠 AI Consensus: ${aiMultiplier.toFixed(2)}× multiplier | Agreement: ${aiAnalysis.agreementRate.toFixed(0)}% | Confidence: ${aiAnalysis.averageConfidence.toFixed(0)}%`,
          data: { modelVotes: aiAnalysis.modelVotes, baseScore, finalScore }
        });
      }

      // =================================================================
      // STAGE 5: False Positive Prevention
      // =================================================================
      logger.info(`[Scanner] [6/7] Executing False Positive Prevention...`);
      this.eventEmitter?.emitStageStart(5, 'False Positive Prevention', 'Checking CDN, RIOT, and legitimacy indicators');
      this.eventEmitter?.emitProgress(85, 'Stage 5: False Positive Prevention', 5, 7);

      const fpResult = await this.fpPreventor.execute(
        stage0.validation.components!.domain,
        stage0.reachability.ip,
        stage0.validation.nameservers
      );

      // Apply false positive adjustment to final score
      const scoreBeforeFP = finalScore;
      const { adjustedScore, reduction } = this.fpPreventor.applyAdjustment(finalScore, fpResult);
      const finalScoreAfterFP = adjustedScore;

      logger.info(`[Scanner] FP Prevention: Legitimacy ${fpResult.legitimacyScore}/100, Adjusted ${scoreBeforeFP} → ${finalScoreAfterFP} (${fpResult.adjustmentMultiplier.toFixed(2)}×)`);
      this.eventEmitter?.emitStageComplete(5, 'False Positive Prevention', {
        legitimacyScore: fpResult.legitimacyScore,
        scoreBeforeFP,
        finalScoreAfterFP,
        adjustmentMultiplier: fpResult.adjustmentMultiplier
      });
      this.eventEmitter?.emitLog('info', `FP Check: Score adjusted ${scoreBeforeFP} → ${finalScoreAfterFP} (legitimacy: ${fpResult.legitimacyScore}/100)`);
      this.eventEmitter?.emitProgress(90, 'Stage 5 completed', 6, 7);

      // =================================================================
      // STAGE 6: Risk Level Determination
      // =================================================================
      logger.info(`[Scanner] [7/7] Determining Risk Level...`);
      this.eventEmitter?.emitStageStart(6, 'Risk Level Determination', 'Calculating final risk level');
      this.eventEmitter?.emitProgress(95, 'Stage 6: Risk Level Determination', 6, 7);

      const riskLevel = this.calculateRiskLevel(finalScoreAfterFP, activeMaxScore);

      logger.info(`[Scanner] Final Score: ${finalScoreAfterFP}/${activeMaxScore} → ${riskLevel.toUpperCase()}`);
      this.eventEmitter?.emitStageComplete(6, 'Risk Level Determination', {
        finalScore: finalScoreAfterFP,
        activeMaxScore,
        riskLevel,
        riskPercentage: (finalScoreAfterFP / activeMaxScore) * 100
      });
      this.eventEmitter?.emitLog('info', `Final Result: ${riskLevel.toUpperCase()} (${finalScoreAfterFP}/${activeMaxScore})`);

      // =================================================================
      // Build Final Result
      // =================================================================
      const scanDuration = Date.now() - scanStartTime;

      const result: FinalScanResult = {
        url: stage0.validation.components!.canonical,
        urlComponents: stage0.validation.components!,
        reachabilityState: stage0.reachability.state,
        pipelineUsed: stage0.pipeline,
        stage0,
        baseScore,
        aiMultiplier,
        finalScore: finalScoreAfterFP,  // Use FP-adjusted score
        activeMaxScore,
        riskLevel,
        riskPercentage: (finalScoreAfterFP / activeMaxScore) * 100,
        categories: categoryExecution.categoryResults as any,
        tiResults: tiLayerResult.sources,
        aiAnalysis: aiAnalysis as any,
        exceptionsHandled: [],
        falsePositiveChecks: {
          cdnCheck: fpResult.cdnCheck.isCDN,
          riotCheck: fpResult.riotCheck.isRIOT,
          govCheck: fpResult.govCheck.isGovernment || fpResult.govCheck.isEducational || fpResult.govCheck.isInternational,
          legitimacyIndicators: fpResult.legitimacyIndicators,
          legitimacyScore: fpResult.legitimacyScore,
          scoreAdjustment: fpResult.scoreAdjustment,
          adjustmentMultiplier: fpResult.adjustmentMultiplier,
          recommendation: fpResult.recommendation,
          evidence: fpResult.evidence
        } as any,
        scanDuration,
        performanceMetrics: {
          stage0: stage0.totalDuration,
          categories: categoryExecution.totalDuration,
          tiLayer: tiLayerResult.totalDuration,
          aiConsensus: aiAnalysis.totalDuration,
          finalization: 0
        },
        cacheStatus: {
          hit: false,
          saved: false
        },
        timestamp: new Date(),
        metadata: {
          scanId,
          duration: scanDuration,
          timestamp: new Date(),
          configurationId: this.config.id || 'default',
          configurationName: this.config.name || 'Default Configuration'
        }
      };

      // Save to database
      await this.saveResult(result, userId);

      logger.info(`[Scanner] ═══════════════════════════════════════════════════`);
      logger.info(`[Scanner] Scan complete in ${result.metadata.duration}ms`);
      logger.info(`[Scanner] Result: ${result.riskLevel.toUpperCase()} (${result.finalScore}/${result.activeMaxScore})`);
      logger.info(`[Scanner] ═══════════════════════════════════════════════════`);

      // Emit scan completion
      this.eventEmitter?.emitProgress(100, 'Scan completed successfully', 7, 7);
      this.eventEmitter?.emitScanComplete(result);

      // Final scan log
      if (enableLogging) {
        scanLogger.endScan(actualScanId, result);
      }

      return result;
    } catch (error) {
      logger.error('[Scanner] Fatal error during scan:', error);
      this.eventEmitter?.emitScanError(error as Error);

      if (enableLogging) {
        scanLogger.log(actualScanId, {
          level: 'error',
          category: 'SCAN_ERROR',
          message: `❌ Scan failed: ${(error as Error).message}`,
          data: { error: (error as Error).message, stack: (error as Error).stack }
        });
      }

      throw error;
    }
  }

  /**
   * Create fast-path result (cache/tombstone/sinkhole)
   */
  private async createFastPathResult(stage0: Stage0Result, scanStartTime: number): Promise<FinalScanResult> {
    const finalScore = stage0.fastPathVerdict!.finalScore;
    const scanDuration = Date.now() - scanStartTime;
    const scanId = this.generateScanId();

    return {
      url: stage0.validation.components!.canonical,
      urlComponents: stage0.validation.components!,
      reachabilityState: stage0.reachability.state,
      pipelineUsed: stage0.pipeline,
      stage0,
      baseScore: finalScore,
      aiMultiplier: 1.0,
      finalScore,
      activeMaxScore: 570,
      riskLevel: stage0.fastPathVerdict!.riskLevel,
      riskPercentage: (finalScore / 570) * 100,
      categories: [],
      tiResults: [],
      aiAnalysis: {
        models: [],
        finalMultiplier: 1.0,
        agreementRate: 100,
        averageConfidence: 100,
        consensusVerdict: stage0.fastPathVerdict!.riskLevel,
        totalDuration: 0
      },
      exceptionsHandled: [],
      falsePositiveChecks: {
        cdnCheck: false,
        riotCheck: false,
        govCheck: false,
        legitimacyIndicators: 0
      },
      scanDuration,
      performanceMetrics: {
        stage0: stage0.totalDuration,
        categories: 0,
        tiLayer: 0,
        aiConsensus: 0,
        finalization: 0
      },
      cacheStatus: {
        hit: stage0.cache.hit,
        age: stage0.cache.age,
        saved: false
      },
      timestamp: new Date(),
      metadata: {
        scanId,
        duration: scanDuration,
        timestamp: new Date(),
        configurationId: this.config.id || 'default',
        configurationName: this.config.name || 'Default Configuration'
      }
    };
  }

  /**
   * Calculate risk level based on score
   */
  private calculateRiskLevel(score: number, maxScore: number): string {
    const percentage = (score / maxScore) * 100;
    const thresholds = this.config.algorithmConfig?.riskThresholds || {
      safe: 15,
      low: 30,
      medium: 60,
      high: 80
    };

    if (percentage >= thresholds.high) return 'critical';
    if (percentage >= thresholds.medium) return 'high';
    if (percentage >= thresholds.low) return 'medium';
    if (percentage >= thresholds.safe) return 'low';
    return 'safe';
  }

  /**
   * Save scan result to database
   */
  private async saveResult(result: FinalScanResult, userId?: string): Promise<void> {
    try {
      await prisma.adminUrlScan.create({
        data: {
          url: result.url,
          configurationId: result.metadata.configurationId,
          configurationSnapshot: this.config,
          reachabilityState: result.reachabilityState,
          pipelineUsed: result.pipelineUsed,
          reachabilityDetails: result.stage0.reachability as any,
          baseScore: result.baseScore,
          aiMultiplier: result.aiMultiplier,
          finalScore: result.finalScore,
          activeMaxScore: result.activeMaxScore,
          riskLevel: result.riskLevel,
          categoryResults: result.categories as any,
          aiAnalysis: result.aiAnalysis as any,
          tiResults: result.tiResults as any,
          duration: result.metadata.duration,
          scanDate: result.metadata.timestamp,
          userId,
          metadata: result.metadata as any
        }
      });

      logger.info(`[Scanner] Result saved to database (scan ID: ${result.metadata.scanId})`);
    } catch (error) {
      logger.error('[Scanner] Error saving result to database:', error);
      // Don't throw - return result even if save fails
    }
  }

  /**
   * Load AI models configuration from database
   * CRITICAL: Backend reads AI models from database (admin panel config)
   */
  private async loadAIModelsFromDatabase(): Promise<any | null> {
    try {
      // Get active consensus configuration
      const consensusConfig = await prisma.aIConsensusConfig.findFirst({
        where: { isActive: true }
      });

      // Get enabled AI models
      const aiModels = await prisma.aIModelDefinition.findMany({
        where: { enabled: true },
        orderBy: { rank: 'asc' }
      });

      if (aiModels.length === 0) {
        logger.warn('[Scanner] No enabled AI models found in database, using defaults');
        return null;
      }

      // Build AI config from database
      const modelsConfig: any = {};
      for (const model of aiModels) {
        const key = model.provider === 'anthropic' ? 'claude' :
                    model.provider === 'openai' ? 'gpt4' :
                    model.provider === 'google' ? 'gemini' : model.provider;

        // Decrypt API key from database
        let decryptedApiKey: string | undefined;
        if (model.apiKey) {
          try {
            decryptedApiKey = apiKeyEncryption.decrypt(model.apiKey);
            logger.debug(`[Scanner] Decrypted API key for ${model.provider}`);
          } catch (error) {
            logger.error(`[Scanner] Failed to decrypt API key for ${model.provider}:`, error);
            // Fall back to environment variable
            decryptedApiKey = process.env[`${model.provider.toUpperCase()}_API_KEY`];
          }
        }

        modelsConfig[key] = {
          enabled: true,
          model: model.modelId,
          weight: model.weight,
          timeout: model.timeout || 10000,
          apiKey: decryptedApiKey, // DECRYPTED API key
          apiEndpoint: model.apiEndpoint || undefined,
          modelName: model.name
        };
      }

      logger.info(`[Scanner] Loaded ${aiModels.length} AI models from database: ${aiModels.map(m => m.name).join(', ')}`);

      return {
        models: modelsConfig,
        multiplierRange: {
          min: consensusConfig?.minMultiplier || 0.7,
          max: consensusConfig?.maxMultiplier || 1.3
        },
        fallbackMultiplier: consensusConfig?.fallbackMultiplier || 1.0
      };
    } catch (error) {
      logger.error('[Scanner] Error loading AI models from database:', error);
      return null;
    }
  }

  /**
   * Prepare input for AI consensus engine
   */
  private prepareAIInput(
    stage0: Stage0Result,
    categoryExecution: any,
    tiLayerResult: any,
    baseScore: number,
    activeMaxScore: number
  ): any {
    // Extract top findings (max 10, sorted by points)
    const allFindings: any[] = [];
    for (const categoryResult of categoryExecution.categoryResults) {
      for (const finding of categoryResult.findings) {
        allFindings.push({
          categoryName: categoryResult.categoryName,
          severity: finding.severity,
          checkId: finding.checkId,
          message: finding.message,
          points: finding.points
        });
      }
    }

    const topFindings = allFindings
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);

    // Build TI summary
    const maliciousSources = tiLayerResult.sources
      .filter((s: any) => s.verdict === 'malicious')
      .map((s: any) => s.source);

    const tiSummary = {
      maliciousCount: tiLayerResult.maliciousCount,
      suspiciousCount: tiLayerResult.suspiciousCount,
      safeCount: tiLayerResult.safeCount,
      errorCount: tiLayerResult.errorCount,
      maliciousSources
    };

    // Build category summary
    const categorySummary = categoryExecution.categoryResults.map((c: any) => ({
      categoryName: c.categoryName,
      score: c.score,
      maxWeight: c.maxWeight,
      percentage: c.maxWeight > 0 ? (c.score / c.maxWeight) * 100 : 0
    }));

    // Calculate risk level and percentage
    const riskPercentage = (baseScore / activeMaxScore) * 100;
    const riskLevel = this.calculateRiskLevel(baseScore, activeMaxScore);

    return {
      url: stage0.validation.components!.canonical,
      urlComponents: {
        protocol: stage0.validation.components!.protocol,
        hostname: stage0.validation.components!.hostname,
        domain: stage0.validation.components!.domain,
        tld: stage0.validation.components!.tld,
        path: stage0.validation.components!.path,
        query: stage0.validation.components!.query,
        subdomain: stage0.validation.components!.subdomain
      },
      reachabilityState: stage0.reachability.state,
      pipelineUsed: stage0.pipeline,
      baseScore,
      activeMaxScore,
      riskLevel,
      riskPercentage,
      topFindings,
      tiSummary,
      categorySummary
    };
  }

  /**
   * Generate unique scan ID
   */
  private generateScanId(): string {
    return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get default configuration (fallback)
   */
  private getDefaultConfig(): any {
    return {
      id: 'default',
      name: 'Default Configuration',
      maxScore: 570,
      categoryWeights: {
        domainAnalysis: 40,
        sslSecurity: 45,
        contentAnalysis: 40,
        phishingPatterns: 50,
        malwareDetection: 45,
        behavioralJS: 25,
        socialEngineering: 30,
        financialFraud: 25,
        identityTheft: 20,
        technicalExploits: 15,
        brandImpersonation: 20,
        trustGraph: 30,
        dataProtection: 50,
        emailSecurity: 25,
        legalCompliance: 35,
        securityHeaders: 25,
        redirectChain: 15,
        threatIntelligence: 55
      },
      checkWeights: {},
      algorithmConfig: {
        scoringMethod: 'contextual',
        enableDynamicScaling: true,
        riskThresholds: {
          safe: 15,
          low: 30,
          medium: 60,
          high: 80,
          critical: 100
        }
      },
      aiModelConfig: {
        models: ['claude-sonnet-4.5', 'gpt-4', 'gemini-1.5-flash'],
        consensusWeights: { claude: 0.35, gpt4: 0.35, gemini: 0.30 }
      }
    };
  }
}
