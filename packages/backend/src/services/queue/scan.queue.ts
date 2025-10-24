import { Queue, Worker, Job } from 'bullmq';
import { logger } from '../../config/logger.js';
import { prisma } from '../../config/database.js';
import { urlScanner } from '../scanners/url-scanner.service.js';
import { enhancedURLScanner } from '../scanners/url-scanner-enhanced.service.js';
import { messageScanner } from '../scanners/message-scanner.service.js';
import { fileScanner } from '../scanners/file-scanner.service.js';
import { emotionAnalyzer } from '../analysis/emotion-analyzer.service.js';
import { aiService } from '../ai/ai.service.js';
import { datasetService } from '../dataset/dataset.service.js';
import { redis } from '../../config/redis.js';

// Only create queue if Redis is available
let scanQueue: Queue | null = null;

if (process.env.REDIS_URL && redis) {
  scanQueue = new Queue('scan-queue', {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: 100,
      removeOnFail: 500
    }
  });
}

export { scanQueue };

export const startWorker = async () => {
  if (!process.env.REDIS_URL || !redis) {
    logger.info('Queue worker not started - Redis unavailable');
    return;
  }
  const worker = new Worker(
    'scan-queue',
    async (job: Job) => {
      logger.info(`Processing job ${job.name} with ID ${job.id}`);

      try {
        switch (job.name) {
          case 'scan-url':
            return await processURLScan(job);

          case 'scan-message':
            return await processMessageScan(job);

          case 'scan-file':
            return await processFileScan(job);

          case 'process-dataset':
            return await processDataset(job);

          case 'vectorize-dataset':
            return await vectorizeDataset(job);

          default:
            throw new Error(`Unknown job type: ${job.name}`);
        }
      } catch (error) {
        logger.error(`Job ${job.id} failed:`, error);
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: 5
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed:`, err);
  });

  logger.info('Scan queue worker started');

  return worker;
};

async function processURLScan(job: Job): Promise<void> {
  const { scanId, url } = job.data;

  logger.info('╔═══════════════════════════════════════════════════════════╗');
  logger.info(`║ QUEUE: Processing URL Scan Job ${job.id}`);
  logger.info(`║ Scan ID: ${scanId}`);
  logger.info(`║ URL: ${url}`);
  logger.info('╚═══════════════════════════════════════════════════════════╝');

  await prisma.scanResult.update({
    where: { id: scanId },
    data: { status: 'processing' }
  });

  const scanStart = Date.now();
  logger.info(`🚀 Starting enhanced URL scanner with real-time logging...`);
  // PHASE 1: Use enhanced URL scanner with Multi-LLM, external threat intelligence, and network analysis
  // Pass scanId for real-time WebSocket logging
  const result = await enhancedURLScanner.scanURL(url, scanId);
  logger.info(`🏁 Scanner returned: Score ${result.riskScore}/${result.maxScore}, Level: ${result.riskLevel}`);

  // PHASE 1: Store comprehensive analysis including Multi-LLM consensus and external scans
  await prisma.scanResult.update({
    where: { id: scanId },
    data: {
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      status: 'completed',
      findings: result.findings as any,
      aiAnalysis: {
        // Original AI analysis (backward compatibility)
        ...result.aiAnalysis,
        // PHASE 1: Multi-LLM consensus (Claude, GPT-4, Gemini)
        multiLLMAnalysis: result.multiLLMAnalysis,
        // PHASE 1: External threat intelligence (VirusTotal, Safe Browsing, AbuseIPDB, PhishTank, URLhaus)
        externalScans: result.externalScans,
        // PHASE 1: Network infrastructure information
        networkInfo: result.networkInfo
      } as any,
      scanDuration: result.scanDuration
    }
  });

  // Create risk categories from enhanced results
  if (result.categories) {
    for (const category of result.categories) {
      await prisma.riskCategory.create({
        data: {
          scanResultId: scanId,
          category: category.name,
          score: category.score,
          maxWeight: category.maxScore,
          findings: category.findings as any,
          evidence: {} as any
        }
      });
    }
  }

  logger.info(`URL scan ${scanId} completed with score ${result.riskScore}${result.multiLLMAnalysis ? `, AI consensus: ${result.multiLLMAnalysis.consensus.verdict}` : ''}`);
}

async function processMessageScan(job: Job): Promise<void> {
  const { scanId, content, sender, subject, language } = job.data;

  await prisma.scanResult.update({
    where: { id: scanId },
    data: { status: 'processing' }
  });

  const scanStart = Date.now();
  // PHASE 1: Message scanner now includes Multi-LLM analysis and enhanced emotion detection
  const result = await messageScanner.scanMessage(content, sender, subject, language);

  // Get AI analysis (original for backward compatibility)
  const aiAnalysis = await aiService.analyzeThreat({
    scanType: 'message',
    riskScore: result.riskScore,
    riskLevel: result.riskLevel,
    findings: result.findings
  });

  await prisma.scanResult.update({
    where: { id: scanId },
    data: {
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      status: 'completed',
      findings: result.findings as any,
      aiAnalysis: {
        // Original AI analysis (backward compatibility)
        ...aiAnalysis,
        sentiment: result.sentiment,
        urls: result.urls,
        // PHASE 1: Enhanced emotion analysis with 6 emotion types and manipulation tactics
        emotionAnalysis: result.emotionAnalysis,
        // PHASE 1: Multi-LLM consensus (Claude, GPT-4, Gemini)
        multiLLMAnalysis: result.multiLLMAnalysis,
        // PHASE 1: Extracted contact information
        extractedData: result.extractedData
      } as any,
      scanDuration: Date.now() - scanStart
    }
  });

  const manipScore = result.emotionAnalysis?.overallManipulationScore || 0;
  logger.info(`Message scan ${scanId} completed with score ${result.riskScore}, manipulation score ${manipScore}${result.multiLLMAnalysis ? `, AI consensus: ${result.multiLLMAnalysis.consensus.verdict}` : ''}`);
}

async function processFileScan(job: Job): Promise<void> {
  const { scanId, filePath, fileName, fileSize, mimeType } = job.data;

  await prisma.scanResult.update({
    where: { id: scanId },
    data: { status: 'processing' }
  });

  const scanStart = Date.now();
  // PHASE 1: File scanner now includes conversation chain analysis with Multi-LLM for screenshots
  const result = await fileScanner.scanFile(filePath, fileName, fileSize, mimeType);

  // Get emotion analysis from extracted text
  let emotionAnalysis = null;
  if (result.extractedText && result.extractedText.length > 50) {
    emotionAnalysis = await emotionAnalyzer.analyzeText(result.extractedText);
  }

  // Get AI analysis (original for backward compatibility)
  const aiAnalysis = await aiService.analyzeThreat({
    scanType: 'file',
    riskScore: result.riskScore,
    riskLevel: result.riskLevel,
    findings: result.findings
  });

  await prisma.scanResult.update({
    where: { id: scanId },
    data: {
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      status: 'completed',
      findings: result.findings as any,
      aiAnalysis: {
        // Original AI analysis (backward compatibility)
        ...aiAnalysis,
        extractedText: result.extractedText,
        ocrConfidence: result.ocrConfidence,
        metadata: result.metadata,
        emotionAnalysis,
        // PHASE 1: Conversation chain analysis from screenshots
        // Includes timeline, red flags, scam progression detection, and Multi-LLM consensus
        conversationAnalysis: result.conversationAnalysis
      } as any,
      scanDuration: Date.now() - scanStart
    }
  });

  const conversationInfo = result.conversationAnalysis?.detected
    ? `, conversation: ${result.conversationAnalysis.totalMessages} msgs, ${result.conversationAnalysis.redFlags?.length || 0} red flags`
    : '';
  const manipScore = emotionAnalysis?.overallManipulationScore || 0;
  logger.info(`File scan ${scanId} completed with score ${result.riskScore}${emotionAnalysis ? `, manipulation score ${manipScore}` : ''}${conversationInfo}`);
}

async function processDataset(job: Job): Promise<void> {
  const { datasetId, filePath } = job.data;
  await datasetService.processDataset(datasetId, filePath);
}

async function vectorizeDataset(job: Job): Promise<void> {
  const { datasetId } = job.data;
  await datasetService.vectorizeDataset(datasetId);
}
