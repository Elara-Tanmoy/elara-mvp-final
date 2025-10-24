/**
 * BEHAVIORAL ANALYSIS API CONTROLLER
 *
 * Receives and processes behavior reports from browser extension
 */

import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

export class BehaviorController {
  /**
   * POST /api/v2/behavior/report
   * Receive behavior report from browser extension
   */
  async reportBehavior(req: Request, res: Response): Promise<void> {
    try {
      const { url, behaviors, riskScore, timestamp, userAgent } = req.body;

      if (!url || !behaviors) {
        res.status(400).json({
          success: false,
          error: 'url and behaviors are required',
        });
        return;
      }

      logger.info(`[BehaviorAPI] Report received for: ${url} (Risk: ${riskScore}/40)`);

      // Store behavior report in database (optional - for analytics)
      // For MVP, we'll just log and acknowledge
      // In production, you'd store this in a BehaviorReport table

      // Log significant findings
      if (behaviors.countdownTimers?.isFake) {
        logger.warn(`⚠️ Fake countdown timer detected: ${url}`);
      }
      if (behaviors.clipboardAccess?.modified) {
        logger.warn(`⚠️ Clipboard hijacking detected: ${url}`);
      }
      if (behaviors.redirects?.suspicious) {
        logger.warn(`⚠️ Suspicious redirect chain detected: ${url}`);
      }

      res.json({
        success: true,
        message: 'Behavior report received',
        riskScore,
        recommendations: this.generateRecommendations(behaviors, riskScore),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[BehaviorAPI] Failed to process behavior report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process behavior report',
        details: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/v2/behavior/stats/:domain
   * Get aggregated behavior statistics for a domain
   */
  async getDomainBehaviorStats(req: Request, res: Response): Promise<void> {
    try {
      const { domain } = req.params;

      // For MVP, return mock data
      // In production, you'd query BehaviorReport table

      res.json({
        success: true,
        domain,
        stats: {
          totalReports: 0,
          avgRiskScore: 0,
          commonBehaviors: [],
          lastReported: null,
        },
        message: 'Behavior statistics (MVP - data collection in progress)',
      });
    } catch (error) {
      logger.error('[BehaviorAPI] Failed to get behavior stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get behavior statistics',
      });
    }
  }

  /**
   * Generate recommendations based on detected behaviors
   */
  private generateRecommendations(behaviors: any, riskScore: number): string[] {
    const recommendations: string[] = [];

    if (riskScore >= 30) {
      recommendations.push('⚠️ CRITICAL: Leave this website immediately');
      recommendations.push('This site exhibits multiple high-risk scam behaviors');
    } else if (riskScore >= 15) {
      recommendations.push('⚠️ WARNING: Exercise extreme caution on this site');
      recommendations.push('Do not enter sensitive information');
    }

    if (behaviors.countdownTimers?.isFake) {
      recommendations.push('Fake countdown timer detected - ignore urgency tactics');
    }

    if (behaviors.clipboardAccess?.modified) {
      recommendations.push('Do NOT paste cryptocurrency addresses or sensitive data');
    }

    if (behaviors.redirects?.suspicious) {
      recommendations.push('Multiple redirects detected - verify you\'re on the correct site');
    }

    if (behaviors.hiddenFields?.count > 0) {
      recommendations.push('Hidden form fields detected - avoid submitting forms');
    }

    if (behaviors.popups?.count >= 3) {
      recommendations.push('Aggressive popup behavior - likely scam site');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ No critical behavioral issues detected');
    }

    return recommendations;
  }
}

export const behaviorController = new BehaviorController();
