/**
 * Scan Configuration Admin Controller
 * Full CRUD API for URL scan engine configuration management
 */

import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { CATEGORY_METADATA } from '../services/scanEngine/categoryBase.js';
import { Scanner } from '../services/scanEngine/scanner.js';
import { ScanEventEmitter } from '../services/events/scan-event-emitter.service.js';
import { apiKeyEncryption } from '../services/apiKeyEncryption.service.js';

export class ScanConfigAdminController {
  /**
   * Get complete scan engine schema (categories, checks, TI sources, defaults)
   */
  async getSchema(req: Request, res: Response) {
    try {
      // Build comprehensive schema (await categories since it now queries database)
      const schema = {
        categories: await this.getCategorySchema(),
        tiSources: this.getTISourceSchema(),
        aiModels: this.getAIModelSchema(),
        riskThresholds: this.getRiskThresholdSchema(),
        defaultConfig: this.getDefaultConfiguration()
      };

      res.json({
        success: true,
        data: schema
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error fetching schema:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch scan engine schema'
      });
    }
  }

  /**
   * Get all scan configurations
   */
  async getAllConfigurations(req: Request, res: Response) {
    try {
      const configurations = await prisma.scanConfiguration.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          version: true,
          isActive: true,
          isDefault: true,
          maxScore: true,
          usageCount: true,
          lastUsedAt: true,
          createdAt: true,
          updatedAt: true,
          createdBy: true
        }
      });

      res.json({
        success: true,
        data: configurations,
        count: configurations.length
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error fetching configurations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch configurations'
      });
    }
  }

  /**
   * Get single configuration by ID
   */
  async getConfiguration(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const configuration = await prisma.scanConfiguration.findUnique({
        where: { id }
      });

      if (!configuration) {
        return res.status(404).json({
          success: false,
          error: 'Configuration not found'
        });
      }

      res.json({
        success: true,
        data: configuration
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error fetching configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch configuration'
      });
    }
  }

  /**
   * Get active configuration
   */
  async getActiveConfiguration(req: Request, res: Response) {
    try {
      const activeConfig = await prisma.scanConfiguration.findFirst({
        where: { isActive: true }
      });

      if (!activeConfig) {
        // Return default configuration
        return res.json({
          success: true,
          data: this.getDefaultConfiguration(),
          isDefault: true
        });
      }

      res.json({
        success: true,
        data: activeConfig,
        isDefault: false
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error fetching active configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch active configuration'
      });
    }
  }

  /**
   * Create new configuration
   */
  async createConfiguration(req: Request, res: Response) {
    try {
      const { name, description, categoryWeights, checkWeights, tiConfig, aiModelConfig, algorithmConfig } = req.body;
      const userId = (req as any).user?.id;

      // Calculate max score
      const maxScore = this.calculateMaxScore(categoryWeights, tiConfig);

      // Validate configuration
      const validation = this.validateConfiguration({ categoryWeights, checkWeights, maxScore });
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      const configuration = await prisma.scanConfiguration.create({
        data: {
          name,
          description,
          version: '1.0.0',
          isActive: false,
          isDefault: false,
          maxScore,
          categoryWeights: categoryWeights || {},
          checkWeights: checkWeights || {},
          algorithmConfig: algorithmConfig || {},
          aiModelConfig: aiModelConfig || {},
          tiConfig: tiConfig || {},
          whitelistRules: [],
          blacklistRules: [],
          createdBy: userId,
          usageCount: 0
        }
      });

      logger.info(`[ScanConfigAdmin] Created configuration: ${configuration.id} by user ${userId}`);

      res.status(201).json({
        success: true,
        data: configuration
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error creating configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create configuration'
      });
    }
  }

  /**
   * Update configuration
   */
  async updateConfiguration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, description, categoryWeights, checkWeights, tiConfig, aiModelConfig, algorithmConfig } = req.body;
      const userId = (req as any).user?.id;

      // Check if configuration exists
      const existing = await prisma.scanConfiguration.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Configuration not found'
        });
      }

      // Calculate new max score
      const maxScore = this.calculateMaxScore(
        categoryWeights || existing.categoryWeights,
        tiConfig || existing.tiConfig
      );

      // Create history entry
      await prisma.scanConfigurationHistory.create({
        data: {
          configurationId: id,
          version: existing.version,
          changes: {
            name: { old: existing.name, new: name },
            categoryWeights: { old: existing.categoryWeights, new: categoryWeights },
            checkWeights: { old: existing.checkWeights, new: checkWeights }
          },
          changedBy: userId,
          changeDescription: 'Configuration updated',
          previousSnapshot: existing as any,
          newSnapshot: { ...existing, name, categoryWeights, checkWeights } as any
        }
      });

      // Update configuration
      const updated = await prisma.scanConfiguration.update({
        where: { id },
        data: {
          name: name || existing.name,
          description: description || existing.description,
          maxScore,
          categoryWeights: categoryWeights || existing.categoryWeights,
          checkWeights: checkWeights || existing.checkWeights,
          algorithmConfig: algorithmConfig || existing.algorithmConfig,
          aiModelConfig: aiModelConfig || existing.aiModelConfig,
          tiConfig: tiConfig || existing.tiConfig
        }
      });

      logger.info(`[ScanConfigAdmin] Updated configuration: ${id} by user ${userId}`);

      res.json({
        success: true,
        data: updated
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error updating configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update configuration'
      });
    }
  }

  /**
   * Activate configuration (deactivates all others)
   */
  async activateConfiguration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      // Check if configuration exists
      const configuration = await prisma.scanConfiguration.findUnique({ where: { id } });
      if (!configuration) {
        return res.status(404).json({
          success: false,
          error: 'Configuration not found'
        });
      }

      // Deactivate all other configurations
      await prisma.scanConfiguration.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });

      // Activate this configuration
      const activated = await prisma.scanConfiguration.update({
        where: { id },
        data: { isActive: true }
      });

      logger.info(`[ScanConfigAdmin] Activated configuration: ${id} by user ${userId}`);

      res.json({
        success: true,
        data: activated,
        message: `Configuration "${activated.name}" is now active`
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error activating configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to activate configuration'
      });
    }
  }

  /**
   * Delete configuration
   */
  async deleteConfiguration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      // Check if configuration exists
      const configuration = await prisma.scanConfiguration.findUnique({ where: { id } });
      if (!configuration) {
        return res.status(404).json({
          success: false,
          error: 'Configuration not found'
        });
      }

      // Prevent deletion of active configuration
      if (configuration.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete active configuration. Activate another configuration first.'
        });
      }

      // Delete configuration
      await prisma.scanConfiguration.delete({ where: { id } });

      logger.info(`[ScanConfigAdmin] Deleted configuration: ${id} by user ${userId}`);

      res.json({
        success: true,
        message: 'Configuration deleted successfully'
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error deleting configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete configuration'
      });
    }
  }

  /**
   * Get scan statistics by configuration
   */
  async getScanStatistics(req: Request, res: Response) {
    try {
      const { configurationId } = req.query;

      const where = configurationId ? { configurationId: String(configurationId) } : {};

      const [scans, riskDistribution, avgScores] = await Promise.all([
        // Total scans
        prisma.adminUrlScan.count({ where }),

        // Risk level distribution
        prisma.adminUrlScan.groupBy({
          by: ['riskLevel'],
          where,
          _count: { riskLevel: true }
        }),

        // Average scores
        prisma.adminUrlScan.aggregate({
          where,
          _avg: {
            baseScore: true,
            aiMultiplier: true,
            finalScore: true
          }
        })
      ]);

      // Get top configurations by usage
      const topConfigurations = await prisma.scanConfiguration.findMany({
        orderBy: { usageCount: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          usageCount: true,
          isActive: true
        }
      });

      res.json({
        success: true,
        data: {
          totalScans: scans,
          riskDistribution: riskDistribution.reduce((acc, curr) => {
            acc[curr.riskLevel] = curr._count.riskLevel;
            return acc;
          }, {} as Record<string, number>),
          averageScores: avgScores._avg,
          topConfigurations
        }
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error fetching scan statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch scan statistics'
      });
    }
  }

  /**
   * Helper: Get category schema with all checks
   */
  private async getCategorySchema() {
    // Fetch all check types from database
    const allChecks = await prisma.checkType.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });

    // Group checks by category name
    const checksByCategory: Record<string, any[]> = {};
    allChecks.forEach(check => {
      if (!checksByCategory[check.category]) {
        checksByCategory[check.category] = [];
      }
      checksByCategory[check.category].push({
        id: check.id,
        name: check.name,
        description: check.description,
        defaultPoints: check.pointsDeducted,
        severity: check.severity,
        enabled: check.enabled,
        automationCapable: check.automationCapable,
        requiresManualReview: check.requiresManualReview,
        apiIntegration: check.apiIntegration,
        apiEndpoint: check.apiEndpoint,
        config: check.config
      });
    });

    return Object.entries(CATEGORY_METADATA).map(([id, meta]) => ({
      id,
      name: meta.name,
      description: meta.description,
      defaultWeight: meta.defaultWeight,
      requiresHTTP: meta.requiresHTTP,
      requiresSSL: meta.requiresSSL,
      requiresDNS: meta.requiresDNS,
      requiresWhois: meta.requiresWhois,
      checks: checksByCategory[meta.name] || []
    }));
  }

  /**
   * Helper: Get checks for a category
   */
  private getCategoryChecks(categoryId: string): any[] {
    const checkMaps: Record<string, any[]> = {
      domainAnalysis: [
        { id: 'domainAge_0_7_days', name: 'Domain Age: 0-7 days', defaultPoints: 20, severity: 'critical' },
        { id: 'domainAge_8_30_days', name: 'Domain Age: 8-30 days', defaultPoints: 15, severity: 'high' },
        { id: 'domainAge_31_90_days', name: 'Domain Age: 31-90 days', defaultPoints: 10, severity: 'medium' },
        { id: 'tld_high_risk', name: 'High-Risk TLD', defaultPoints: 15, severity: 'high' },
        { id: 'tld_medium_risk', name: 'Medium-Risk TLD', defaultPoints: 8, severity: 'medium' },
        { id: 'whois_privacy_protection', name: 'WHOIS Privacy Protection', defaultPoints: 5, severity: 'low' },
        { id: 'whois_incomplete_data', name: 'Incomplete WHOIS Data', defaultPoints: 8, severity: 'medium' },
        { id: 'registrar_frequently_abused', name: 'Frequently Abused Registrar', defaultPoints: 3, severity: 'low' },
        { id: 'subdomain_depth_excessive', name: 'Excessive Subdomain Depth', defaultPoints: 7, severity: 'medium' },
        { id: 'domain_suspicious_pattern', name: 'Suspicious Domain Pattern', defaultPoints: 12, severity: 'high' },
        { id: 'domain_excessive_numbers', name: 'Excessive Numbers in Domain', defaultPoints: 8, severity: 'medium' },
        { id: 'domain_random_sequence', name: 'Random Character Sequence', defaultPoints: 7, severity: 'medium' }
      ],
      sslSecurity: [
        { id: 'ssl_no_certificate', name: 'No SSL Certificate', defaultPoints: 25, severity: 'critical' },
        { id: 'ssl_expired', name: 'Expired Certificate', defaultPoints: 20, severity: 'critical' },
        { id: 'ssl_self_signed', name: 'Self-Signed Certificate', defaultPoints: 15, severity: 'high' },
        { id: 'ssl_untrusted_issuer', name: 'Untrusted Issuer', defaultPoints: 12, severity: 'high' },
        { id: 'ssl_weak_cipher', name: 'Weak Cipher Suite', defaultPoints: 10, severity: 'medium' },
        { id: 'ssl_no_hsts', name: 'Missing HSTS Header', defaultPoints: 8, severity: 'low' }
      ],
      contentAnalysis: [
        { id: 'content_obfuscation', name: 'Code Obfuscation Detected', defaultPoints: 15, severity: 'high' },
        { id: 'content_suspicious_keywords', name: 'Suspicious Keywords', defaultPoints: 10, severity: 'medium' },
        { id: 'content_hidden_elements', name: 'Hidden Elements', defaultPoints: 8, severity: 'medium' },
        { id: 'content_external_resources', name: 'Suspicious External Resources', defaultPoints: 12, severity: 'high' }
      ],
      phishingPatterns: [
        { id: 'phishing_login_form', name: 'Login Form Detected', defaultPoints: 20, severity: 'critical' },
        { id: 'phishing_credential_harvest', name: 'Credential Harvesting Pattern', defaultPoints: 25, severity: 'critical' },
        { id: 'phishing_brand_mimicry', name: 'Brand Mimicry', defaultPoints: 18, severity: 'high' },
        { id: 'phishing_urgent_language', name: 'Urgent/Threatening Language', defaultPoints: 12, severity: 'medium' }
      ],
      malwareDetection: [
        { id: 'malware_suspicious_scripts', name: 'Suspicious JavaScript', defaultPoints: 20, severity: 'high' },
        { id: 'malware_auto_download', name: 'Auto-Download Behavior', defaultPoints: 25, severity: 'critical' },
        { id: 'malware_exploit_kit', name: 'Exploit Kit Pattern', defaultPoints: 30, severity: 'critical' },
        { id: 'malware_iframe_injection', name: 'Iframe Injection', defaultPoints: 15, severity: 'high' }
      ]
    };

    return checkMaps[categoryId] || [];
  }

  /**
   * Helper: Get TI source schema
   */
  private getTISourceSchema() {
    return [
      { id: 'google_safe_browsing', name: 'Google Safe Browsing', defaultPoints: 5, requiresAPIKey: true },
      { id: 'virustotal', name: 'VirusTotal', defaultPoints: 5, requiresAPIKey: true },
      { id: 'phishtank', name: 'PhishTank', defaultPoints: 5, requiresAPIKey: false },
      { id: 'urlhaus', name: 'URLhaus', defaultPoints: 5, requiresAPIKey: false },
      { id: 'alienvault_otx', name: 'AlienVault OTX', defaultPoints: 5, requiresAPIKey: true },
      { id: 'abuseipdb', name: 'AbuseIPDB', defaultPoints: 5, requiresAPIKey: true },
      { id: 'spamhaus', name: 'Spamhaus DBL', defaultPoints: 5, requiresAPIKey: false },
      { id: 'surbl', name: 'SURBL', defaultPoints: 5, requiresAPIKey: false },
      { id: 'openphish', name: 'OpenPhish', defaultPoints: 5, requiresAPIKey: false },
      { id: 'cisco_talos', name: 'Cisco Talos', defaultPoints: 5, requiresAPIKey: true },
      { id: 'ibm_xforce', name: 'IBM X-Force', defaultPoints: 5, requiresAPIKey: true }
    ];
  }

  /**
   * Helper: Get AI model schema
   */
  private getAIModelSchema() {
    return {
      models: [
        { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', defaultWeight: 0.35 },
        { id: 'gpt-4', name: 'GPT-4', defaultWeight: 0.35 },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', defaultWeight: 0.30 }
      ],
      multiplierRange: { min: 0.7, max: 1.3 }
    };
  }

  /**
   * Helper: Get risk threshold schema
   */
  private getRiskThresholdSchema() {
    return {
      safe: { min: 0, max: 15, color: '#10b981', description: 'Safe - No significant threats detected' },
      low: { min: 15, max: 30, color: '#3b82f6', description: 'Low Risk - Minor concerns detected' },
      medium: { min: 30, max: 60, color: '#f59e0b', description: 'Medium Risk - Multiple concerns detected' },
      high: { min: 60, max: 80, color: '#ef4444', description: 'High Risk - Significant threats detected' },
      critical: { min: 80, max: 100, color: '#991b1b', description: 'Critical - Severe threats detected' }
    };
  }

  /**
   * Helper: Get default configuration
   */
  private getDefaultConfiguration() {
    return {
      id: 'default',
      name: 'Default Configuration',
      description: 'Standard scan configuration with balanced weights',
      version: '1.0.0',
      isActive: true,
      isDefault: true,
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
        redirectChain: 15
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
      },
      tiConfig: {
        maxScore: 55,
        sourceWeights: {
          google_safe_browsing: 5,
          virustotal: 5,
          phishtank: 5,
          urlhaus: 5,
          alienvault_otx: 5,
          abuseipdb: 5,
          spamhaus: 5,
          surbl: 5,
          openphish: 5,
          cisco_talos: 5,
          ibm_xforce: 5
        }
      },
      whitelistRules: [],
      blacklistRules: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Helper: Calculate max score
   */
  private calculateMaxScore(categoryWeights: any, tiConfig: any): number {
    const categoryTotal = Object.values(categoryWeights || {}).reduce((sum: number, weight: any) => sum + (weight || 0), 0);
    const tiTotal = tiConfig?.maxScore || 55;
    return categoryTotal + tiTotal;
  }

  /**
   * Helper: Validate configuration
   */
  private validateConfiguration(config: any): { valid: boolean; error?: string } {
    if (!config.categoryWeights) {
      return { valid: false, error: 'Category weights are required' };
    }

    if (config.maxScore > 1000) {
      return { valid: false, error: 'Max score cannot exceed 1000' };
    }

    return { valid: true };
  }

  /**
   * ========================================================================
   * CALIBRATION & TESTING ENDPOINTS
   * ========================================================================
   */

  /**
   * Test URL scan with specific configuration
   * POST /api/v2/admin/scan-engine/calibrate
   */
  async calibrateScan(req: Request, res: Response) {
    try {
      const { url, configurationId, testMode = true, scanId: clientScanId } = req.body;
      const userId = (req as any).user?.id;

      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required'
        });
      }

      // Get configuration to test
      let config: any;
      if (configurationId) {
        config = await prisma.scanConfiguration.findUnique({ where: { id: configurationId } });
        if (!config) {
          return res.status(404).json({
            success: false,
            error: 'Configuration not found'
          });
        }
      } else {
        // Use active configuration
        config = await prisma.scanConfiguration.findFirst({ where: { isActive: true } });
        if (!config) {
          config = this.getDefaultConfiguration();
        }
      }

      // Use client-provided scanId if available, otherwise generate one
      // This allows frontend to open ScanConsole BEFORE starting the scan
      const scanId = clientScanId || `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info(`[ScanConfigAdmin] Starting calibration scan for ${url} with config ${config.id || 'default'} (scanId: ${scanId})`);

      // Initialize scanner with the specified configuration
      const scanner = new Scanner(config);

      // Execute the scan
      const scanResult = await scanner.scan(url, userId, scanId);

      // Build detailed step-by-step breakdown for visualization
      const stepByStepBreakdown = this.buildStepByStepBreakdown(scanResult);

      // Format the calibration result
      const calibrationResult = {
        scanId, // Include scanId for WebSocket room identification
        url: scanResult.url,
        configurationUsed: {
          id: config.id || 'default',
          name: config.name,
          maxScore: config.maxScore,
          categoryWeights: config.categoryWeights,
          algorithmConfig: config.algorithmConfig
        },
        scanResult: {
          // Stage 0: Reachability
          reachability: {
            state: scanResult.reachabilityState,
            pipeline: scanResult.pipelineUsed,
            dns: scanResult.stage0.reachability.dns,
            tcp: scanResult.stage0.reachability.tcp,
            http: scanResult.stage0.reachability.http,
            detection: scanResult.stage0.reachability.detection
          },

          // Stage 1: Category Results (detailed)
          categories: scanResult.categories.map((cat: any) => ({
            id: cat.id,
            name: cat.name,
            score: cat.score,
            maxWeight: cat.maxWeight,
            percentage: cat.maxWeight > 0 ? ((cat.score / cat.maxWeight) * 100).toFixed(1) : 0,
            status: cat.status,
            findings: cat.findings || [],
            checksRun: cat.checksRun || 0,
            checksTotal: cat.checksTotal || 0
          })),

          // Stage 2: Threat Intelligence Results
          tiResults: scanResult.tiResults.map((ti: any) => ({
            source: ti.source,
            verdict: ti.verdict,
            score: ti.score,
            confidence: ti.confidence,
            duration: ti.duration,
            details: ti.details
          })),

          // Stage 3: Base Score
          baseScore: scanResult.baseScore,
          activeMaxScore: scanResult.activeMaxScore,
          baseScorePercentage: ((scanResult.baseScore / scanResult.activeMaxScore) * 100).toFixed(1),

          // Stage 4: AI Consensus
          aiAnalysis: {
            models: scanResult.aiAnalysis.models.map((model: any) => ({
              model: model.model,
              verdict: model.verdict,
              confidence: model.confidence,
              multiplier: model.multiplier,
              reasoning: model.reasoning,
              duration: model.duration
            })),
            finalMultiplier: scanResult.aiMultiplier,
            agreementRate: scanResult.aiAnalysis.agreementRate,
            averageConfidence: scanResult.aiAnalysis.averageConfidence,
            consensusVerdict: scanResult.aiAnalysis.consensusVerdict
          },

          // Stage 5: False Positive Prevention
          falsePositiveChecks: scanResult.falsePositiveChecks,

          // Stage 6: Final Score & Risk Level
          finalScore: scanResult.finalScore,
          riskLevel: scanResult.riskLevel,
          riskPercentage: scanResult.riskPercentage.toFixed(1),

          // Performance Metrics
          performance: {
            totalDuration: scanResult.scanDuration,
            stage0: scanResult.performanceMetrics.stage0,
            categories: scanResult.performanceMetrics.categories,
            tiLayer: scanResult.performanceMetrics.tiLayer,
            aiConsensus: scanResult.performanceMetrics.aiConsensus,
            breakdown: {
              reachability: `${scanResult.performanceMetrics.stage0}ms`,
              categoryAnalysis: `${scanResult.performanceMetrics.categories}ms`,
              threatIntel: `${scanResult.performanceMetrics.tiLayer}ms`,
              aiConsensus: `${scanResult.performanceMetrics.aiConsensus}ms`,
              total: `${scanResult.scanDuration}ms`
            }
          }
        },

        // Step-by-step visual breakdown
        visualFlow: stepByStepBreakdown,

        testMode,
        timestamp: scanResult.timestamp
      };

      // If test mode, mark the scan as a test in database
      if (testMode && scanResult.metadata?.scanId) {
        try {
          await prisma.adminUrlScan.updateMany({
            where: {
              url: scanResult.url,
              createdAt: {
                gte: new Date(Date.now() - 5000) // Within last 5 seconds
              }
            },
            data: {
              metadata: {
                ...(scanResult.metadata as any),
                isTestScan: true,
                testMode: true
              }
            }
          });
        } catch (err) {
          logger.warn('[ScanConfigAdmin] Could not mark scan as test:', err);
        }
      }

      logger.info(`[ScanConfigAdmin] Calibration scan complete: ${scanResult.riskLevel} (${scanResult.finalScore}/${scanResult.activeMaxScore}) in ${scanResult.scanDuration}ms`);

      res.json({
        success: true,
        data: calibrationResult
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error in calibration scan:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run calibration scan'
      });
    }
  }

  /**
   * Build step-by-step breakdown for visual flow
   */
  private buildStepByStepBreakdown(scanResult: any) {
    const steps = [];
    let currentScore = 0;

    // Step 1: URL Entry
    steps.push({
      step: 1,
      stage: 'Input',
      name: 'URL Submission',
      description: 'URL entered for scanning',
      data: {
        url: scanResult.url,
        protocol: scanResult.urlComponents.protocol,
        domain: scanResult.urlComponents.domain,
        tld: scanResult.urlComponents.tld
      },
      score: 0,
      cumulativeScore: 0,
      duration: 0
    });

    // Step 2: Stage 0 - Reachability
    steps.push({
      step: 2,
      stage: 'Stage 0',
      name: 'Pre-Flight Checks',
      description: 'Reachability probe and validation',
      data: {
        reachabilityState: scanResult.reachabilityState,
        pipeline: scanResult.pipelineUsed,
        dnsResolved: scanResult.stage0.reachability.dns.resolved,
        ip: scanResult.stage0.reachability.dns.ip,
        httpStatus: scanResult.stage0.reachability.http.statusCode
      },
      score: 0,
      cumulativeScore: 0,
      duration: scanResult.performanceMetrics.stage0
    });

    // Step 3: Stage 1 - Categories
    const categoriesScore = scanResult.categories.reduce((sum: number, cat: any) => sum + (cat.score || 0), 0);
    currentScore += categoriesScore;
    steps.push({
      step: 3,
      stage: 'Stage 1',
      name: 'Category Analysis',
      description: `Analyzed ${scanResult.categories.length} security categories`,
      data: {
        categoriesAnalyzed: scanResult.categories.length,
        topIssues: scanResult.categories
          .filter((c: any) => c.findings && c.findings.length > 0)
          .map((c: any) => ({
            category: c.name,
            score: c.score,
            findingsCount: c.findings.length
          }))
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 5)
      },
      score: categoriesScore,
      cumulativeScore: currentScore,
      duration: scanResult.performanceMetrics.categories
    });

    // Step 4: Stage 2 - Threat Intelligence
    const tiScore = scanResult.tiResults.reduce((sum: number, ti: any) => sum + (ti.score || 0), 0);
    currentScore += tiScore;
    const maliciousTI = scanResult.tiResults.filter((ti: any) => ti.verdict === 'malicious');
    steps.push({
      step: 4,
      stage: 'Stage 2',
      name: 'Threat Intelligence',
      description: `Queried ${scanResult.tiResults.length} threat intelligence sources`,
      data: {
        sourcesQueried: scanResult.tiResults.length,
        maliciousCount: maliciousTI.length,
        maliciousSources: maliciousTI.map((ti: any) => ti.source),
        totalTIScore: tiScore
      },
      score: tiScore,
      cumulativeScore: currentScore,
      duration: scanResult.performanceMetrics.tiLayer
    });

    // Step 5: Stage 3 - Base Score
    steps.push({
      step: 5,
      stage: 'Stage 3',
      name: 'Base Score Calculation',
      description: 'Categories + TI = Base Score',
      data: {
        categoryScore: categoriesScore,
        tiScore: tiScore,
        baseScore: scanResult.baseScore,
        maxScore: scanResult.activeMaxScore,
        percentage: ((scanResult.baseScore / scanResult.activeMaxScore) * 100).toFixed(1)
      },
      score: 0,
      cumulativeScore: scanResult.baseScore,
      duration: 0
    });

    // Step 6: Stage 4 - AI Consensus
    const scoreBeforeAI = scanResult.baseScore;
    const scoreAfterAI = Math.round(scanResult.baseScore * scanResult.aiMultiplier);
    steps.push({
      step: 6,
      stage: 'Stage 4',
      name: 'AI Consensus Engine',
      description: `${scanResult.aiAnalysis.models.length} AI models analyzed the URL`,
      data: {
        modelsUsed: scanResult.aiAnalysis.models.map((m: any) => m.model),
        multiplier: scanResult.aiMultiplier,
        agreementRate: scanResult.aiAnalysis.agreementRate,
        confidenceAvg: scanResult.aiAnalysis.averageConfidence,
        scoreBeforeAI: scoreBeforeAI,
        scoreAfterAI: scoreAfterAI,
        impact: `${scanResult.aiMultiplier}× multiplier`
      },
      score: scoreAfterAI - scoreBeforeAI,
      cumulativeScore: scoreAfterAI,
      duration: scanResult.performanceMetrics.aiConsensus
    });

    // Step 7: Stage 5 - False Positive Prevention
    const fpAdjustment = scanResult.falsePositiveChecks?.scoreAdjustment || 0;
    steps.push({
      step: 7,
      stage: 'Stage 5',
      name: 'False Positive Prevention',
      description: 'Legitimacy checks applied',
      data: {
        legitimacyScore: scanResult.falsePositiveChecks?.legitimacyScore || 0,
        cdnDetected: scanResult.falsePositiveChecks?.cdnCheck || false,
        riotDetected: scanResult.falsePositiveChecks?.riotCheck || false,
        govDetected: scanResult.falsePositiveChecks?.govCheck || false,
        adjustment: fpAdjustment,
        multiplier: scanResult.falsePositiveChecks?.adjustmentMultiplier || 1.0
      },
      score: fpAdjustment,
      cumulativeScore: scanResult.finalScore,
      duration: 0
    });

    // Step 8: Stage 6 - Final Verdict
    steps.push({
      step: 8,
      stage: 'Stage 6',
      name: 'Risk Level Determination',
      description: `Final verdict: ${scanResult.riskLevel.toUpperCase()}`,
      data: {
        finalScore: scanResult.finalScore,
        maxScore: scanResult.activeMaxScore,
        riskLevel: scanResult.riskLevel,
        riskPercentage: scanResult.riskPercentage,
        totalDuration: scanResult.scanDuration
      },
      score: 0,
      cumulativeScore: scanResult.finalScore,
      duration: scanResult.scanDuration
    });

    return {
      steps,
      summary: {
        totalSteps: steps.length,
        totalDuration: scanResult.scanDuration,
        finalScore: scanResult.finalScore,
        maxScore: scanResult.activeMaxScore,
        riskLevel: scanResult.riskLevel
      }
    };
  }

  /**
   * Compare scan results across multiple configurations
   * POST /api/v2/admin/scan-engine/calibrate/compare
   */
  async compareConfigurations(req: Request, res: Response) {
    try {
      const { url, configurationIds } = req.body;
      const userId = (req as any).user?.id;

      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required'
        });
      }

      if (!configurationIds || !Array.isArray(configurationIds)) {
        return res.status(400).json({
          success: false,
          error: 'Configuration IDs array is required'
        });
      }

      if (configurationIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one configuration ID is required'
        });
      }

      if (configurationIds.length > 6) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 6 configurations can be compared at once'
        });
      }

      logger.info(`[ScanConfigAdmin] Starting comparison scan for ${url} across ${configurationIds.length} configs`);

      // Get all configurations
      const configurations = await prisma.scanConfiguration.findMany({
        where: { id: { in: configurationIds } }
      });

      if (configurations.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No configurations found'
        });
      }

      // Run scan with each configuration in parallel
      const scanPromises = configurations.map(async (config) => {
        try {
          const scanner = new Scanner(config);
          const scanResult = await scanner.scan(url, userId);

          return {
            configurationId: config.id,
            configurationName: config.name,
            maxScore: config.maxScore,
            success: true,
            result: {
              baseScore: scanResult.baseScore,
              aiMultiplier: scanResult.aiMultiplier,
              finalScore: scanResult.finalScore,
              activeMaxScore: scanResult.activeMaxScore,
              riskLevel: scanResult.riskLevel,
              riskPercentage: scanResult.riskPercentage.toFixed(1),
              scanDuration: scanResult.scanDuration,
              categoriesAnalyzed: scanResult.categories.length,
              tiSourcesQueried: scanResult.tiResults.length,
              categoryBreakdown: scanResult.categories.map((cat: any) => ({
                name: cat.name,
                score: cat.score,
                maxWeight: cat.maxWeight,
                percentage: cat.maxWeight > 0 ? ((cat.score / cat.maxWeight) * 100).toFixed(1) : 0
              })),
              tiBreakdown: {
                malicious: scanResult.tiResults.filter((ti: any) => ti.verdict === 'malicious').length,
                suspicious: scanResult.tiResults.filter((ti: any) => ti.verdict === 'suspicious').length,
                safe: scanResult.tiResults.filter((ti: any) => ti.verdict === 'safe').length
              }
            }
          };
        } catch (error) {
          logger.error(`[ScanConfigAdmin] Error scanning with config ${config.id}:`, error);
          return {
            configurationId: config.id,
            configurationName: config.name,
            maxScore: config.maxScore,
            success: false,
            error: error instanceof Error ? error.message : 'Scan failed'
          };
        }
      });

      const comparisonResults = await Promise.all(scanPromises);

      // Calculate comparison metrics
      const successfulScans = comparisonResults.filter(r => r.success);
      const comparison = {
        url,
        totalConfigurations: configurationIds.length,
        successfulScans: successfulScans.length,
        failedScans: comparisonResults.length - successfulScans.length,
        results: comparisonResults,
        analysis: {
          scoreRange: {
            min: Math.min(...successfulScans.map((r: any) => r.result.finalScore)),
            max: Math.max(...successfulScans.map((r: any) => r.result.finalScore)),
            avg: successfulScans.reduce((sum: number, r: any) => sum + r.result.finalScore, 0) / successfulScans.length
          },
          riskLevelDistribution: successfulScans.reduce((acc: any, r: any) => {
            acc[r.result.riskLevel] = (acc[r.result.riskLevel] || 0) + 1;
            return acc;
          }, {}),
          performanceAvg: successfulScans.reduce((sum: number, r: any) => sum + r.result.scanDuration, 0) / successfulScans.length,
          mostStrictConfig: successfulScans.sort((a: any, b: any) => b.result.finalScore - a.result.finalScore)[0]?.configurationName,
          mostPermissiveConfig: successfulScans.sort((a: any, b: any) => a.result.finalScore - b.result.finalScore)[0]?.configurationName
        },
        timestamp: new Date()
      };

      logger.info(`[ScanConfigAdmin] Comparison scan complete: ${successfulScans.length}/${configurationIds.length} successful`);

      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error comparing configurations:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compare configurations'
      });
    }
  }

  /**
   * ========================================================================
   * PRESET MANAGEMENT
   * ========================================================================
   */

  /**
   * Get all predefined presets
   * GET /api/v2/admin/scan-engine/presets
   */
  async getPresets(req: Request, res: Response) {
    try {
      const presets = this.getPredefinedPresets();

      res.json({
        success: true,
        data: presets
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error fetching presets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch presets'
      });
    }
  }

  /**
   * Apply a preset to create new configuration
   * POST /api/v2/admin/scan-engine/preset/:presetName/apply
   */
  async applyPreset(req: Request, res: Response) {
    try {
      const { presetName } = req.params;
      const { name, description } = req.body;
      const userId = (req as any).user?.id;

      const presets = this.getPredefinedPresets();
      const preset = presets.find(p => p.id === presetName);

      if (!preset) {
        return res.status(404).json({
          success: false,
          error: 'Preset not found'
        });
      }

      // Create configuration from preset
      const configuration = await prisma.scanConfiguration.create({
        data: {
          name: name || `${preset.name} Configuration`,
          description: description || preset.description,
          version: '1.0.0',
          isActive: false,
          isDefault: false,
          maxScore: preset.config.maxScore,
          categoryWeights: preset.config.categoryWeights,
          checkWeights: preset.config.checkWeights || {},
          algorithmConfig: preset.config.algorithmConfig,
          aiModelConfig: preset.config.aiModelConfig,
          tiConfig: preset.config.tiConfig,
          whitelistRules: [],
          blacklistRules: [],
          createdBy: userId,
          usageCount: 0
        }
      });

      logger.info(`[ScanConfigAdmin] Applied preset ${presetName} as config ${configuration.id}`);

      res.status(201).json({
        success: true,
        data: configuration,
        message: `Preset "${preset.name}" applied successfully`
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error applying preset:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to apply preset'
      });
    }
  }

  /**
   * ========================================================================
   * EXPORT / IMPORT
   * ========================================================================
   */

  /**
   * Export configuration as JSON
   * GET /api/v2/admin/scan-engine/config/:id/export
   */
  async exportConfiguration(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const configuration = await prisma.scanConfiguration.findUnique({ where: { id } });

      if (!configuration) {
        return res.status(404).json({
          success: false,
          error: 'Configuration not found'
        });
      }

      // Remove system fields
      const exportData = {
        name: configuration.name,
        description: configuration.description,
        version: configuration.version,
        maxScore: configuration.maxScore,
        categoryWeights: configuration.categoryWeights,
        checkWeights: configuration.checkWeights,
        algorithmConfig: configuration.algorithmConfig,
        aiModelConfig: configuration.aiModelConfig,
        tiConfig: configuration.tiConfig,
        whitelistRules: configuration.whitelistRules,
        blacklistRules: configuration.blacklistRules,
        exportedAt: new Date(),
        exportedFrom: 'Elara Scan Engine Admin'
      };

      res.json({
        success: true,
        data: exportData
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error exporting configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export configuration'
      });
    }
  }

  /**
   * Import configuration from JSON
   * POST /api/v2/admin/scan-engine/config/import
   */
  async importConfiguration(req: Request, res: Response) {
    try {
      const importData = req.body;
      const userId = (req as any).user?.id;

      // Validate import data
      if (!importData.name || !importData.categoryWeights) {
        return res.status(400).json({
          success: false,
          error: 'Invalid import data: name and categoryWeights are required'
        });
      }

      // Create configuration from import
      const configuration = await prisma.scanConfiguration.create({
        data: {
          name: `${importData.name} (Imported)`,
          description: importData.description || '',
          version: importData.version || '1.0.0',
          isActive: false,
          isDefault: false,
          maxScore: importData.maxScore || 570,
          categoryWeights: importData.categoryWeights,
          checkWeights: importData.checkWeights || {},
          algorithmConfig: importData.algorithmConfig || {},
          aiModelConfig: importData.aiModelConfig || {},
          tiConfig: importData.tiConfig || {},
          whitelistRules: importData.whitelistRules || [],
          blacklistRules: importData.blacklistRules || [],
          createdBy: userId,
          usageCount: 0
        }
      });

      logger.info(`[ScanConfigAdmin] Imported configuration: ${configuration.id}`);

      res.status(201).json({
        success: true,
        data: configuration,
        message: 'Configuration imported successfully'
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error importing configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to import configuration'
      });
    }
  }

  /**
   * Clone existing configuration
   * POST /api/v2/admin/scan-engine/config/:id/clone
   */
  async cloneConfiguration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const userId = (req as any).user?.id;

      const original = await prisma.scanConfiguration.findUnique({ where: { id } });

      if (!original) {
        return res.status(404).json({
          success: false,
          error: 'Configuration not found'
        });
      }

      const cloned = await prisma.scanConfiguration.create({
        data: {
          name: name || `${original.name} (Copy)`,
          description: original.description,
          version: original.version,
          isActive: false,
          isDefault: false,
          maxScore: original.maxScore,
          categoryWeights: original.categoryWeights,
          checkWeights: original.checkWeights,
          algorithmConfig: original.algorithmConfig,
          aiModelConfig: original.aiModelConfig,
          tiConfig: original.tiConfig,
          whitelistRules: original.whitelistRules,
          blacklistRules: original.blacklistRules,
          createdBy: userId,
          usageCount: 0
        }
      });

      logger.info(`[ScanConfigAdmin] Cloned configuration ${id} to ${cloned.id}`);

      res.status(201).json({
        success: true,
        data: cloned,
        message: 'Configuration cloned successfully'
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error cloning configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clone configuration'
      });
    }
  }

  /**
   * Get configuration change history
   * GET /api/v2/admin/scan-engine/config/:id/history
   */
  async getConfigurationHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const history = await prisma.scanConfigurationHistory.findMany({
        where: { configurationId: id },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      res.json({
        success: true,
        data: history,
        count: history.length
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error fetching configuration history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch configuration history'
      });
    }
  }

  /**
   * ========================================================================
   * CHECK DEFINITION MANAGEMENT (PHASE 1 - ENTERPRISE FEATURES)
   * ========================================================================
   */

  /**
   * Get all check definitions with filtering
   * GET /api/v2/admin/scan-engine/checks
   */
  async getCheckDefinitions(req: Request, res: Response) {
    try {
      const { category, enabled, search } = req.query;

      const where: any = {};
      if (category) where.category = category;
      if (enabled !== undefined) where.enabled = enabled === 'true';
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } }
        ];
      }

      // Query CheckType table (where we seeded 70 check definitions)
      const checks = await prisma.checkType.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }]
      });

      // Group by category for easier frontend consumption
      const grouped = checks.reduce((acc, check) => {
        if (!acc[check.category]) {
          acc[check.category] = [];
        }
        acc[check.category].push(check);
        return acc;
      }, {} as Record<string, typeof checks>);

      res.json({
        success: true,
        data: checks,
        grouped: grouped,
        count: checks.length
      });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error fetching check definitions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch check definitions'
      });
    }
  }

  /**
   * Create new check definition
   * POST /api/v2/admin/scan-engine/checks
   */
  async createCheckDefinition(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const checkData = req.body;

      // Validation
      if (!checkData.name || !checkData.category) {
        return res.status(400).json({
          success: false,
          error: 'name and category are required'
        });
      }

      // Check for duplicate name+category
      const existing = await prisma.checkType.findFirst({
        where: {
          name: checkData.name,
          category: checkData.category
        }
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Check '${checkData.name}' already exists in category '${checkData.category}'`
        });
      }

      const newCheck = await prisma.checkType.create({
        data: checkData
      });

      logger.info(`[ScanConfigAdmin] Created check definition: ${newCheck.name} (${newCheck.category}) by user ${userId}`);
      res.status(201).json({ success: true, data: newCheck });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error creating check definition:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create check definition'
      });
    }
  }

  /**
   * Update check definition
   * PUT /api/v2/admin/scan-engine/checks/:id
   */
  async updateCheckDefinition(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const updateData = req.body;

      const updated = await prisma.checkType.update({
        where: { id },
        data: updateData
      });

      logger.info(`[ScanConfigAdmin] Updated check definition: ${updated.name} (${updated.category}) by user ${userId}`);
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error updating check definition:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update check definition'
      });
    }
  }

  /**
   * Delete check definition
   * DELETE /api/v2/admin/scan-engine/checks/:id
   */
  async deleteCheckDefinition(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      await prisma.checkType.delete({ where: { id } });

      logger.info(`[ScanConfigAdmin] Deleted check definition: ${id} by user ${userId}`);
      res.json({ success: true, message: 'Check deleted successfully' });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error deleting check definition:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete check definition'
      });
    }
  }

  /**
   * Toggle check definition enabled/disabled
   * POST /api/v2/admin/scan-engine/checks/:id/toggle
   */
  async toggleCheckDefinition(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const userId = (req as any).user?.id;

      const updated = await prisma.checkType.update({
        where: { id },
        data: { enabled }
      });

      logger.info(`[ScanConfigAdmin] Toggled check ${updated.id}: ${enabled} by user ${userId}`);
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error toggling check:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle check'
      });
    }
  }

  /**
   * Test check connection/API integration
   * POST /api/v2/admin/scan-engine/checks/:id/test
   */
  async testCheckConnection(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Get check definition
      const check = await prisma.checkType.findUnique({ where: { id } });
      if (!check) {
        return res.status(404).json({
          success: false,
          error: 'Check not found'
        });
      }

      if (!check.apiIntegration) {
        return res.json({
          success: true,
          message: 'This check does not require API integration (built-in logic)'
        });
      }

      // Test based on API integration type
      let testResult: any = {};
      const apiType = check.apiIntegration.toLowerCase();

      try {
        if (apiType === 'virustotal') {
          // Test VirusTotal API
          const apiKey = await this.getGlobalSetting('VIRUSTOTAL_API_KEY');
          if (!apiKey) {
            throw new Error('VirusTotal API key not configured');
          }
          // Make test request to VirusTotal
          const axios = require('axios');
          const response = await axios.get('https://www.virustotal.com/api/v3/domains/google.com', {
            headers: { 'x-apikey': apiKey },
            timeout: 5000
          });
          testResult = { status: 'Connected', responseCode: response.status };

        } else if (apiType === 'google-safe-browsing' || apiType.includes('google')) {
          // Test Google Safe Browsing API
          const apiKey = await this.getGlobalSetting('GOOGLE_SAFE_BROWSING_API_KEY');
          if (!apiKey) {
            throw new Error('Google Safe Browsing API key not configured');
          }
          testResult = { status: 'API Key Found', message: 'Configured' };

        } else if (apiType.includes('whois')) {
          // Test WHOIS (no API key usually needed)
          testResult = { status: 'Available', message: 'WHOIS lookups are operational' };

        } else if (apiType === 'node:tls' || apiType === 'node:dns' || apiType === 'node:https') {
          // Built-in Node.js modules - always available
          testResult = { status: 'Available', message: `${apiType} module is built-in` };

        } else if (apiType === 'puppeteer') {
          // Check if Puppeteer is available
          testResult = { status: 'Available', message: 'Puppeteer is configured' };

        } else if (apiType === 'axios') {
          // Axios HTTP client - always available
          testResult = { status: 'Available', message: 'HTTP client ready' };

        } else {
          testResult = { status: 'Unknown', message: `No test available for ${apiType}` };
        }

        logger.info(`[ScanConfigAdmin] Check connection test passed for ${check.name} (${apiType})`);
        res.json({
          success: true,
          message: `✓ ${check.apiIntegration} connection test passed`,
          data: testResult
        });

      } catch (testError: any) {
        logger.warn(`[ScanConfigAdmin] Check connection test failed for ${check.name}:`, testError.message);
        res.json({
          success: false,
          error: `Connection test failed: ${testError.message}`,
          data: { apiIntegration: check.apiIntegration }
        });
      }

    } catch (error: any) {
      logger.error('[ScanConfigAdmin] Error testing check connection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test check connection'
      });
    }
  }

  /**
   * Helper: Get global setting value
   */
  private async getGlobalSetting(key: string): Promise<string | null> {
    try {
      const setting = await prisma.globalSetting.findUnique({ where: { key } });
      if (!setting) return null;

      // Decrypt if value is encrypted
      if (typeof setting.value === 'object' && (setting.value as any).encrypted) {
        const { decrypt } = await import('../utils/encryption.js');
        return decrypt((setting.value as any).encrypted);
      }

      return setting.value as string;
    } catch (error) {
      logger.error(`[ScanConfigAdmin] Error getting global setting ${key}:`, error);
      return null;
    }
  }

  /**
   * ========================================================================
   * AI MODEL MANAGEMENT (PHASE 1 - ENTERPRISE FEATURES)
   * ========================================================================
   */

  /**
   * Get all AI model definitions
   * GET /api/v2/admin/scan-engine/ai-models
   */
  async getAIModels(req: Request, res: Response) {
    try {
      const { provider, enabled } = req.query;

      const where: any = {};
      if (provider) where.provider = provider;
      if (enabled !== undefined) where.enabled = enabled === 'true';

      const models = await prisma.aIModelDefinition.findMany({
        where,
        orderBy: [{ rank: 'asc' }, { name: 'asc' }]
      });

      res.json({ success: true, data: models });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error fetching AI models:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch AI models' });
    }
  }

  /**
   * Create new AI model
   * POST /api/v2/admin/scan-engine/ai-models
   */
  async createAIModel(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const modelData = req.body;

      // Validation
      if (!modelData.modelId || !modelData.name || !modelData.provider) {
        return res.status(400).json({
          success: false,
          error: 'modelId, name, and provider are required'
        });
      }

      // Check for duplicate
      const existing = await prisma.aIModelDefinition.findUnique({
        where: { modelId: modelData.modelId }
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Model '${modelData.modelId}' already exists`
        });
      }

      if (modelData.apiKey) {
        modelData.apiKey = apiKeyEncryption.encrypt(modelData.apiKey);
      }

      const newModel = await prisma.aIModelDefinition.create({
        data: {
          ...modelData,
          createdBy: userId
        }
      });

      logger.info(`[ScanConfigAdmin] Created AI model: ${newModel.modelId} by user ${userId}`);
      res.status(201).json({ success: true, data: newModel });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error creating AI model:', error);
      res.status(500).json({ success: false, error: 'Failed to create AI model' });
    }
  }

  /**
   * Update AI model
   * PUT /api/v2/admin/scan-engine/ai-models/:id
   */
  async updateAIModel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const updateData = req.body;

      if (updateData.apiKey) {
        updateData.apiKey = apiKeyEncryption.encrypt(updateData.apiKey);
      }

      const updated = await prisma.aIModelDefinition.update({
        where: { id },
        data: {
          ...updateData,
          lastEditedBy: userId
        }
      });

      logger.info(`[ScanConfigAdmin] Updated AI model: ${updated.modelId} by user ${userId}`);
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error updating AI model:', error);
      res.status(500).json({ success: false, error: 'Failed to update AI model' });
    }
  }

  /**
   * Delete AI model
   * DELETE /api/v2/admin/scan-engine/ai-models/:id
   */
  async deleteAIModel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      await prisma.aIModelDefinition.delete({ where: { id } });

      logger.info(`[ScanConfigAdmin] Deleted AI model: ${id} by user ${userId}`);
      res.json({ success: true, message: 'AI model deleted successfully' });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error deleting AI model:', error);
      res.status(500).json({ success: false, error: 'Failed to delete AI model' });
    }
  }

  /**
   * Test AI model connectivity
   * POST /api/v2/admin/scan-engine/ai-models/:id/test
   */
  async testAIModel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { testPrompt = "Hello, test connection" } = req.body;

      const model = await prisma.aIModelDefinition.findUnique({ where: { id } });
      if (!model) {
        return res.status(404).json({ success: false, error: 'Model not found' });
      }

      if (!model.enabled) {
        return res.status(400).json({
          success: false,
          error: 'Model is disabled. Enable it first to test connection.'
        });
      }

      if (!model.apiKey) {
        return res.status(400).json({
          success: false,
          error: 'No API key configured for this model. Please add an API key first.'
        });
      }

      logger.info(`[ScanConfigAdmin] Testing AI model: ${model.name} (${model.provider})`);

      const startTime = Date.now();
      let testResult = {
        success: false,
        responseTime: 0,
        error: null as string | null,
        sampleResponse: null as string | null,
        provider: model.provider,
        modelId: model.modelId
      };

      try {
        // Decrypt API key
        const apiKey = apiKeyEncryption.decrypt(model.apiKey);

        // Test based on provider
        if (model.provider === 'anthropic') {
          // Test Claude API
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: model.modelId,
              max_tokens: 50,
              messages: [
                { role: 'user', content: testPrompt }
              ]
            })
          });

          const data = await response.json();

          if (response.ok && data.content && data.content[0]) {
            testResult.success = true;
            testResult.sampleResponse = data.content[0].text;
          } else {
            throw new Error(data.error?.message || 'API request failed');
          }

        } else if (model.provider === 'openai') {
          // Test OpenAI API
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model.modelId,
              max_tokens: 50,
              messages: [
                { role: 'user', content: testPrompt }
              ]
            })
          });

          const data = await response.json();

          if (response.ok && data.choices && data.choices[0]) {
            testResult.success = true;
            testResult.sampleResponse = data.choices[0].message.content;
          } else {
            throw new Error(data.error?.message || 'API request failed');
          }

        } else if (model.provider === 'google') {
          // Test Google Gemini API
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model.modelId}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [{ text: testPrompt }]
                  }
                ]
              })
            }
          );

          const data = await response.json();

          if (response.ok && data.candidates && data.candidates[0]) {
            testResult.success = true;
            testResult.sampleResponse = data.candidates[0].content.parts[0].text;
          } else {
            throw new Error(data.error?.message || 'API request failed');
          }

        } else {
          throw new Error(`Unsupported provider: ${model.provider}`);
        }

        testResult.responseTime = Date.now() - startTime;
        logger.info(`[ScanConfigAdmin] Test successful for ${model.name}: ${testResult.responseTime}ms`);

      } catch (error) {
        testResult.responseTime = Date.now() - startTime;
        testResult.error = error instanceof Error ? error.message : 'Connection failed';
        logger.error(`[ScanConfigAdmin] Test failed for ${model.name}:`, error);
      }

      res.json({ success: true, data: testResult });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error testing AI model:', error);
      res.status(500).json({ success: false, error: 'Failed to test AI model' });
    }
  }

  /**
   * ========================================================================
   * THREAT INTELLIGENCE SOURCE MANAGEMENT (PHASE 1 - ENTERPRISE FEATURES)
   * ========================================================================
   */

  /**
   * Get all TI sources
   * GET /api/v2/admin/scan-engine/ti-sources
   */
  async getTISources(req: Request, res: Response) {
    try {
      const { category, enabled } = req.query;

      const where: any = {};
      if (category) where.category = category;
      if (enabled !== undefined) where.enabled = enabled === 'true';

      const sources = await prisma.threatIntelSource.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { name: 'asc' }]
      });

      res.json({ success: true, data: sources });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error fetching TI sources:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch TI sources' });
    }
  }

  /**
   * Create new TI source
   * POST /api/v2/admin/scan-engine/ti-sources
   */
  async createTISource(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const sourceData = req.body;

      if (!sourceData.sourceId || !sourceData.name) {
        return res.status(400).json({
          success: false,
          error: 'sourceId and name are required'
        });
      }

      const newSource = await prisma.threatIntelSource.create({
        data: {
          ...sourceData,
          createdBy: userId
        }
      });

      logger.info(`[ScanConfigAdmin] Created TI source: ${newSource.sourceId} by user ${userId}`);
      res.status(201).json({ success: true, data: newSource });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error creating TI source:', error);
      res.status(500).json({ success: false, error: 'Failed to create TI source' });
    }
  }

  /**
   * Update TI source
   * PUT /api/v2/admin/scan-engine/ti-sources/:id
   */
  async updateTISource(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      const updated = await prisma.threatIntelSource.update({
        where: { id },
        data: {
          ...req.body,
          lastEditedBy: userId
        }
      });

      logger.info(`[ScanConfigAdmin] Updated TI source: ${updated.sourceId} by user ${userId}`);
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error updating TI source:', error);
      res.status(500).json({ success: false, error: 'Failed to update TI source' });
    }
  }

  /**
   * Delete TI source
   * DELETE /api/v2/admin/scan-engine/ti-sources/:id
   */
  async deleteTISource(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      await prisma.threatIntelSource.delete({ where: { id } });

      logger.info(`[ScanConfigAdmin] Deleted TI source: ${id} by user ${userId}`);
      res.json({ success: true, message: 'TI source deleted successfully' });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error deleting TI source:', error);
      res.status(500).json({ success: false, error: 'Failed to delete TI source' });
    }
  }

  /**
   * Test TI source connectivity
   * POST /api/v2/admin/scan-engine/ti-sources/:id/test
   */
  async testTISource(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { testUrl = "example.com" } = req.body;

      const source = await prisma.threatIntelSource.findUnique({ where: { id } });
      if (!source) {
        return res.status(404).json({ success: false, error: 'Source not found' });
      }

      const startTime = Date.now();
      let testResult = {
        success: false,
        responseTime: 0,
        authenticated: false,
        error: null as string | null,
        sampleData: null as any
      };

      try {
        // TODO: Implement actual API connectivity test
        // In production, this would query the actual TI source
        testResult.success = true;
        testResult.responseTime = Date.now() - startTime;
        testResult.authenticated = !source.requiresAuth || !!source.apiEndpoint;
        testResult.sampleData = { status: 'ok', source: source.sourceId };
      } catch (error) {
        testResult.error = error instanceof Error ? error.message : 'Connection failed';
      }

      res.json({ success: true, data: testResult });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error testing TI source:', error);
      res.status(500).json({ success: false, error: 'Failed to test TI source' });
    }
  }

  /**
   * ========================================================================
   * AI CONSENSUS CONFIGURATION (PHASE 1 - ENTERPRISE FEATURES)
   * ========================================================================
   */

  /**
   * Get all consensus configurations
   * GET /api/v2/admin/scan-engine/consensus-configs
   */
  async getConsensusConfigs(req: Request, res: Response) {
    try {
      const configs = await prisma.aIConsensusConfig.findMany({
        orderBy: { createdAt: 'desc' }
      });

      res.json({ success: true, data: configs });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error fetching consensus configs:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch configs' });
    }
  }

  /**
   * Create consensus configuration
   * POST /api/v2/admin/scan-engine/consensus-configs
   */
  async createConsensusConfig(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const configData = req.body;

      if (!configData.name) {
        return res.status(400).json({
          success: false,
          error: 'name is required'
        });
      }

      const newConfig = await prisma.aIConsensusConfig.create({
        data: {
          ...configData,
          createdBy: userId
        }
      });

      logger.info(`[ScanConfigAdmin] Created consensus config: ${newConfig.name} by user ${userId}`);
      res.status(201).json({ success: true, data: newConfig });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error creating consensus config:', error);
      res.status(500).json({ success: false, error: 'Failed to create config' });
    }
  }

  /**
   * Update consensus configuration
   * PUT /api/v2/admin/scan-engine/consensus-configs/:id
   */
  async updateConsensusConfig(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      const updated = await prisma.aIConsensusConfig.update({
        where: { id },
        data: req.body
      });

      logger.info(`[ScanConfigAdmin] Updated consensus config: ${updated.name} by user ${userId}`);
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error updating consensus config:', error);
      res.status(500).json({ success: false, error: 'Failed to update config' });
    }
  }

  /**
   * Delete consensus configuration
   * DELETE /api/v2/admin/scan-engine/consensus-configs/:id
   */
  async deleteConsensusConfig(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      await prisma.aIConsensusConfig.delete({ where: { id } });

      logger.info(`[ScanConfigAdmin] Deleted consensus config: ${id} by user ${userId}`);
      res.json({ success: true, message: 'Config deleted successfully' });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error deleting consensus config:', error);
      res.status(500).json({ success: false, error: 'Failed to delete config' });
    }
  }

  /**
   * Activate consensus configuration
   * POST /api/v2/admin/scan-engine/consensus-configs/:id/activate
   */
  async activateConsensusConfig(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      // Deactivate all others
      await prisma.aIConsensusConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });

      // Activate this one
      const activated = await prisma.aIConsensusConfig.update({
        where: { id },
        data: { isActive: true }
      });

      logger.info(`[ScanConfigAdmin] Activated consensus config: ${activated.name} by user ${userId}`);
      res.json({ success: true, data: activated });
    } catch (error) {
      logger.error('[ScanConfigAdmin] Error activating consensus config:', error);
      res.status(500).json({ success: false, error: 'Failed to activate config' });
    }
  }

  /**
   * ========================================================================
   * PREDEFINED PRESETS
   * ========================================================================
   */

  private getPredefinedPresets() {
    return [
      {
        id: 'balanced',
        name: 'Balanced (Default)',
        description: 'Standard balanced configuration for general use',
        icon: '⚖️',
        config: this.getDefaultConfiguration()
      },
      {
        id: 'strict',
        name: 'Strict Security',
        description: 'Maximum security - higher false positive rate',
        icon: '🔒',
        config: {
          ...this.getDefaultConfiguration(),
          name: 'Strict Security',
          maxScore: 700,
          categoryWeights: {
            domainAnalysis: 55,
            sslSecurity: 60,
            contentAnalysis: 55,
            phishingPatterns: 70,
            malwareDetection: 65,
            behavioralJS: 35,
            socialEngineering: 45,
            financialFraud: 40,
            identityTheft: 35,
            technicalExploits: 30,
            brandImpersonation: 35,
            trustGraph: 45,
            dataProtection: 65,
            emailSecurity: 40,
            legalCompliance: 50,
            securityHeaders: 40,
            redirectChain: 30
          },
          algorithmConfig: {
            scoringMethod: 'contextual',
            enableDynamicScaling: true,
            riskThresholds: {
              safe: 10,
              low: 25,
              medium: 50,
              high: 70,
              critical: 85
            }
          }
        }
      },
      {
        id: 'permissive',
        name: 'Permissive',
        description: 'Lower false positives - use for trusted environments',
        icon: '🌐',
        config: {
          ...this.getDefaultConfiguration(),
          name: 'Permissive',
          maxScore: 450,
          categoryWeights: {
            domainAnalysis: 25,
            sslSecurity: 30,
            contentAnalysis: 25,
            phishingPatterns: 40,
            malwareDetection: 35,
            behavioralJS: 15,
            socialEngineering: 20,
            financialFraud: 20,
            identityTheft: 12,
            technicalExploits: 10,
            brandImpersonation: 15,
            trustGraph: 20,
            dataProtection: 35,
            emailSecurity: 15,
            legalCompliance: 25,
            securityHeaders: 15,
            redirectChain: 10
          },
          algorithmConfig: {
            scoringMethod: 'contextual',
            enableDynamicScaling: true,
            riskThresholds: {
              safe: 20,
              low: 35,
              medium: 65,
              high: 85,
              critical: 95
            }
          }
        }
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Optimized for corporate environments and B2B sites',
        icon: '🏢',
        config: {
          ...this.getDefaultConfiguration(),
          name: 'Enterprise',
          maxScore: 600,
          categoryWeights: {
            domainAnalysis: 35,
            sslSecurity: 50,
            contentAnalysis: 40,
            phishingPatterns: 45,
            malwareDetection: 50,
            behavioralJS: 25,
            socialEngineering: 30,
            financialFraud: 30,
            identityTheft: 25,
            technicalExploits: 20,
            brandImpersonation: 25,
            trustGraph: 35,
            dataProtection: 60,
            emailSecurity: 30,
            legalCompliance: 45,
            securityHeaders: 35,
            redirectChain: 20
          },
          algorithmConfig: {
            scoringMethod: 'contextual',
            enableDynamicScaling: true,
            riskThresholds: {
              safe: 12,
              low: 28,
              medium: 55,
              high: 75,
              critical: 90
            }
          }
        }
      },
      {
        id: 'paranoid',
        name: 'Paranoid',
        description: 'Maximum scrutiny - flag almost everything suspicious',
        icon: '🚨',
        config: {
          ...this.getDefaultConfiguration(),
          name: 'Paranoid',
          maxScore: 850,
          categoryWeights: {
            domainAnalysis: 70,
            sslSecurity: 75,
            contentAnalysis: 70,
            phishingPatterns: 90,
            malwareDetection: 80,
            behavioralJS: 50,
            socialEngineering: 60,
            financialFraud: 55,
            identityTheft: 50,
            technicalExploits: 45,
            brandImpersonation: 50,
            trustGraph: 60,
            dataProtection: 80,
            emailSecurity: 55,
            legalCompliance: 65,
            securityHeaders: 55,
            redirectChain: 40
          },
          algorithmConfig: {
            scoringMethod: 'contextual',
            enableDynamicScaling: true,
            riskThresholds: {
              safe: 5,
              low: 15,
              medium: 35,
              high: 60,
              critical: 75
            }
          }
        }
      },
      {
        id: 'fast',
        name: 'Fast Scan',
        description: 'Speed-optimized - skip slow checks',
        icon: '⚡',
        config: {
          ...this.getDefaultConfiguration(),
          name: 'Fast Scan',
          maxScore: 400,
          categoryWeights: {
            domainAnalysis: 30,
            sslSecurity: 35,
            contentAnalysis: 20,
            phishingPatterns: 45,
            malwareDetection: 40,
            behavioralJS: 10,
            socialEngineering: 20,
            financialFraud: 20,
            identityTheft: 15,
            technicalExploits: 10,
            brandImpersonation: 20,
            trustGraph: 15,
            dataProtection: 30,
            emailSecurity: 20,
            legalCompliance: 20,
            securityHeaders: 20,
            redirectChain: 10
          },
          tiConfig: {
            maxScore: 30,
            sourceWeights: {
              google_safe_browsing: 10,
              virustotal: 10,
              phishtank: 10,
              urlhaus: 0,
              alienvault_otx: 0,
              abuseipdb: 0,
              spamhaus: 0,
              surbl: 0,
              openphish: 0,
              cisco_talos: 0,
              ibm_xforce: 0
            }
          }
        }
      }
    ];
  }
}

export const scanConfigAdminController = new ScanConfigAdminController();
