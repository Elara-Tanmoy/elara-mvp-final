import { Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { recoverySupportService } from '../services/analyzers/recovery-support.service.js';
import { bigQueryLoggerService } from '../services/logging/bigquery-logger.service.js';

/**
 * Recovery Support Controller
 * Handles scam victim support and recovery planning
 */

export interface IncidentReportRequest {
  scamType: 'phishing' | 'investment' | 'romance' | 'tech_support' | 'lottery' | 'employment' | 'other';
  description: string;
  financialLoss?: number;
  personalInfoShared?: string[];
  whenOccurred?: string;
  alreadyReported?: boolean;
  emotionalState?: string;
}

export class RecoveryController {
  /**
   * Submit scam incident report
   * POST /api/v2/recovery/incident
   */
  async reportIncident(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { userId } = req.user as any || { userId: 'anonymous' };
      const requestData: IncidentReportRequest = req.body;

      // Validate request
      if (!requestData.scamType || !requestData.description) {
        res.status(400).json({
          success: false,
          error: 'scamType and description are required'
        });
        return;
      }

      if (requestData.description.length > 5000) {
        res.status(400).json({
          success: false,
          error: 'Description too long (max 5,000 characters)'
        });
        return;
      }

      logger.info(`Incident reported by user ${userId}: ${requestData.scamType}`);

      // Build incident data
      const incidentData = {
        scamType: requestData.scamType,
        description: requestData.description,
        financialLoss: requestData.financialLoss || 0,
        personalInfoShared: requestData.personalInfoShared || [],
        whenOccurred: requestData.whenOccurred || 'recently',
        alreadyReported: requestData.alreadyReported || false,
        emotionalState: requestData.emotionalState || ''
      };

      // Assess emotional state from description and emotionalState field
      const emotionalText = `${incidentData.description} ${incidentData.emotionalState}`;
      const emotionalAssessment = recoverySupportService.assessEmotionalState(emotionalText);

      // Generate personalized recovery plan
      const recoveryPlan = recoverySupportService.generateRecoveryPlan({
        ...incidentData,
        emotionalAssessment
      });

      // Get relevant resources
      const resources = recoverySupportService.getRelevantResources({
        scamType: incidentData.scamType,
        financialLoss: incidentData.financialLoss,
        emotionalDistress: emotionalAssessment.distressLevel
      });

      // Schedule follow-ups
      const followUps = recoverySupportService.scheduleFollowUps(userId, {
        scamType: incidentData.scamType,
        emotionalDistress: emotionalAssessment.distressLevel,
        reportedAt: new Date()
      });

      // Calculate latency
      const latency = Date.now() - startTime;

      // Log to BigQuery for ML training (async, don't await)
      bigQueryLoggerService.logAnalysis({
        userId,
        type: 'recovery',
        input: {
          text: requestData.description,
          type: 'incident_report',
          length: requestData.description.length,
          metadata: {
            scamType: requestData.scamType,
            financialLoss: requestData.financialLoss,
            distressLevel: emotionalAssessment.distressLevel
          }
        },
        verdict: emotionalAssessment.distressLevel,
        specificData: {
          scamType: requestData.scamType,
          emotionalAssessment,
          recoverySteps: recoveryPlan.steps.length,
          suicidalIdeation: emotionalAssessment.suicidalIdeation
        },
        latency,
        cost: 0,
        timestamp: new Date()
      }).catch(err => logger.error('BigQuery logging failed:', err));

      // CRITICAL: If suicidal ideation detected, log urgent alert
      if (emotionalAssessment.suicidalIdeation) {
        logger.error(`🚨 CRITICAL: Suicidal ideation detected for user ${userId}. Crisis intervention needed.`);
        // In production, would trigger immediate alert to crisis team
      }

      // Return response
      res.status(200).json({
        success: true,
        data: {
          incidentId: `INC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          emotionalAssessment,
          recoveryPlan,
          resources,
          followUps,
          metadata: {
            reportedAt: new Date().toISOString(),
            latency,
            priorityLevel: emotionalAssessment.suicidalIdeation ? 'CRITICAL' :
                          emotionalAssessment.distressLevel === 'severe' ? 'HIGH' :
                          emotionalAssessment.distressLevel === 'high' ? 'MEDIUM' : 'NORMAL'
          }
        }
      });

    } catch (error) {
      logger.error('Report incident error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to report incident',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get recovery resources
   * GET /api/v2/recovery/resources
   */
  async getResources(req: Request, res: Response): Promise<void> {
    try {
      const { type, available24_7 } = req.query;

      logger.info(`Resources requested: type=${type}, 24/7=${available24_7}`);

      // Get all resources
      let resources = recoverySupportService.getAllResources();

      // Filter by type if provided
      if (type && typeof type === 'string') {
        resources = resources.filter(r => r.type === type);
      }

      // Filter by 24/7 availability if provided
      if (available24_7 === 'true') {
        resources = resources.filter(r => r.available24_7);
      }

      res.status(200).json({
        success: true,
        data: {
          resources,
          totalResources: resources.length,
          categories: ['reporting', 'financial', 'emotional', 'legal']
        }
      });

    } catch (error) {
      logger.error('Get resources error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch resources',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get specific resource by ID
   * GET /api/v2/recovery/resources/:resourceId
   */
  async getResource(req: Request, res: Response): Promise<void> {
    try {
      const { resourceId } = req.params;

      logger.info(`Resource ${resourceId} requested`);

      const resource = recoverySupportService.getResourceById(resourceId);

      if (!resource) {
        res.status(404).json({
          success: false,
          error: 'Resource not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { resource }
      });

    } catch (error) {
      logger.error('Get resource error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch resource',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Record follow-up check-in
   * POST /api/v2/recovery/followup
   */
  async recordFollowUp(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any || { userId: 'anonymous' };
      const { incidentId, status, notes, emotionalState } = req.body;

      // Validate request
      if (!incidentId) {
        res.status(400).json({
          success: false,
          error: 'incidentId is required'
        });
        return;
      }

      logger.info(`Follow-up recorded by user ${userId} for incident ${incidentId}`);

      // Reassess emotional state if provided
      let emotionalAssessment = null;
      if (emotionalState) {
        emotionalAssessment = recoverySupportService.assessEmotionalState(emotionalState);
      }

      // Record follow-up (would save to database)
      const followUp = {
        incidentId,
        userId,
        recordedAt: new Date(),
        status: status || 'in_progress',
        notes: notes || '',
        emotionalAssessment
      };

      res.status(200).json({
        success: true,
        data: {
          followUp,
          message: 'Thank you for the update. We\'re here to support you.'
        }
      });

    } catch (error) {
      logger.error('Record follow-up error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record follow-up',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get user's incident history
   * GET /api/v2/recovery/incidents
   */
  async getIncidents(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any || { userId: 'anonymous' };

      logger.info(`Incident history requested by user ${userId}`);

      // Get incidents from database (would need implementation)
      // For now, return empty array
      const incidents: any[] = [];

      res.status(200).json({
        success: true,
        data: {
          incidents,
          totalIncidents: incidents.length
        }
      });

    } catch (error) {
      logger.error('Get incidents error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch incidents',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get recovery statistics
   * GET /api/v2/recovery/stats
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any || { userId: 'anonymous' };

      logger.info(`Recovery stats requested by user ${userId}`);

      // Get stats from database (would need implementation)
      const stats = {
        totalIncidents: 0,
        totalFinancialLoss: 0,
        mostCommonScamType: 'phishing',
        recoveryStepsCompleted: 0,
        totalRecoverySteps: 0,
        completionRate: 0,
        followUpsScheduled: 0,
        followUpsCompleted: 0
      };

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Get recovery stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get crisis hotlines (quick access)
   * GET /api/v2/recovery/crisis
   */
  async getCrisisHotlines(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Crisis hotlines requested');

      const hotlines = [
        {
          name: 'National Suicide Prevention Lifeline',
          phone: '988',
          description: 'Free, confidential support 24/7',
          available24_7: true,
          url: 'https://988lifeline.org'
        },
        {
          name: 'Crisis Text Line',
          phone: '741741',
          sms: 'Text HOME to 741741',
          description: 'Free, 24/7 crisis support via text',
          available24_7: true,
          url: 'https://www.crisistextline.org'
        },
        {
          name: 'SAMHSA National Helpline',
          phone: '1-800-662-4357',
          description: 'Mental health and substance abuse support',
          available24_7: true,
          url: 'https://www.samhsa.gov/find-help/national-helpline'
        }
      ];

      res.status(200).json({
        success: true,
        data: {
          hotlines,
          message: 'If you are in immediate danger, please call 911.'
        }
      });

    } catch (error) {
      logger.error('Get crisis hotlines error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch crisis hotlines',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get success stories (for encouragement)
   * GET /api/v2/recovery/stories
   */
  async getSuccessStories(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Success stories requested');

      const stories = [
        {
          id: 'story-1',
          title: 'Sarah Recovered from Romance Scam',
          excerpt: 'After losing $15,000 to a romance scammer, Sarah followed the recovery plan and got help...',
          scamType: 'romance',
          recoveryTime: '6 months',
          financialRecovery: 'Partial - recovered $8,000',
          emotionalRecovery: 'Full recovery with therapy support'
        },
        {
          id: 'story-2',
          title: 'John Stopped Tech Support Scam',
          excerpt: 'John recognized the scam in time and prevented $5,000 in losses...',
          scamType: 'tech_support',
          recoveryTime: '1 month',
          financialRecovery: 'Full - no losses',
          emotionalRecovery: 'Minimal impact, increased awareness'
        },
        {
          id: 'story-3',
          title: 'Maria Recovered from Investment Fraud',
          excerpt: 'Maria reported to authorities and recovered 70% of her investment...',
          scamType: 'investment',
          recoveryTime: '12 months',
          financialRecovery: 'Significant - recovered $35,000 of $50,000',
          emotionalRecovery: 'Ongoing therapy, strong support system'
        }
      ];

      res.status(200).json({
        success: true,
        data: {
          stories,
          totalStories: stories.length,
          message: 'Recovery is possible. You are not alone.'
        }
      });

    } catch (error) {
      logger.error('Get success stories error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch success stories',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const recoveryController = new RecoveryController();
