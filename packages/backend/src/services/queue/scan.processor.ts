import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { enhancedScanURL } from '../../scanners/url-scanner/index.js';
import { urlScanner } from '../scanners/url-scanner.service.js';
import { messageScanner } from '../scanners/message-scanner.service.js';
import { fileScanner } from '../scanners/file-scanner.service.js';
import { getV2ScannerConfigService } from '../config/v2-scanner-config.service.js';
import { createURLScannerV2 } from '../../scanners/url-scanner-v2/index.js';
import type { EnhancedScanResult } from '../../scanners/url-scanner-v2/types.js';

interface ScanJobData {
  scanId: string;
  url?: string;
  content?: string;
  sender?: string;
  subject?: string;
  language?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  scanEngineVersion?: string; // 'v1' or 'v2'
}

export async function processScanJob(jobData: ScanJobData): Promise<void> {
  try {
    const scan = await prisma.scanResult.findUnique({
      where: { id: jobData.scanId }
    });

    if (!scan) {
      logger.error(`Scan not found: ${jobData.scanId}`);
      return;
    }

    logger.info(`Processing scan: ${jobData.scanId} (type: ${scan.scanType})`);

    let result: any;

    switch (scan.scanType) {
      case 'url':
        if (!jobData.url) {
          throw new Error('URL is required for URL scan');
        }

        // V2 Scanner Integration: Check if should use V2
        const v2ConfigService = getV2ScannerConfigService();
        const shouldUseV2 = await v2ConfigService.shouldUseV2(scan.organizationId);
        const shadowMode = await v2ConfigService.isShadowMode();

        if (shouldUseV2 || shadowMode) {
          logger.info(`[V2 Scanner] Processing URL scan with V2 (shadow: ${shadowMode}, org: ${scan.organizationId})`);

          try {
            const v2Config = await v2ConfigService.getActiveConfig();
            const v2Scanner = createURLScannerV2(v2Config);
            const v2Result: EnhancedScanResult = await v2Scanner.scan(jobData.url);

            if (shadowMode) {
              // Shadow mode: Run both V1 and V2, compare results, return V1
              logger.info(`[V2 Shadow Mode] Running V1 for comparison...`);
              const v1Result = await enhancedScanURL(jobData.url);

              // Log comparison for analysis
              logger.info(`[V2 Shadow Mode] V1 vs V2 Comparison for ${jobData.url}:`, {
                v1Score: v1Result.riskScore,
                v2Score: v2Result.riskScore,
                v1Level: v1Result.riskLevel,
                v2Level: v2Result.riskLevel,
                v1Verdict: v1Result.verdict,
                v2Verdict: v2Result.verdict,
                scoreDiff: Math.abs((v1Result.riskScore || 0) - v2Result.riskScore),
                agreement: v1Result.riskLevel === v2Result.riskLevel
              });

              // Store V2 results in separate fields for analysis
              await prisma.scanResult.update({
                where: { id: jobData.scanId },
                data: {
                  stage1Results: v2Result.stage1Results || {},
                  stage2Results: v2Result.stage2Results || {},
                  decisionGraph: v2Result.decisionGraph || {},
                  probability: v2Result.probability,
                  confidenceInterval: v2Result.confidenceInterval || {}
                }
              });

              // Return V1 result in shadow mode
              result = v1Result;
            } else {
              // V2 fully enabled: Return V2 result
              logger.info(`[V2 Scanner] Using V2 result (probability: ${v2Result.probability}, riskScore: ${v2Result.riskScore})`);
              result = v2Result;
            }
          } catch (v2Error) {
            logger.error(`[V2 Scanner] V2 scan failed, falling back to V1:`, v2Error);
            // Fallback to V1 on V2 error
            result = await enhancedScanURL(jobData.url);
          }
        } else {
          // Default V1 path
          logger.info(`[V1 Scanner] Processing URL scan with V1`);
          result = await enhancedScanURL(jobData.url);
        }

        // DEBUG: Log what scanner returned
        logger.info(`[QUEUE DEBUG] Scanner returned for ${jobData.url}:`, {
          riskScore: result.riskScore,
          maxScore: result.maxScore,
          riskLevel: result.riskLevel,
          hasCategories: !!result.categories,
          categoriesCount: result.categories?.length || 0,
          hasVerdict: !!result.verdict,
          hasFindings: !!result.findings,
          engineVersion: result.scanEngineVersion || 'v1'
        });
        break;

      case 'message':
        if (!jobData.content) {
          throw new Error('Content is required for message scan');
        }
        result = await messageScanner.scanMessage(
          jobData.content,
          jobData.sender,
          jobData.subject,
          jobData.language || 'en'
        );
        break;

      case 'file':
        if (!jobData.filePath) {
          throw new Error('File path is required for file scan');
        }
        result = await fileScanner.scanFile(
          jobData.filePath,
          jobData.fileName || 'unknown',
          jobData.fileSize || 0,
          jobData.mimeType || 'application/octet-stream'
        );
        break;

      default:
        throw new Error(`Unknown scan type: ${scan.scanType}`);
    }

    // DEBUG: Log what we're about to save to database
    const dataToSave = {
      status: 'completed',
      riskScore: result.riskScore || 0,
      riskLevel: result.riskLevel || 'unknown',
      aiAnalysis: result.analysis || result.aiAnalysis || 'Analysis completed',
      findings: {
        detailedReport: result.detailedReport || result,
        categories: result.categories || [],
        indicators: result.indicators || [],
        recommendations: result.recommendations || [],
        completedAt: new Date().toISOString(),
        scanDuration: result.scanDuration || Date.now() - new Date(scan.createdAt).getTime()
      },
      scanDuration: result.scanDuration || null,
      // CRITICAL FIX: Save verdict, conversationAnalysis, intentAnalysis for WhatsApp rich responses
      verdict: result.verdict || null,
      conversationAnalysis: result.conversationAnalysis || null,
      intentAnalysis: result.intentAnalysis || null,
      ocrText: result.ocrText || result.extractedText || null,
      ocrConfidence: result.ocrConfidence || null,
      extractedText: result.extractedText || result.ocrText || null,
      // V2 Scanner fields
      scanEngineVersion: result.scanEngineVersion || jobData.scanEngineVersion || 'v1',
      probability: result.probability || null,
      confidenceInterval: result.confidenceInterval || null,
      decisionGraph: result.decisionGraph || null,
      policyOverride: result.policyOverride || null,
      stage1Results: result.stage1Results || null,
      stage2Results: result.stage2Results || null,
      updatedAt: new Date()
    };

    logger.info(`[QUEUE DEBUG] Saving to database for scan ${jobData.scanId}:`, {
      riskScore: dataToSave.riskScore,
      riskLevel: dataToSave.riskLevel,
      status: dataToSave.status,
      hasFindings: !!dataToSave.findings,
      hasVerdict: !!dataToSave.verdict
    });

    // Update scan result - CRITICAL: Store ALL fields including verdict, conversationAnalysis, etc.
    await prisma.scanResult.update({
      where: { id: jobData.scanId },
      data: dataToSave
    });

    logger.info(`Scan completed successfully: ${jobData.scanId}`);
  } catch (error) {
    logger.error(`Scan processing error for ${jobData.scanId}:`, error);

    // Update scan status to failed
    await prisma.scanResult.update({
      where: { id: jobData.scanId },
      data: {
        status: 'failed',
        aiAnalysis: `Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        findings: {
          error: error instanceof Error ? error.message : 'Unknown error',
          failedAt: new Date().toISOString()
        },
        updatedAt: new Date()
      }
    }).catch(err => {
      logger.error(`Failed to update scan status:`, err);
    });

    throw error;
  }
}
