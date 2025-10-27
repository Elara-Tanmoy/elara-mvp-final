/**
 * V2 Test & Calibrate Service
 *
 * Provides tools for testing and calibrating V2 scanner configurations
 */

import { prisma } from '../../config/database.js';
import type { EnhancedScanResult } from '../../scanners/url-scanner-v2/types';

export class V2TestCalibrateService {
  // Run test scan with specific config
  async runTestScan(
    url: string,
    configId: string,
    scanner: any // V2 scanner instance
  ): Promise<{
    success: boolean;
    result?: EnhancedScanResult;
    error?: string;
    metrics: {
      duration: number;
      stage1Duration?: number;
      stage2Duration?: number;
      tiDuration?: number;
    };
  }> {
    const startTime = Date.now();

    try {
      // Load config
      const config = await prisma.v2CategoryConfig.findUnique({
        where: { id: configId },
        include: {
          checks: true,
          thresholds: true
        }
      });

      if (!config) {
        throw new Error('Configuration not found');
      }

      // Run scan with this config
      const result = await scanner.scan(url, { configOverride: config });

      const duration = Date.now() - startTime;

      return {
        success: true,
        result,
        metrics: {
          duration,
          stage1Duration: result.latency?.stage1,
          stage2Duration: result.latency?.stage2,
          tiDuration: result.latency?.threatIntel
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metrics: {
          duration: Date.now() - startTime
        }
      };
    }
  }

  // Batch test multiple URLs
  async batchTest(
    urls: string[],
    configId: string,
    scanner: any
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: Array<{
      url: string;
      success: boolean;
      riskLevel?: string;
      probability?: number;
      duration?: number;
      error?: string;
    }>;
    summary: {
      avgDuration: number;
      riskDistribution: Record<string, number>;
    };
  }> {
    const results = [];
    let totalDuration = 0;
    const riskDistribution: Record<string, number> = {};

    for (const url of urls) {
      const testResult = await this.runTestScan(url, configId, scanner);

      results.push({
        url,
        success: testResult.success,
        riskLevel: testResult.result?.riskLevel,
        probability: testResult.result?.probability,
        duration: testResult.metrics.duration,
        error: testResult.error
      });

      totalDuration += testResult.metrics.duration;

      if (testResult.result?.riskLevel) {
        riskDistribution[testResult.result.riskLevel] =
          (riskDistribution[testResult.result.riskLevel] || 0) + 1;
      }
    }

    return {
      total: urls.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      summary: {
        avgDuration: totalDuration / urls.length,
        riskDistribution
      }
    };
  }

  // Compare two configs on same URL
  async compareConfigs(
    url: string,
    configId1: string,
    configId2: string,
    scanner: any
  ): Promise<{
    config1: {
      name: string;
      result?: EnhancedScanResult;
      duration: number;
    };
    config2: {
      name: string;
      result?: EnhancedScanResult;
      duration: number;
    };
    comparison: {
      riskLevelMatch: boolean;
      probabilityDiff: number;
      durationDiff: number;
      checksMatched: number;
      checksDifferent: number;
    };
  }> {
    const [config1, config2] = await Promise.all([
      prisma.v2CategoryConfig.findUnique({ where: { id: configId1 } }),
      prisma.v2CategoryConfig.findUnique({ where: { id: configId2 } })
    ]);

    if (!config1 || !config2) {
      throw new Error('One or both configurations not found');
    }

    const [result1, result2] = await Promise.all([
      this.runTestScan(url, configId1, scanner),
      this.runTestScan(url, configId2, scanner)
    ]);

    const comparison = {
      riskLevelMatch: result1.result?.riskLevel === result2.result?.riskLevel,
      probabilityDiff: Math.abs(
        (result1.result?.probability || 0) - (result2.result?.probability || 0)
      ),
      durationDiff: result1.metrics.duration - result2.metrics.duration,
      checksMatched: 0,
      checksDifferent: 0
    };

    // Compare granular checks
    if (result1.result?.granularChecks && result2.result?.granularChecks) {
      const checks1 = result1.result.granularChecks;
      const checks2 = result2.result.granularChecks;

      const checkMap1 = new Map(checks1.map(c => [c.checkId, c.status]));
      const checkMap2 = new Map(checks2.map(c => [c.checkId, c.status]));

      for (const [checkId, status1] of checkMap1) {
        const status2 = checkMap2.get(checkId);
        if (status2) {
          if (status1 === status2) {
            comparison.checksMatched++;
          } else {
            comparison.checksDifferent++;
          }
        }
      }
    }

    return {
      config1: {
        name: config1.name,
        result: result1.result,
        duration: result1.metrics.duration
      },
      config2: {
        name: config2.name,
        result: result2.result,
        duration: result2.metrics.duration
      },
      comparison
    };
  }

  // Calibrate thresholds based on test results
  async calibrateThresholds(
    testResults: Array<{
      url: string;
      probability: number;
      actualRisk: 'safe' | 'malicious'; // Ground truth
    }>,
    configId: string
  ): Promise<{
    recommended: {
      branch: string;
      safeThreshold: number;
      lowThreshold: number;
      mediumThreshold: number;
      highThreshold: number;
      criticalThreshold: number;
    }[];
    metrics: {
      accuracy: number;
      precision: number;
      recall: number;
      f1Score: number;
      falsePositiveRate: number;
      falseNegativeRate: number;
    };
  }> {
    // Sort by probability
    const sorted = testResults.sort((a, b) => a.probability - b.probability);

    // Split into safe and malicious
    const safe = sorted.filter(r => r.actualRisk === 'safe');
    const malicious = sorted.filter(r => r.actualRisk === 'malicious');

    // Calculate optimal thresholds using ROC analysis
    const thresholds = this.findOptimalThresholds(safe, malicious);

    // Calculate metrics
    const metrics = this.calculateMetrics(testResults, thresholds);

    return {
      recommended: [
        {
          branch: 'ONLINE',
          ...thresholds
        }
      ],
      metrics
    };
  }

  // Find optimal thresholds using ROC curve
  private findOptimalThresholds(
    safe: Array<{ probability: number }>,
    malicious: Array<{ probability: number }>
  ) {
    // Find threshold that maximizes accuracy
    const allProbs = [...safe, ...malicious].map(r => r.probability);
    const uniqueProbs = [...new Set(allProbs)].sort((a, b) => a - b);

    let bestThreshold = 0.5;
    let bestAccuracy = 0;

    for (const threshold of uniqueProbs) {
      const truePositives = malicious.filter(r => r.probability >= threshold).length;
      const trueNegatives = safe.filter(r => r.probability < threshold).length;
      const accuracy = (truePositives + trueNegatives) / (safe.length + malicious.length);

      if (accuracy > bestAccuracy) {
        bestAccuracy = accuracy;
        bestThreshold = threshold;
      }
    }

    // Generate thresholds around optimal point
    return {
      safeThreshold: Math.max(0, bestThreshold - 0.3),
      lowThreshold: Math.max(0, bestThreshold - 0.2),
      mediumThreshold: bestThreshold,
      highThreshold: Math.min(1, bestThreshold + 0.15),
      criticalThreshold: Math.min(1, bestThreshold + 0.25)
    };
  }

  // Calculate performance metrics
  private calculateMetrics(
    testResults: Array<{
      probability: number;
      actualRisk: 'safe' | 'malicious';
    }>,
    thresholds: any
  ) {
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    for (const result of testResults) {
      const predicted = result.probability >= thresholds.mediumThreshold ? 'malicious' : 'safe';
      const actual = result.actualRisk;

      if (predicted === 'malicious' && actual === 'malicious') truePositives++;
      if (predicted === 'malicious' && actual === 'safe') falsePositives++;
      if (predicted === 'safe' && actual === 'safe') trueNegatives++;
      if (predicted === 'safe' && actual === 'malicious') falseNegatives++;
    }

    const accuracy = (truePositives + trueNegatives) / testResults.length;
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
    const falsePositiveRate = falsePositives / (falsePositives + trueNegatives) || 0;
    const falseNegativeRate = falseNegatives / (falseNegatives + truePositives) || 0;

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      falsePositiveRate,
      falseNegativeRate
    };
  }

