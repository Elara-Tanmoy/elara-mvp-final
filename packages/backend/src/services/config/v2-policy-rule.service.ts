/**
 * V2 Policy Rule Service
 */

import { prisma } from '../../config/database.js';
import type { EnhancedScanResult } from '../../scanners/url-scanner-v2/types';

export class V2PolicyRuleService {
  // Create new policy rule
  async createRule(data: {
    name: string;
    priority: number;
    enabled?: boolean;
    condition: any;
    action: any;
    createdBy?: string;
  }) {
    return prisma.v2PolicyRule.create({
      data
    });
  }

  // Get all rules
  async getAllRules() {
    return prisma.v2PolicyRule.findMany({
      orderBy: { priority: 'asc' }
    });
  }

  // Get enabled rules
  async getEnabledRules() {
    return prisma.v2PolicyRule.findMany({
      where: { enabled: true },
      orderBy: { priority: 'asc' }
    });
  }

  // Get rule by ID
  async getRuleById(id: string) {
    return prisma.v2PolicyRule.findUnique({
      where: { id }
    });
  }

  // Update rule
  async updateRule(id: string, data: {
    name?: string;
    priority?: number;
    enabled?: boolean;
    condition?: any;
    action?: any;
  }) {
    return prisma.v2PolicyRule.update({
      where: { id },
      data
    });
  }

  // Delete rule
  async deleteRule(id: string) {
    return prisma.v2PolicyRule.delete({
      where: { id }
    });
  }

  // Toggle rule enabled status
  async toggleRule(id: string, enabled: boolean) {
    return prisma.v2PolicyRule.update({
      where: { id },
      data: { enabled }
    });
  }

  // Reorder rules
  async reorderRules(ruleIds: string[]) {
    const updates = ruleIds.map((id, index) =>
      prisma.v2PolicyRule.update({
        where: { id },
        data: { priority: index + 1 }
      })
    );

    return prisma.$transaction(updates);
  }

  // Record rule application
  async recordRuleApplication(id: string) {
    return prisma.v2PolicyRule.update({
      where: { id },
      data: {
        appliedCount: { increment: 1 },
        lastAppliedAt: new Date()
      }
    });
  }

  // Evaluate rules against scan result
  async evaluateRules(result: EnhancedScanResult): Promise<{
    matched: boolean;
    rule?: any;
    override?: any;
  }> {
    const rules = await this.getEnabledRules();

    for (const rule of rules) {
      if (this.evaluateCondition(rule.condition, result)) {
        // Record application
        await this.recordRuleApplication(rule.id);

        return {
          matched: true,
          rule,
          override: rule.action
        };
      }
    }

    return { matched: false };
  }

  // Evaluate a single condition
  private evaluateCondition(condition: any, result: EnhancedScanResult): boolean {
    const { type, clauses } = condition;

    if (type === 'AND') {
      return clauses.every((clause: any) => this.evaluateClause(clause, result));
    }

    if (type === 'OR') {
      return clauses.some((clause: any) => this.evaluateClause(clause, result));
    }

    // Single clause
    return this.evaluateClause(condition, result);
  }

  // Evaluate individual clause
  private evaluateClause(clause: any, result: EnhancedScanResult): boolean {
    const { field, operator, value } = clause;

    let fieldValue: any;

    // Extract field value from result
    switch (field) {
      case 'riskLevel':
        fieldValue = result.riskLevel;
        break;
      case 'probability':
        fieldValue = result.probability;
        break;
      case 'tiHits':
        fieldValue = result.evidenceSummary.tiHits;
        break;
      case 'domainAge':
        fieldValue = result.evidenceSummary.domainAge;
        break;
      case 'hasLoginForm':
        fieldValue = result.evidenceSummary.hasLoginForm;
        break;
      case 'tlsValid':
        fieldValue = result.evidenceSummary.tlsValid;
        break;
      case 'reachability':
        fieldValue = result.reachability;
        break;
      default:
        return false;
    }

    // Apply operator
    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'greater_than':
        return fieldValue > value;
      case 'less_than':
        return fieldValue < value;
      case 'greater_equal':
        return fieldValue >= value;
      case 'less_equal':
        return fieldValue <= value;
      case 'contains':
        return String(fieldValue).includes(value);
      case 'not_contains':
        return !String(fieldValue).includes(value);
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(fieldValue);
      default:
        return false;
    }
  }

  // Get rule statistics
  async getRuleStats() {
    const rules = await this.getAllRules();

    return {
      total: rules.length,
      enabled: rules.filter(r => r.enabled).length,
      disabled: rules.filter(r => !r.enabled).length,
      totalApplications: rules.reduce((sum, r) => sum + r.appliedCount, 0),
      mostUsed: rules.sort((a, b) => b.appliedCount - a.appliedCount).slice(0, 5)
    };
  }

  // Test rule against sample data
  async testRule(ruleId: string, sampleResult: EnhancedScanResult): Promise<{
    matched: boolean;
    override?: any;
  }> {
    const rule = await this.getRuleById(ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }

    const matched = this.evaluateCondition(rule.condition, sampleResult);

    return {
      matched,
      override: matched ? rule.action : undefined
    };
  }
}
