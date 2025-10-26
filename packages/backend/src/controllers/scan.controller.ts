import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { scanQueue } from '../services/queue/scan.queue.js';
import { generateContentHash } from '../utils/auth.js';
import { urlScanSchema, messageScanSchema, scanQuerySchema } from '../validators/scan.validator.js';
import { dataCaptureService } from '../services/intelligence/dataCapture.service.js';
import { scanCacheService } from '../services/cache/scan-cache.service.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const upload = multer({
  dest: process.env.UPLOAD_DIR || './uploads',
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'),
    files: 10 // Max 10 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP and PDF allowed.'));
    }
  }
});

export class ScanController {
  /**
   * Sanitize scan data to remove non-serializable values (functions, undefined, circular refs)
   * Ensures data can be safely stored in database as JSON
   */
  private sanitizeForDatabase(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }

    if (typeof obj === 'function') {
      return null;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForDatabase(item)).filter(item => item !== null);
    }

    // Handle objects
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (typeof value !== 'function' && value !== undefined) {
          sanitized[key] = this.sanitizeForDatabase(value);
        }
      }
    }
    return sanitized;
  }

  async scanURL(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validatedData = urlScanSchema.parse(req.body);
      const contentHash = generateContentHash(validatedData.url);

      // V2 Scanner: Extract version from query parameter (?version=v2)
      const scanEngineVersion = req.query.version === 'v2' ? 'v2' : 'v1';
      logger.info(`[Scan Controller] Initiating ${scanEngineVersion} scan for ${validatedData.url}`);

      // Create scan result
      const scanResult = await prisma.scanResult.create({
        data: {
          scanType: 'url',
          url: validatedData.url,
          contentHash,
          status: 'pending',
          userId: req.user!.userId,
          organizationId: req.user!.organizationId,
          scanEngineVersion // Store requested version
        }
      });

      // Queue for processing (if queue is available)
      if (scanQueue) {
        await scanQueue.add('scan-url', {
          scanId: scanResult.id,
          url: validatedData.url,
          scanEngineVersion // Pass to processor
        });

        // Audit log
        await prisma.auditLog.create({
          data: {
            action: 'scan_url',
            entityType: 'scan',
            entityId: scanResult.id,
            userId: req.user!.userId,
            organizationId: req.user!.organizationId,
            scanResultId: scanResult.id,
            details: { url: validatedData.url },
            ipAddress: req.ip
          }
        });

        logger.info(`URL scan queued: ${scanResult.id}`);

        res.status(202).json({
          scanId: scanResult.id,
          status: 'pending',
          message: 'Scan queued for processing'
        });
      } else {
        // Process SYNCHRONOUSLY without queue (for instant results)
        logger.info('Processing scan synchronously (no queue available)');

        try {
          // Check cache first for faster responses on well-known sites
          const cachedResult = await scanCacheService.get(validatedData.url);
          if (cachedResult) {
            logger.info(`✅ Returning cached result for ${validatedData.url}`);

            // Update scan result in database
            await prisma.scanResult.update({
              where: { id: scanResult.id },
              data: {
                status: 'completed',
                riskScore: cachedResult.riskScore,
                riskLevel: cachedResult.riskLevel,
                findings: this.sanitizeForDatabase(cachedResult.scanResult.findings) as any,
                scanDuration: cachedResult.scanResult.scanDuration
              }
            });

            // Audit log
            await prisma.auditLog.create({
              data: {
                action: 'scan_url',
                entityType: 'scan',
                entityId: scanResult.id,
                userId: req.user!.userId,
                organizationId: req.user!.organizationId,
                scanResultId: scanResult.id,
                details: { url: validatedData.url, riskLevel: cachedResult.riskLevel, cached: true },
                ipAddress: req.ip
              }
            });

            // Return cached result
            res.status(200).json(cachedResult.scanResult);
            return;
          }

          // Cache miss - perform full scan
          logger.info(`❌ Cache miss - performing ${scanEngineVersion} scan for ${validatedData.url}`);

          let scanResults: any;

          if (scanEngineVersion === 'v2') {
            // V2 Scanner: Enhanced ML pipeline with Vertex AI
            logger.info(`🚀 Using V2 scanner with Vertex AI models`);
            const { createURLScannerV2, getDefaultV2Config } = await import('../scanners/url-scanner-v2/index.js');

            const v2Config = getDefaultV2Config();
            const v2Scanner = createURLScannerV2(v2Config);

            // V2 scanner has built-in timeout protection
            scanResults = await v2Scanner.scan(validatedData.url, {});
          } else {
            // V1 Scanner: Original enhanced scanner
            logger.info(`📊 Using V1 enhanced scanner`);
            const { enhancedURLScanner } = await import('../services/scanners/url-scanner-enhanced.service.js');

            // Add timeout protection (max 60 seconds for comprehensive scan)
            const scanPromise = enhancedURLScanner.scanURL(validatedData.url);
            const timeoutPromise = new Promise<any>((_, reject) =>
              setTimeout(() => reject(new Error('Scan timeout - taking longer than expected')), 60000)
            );

            scanResults = await Promise.race([scanPromise, timeoutPromise]);
          }

          // Prepare data for database based on scanner version
          let updateData: any;

          if (scanEngineVersion === 'v2') {
            // V2 Result format
            const sanitizedV2Data = this.sanitizeForDatabase({
              stage1: scanResults.stage1,
              stage2: scanResults.stage2,
              evidenceSummary: scanResults.evidenceSummary,
              decisionGraph: scanResults.decisionGraph,
              recommendedActions: scanResults.recommendedActions,
              aiSummary: scanResults.aiSummary,
              probability: scanResults.probability,
              confidenceInterval: scanResults.confidenceInterval,
              reachability: scanResults.reachability,
              policyOverride: scanResults.policyOverride
            });

            updateData = {
              status: 'completed',
              riskScore: scanResults.riskScore,
              riskLevel: this.mapV2RiskLevel(scanResults.riskLevel),
              v2Data: sanitizedV2Data as any,
              scanDuration: scanResults.latency?.total || 0
            };
          } else {
            // V1 Result format
            const sanitizedFindings = this.sanitizeForDatabase(scanResults.findings);

            updateData = {
              status: 'completed',
              riskScore: scanResults.riskScore,
              riskLevel: scanResults.riskLevel,
              findings: sanitizedFindings as any,
              scanDuration: scanResults.scanDuration
            };
          }

          // Update scan result in database
          await prisma.scanResult.update({
            where: { id: scanResult.id },
            data: updateData
          });

          // Build Trust Graph in background (if Neo4j configured)
          if (process.env.NEO4J_URI && validatedData.url) {
            try {
              // Extract domain from URL
              const urlObj = new URL(validatedData.url);
              const domain = urlObj.hostname.replace(/^www\./, '');

              // Import trust graph service
              const { trustGraphService } = await import('../services/graph/trustGraphService.js');

              // Build graph asynchronously (don't await - run in background)
              trustGraphService.buildDomainGraph(domain, {
                riskScore: scanResults.riskScore,
                riskLevel: scanResults.riskLevel,
                scannedAt: new Date().toISOString()
              }).then((buildResult) => {
                if (buildResult.success) {
                  logger.info(
                    `✅ [Trust Graph] Auto-build completed for ${domain} - ` +
                    `Nodes: ${buildResult.nodesCreated}, Relations: ${buildResult.relationshipsCreated}`
                  );
                } else {
                  logger.warn(
                    `⚠️  [Trust Graph] Auto-build partially completed for ${domain} - ` +
                    `Nodes: ${buildResult.nodesCreated}, Relations: ${buildResult.relationshipsCreated}, ` +
                    `Warnings: ${buildResult.warnings.length}, Errors: ${buildResult.errors.length}`
                  );
                  if (buildResult.errors.length > 0) {
                    logger.warn(`[Trust Graph] Build errors: ${buildResult.errors.join('; ')}`);
                  }
                }
              }).catch((err) => {
                logger.error(`❌ [Trust Graph] Auto-build failed for ${domain}:`, err.message);
              });
            } catch (err: any) {
              logger.warn(`[Trust Graph] Failed to trigger graph build:`, err.message);
            }
          }

          // Audit log
          await prisma.auditLog.create({
            data: {
              action: 'scan_url',
              entityType: 'scan',
              entityId: scanResult.id,
              userId: req.user!.userId,
              organizationId: req.user!.organizationId,
              scanResultId: scanResult.id,
              details: { url: validatedData.url, riskLevel: scanResults.riskLevel },
              ipAddress: req.ip
            }
          });

          logger.info(`URL scan completed synchronously: ${scanResult.id} - Risk: ${scanResults.riskLevel}`);

          // Capture scan data for intelligence platform (non-blocking)
          dataCaptureService.captureScan({
            userId: req.user!.userId,
            organizationId: req.user!.organizationId,
            scanType: 'url',
            inputData: { url: validatedData.url },
            scanResults: scanResults,
            riskScore: scanResults.riskScore,
            riskLevel: scanResults.riskLevel,
            findings: scanResults.findings,
            scanDuration: scanResults.scanDuration,
            timestamp: new Date(),
            metadata: {
              userAgent: req.headers['user-agent'],
              scanId: scanResult.id
            }
          }).catch(err => {
            logger.warn('[Data Intelligence] Failed to capture scan:', err.message);
          });

          // Cache the result for future requests (non-blocking)
          scanCacheService.set(validatedData.url, scanResults).catch(err => {
            logger.warn('[Scan Cache] Failed to cache result:', err.message);
          });

          // Return appropriate response based on scanner version
          if (scanEngineVersion === 'v2') {
            // V2: Return the full enhanced scan result with all V2 fields
            res.status(200).json({
              ...scanResults,
              scanId: scanResult.id, // Add database scan ID for reference
              dbRecord: {
                id: scanResult.id,
                userId: req.user!.userId,
                organizationId: req.user!.organizationId,
                createdAt: scanResult.createdAt,
                scanEngineVersion: 'v2'
              }
            });
          } else {
            // V1: Fetch the updated scan result from database to return consistent format
            const completedScan = await prisma.scanResult.findUnique({
              where: { id: scanResult.id },
              include: {
                riskCategories: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            });

            // Return database record (same format as GET /v2/scans/:id)
            res.status(200).json(completedScan);
          }
        } catch (scanError) {
          logger.error(`Scan ${scanResult.id} processing error:`, scanError);

          // Update scan as failed
          await prisma.scanResult.update({
            where: { id: scanResult.id },
            data: { status: 'failed' }
          });

          res.status(500).json({ error: 'Scan processing failed' });
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }

      logger.error('URL scan error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async scanMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validatedData = messageScanSchema.parse(req.body);
      const contentHash = generateContentHash(validatedData.content);

      const scanResult = await prisma.scanResult.create({
        data: {
          scanType: 'message',
          content: validatedData.content,
          contentHash,
          status: 'pending',
          userId: req.user!.userId,
          organizationId: req.user!.organizationId
        }
      });

      // Queue for processing (if queue is available)
      if (scanQueue) {
        await scanQueue.add('scan-message', {
          scanId: scanResult.id,
          content: validatedData.content,
          sender: validatedData.sender,
          subject: validatedData.subject,
          language: validatedData.language
        });
      } else {
        // Process immediately without queue
        logger.info('Processing message scan immediately (no queue available)');
        const { processScanJob } = await import('../services/queue/scan.processor.js');
        processScanJob({
          scanId: scanResult.id,
          content: validatedData.content,
          sender: validatedData.sender,
          subject: validatedData.subject,
          language: validatedData.language
        }).then(() => {
          logger.info(`Scan ${scanResult.id} completed successfully`);
        }).catch((err) => {
          logger.error(`Scan ${scanResult.id} processing error:`, err);
        });
      }

      await prisma.auditLog.create({
        data: {
          action: 'scan_message',
          entityType: 'scan',
          entityId: scanResult.id,
          userId: req.user!.userId,
          organizationId: req.user!.organizationId,
          scanResultId: scanResult.id,
          ipAddress: req.ip
        }
      });

      logger.info(`Message scan initiated: ${scanResult.id}`);

      res.status(202).json({
        scanId: scanResult.id,
        status: 'pending',
        message: 'Scan queued for processing'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }

      logger.error('Message scan error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async scanFile(req: AuthRequest, res: Response): Promise<void> {
    upload.array('files', 10)(req, res, async (err) => {
      try {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              res.status(400).json({ error: 'File size exceeds 50MB limit' });
              return;
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
              res.status(400).json({ error: 'Maximum 10 files allowed' });
              return;
            }
          }
          res.status(400).json({ error: err.message || 'File upload error' });
          return;
        }

        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
          res.status(400).json({ error: 'No files uploaded' });
          return;
        }

        const scanIds: string[] = [];

        // Process each file
        for (const file of files) {
          const contentHash = generateContentHash(file.filename);

          const scanResult = await prisma.scanResult.create({
            data: {
              scanType: 'file',
              fileName: file.originalname,
              fileSize: file.size,
              fileMimeType: file.mimetype,
              contentHash,
              status: 'pending',
              userId: req.user!.userId,
              organizationId: req.user!.organizationId
            }
          });

          // Queue for processing (if queue is available)
          if (scanQueue) {
            await scanQueue.add('scan-file', {
              scanId: scanResult.id,
              filePath: file.path,
              fileName: file.originalname,
              fileSize: file.size,
              mimeType: file.mimetype
            });
          } else {
            // Process immediately without queue - SYNCHRONOUSLY for API responses
            logger.info('Processing file scan SYNCHRONOUSLY (no queue available)');
            const { processScanJob } = await import('../services/queue/scan.processor.js');

            try {
              // CRITICAL FIX: AWAIT the scan to complete before responding
              await processScanJob({
                scanId: scanResult.id,
                filePath: file.path,
                fileName: file.originalname,
                fileSize: file.size,
                mimeType: file.mimetype
              });
              logger.info(`Scan ${scanResult.id} completed successfully (SYNC)`);
            } catch (err) {
              logger.error(`Scan ${scanResult.id} processing error:`, err);
              // Continue - result will show as failed in DB
            }
          }

          await prisma.auditLog.create({
            data: {
              action: 'scan_file',
              entityType: 'scan',
              entityId: scanResult.id,
              userId: req.user!.userId,
              organizationId: req.user!.organizationId,
              scanResultId: scanResult.id,
              details: { fileName: file.originalname, fileSize: file.size },
              ipAddress: req.ip
            }
          });

          scanIds.push(scanResult.id);
          logger.info(`File scan completed: ${scanResult.id} - ${file.originalname}`);
        }

        // CRITICAL FIX: Fetch completed scan results from database
        const completedScans = await prisma.scanResult.findMany({
          where: {
            id: { in: scanIds }
          },
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            fileMimeType: true,
            riskScore: true,
            riskLevel: true,
            status: true,
            findings: true,
            scanDuration: true,
            extractedText: true,
            ocrText: true,
            ocrConfidence: true,
            // metadata: true, // REMOVED - not a database field
            conversationAnalysis: true,
            intentAnalysis: true,
            verdict: true
          }
        });

        // Return 200 with actual results (not 202 pending)
        res.status(200).json({
          scans: completedScans,
          count: files.length,
          status: 'completed',
          message: `${files.length} file(s) scanned successfully`
        });
      } catch (error) {
        logger.error('File scan error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  async getScans(req: AuthRequest, res: Response): Promise<void> {
    try {
      const query = scanQuerySchema.parse(req.query);

      const where: any = {
        organizationId: req.user!.organizationId
      };

      if (query.scanType) where.scanType = query.scanType;
      if (query.riskLevel) where.riskLevel = query.riskLevel;
      if (query.status) where.status = query.status;

      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate) where.createdAt.gte = new Date(query.startDate);
        if (query.endDate) where.createdAt.lte = new Date(query.endDate);
      }

      const [scans, total] = await Promise.all([
        prisma.scanResult.findMany({
          where,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            scanType: true,
            url: true,
            fileName: true,
            riskScore: true,
            riskLevel: true,
            status: true,
            createdAt: true,
            scanDuration: true
          }
        }),
        prisma.scanResult.count({ where })
      ]);

      res.json({
        scans,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit)
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }

      logger.error('Get scans error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getScan(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const scan = await prisma.scanResult.findFirst({
        where: {
          id,
          organizationId: req.user!.organizationId
        },
        include: {
          riskCategories: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      if (!scan) {
        res.status(404).json({ error: 'Scan not found' });
        return;
      }

      res.json(scan);
    } catch (error) {
      logger.error('Get scan error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Pre-browse URL scan for Secure Browser
   * Uses Elara's full enterprise-grade scanner with multi-LLM analysis
   * POST /api/v2/scan/pre-browse
   */
  async preBrowseScan(req: AuthRequest, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { url } = req.body;

      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'Valid URL is required' });
        return;
      }

      // Validate URL format
      try {
        new URL(url);
      } catch (error) {
        res.status(400).json({ error: 'Invalid URL format' });
        return;
      }

      logger.info(`[PRE-BROWSE] Full enterprise scan requested by user ${req.user!.userId}: ${url}`);

      // Check cache first for faster pre-browse responses
      const cachedResult = await scanCacheService.get(url);
      let fullScanResult: any;

      if (cachedResult) {
        logger.info(`✅ [PRE-BROWSE] Returning cached result for ${url}`);
        fullScanResult = cachedResult.scanResult;
      } else {
        logger.info(`❌ [PRE-BROWSE] Cache miss - performing full enterprise scan for ${url}`);

        // Import Elara's enterprise-grade URL scanner
        const { EnhancedURLScanner } = await import('../services/scanners/url-scanner-enhanced.service.js');
        const scanner = new EnhancedURLScanner();

        // Run full scan with timeout protection (max 60 seconds for comprehensive analysis with Multi-LLM)
        const scanPromise = scanner.scanURL(url);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Scan timeout - taking longer than expected')), 60000)
        );

        fullScanResult = await Promise.race([scanPromise, timeoutPromise]) as any;
      }

      const scanDuration = (Date.now() - startTime) / 1000;

      // Transform Elara's comprehensive scan result to browser-friendly format
      const browserResult = {
        url: fullScanResult.url,
        riskLevel: this.mapRiskLevel(fullScanResult.riskLevel),
        riskScore: fullScanResult.riskScore,
        maxScore: fullScanResult.maxScore,
        threats: this.extractThreats(fullScanResult),
        details: {
          categories: fullScanResult.categories,
          findings: fullScanResult.findings,
          externalScans: fullScanResult.externalScans,
          aiAnalysis: fullScanResult.aiAnalysis,
          multiLLM: fullScanResult.multiLLMAnalysis
        },
        scanDuration,
        cached: false,
        scannedAt: new Date(),
        message: this.getRiskMessage(fullScanResult.riskLevel, fullScanResult.riskScore, fullScanResult.maxScore),
        comprehensive: true // Flag that this is full Elara scan
      };

      // Log to audit
      await prisma.auditLog.create({
        data: {
          action: 'pre_browse_scan',
          entityType: 'url',
          entityId: url,
          userId: req.user!.userId,
          organizationId: req.user!.organizationId,
          ipAddress: req.ip,
          metadata: {
            riskLevel: browserResult.riskLevel,
            riskScore: fullScanResult.riskScore,
            scanDuration,
            comprehensive: true
          }
        }
      }).catch(err => {
        logger.warn(`Failed to create audit log: ${err.message}`);
      });

      logger.info(`✅ [PRE-BROWSE] Enterprise scan completed in ${scanDuration.toFixed(2)}s - Risk: ${browserResult.riskLevel} (${fullScanResult.riskScore}/${fullScanResult.maxScore})`);

      // Capture scan data for intelligence platform (non-blocking)
      dataCaptureService.captureScan({
        userId: req.user!.userId,
        organizationId: req.user!.organizationId,
        scanType: 'url',
        inputData: { url: url },
        scanResults: fullScanResult,
        riskScore: fullScanResult.riskScore,
        riskLevel: fullScanResult.riskLevel,
        findings: fullScanResult.findings,
        scanDuration: scanDuration,
        timestamp: new Date(),
        metadata: {
          userAgent: req.headers['user-agent'],
          scanType: 'pre-browse',
          comprehensive: true
        }
      }).catch(err => {
        logger.warn('[Data Intelligence] Failed to capture pre-browse scan:', err.message);
      });

      // Cache the result for future pre-browse requests (non-blocking)
      if (!cachedResult) {
        scanCacheService.set(url, fullScanResult).catch(err => {
          logger.warn('[Scan Cache] Failed to cache pre-browse result:', err.message);
        });
      }

      res.json({
        success: true,
        result: browserResult
      });

    } catch (error: any) {
      const scanDuration = (Date.now() - startTime) / 1000;
      logger.error(`❌ [PRE-BROWSE] Scan failed after ${scanDuration.toFixed(2)}s:`, error);

      // Return graceful fallback
      res.json({
        success: true,
        result: {
          url: req.body.url,
          riskLevel: 'medium',
          riskScore: 0,
          maxScore: 350,
          threats: ['Unable to complete comprehensive scan - proceeding with caution recommended'],
          details: {},
          scanDuration,
          cached: false,
          scannedAt: new Date(),
          message: '⚠️ Scan timeout or error - please proceed with caution',
          comprehensive: false
        }
      });
    }
  }

  /**
   * Map Elara's risk level to browser format
   */
  private mapRiskLevel(elaraLevel: string): 'safe' | 'low' | 'medium' | 'high' | 'critical' {
    const level = elaraLevel.toLowerCase();
    if (level === 'critical' || level === 'very high') return 'critical';
    if (level === 'high') return 'high';
    if (level === 'medium' || level === 'moderate') return 'medium';
    if (level === 'low') return 'low';
    return 'safe';
  }

  /**
   * Map V2 scanner's A-F risk bands to Prisma's risk level enum
   */
  private mapV2RiskLevel(v2Level: string): 'safe' | 'low' | 'medium' | 'high' | 'critical' {
    switch (v2Level) {
      case 'A': return 'safe';      // Safe (0-15%)
      case 'B': return 'low';       // Low (15-30%)
      case 'C': return 'medium';    // Medium (30-50%)
      case 'D': return 'high';      // High (50-75%)
      case 'E': return 'critical';  // Critical (75-90%)
      case 'F': return 'critical';  // Severe (90-100%)
      default: return 'medium';      // Fallback
    }
  }

  /**
   * Extract human-readable threats from Elara scan results
   */
  private extractThreats(scanResult: any): string[] {
    const threats: string[] = [];

    // Add findings as threats
    if (scanResult.findings && Array.isArray(scanResult.findings)) {
      scanResult.findings
        .filter((f: any) => f.severity === 'high' || f.severity === 'critical')
        .forEach((finding: any) => {
          threats.push(`${finding.category}: ${finding.message}`);
        });
    }

    // Add external scan results
    if (scanResult.externalScans?.summary) {
      const summary = scanResult.externalScans.summary;
      if (summary.flaggedCount > 0) {
        threats.push(`${summary.flaggedCount} external security vendor(s) flagged this URL`);
      }
    }

    // Add AI analysis warnings
    if (scanResult.aiAnalysis?.recommendations) {
      scanResult.aiAnalysis.recommendations
        .slice(0, 2) // Top 2 recommendations
        .forEach((rec: string) => {
          if (rec.toLowerCase().includes('warning') || rec.toLowerCase().includes('caution')) {
            threats.push(rec);
          }
        });
    }

    // If no specific threats but high risk, add generic warning
    if (threats.length === 0 && scanResult.riskScore > 150) {
      threats.push('Multiple security concerns detected - see details for more information');
    }

    return threats.slice(0, 5); // Max 5 threats for UX
  }

  /**
   * Get user-friendly risk message
   */
  private getRiskMessage(riskLevel: string, riskScore: number, maxScore: number): string {
    const level = riskLevel.toLowerCase();
    const percentage = Math.round((riskScore / maxScore) * 100);

    if (level === 'critical' || percentage >= 80) {
      return '⛔ CRITICAL RISK - This website is highly dangerous. Do NOT proceed.';
    }
    if (level === 'high' || percentage >= 60) {
      return '🚨 HIGH RISK - This website has been flagged for malicious activity.';
    }
    if (level === 'medium' || percentage >= 40) {
      return '⚠️ MEDIUM RISK - This website has security concerns. Proceed with caution.';
    }
    if (level === 'low' || percentage >= 20) {
      return 'ℹ️ LOW RISK - This website has minor concerns. Generally safe to proceed.';
    }
    return '✅ SAFE - No significant security threats detected.';
  }
}

export const scanController = new ScanController();
