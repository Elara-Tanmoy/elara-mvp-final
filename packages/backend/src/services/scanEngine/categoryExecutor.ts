/**
 * Category Executor: Orchestrates running all applicable categories based on pipeline
 * Coordinates data gathering and parallel execution
 */

import { Stage0Result, ReachabilityState } from './types.js';
import {
  CategoryAnalyzer,
  CategoryResult,
  CategoryContext,
  CategoryConfig,
  Pipeline,
  PIPELINE_CATEGORY_MAP
} from './categoryBase.js';
import { logger } from '../../config/logger.js';
import { ScanEventEmitter } from '../events/scan-event-emitter.service.js';
import { scanLogger } from '../logging/scanLogger.service.js';

export class CategoryExecutor {
  private categoryRegistry: Map<string, CategoryAnalyzer> = new Map();
  private config: any;
  private eventEmitter?: ScanEventEmitter;

  constructor(scanConfig: any, eventEmitter?: ScanEventEmitter) {
    this.config = scanConfig;
    this.eventEmitter = eventEmitter;
  }

  /**
   * Register a category analyzer
   */
  registerCategory(categoryId: string, analyzer: CategoryAnalyzer): void {
    this.categoryRegistry.set(categoryId, analyzer);
    logger.debug(`[Category Executor] Registered category: ${categoryId}`);
  }

  /**
   * Execute all applicable categories based on Stage 0 result
   */
  async execute(stage0: Stage0Result, scanId?: string): Promise<{
    categoryResults: CategoryResult[];
    baseScore: number;
    activeMaxScore: number;
    totalDuration: number;
  }> {
    const startTime = Date.now();
    const enableLogging = !!scanId;

    // If fast-path verdict (cache/tombstone/sinkhole), skip category execution
    if (!stage0.shouldContinue) {
      logger.info('[Category Executor] Fast-path verdict - skipping category execution');
      return {
        categoryResults: [],
        baseScore: stage0.fastPathVerdict?.finalScore || 0,
        activeMaxScore: stage0.fastPathVerdict?.finalScore || 570,
        totalDuration: 0
      };
    }

    // Determine which categories to run based on pipeline
    const pipeline = stage0.pipeline as unknown as Pipeline;
    const categoriesToRun = PIPELINE_CATEGORY_MAP[pipeline] || [];

    logger.info(`[Category Executor] Pipeline: ${pipeline}, Categories to run: ${categoriesToRun.length}`);

    if (enableLogging && scanId) {
      scanLogger.log(scanId, {
        level: 'debug',
        category: 'CATEGORY_EXECUTOR',
        message: `📋 Preparing to execute ${categoriesToRun.length} categories in parallel`,
        data: { pipeline, categories: categoriesToRun }
      });
    }

    // Gather context data for categories
    const context = await this.gatherContext(stage0);

    // Execute categories in parallel
    const categoryPromises = categoriesToRun.map(async (categoryId, index) => {
      const analyzer = this.categoryRegistry.get(categoryId);

      if (!analyzer) {
        logger.warn(`[Category Executor] Category not registered: ${categoryId}`);
        if (enableLogging && scanId) {
          scanLogger.log(scanId, {
            level: 'warn',
            category: 'CATEGORY_EXECUTOR',
            message: `⚠️  Category ${categoryId} not registered - skipping`
          });
        }
        return this.createMissingCategoryResult(categoryId);
      }

      // Check if category should run
      if (!analyzer.shouldRun(stage0.reachability.state, pipeline)) {
        logger.debug(`[Category Executor] Skipping category ${categoryId} - conditions not met`);
        if (enableLogging && scanId) {
          scanLogger.log(scanId, {
            level: 'debug',
            category: 'CATEGORY_EXECUTOR',
            message: `⏭️  Skipping ${categoryId} - pipeline conditions not met`
          });
        }
        return this.createSkippedResult(categoryId, 'Pipeline conditions not met');
      }

      try {
        logger.debug(`[Category Executor] Running category: ${categoryId}`);

        if (enableLogging && scanId) {
          scanLogger.log(scanId, {
            level: 'info',
            category: 'CATEGORY_START',
            message: `🔍 [${index + 1}/${categoriesToRun.length}] Starting category: ${categoryId}`,
            data: { categoryId, index: index + 1, total: categoriesToRun.length }
          });
        }

        const categoryStartTime = Date.now();
        const result = await analyzer.analyze(context);
        const categoryDuration = Date.now() - categoryStartTime;

        logger.info(`[Category Executor] ✅ ${categoryId} complete: ${result.score}/${result.maxWeight} (${result.findings.length} findings)`);

        if (enableLogging && scanId) {
          scanLogger.log(scanId, {
            level: 'info',
            category: 'CATEGORY_COMPLETE',
            message: `✅ [${index + 1}/${categoriesToRun.length}] ${categoryId} complete - Score: ${result.score}/${result.maxWeight} (${categoryDuration}ms)`,
            data: {
              categoryId,
              score: result.score,
              maxWeight: result.maxWeight,
              findings: result.findings.length,
              duration: categoryDuration,
              findingsDetail: result.findings.map(f => ({
                checkId: f.checkId,
                severity: f.severity,
                message: f.message,
                points: f.score
              }))
            }
          });
        }

        return result;
      } catch (error) {
        logger.error(`[Category Executor] ❌ Error in category ${categoryId}:`, error);

        if (enableLogging && scanId) {
          scanLogger.log(scanId, {
            level: 'error',
            category: 'CATEGORY_ERROR',
            message: `❌ [${index + 1}/${categoriesToRun.length}] Error in ${categoryId}: ${(error as Error).message}`,
            data: {
              categoryId,
              error: (error as Error).message,
              stack: (error as Error).stack,
              fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
            }
          });
        }

        return this.createErrorResult(categoryId, error as Error);
      }
    });

    const categoryResults = await Promise.all(categoryPromises);

    // Calculate base score and active max score
    const baseScore = categoryResults.reduce((sum, r) => sum + r.score, 0);
    const activeMaxScore = categoryResults
      .filter(r => !r.metadata.skipped)
      .reduce((sum, r) => sum + r.maxWeight, 0);

    const totalDuration = Date.now() - startTime;

    logger.info(`[Category Executor] ✅ COMPLETE - Base Score: ${baseScore}/${activeMaxScore} (${totalDuration}ms)`);

    return {
      categoryResults,
      baseScore,
      activeMaxScore,
      totalDuration
    };
  }

