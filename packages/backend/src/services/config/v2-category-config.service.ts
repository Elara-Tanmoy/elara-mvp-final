/**
 * V2 Category Configuration Service
 */

import { prisma } from '../../config/database.js';

export class V2CategoryConfigService {
  // Create new config
  async createConfig(data: {
    name: string;
    description?: string;
    version: string;
    categoryWeights: Record<string, number>;
    createdBy?: string;
  }) {
    return prisma.v2CategoryConfig.create({
      data: {
        ...data,
        isActive: false,
        isDefault: false
      },
      include: {
        checks: true,
        thresholds: true
      }
    });
  }

  // Get all configs
  async getAllConfigs() {
    return prisma.v2CategoryConfig.findMany({
      include: {
        checks: true,
        thresholds: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Get active config
  async getActiveConfig() {
    return prisma.v2CategoryConfig.findFirst({
      where: { isActive: true },
      include: {
        checks: true,
        thresholds: true
      }
    });
  }

  // Get config by ID
  async getConfigById(id: string) {
    return prisma.v2CategoryConfig.findUnique({
      where: { id },
      include: {
        checks: true,
        thresholds: true
      }
    });
  }

  // Activate config
  async activateConfig(id: string) {
    // Deactivate all other configs
    await prisma.v2CategoryConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    // Activate the selected config
    return prisma.v2CategoryConfig.update({
      where: { id },
      data: {
        isActive: true,
        usageCount: { increment: 1 },
        lastUsedAt: new Date()
      }
    });
  }

  // Update config
  async updateConfig(id: string, data: {
    name?: string;
    description?: string;
    categoryWeights?: Record<string, number>;
  }) {
    return prisma.v2CategoryConfig.update({
      where: { id },
      data,
      include: {
        checks: true,
        thresholds: true
      }
    });
  }

  // Delete config
  async deleteConfig(id: string) {
    // Cannot delete active config
    const config = await prisma.v2CategoryConfig.findUnique({
      where: { id }
    });

    if (config?.isActive) {
      throw new Error('Cannot delete active configuration');
    }

    return prisma.v2CategoryConfig.delete({ where: { id } });
  }

  // Duplicate config
  async duplicateConfig(id: string, newName: string, createdBy?: string) {
    const original = await this.getConfigById(id);
    if (!original) {
      throw new Error('Configuration not found');
    }

    // Create new config with same settings
    const newConfig = await prisma.v2CategoryConfig.create({
      data: {
        name: newName,
        description: original.description,
        version: original.version,
        categoryWeights: original.categoryWeights,
        isActive: false,
        isDefault: false,
        createdBy
      }
    });

    // Duplicate checks
    for (const check of original.checks) {
      await prisma.v2CheckConfig.create({
        data: {
          checkId: check.checkId,
          name: check.name,
          category: check.category,
          defaultPoints: check.defaultPoints,
          currentPoints: check.currentPoints,
          maxPoints: check.maxPoints,
          enabled: check.enabled,
          severity: check.severity,
          description: check.description,
          config: check.config,
          configId: newConfig.id
        }
      });
    }

    // Duplicate thresholds
    for (const threshold of original.thresholds) {
      await prisma.v2BranchThreshold.create({
        data: {
          branch: threshold.branch,
          safeThreshold: threshold.safeThreshold,
          lowThreshold: threshold.lowThreshold,
          mediumThreshold: threshold.mediumThreshold,
          highThreshold: threshold.highThreshold,
          criticalThreshold: threshold.criticalThreshold,
          configId: newConfig.id
        }
      });
    }

    return this.getConfigById(newConfig.id);
  }
}
