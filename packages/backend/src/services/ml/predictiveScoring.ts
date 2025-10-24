/**
 * ELARA PREDICTIVE SCAM SCORING SERVICE
 *
 * Temporal Analysis and Anomaly Detection
 *
 * This service predicts if legitimate sites will become compromised by analyzing:
 * - Historical domain changes (IP, ownership, content)
 * - Temporal behavior patterns
 * - Anomaly detection in traffic and infrastructure
 * - Risk trajectory over time
 *
 * FREE ENTERPRISE-GRADE SOLUTION:
 * Uses PostgreSQL time-series data + statistical anomaly detection
 * (No external ML libraries required - pure TypeScript implementation)
 */

import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import crypto from 'crypto';

export interface DomainHistorySnapshot {
  domain: string;
  ipAddress?: string;
  registrar?: string;
  whoisData?: any;
  sslFingerprint?: string;
  contentHash?: string;
  pageTitle?: string;
  technologies?: string[];
  paymentMethods?: string[];
}

export interface TemporalRiskAnalysis {
  domain: string;
  ageInDays: number;
  changeHistory: Array<{
    timestamp: Date;
    changeType: string;
    details: string;
  }>;
  riskTrajectory: {
    current: number; // Current risk probability (0-1)
    trend: 'increasing' | 'decreasing' | 'stable';
    prediction: number; // Predicted risk in 30 days (0-1)
    confidence: number; // Confidence in prediction (0-1)
  };
  anomalies: {
    ownershipChanges: number;
    contentChanges: number;
    ipChanges: number;
    trafficSpikes: number;
  };
  alerts: string[];
  riskScore: number; // 0-20 points (as per enhancement document)
}

export class PredictiveScoringService {
  /**
   * Record a domain snapshot for temporal analysis
   */
  async recordDomainSnapshot(snapshot: DomainHistorySnapshot): Promise<void> {
    try {
      // Get the previous snapshot for comparison
      const previousSnapshot = await prisma.domainHistory.findFirst({
        where: { domain: snapshot.domain },
        orderBy: { timestamp: 'desc' },
      });

      // Detect changes
      const changes = this.detectChanges(previousSnapshot, snapshot);

      // Create new history record
      await prisma.domainHistory.create({
        data: {
          domain: snapshot.domain,
          ipAddress: snapshot.ipAddress,
          registrar: snapshot.registrar,
          whoisData: snapshot.whoisData || {},
          sslFingerprint: snapshot.sslFingerprint,
          contentHash: snapshot.contentHash,
          pageTitle: snapshot.pageTitle,
          technologies: snapshot.technologies || [],
          paymentMethods: snapshot.paymentMethods || [],
          ownershipChange: changes.ownershipChange,
          contentChange: changes.contentChange,
          ipChange: changes.ipChange,
          trafficSpike: false, // Will be updated by traffic monitoring
          riskScore: 0, // Will be calculated later
          anomalyScore: 0.0,
        },
      });

      logger.info(`✅ Domain snapshot recorded for ${snapshot.domain}`);
    } catch (error) {
      logger.error(`Failed to record domain snapshot for ${snapshot.domain}:`, error);
      throw error;
    }
  }

  /**
   * Detect changes between snapshots
   */
  private detectChanges(
    previous: any,
    current: DomainHistorySnapshot
  ): {
    ownershipChange: boolean;
    contentChange: boolean;
    ipChange: boolean;
  } {
    if (!previous) {
      return {
        ownershipChange: false,
        contentChange: false,
        ipChange: false,
      };
    }

    return {
      ownershipChange: previous.registrar !== current.registrar,
      contentChange: previous.contentHash !== current.contentHash,
      ipChange: previous.ipAddress !== current.ipAddress,
    };
  }