  /**
   * Gather context data for category analysis
   */
  private async gatherContext(stage0: Stage0Result): Promise<CategoryContext> {
    const startTime = Date.now();

    const context: CategoryContext = {
      url: stage0.validation.components!.canonical,
      urlComponents: stage0.validation.components!,
      reachability: stage0.reachability,
      config: this.getCategoryConfigMap()
    };

    // Gather HTTP response if ONLINE
    if (stage0.reachability.state === ReachabilityState.ONLINE && stage0.reachability.http.ok) {
      context.httpResponse = {
        statusCode: stage0.reachability.http.statusCode || 200,
        headers: stage0.reachability.http.headers || {},
        body: stage0.reachability.http.body || '',
        redirectChain: stage0.reachability.http.redirectChain
      };
    }

    // Gather DNS records (always available if DNS resolved)
    if (stage0.reachability.dns.resolved) {
      context.dnsRecords = await this.gatherDNSRecords(stage0.validation.components!.hostname);
    }

    // Gather WHOIS data (for PASSIVE and FULL pipelines)
    if (stage0.pipeline === 'FULL' || stage0.pipeline === 'PASSIVE') {
      context.whoisData = await this.gatherWhoisData(stage0.validation.components!.domain);
    }

    // Gather SSL certificate (for HTTPS URLs if ONLINE)
    if (stage0.validation.components!.protocol === 'https' && stage0.reachability.state === ReachabilityState.ONLINE) {
      context.sslCertificate = await this.gatherSSLCertificate(stage0.validation.components!.hostname);
    }

    logger.debug(`[Category Executor] Context gathered in ${Date.now() - startTime}ms`);

    return context;
  }

  /**
   * Gather DNS records (A, AAAA, MX, TXT, NS, CNAME)
   */
  private async gatherDNSRecords(hostname: string): Promise<any> {
    try {
      const dns = require('dns').promises;

      const [A, AAAA, MX, TXT, NS] = await Promise.allSettled([
        dns.resolve4(hostname).catch(() => []),
        dns.resolve6(hostname).catch(() => []),
        dns.resolveMx(hostname).catch(() => []),
        dns.resolveTxt(hostname).catch(() => []),
        dns.resolveNs(hostname).catch(() => [])
      ]);

      return {
        A: A.status === 'fulfilled' ? A.value : [],
        AAAA: AAAA.status === 'fulfilled' ? AAAA.value : [],
        MX: MX.status === 'fulfilled' ? MX.value : [],
        TXT: TXT.status === 'fulfilled' ? TXT.value.flat() : [],
        NS: NS.status === 'fulfilled' ? NS.value : []
      };
    } catch (error) {
      logger.error('[Category Executor] Error gathering DNS records:', error);
      return { A: [], AAAA: [], MX: [], TXT: [], NS: [] };
    }
  }

