/**
 * V2 Check Configuration Service
 */

import { prisma } from '../../config/database.js';

export class V2CheckConfigService {
  // Create new check
  async createCheck(data: {
    checkId: string;
    name: string;
    category: string;
    defaultPoints: number;
    currentPoints: number;
    maxPoints: number;
    enabled?: boolean;
    severity: string;
    description?: string;
    config?: any;
    configId: string;
    updatedBy?: string;
  }) {
    return prisma.v2CheckConfig.create({
      data
    });
  }

  // Get all checks for a config
  async getChecksByConfigId(configId: string) {
    return prisma.v2CheckConfig.findMany({
      where: { configId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });
  }

  // Get check by ID
  async getCheckById(id: string) {
    return prisma.v2CheckConfig.findUnique({
      where: { id }
    });
  }

  // Update check
  async updateCheck(id: string, data: {
    name?: string;
    defaultPoints?: number;
    currentPoints?: number;
    maxPoints?: number;
    enabled?: boolean;
    severity?: string;
    description?: string;
    config?: any;
    updatedBy?: string;
  }) {
    return prisma.v2CheckConfig.update({
      where: { id },
      data
    });
  }

  // Delete check
  async deleteCheck(id: string) {
    return prisma.v2CheckConfig.delete({
      where: { id }
    });
  }

  // Bulk update checks
  async bulkUpdateChecks(checks: Array<{
    id: string;
    enabled?: boolean;
    currentPoints?: number;
  }>, updatedBy?: string) {
    const updates = checks.map(check =>
      prisma.v2CheckConfig.update({
        where: { id: check.id },
        data: {
          enabled: check.enabled,
          currentPoints: check.currentPoints,
          updatedBy
        }
      })
    );

    return prisma.$transaction(updates);
  }

  // Get checks by category
  async getChecksByCategory(configId: string, category: string) {
    return prisma.v2CheckConfig.findMany({
      where: { configId, category },
      orderBy: { name: 'asc' }
    });
  }

  // Enable/disable check
  async toggleCheck(id: string, enabled: boolean, updatedBy?: string) {
    return prisma.v2CheckConfig.update({
      where: { id },
      data: { enabled, updatedBy }
    });
  }

  // Reset check points to default
  async resetCheckPoints(id: string, updatedBy?: string) {
    const check = await this.getCheckById(id);
    if (!check) {
      throw new Error('Check not found');
    }

    return prisma.v2CheckConfig.update({
      where: { id },
      data: {
        currentPoints: check.defaultPoints,
        updatedBy
      }
    });
  }

  // Reset all checks in config to defaults
  async resetAllChecks(configId: string, updatedBy?: string) {
    const checks = await this.getChecksByConfigId(configId);

    const updates = checks.map(check =>
      prisma.v2CheckConfig.update({
        where: { id: check.id },
        data: {
          currentPoints: check.defaultPoints,
          updatedBy
        }
      })
    );

    return prisma.$transaction(updates);
  }

  // Get check statistics
  async getCheckStats(configId: string) {
    const checks = await this.getChecksByConfigId(configId);

    const stats = {
      total: checks.length,
      enabled: checks.filter(c => c.enabled).length,
      disabled: checks.filter(c => !c.enabled).length,
      byCategory: {} as Record<string, { total: number; enabled: number }>,
      bySeverity: {} as Record<string, { total: number; enabled: number }>,
      totalPoints: 0,
      maxPoints: 0
    };

    checks.forEach(check => {
      // By category
      if (!stats.byCategory[check.category]) {
        stats.byCategory[check.category] = { total: 0, enabled: 0 };
      }
      stats.byCategory[check.category].total++;
      if (check.enabled) stats.byCategory[check.category].enabled++;

      // By severity
      if (!stats.bySeverity[check.severity]) {
        stats.bySeverity[check.severity] = { total: 0, enabled: 0 };
      }
      stats.bySeverity[check.severity].total++;
      if (check.enabled) stats.bySeverity[check.severity].enabled++;

      // Points
      if (check.enabled) {
        stats.totalPoints += check.currentPoints;
        stats.maxPoints += check.maxPoints;
      }
    });

    return stats;
  }
}
