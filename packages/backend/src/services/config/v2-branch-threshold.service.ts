/**
 * V2 Branch Threshold Service
 */

import { prisma } from '../../config/database.js';

export class V2BranchThresholdService {
  // Create new threshold
  async createThreshold(data: {
    branch: string;
    safeThreshold: number;
    lowThreshold: number;
    mediumThreshold: number;
    highThreshold: number;
    criticalThreshold: number;
    configId: string;
  }) {
    return prisma.v2BranchThreshold.create({
      data
    });
  }

  // Get all thresholds for a config
  async getThresholdsByConfigId(configId: string) {
    return prisma.v2BranchThreshold.findMany({
      where: { configId }
    });
  }

  // Get threshold by branch and config
  async getThresholdByBranch(configId: string, branch: string) {
    return prisma.v2BranchThreshold.findFirst({
      where: { configId, branch }
    });
  }

  // Get threshold by ID
  async getThresholdById(id: string) {
    return prisma.v2BranchThreshold.findUnique({
      where: { id }
    });
  }

  // Update threshold
  async updateThreshold(id: string, data: {
    safeThreshold?: number;
    lowThreshold?: number;
    mediumThreshold?: number;
    highThreshold?: number;
    criticalThreshold?: number;
  }) {
    return prisma.v2BranchThreshold.update({
      where: { id },
      data
    });
  }

  // Delete threshold
  async deleteThreshold(id: string) {
    return prisma.v2BranchThreshold.delete({
      where: { id }
    });
  }

  // Create default thresholds for a config
  async createDefaultThresholds(configId: string) {
    const defaultThresholds = [
      {
        branch: 'ONLINE',
        safeThreshold: 0.15,
        lowThreshold: 0.30,
        mediumThreshold: 0.50,
        highThreshold: 0.75,
        criticalThreshold: 0.90,
        configId
      },
      {
        branch: 'OFFLINE',
        safeThreshold: 0.25,
        lowThreshold: 0.45,
        mediumThreshold: 0.65,
        highThreshold: 0.85,
        criticalThreshold: 0.95,
        configId
      },
      {
        branch: 'PARKED',
        safeThreshold: 0.35,
        lowThreshold: 0.55,
        mediumThreshold: 0.70,
        highThreshold: 0.85,
        criticalThreshold: 0.95,
        configId
      },
      {
        branch: 'WAF',
        safeThreshold: 0.30,
        lowThreshold: 0.50,
        mediumThreshold: 0.70,
        highThreshold: 0.85,
        criticalThreshold: 0.95,
        configId
      },
      {
        branch: 'SINKHOLE',
        safeThreshold: 0.90,
        lowThreshold: 0.95,
        mediumThreshold: 0.97,
        highThreshold: 0.99,
        criticalThreshold: 1.0,
        configId
      }
    ];

    const created = await Promise.all(
      defaultThresholds.map(threshold =>
        prisma.v2BranchThreshold.create({ data: threshold })
      )
    );

    return created;
  }

  // Get risk level based on probability and branch
  getRiskLevel(probability: number, branch: string, thresholds: any): string {
    if (probability < thresholds.safeThreshold) return 'A';
    if (probability < thresholds.lowThreshold) return 'B';
    if (probability < thresholds.mediumThreshold) return 'C';
    if (probability < thresholds.highThreshold) return 'D';
    if (probability < thresholds.criticalThreshold) return 'E';
    return 'F';
  }

  // Validate threshold consistency
  validateThresholds(data: {
    safeThreshold: number;
    lowThreshold: number;
    mediumThreshold: number;
    highThreshold: number;
    criticalThreshold: number;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check order
    if (data.safeThreshold >= data.lowThreshold) {
      errors.push('Safe threshold must be less than low threshold');
    }
    if (data.lowThreshold >= data.mediumThreshold) {
      errors.push('Low threshold must be less than medium threshold');
    }
    if (data.mediumThreshold >= data.highThreshold) {
      errors.push('Medium threshold must be less than high threshold');
    }
    if (data.highThreshold >= data.criticalThreshold) {
      errors.push('High threshold must be less than critical threshold');
    }

    // Check range
    const thresholds = [
      data.safeThreshold,
      data.lowThreshold,
      data.mediumThreshold,
      data.highThreshold,
      data.criticalThreshold
    ];

    for (const threshold of thresholds) {
      if (threshold < 0 || threshold > 1) {
        errors.push('All thresholds must be between 0 and 1');
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Bulk update all thresholds for a config
  async bulkUpdateThresholds(
    configId: string,
    updates: Array<{
      branch: string;
      safeThreshold: number;
      lowThreshold: number;
      mediumThreshold: number;
      highThreshold: number;
      criticalThreshold: number;
    }>
  ) {
    // Validate all thresholds first
    for (const update of updates) {
      const validation = this.validateThresholds(update);
      if (!validation.valid) {
        throw new Error(`Invalid thresholds for ${update.branch}: ${validation.errors.join(', ')}`);
      }
    }

    // Update all thresholds
    const results = await Promise.all(
      updates.map(async update => {
        const existing = await this.getThresholdByBranch(configId, update.branch);
        if (existing) {
          return this.updateThreshold(existing.id, {
            safeThreshold: update.safeThreshold,
            lowThreshold: update.lowThreshold,
            mediumThreshold: update.mediumThreshold,
            highThreshold: update.highThreshold,
            criticalThreshold: update.criticalThreshold
          });
        } else {
          return this.createThreshold({
            ...update,
            configId
          });
        }
      })
    );

    return results;
  }

  // Get threshold summary
  async getThresholdSummary(configId: string) {
    const thresholds = await this.getThresholdsByConfigId(configId);

    return thresholds.map(t => ({
      branch: t.branch,
      ranges: {
        A: `< ${t.safeThreshold}`,
        B: `${t.safeThreshold} - ${t.lowThreshold}`,
        C: `${t.lowThreshold} - ${t.mediumThreshold}`,
        D: `${t.mediumThreshold} - ${t.highThreshold}`,
        E: `${t.highThreshold} - ${t.criticalThreshold}`,
        F: `>= ${t.criticalThreshold}`
      }
    }));
  }
}
