import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { enhancedScanURL } from '../../scanners/url-scanner/index.js';
import { urlScanner } from '../scanners/url-scanner.service.js';
import { messageScanner } from '../scanners/message-scanner.service.js';
import { fileScanner } from '../scanners/file-scanner.service.js';

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
        // Use RYAN RAG Enhanced Scanner for comprehensive 350-point analysis
        result = await enhancedScanURL(jobData.url);

        // DEBUG: Log what scanner returned
        logger.info(`[QUEUE DEBUG] Scanner returned for ${jobData.url}:`, {
          riskScore: result.riskScore,
          maxScore: result.maxScore,
          riskLevel: result.riskLevel,
          hasCategories: !!result.categories,
          categoriesCount: result.categories?.length || 0,
          hasVerdict: !!result.verdict,
          hasFindings: !!result.findings
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