  /**
   * Analyze domain's temporal risk
   */
  async analyzeDomainRisk(domain: string): Promise<TemporalRiskAnalysis> {
    try {
      logger.info(`📊 Analyzing temporal risk for ${domain}...`);

      // Get all history records for this domain
      const history = await prisma.domainHistory.findMany({
        where: { domain },
        orderBy: { timestamp: 'asc' },
      });

      if (history.length === 0) {
        return this.getDefaultAnalysis(domain);
      }

      // Calculate domain age
      const firstSeen = history[0].timestamp;
      const ageInDays = Math.floor(
        (Date.now() - firstSeen.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Build change history
      const changeHistory = this.buildChangeHistory(history);

      // Count anomalies
      const anomalies = {
        ownershipChanges: history.filter((h) => h.ownershipChange).length,
        contentChanges: history.filter((h) => h.contentChange).length,
        ipChanges: history.filter((h) => h.ipChange).length,
        trafficSpikes: history.filter((h) => h.trafficSpike).length,
      };

      // Calculate risk trajectory
      const riskTrajectory = this.calculateRiskTrajectory(history, anomalies, ageInDays);

      // Generate alerts
      const alerts = this.generateAlerts(anomalies, ageInDays);

      // Calculate risk score (0-20 points)
      const riskScore = this.calculateRiskScore(anomalies, ageInDays, riskTrajectory);

      return {
        domain,
        ageInDays,
        changeHistory,
        riskTrajectory,
        anomalies,
        alerts,
        riskScore,
      };
    } catch (error) {
      logger.error(`Temporal risk analysis failed for ${domain}:`, error);
      return this.getDefaultAnalysis(domain);
    }
  }

  /**
   * Build chronological change history
   */
  private buildChangeHistory(history: any[]): TemporalRiskAnalysis['changeHistory'] {
    const changes: TemporalRiskAnalysis['changeHistory'] = [];

    for (let i = 1; i < history.length; i++) {
      const current = history[i];
      const changeTypes: string[] = [];

      if (current.ownershipChange) changeTypes.push('Ownership');
      if (current.contentChange) changeTypes.push('Content');
      if (current.ipChange) changeTypes.push('IP Address');
      if (current.trafficSpike) changeTypes.push('Traffic Spike');

      if (changeTypes.length > 0) {
        changes.push({
          timestamp: current.timestamp,
          changeType: changeTypes.join(', '),
          details: `${changeTypes.join(' & ')} changed`,
        });
      }
    }

    return changes;
  }

  /**
   * Calculate risk trajectory using time-series analysis
   */
  private calculateRiskTrajectory(
    history: any[],
    anomalies: TemporalRiskAnalysis['anomalies'],
    ageInDays: number
  ): TemporalRiskAnalysis['riskTrajectory'] {
    // Simple rule-based prediction (can be enhanced with ML later)
    let currentRisk = 0.0;
    let predictedRisk = 0.0;

    // Factor 1: Ownership changes
    if (anomalies.ownershipChanges >= 3) {
      currentRisk += 0.4;
    } else if (anomalies.ownershipChanges >= 1) {
      currentRisk += 0.15;
    }

    // Factor 2: Recent content changes
    const recentChanges = history.slice(-10).filter((h) => h.contentChange).length;
    if (recentChanges >= 5) {
      currentRisk += 0.3;
    } else if (recentChanges >= 2) {
      currentRisk += 0.1;
    }

    // Factor 3: IP changes
    if (anomalies.ipChanges >= 3) {
      currentRisk += 0.2;
    } else if (anomalies.ipChanges >= 1) {
      currentRisk += 0.05;
    }

    // Factor 4: New domain with many changes
    if (ageInDays < 90 && (anomalies.ownershipChanges + anomalies.contentChanges) > 3) {
      currentRisk += 0.25;
    }

    // Cap at 1.0
    currentRisk = Math.min(currentRisk, 1.0);

    // Predict future risk based on trend
    const trend = this.calculateTrend(history);
    if (trend === 'increasing') {
      predictedRisk = Math.min(currentRisk + 0.15, 1.0);
    } else if (trend === 'decreasing') {
      predictedRisk = Math.max(currentRisk - 0.1, 0.0);
    } else {
      predictedRisk = currentRisk;
    }

    // Confidence based on data points
    const confidence = Math.min(history.length / 10, 1.0);

    return {
      current: parseFloat(currentRisk.toFixed(2)),
      trend,
      prediction: parseFloat(predictedRisk.toFixed(2)),
      confidence: parseFloat(confidence.toFixed(2)),
    };
  }

  /**
   * Calculate trend from historical data
   */
  private calculateTrend(history: any[]): 'increasing' | 'decreasing' | 'stable' {
    if (history.length < 3) return 'stable';

    const recentHistory = history.slice(-5);
    const changeCount = recentHistory.filter(
      (h) => h.ownershipChange || h.contentChange || h.ipChange
    ).length;

    const olderHistory = history.slice(-10, -5);
    const oldChangeCount = olderHistory.filter(
      (h) => h.ownershipChange || h.contentChange || h.ipChange
    ).length;

    if (changeCount > oldChangeCount + 1) return 'increasing';
    if (changeCount < oldChangeCount - 1) return 'decreasing';
    return 'stable';
  }

  /**
   * Generate risk alerts
   */
  private generateAlerts(
    anomalies: TemporalRiskAnalysis['anomalies'],
    ageInDays: number
  ): string[] {
    const alerts: string[] = [];

    // Ownership change alerts
    if (anomalies.ownershipChanges >= 3 && ageInDays < 60) {
      alerts.push('⚠️ CRITICAL: Ownership changed 3+ times in 60 days');
    } else if (anomalies.ownershipChanges >= 2) {
      alerts.push('⚠️ WARNING: Multiple ownership changes detected');
    }

    // Content change alerts
    if (anomalies.contentChanges >= 5 && ageInDays < 30) {
      alerts.push('⚠️ CRITICAL: Frequent content changes in new domain');
    } else if (anomalies.contentChanges >= 8) {
      alerts.push('⚠️ WARNING: Numerous content modifications detected');
    }

    // IP change alerts
    if (anomalies.ipChanges >= 3) {
      alerts.push('⚠️ WARNING: Multiple IP address changes (hosting migration or compromise)');
    }

    // New domain with high activity
    if (ageInDays < 30 && (anomalies.ownershipChanges + anomalies.ipChanges) >= 2) {
      alerts.push('⚠️ HIGH RISK: New domain with suspicious infrastructure changes');
    }

    if (alerts.length === 0) {
      alerts.push('✅ No temporal anomalies detected');
    }

    return alerts;
  }

  /**
   * Calculate risk score (0-20 points as per enhancement document)
   */
  private calculateRiskScore(
    anomalies: TemporalRiskAnalysis['anomalies'],
    ageInDays: number,
    trajectory: TemporalRiskAnalysis['riskTrajectory']
  ): number {
    let score = 0;

    // High predicted risk: +20 points
    if (trajectory.prediction > 0.7) {
      score += 20;
    } else if (trajectory.prediction > 0.5) {
      score += 15;
    } else if (trajectory.prediction > 0.3) {
      score += 10;
    }

    // Additional penalties for specific anomalies
    if (anomalies.ownershipChanges >= 3 && ageInDays < 60) {
      score = Math.max(score, 18); // Ensure at least 18 points
    }

    return Math.min(score, 20); // Cap at 20
  }

  /**
   * Get default analysis for domains with no history
   */
  private getDefaultAnalysis(domain: string): TemporalRiskAnalysis {
    return {
      domain,
      ageInDays: 0,
      changeHistory: [],
      riskTrajectory: {
        current: 0.0,
        trend: 'stable',
        prediction: 0.0,
        confidence: 0.0,
      },
      anomalies: {
        ownershipChanges: 0,
        contentChanges: 0,
        ipChanges: 0,
        trafficSpikes: 0,
      },
      alerts: ['No historical data available for temporal analysis'],
      riskScore: 0,
    };
  }

  /**
   * Generate content hash for change detection
   */
  generateContentHash(htmlContent: string): string {
    return crypto.createHash('sha256').update(htmlContent).digest('hex');
  }

  /**
   * Get domain history records
   */
  async getDomainHistory(domain: string, limit: number = 30): Promise<any[]> {
    return await prisma.domainHistory.findMany({
      where: { domain },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}

// Export singleton instance
export const predictiveScoringService = new PredictiveScoringService();