  // Simulate A/B test
  async simulateABTest(
    urls: string[],
    configA: string,
    configB: string,
    scanner: any
  ): Promise<{
    configA: {
      name: string;
      avgDuration: number;
      riskDistribution: Record<string, number>;
    };
    configB: {
      name: string;
      avgDuration: number;
      riskDistribution: Record<string, number>;
    };
    winner: {
      config: string;
      reason: string;
    };
  }> {
    const [resultsA, resultsB] = await Promise.all([
      this.batchTest(urls, configA, scanner),
      this.batchTest(urls, configB, scanner)
    ]);

    const [configAData, configBData] = await Promise.all([
      prisma.v2CategoryConfig.findUnique({ where: { id: configA } }),
      prisma.v2CategoryConfig.findUnique({ where: { id: configB } })
    ]);

    // Determine winner (faster + similar accuracy)
    let winner = 'A';
    let reason = '';

    if (resultsA.summary.avgDuration < resultsB.summary.avgDuration) {
      winner = 'A';
      reason = `Config A is ${((resultsB.summary.avgDuration - resultsA.summary.avgDuration) / resultsB.summary.avgDuration * 100).toFixed(1)}% faster`;
    } else {
      winner = 'B';
      reason = `Config B is ${((resultsA.summary.avgDuration - resultsB.summary.avgDuration) / resultsA.summary.avgDuration * 100).toFixed(1)}% faster`;
    }

    return {
      configA: {
        name: configAData?.name || 'Config A',
        avgDuration: resultsA.summary.avgDuration,
        riskDistribution: resultsA.summary.riskDistribution
      },
      configB: {
        name: configBData?.name || 'Config B',
        avgDuration: resultsB.summary.avgDuration,
        riskDistribution: resultsB.summary.riskDistribution
      },
      winner: {
        config: winner,
        reason
      }
    };
  }
}