  /**
   * Gather WHOIS data
   * Note: External WHOIS APIs (WhoisXML, RiskIQ, etc.) can be integrated for enhanced data.
   * Currently returns null values as WHOIS data is optional for most categories.
   */
  private async gatherWhoisData(domain: string): Promise<any> {
    try {
      // WHOIS data structure - categories handle null values gracefully
      return {
        registrar: null,
        registrationDate: null,
        expirationDate: null,
        updatedDate: null,
        registrant: null,
        privacyProtection: null,
        nameServers: [],
        status: []
      };
    } catch (error) {
      logger.error('[Category Executor] Error gathering WHOIS data:', error);
      return null;
    }
  }

  /**
   * Gather SSL certificate details
   */
  private async gatherSSLCertificate(hostname: string): Promise<any> {
    try {
      const tls = require('tls');

      return new Promise((resolve) => {
        const socket = tls.connect(443, hostname, { servername: hostname, rejectUnauthorized: false }, () => {
          const cert = socket.getPeerCertificate();
          socket.end();

          resolve({
            subject: cert.subject,
            issuer: cert.issuer,
            validFrom: cert.valid_from,
            validTo: cert.valid_to,
            serialNumber: cert.serialNumber,
            fingerprint: cert.fingerprint,
            keySize: cert.bits,
            signatureAlgorithm: cert.sigalg,
            subjectAltNames: cert.subjectaltname
          });
        });

        socket.on('error', (error: any) => {
          logger.error(`[Category Executor] SSL error for ${hostname}:`, error);
          resolve(null);
        });

        socket.setTimeout(3000, () => {
          socket.destroy();
          resolve(null);
        });
      });
    } catch (error) {
      logger.error('[Category Executor] Error gathering SSL certificate:', error);
      return null;
    }
  }

  /**
   * Get category configurations from scan config
   */
  private getCategoryConfigMap(): any {
    // Build map of categoryId -> CategoryConfig
    const configMap: any = {};

    Object.keys(this.config.categoryWeights || {}).forEach((categoryId) => {
      configMap[categoryId] = {
        categoryId,
        enabled: true,
        maxWeight: this.config.categoryWeights[categoryId],
        checkWeights: this.config.checkWeights || {},
        thresholds: this.config.algorithmConfig?.thresholds || {},
        customConfig: {}
      };
    });

    return configMap;
  }

  /**
   * Create a result for missing category
   */
  private createMissingCategoryResult(categoryId: string): CategoryResult {
    return {
      categoryId,
      categoryName: categoryId,
      score: 0,
      maxWeight: 0,
      findings: [],
      metadata: {
        checksRun: 0,
        checksSkipped: 0,
        duration: 0,
        skipped: true,
        skipReason: 'Category analyzer not registered'
      }
    };
  }

  /**
   * Create a skipped result
   */
  private createSkippedResult(categoryId: string, reason: string): CategoryResult {
    return {
      categoryId,
      categoryName: categoryId,
      score: 0,
      maxWeight: this.config.categoryWeights?.[categoryId] || 0,
      findings: [],
      metadata: {
        checksRun: 0,
        checksSkipped: 0,
        duration: 0,
        skipped: true,
        skipReason: reason
      }
    };
  }

  /**
   * Create an error result
   */
  private createErrorResult(categoryId: string, error: Error): CategoryResult {
    return {
      categoryId,
      categoryName: categoryId,
      score: 0,
      maxWeight: this.config.categoryWeights?.[categoryId] || 0,
      findings: [],
      metadata: {
        checksRun: 0,
        checksSkipped: 0,
        duration: 0,
        skipped: true,
        skipReason: `Error: ${error.message}`
      }
    };
  }

  /**
   * Get statistics about registered categories
   */
  getStats(): {
    totalRegistered: number;
    categories: string[];
  } {
    return {
      totalRegistered: this.categoryRegistry.size,
      categories: Array.from(this.categoryRegistry.keys())
    };
  }
}
