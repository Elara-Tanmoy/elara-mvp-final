/**
 * V2 Check Definitions Controller
 *
 * Manages V2 scanner check definitions with full CRUD operations.
 * Similar to V1 CheckType management but for V2 granular checks.
 */

import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';

export class V2ChecksController {
  /**
   * GET /api/admin/v2-checks
   * List all V2 check definitions with optional filtering
   */
  async getChecks(req: Request, res: Response) {
    try {
      const { category, stage, enabled, search } = req.query;

      const where: any = {};

      if (category) where.category = category as string;
      if (stage) where.stage = stage as string;
      if (enabled !== undefined) where.enabled = enabled === 'true';
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { displayName: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } }
        ];
      }

      const checks = await prisma.v2CheckDefinition.findMany({
        where,
        orderBy: [{ order: 'asc' }, { name: 'asc' }]
      });

      logger.info(`[V2 Checks] Retrieved ${checks.length} checks`, { filters: req.query });

      res.json({
        success: true,
        data: checks,
        total: checks.length
      });
    } catch (error) {
      logger.error('[V2 Checks] Error getting checks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get V2 check definitions'
      });
    }
  }

  /**
   * GET /api/admin/v2-checks/:id
   * Get single check definition by ID
   */
  async getCheck(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const check = await prisma.v2CheckDefinition.findUnique({
        where: { id }
      });

      if (!check) {
        return res.status(404).json({
          success: false,
          error: 'Check definition not found'
        });
      }

      logger.info(`[V2 Checks] Retrieved check: ${check.name}`);

      res.json({
        success: true,
        data: check
      });
    } catch (error) {
      logger.error('[V2 Checks] Error getting check:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get check definition'
      });
    }
  }

  /**
   * POST /api/admin/v2-checks
   * Create new check definition
   */
  async createCheck(req: Request, res: Response) {
    try {
      const checkData = req.body;

      // Validate required fields
      const required = ['name', 'displayName', 'category', 'stage'];
      const missing = required.filter(field => !checkData[field]);
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missing.join(', ')}`
        });
      }

      // Check for duplicate name
      const existing = await prisma.v2CheckDefinition.findUnique({
        where: { name: checkData.name }
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Check with name '${checkData.name}' already exists`
        });
      }

      const check = await prisma.v2CheckDefinition.create({
        data: checkData
      });

      logger.info(`[V2 Checks] Created check: ${check.name}`);

      res.status(201).json({
        success: true,
        data: check,
        message: 'Check definition created successfully'
      });
    } catch (error) {
      logger.error('[V2 Checks] Error creating check:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create check definition'
      });
    }
  }

  /**
   * PUT /api/admin/v2-checks/:id
   * Update check definition
   */
  async updateCheck(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const existing = await prisma.v2CheckDefinition.findUnique({
        where: { id }
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Check definition not found'
        });
      }

      // Prevent name change if it would conflict
      if (updates.name && updates.name !== existing.name) {
        const nameConflict = await prisma.v2CheckDefinition.findUnique({
          where: { name: updates.name }
        });
        if (nameConflict) {
          return res.status(409).json({
            success: false,
            error: `Check with name '${updates.name}' already exists`
          });
        }
      }

      const check = await prisma.v2CheckDefinition.update({
        where: { id },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });

      logger.info(`[V2 Checks] Updated check: ${check.name}`);

      res.json({
        success: true,
        data: check,
        message: 'Check definition updated successfully'
      });
    } catch (error) {
      logger.error('[V2 Checks] Error updating check:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update check definition'
      });
    }
  }

  /**
   * DELETE /api/admin/v2-checks/:id
   * Delete check definition (soft delete by setting isActive = false)
   */
  async deleteCheck(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { hard } = req.query; // Optional hard delete

      const existing = await prisma.v2CheckDefinition.findUnique({
        where: { id }
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Check definition not found'
        });
      }

      if (hard === 'true') {
        // Hard delete
        await prisma.v2CheckDefinition.delete({
          where: { id }
        });
        logger.info(`[V2 Checks] Hard deleted check: ${existing.name}`);
      } else {
        // Soft delete
        await prisma.v2CheckDefinition.update({
          where: { id },
          data: { isActive: false, updatedAt: new Date() }
        });
        logger.info(`[V2 Checks] Soft deleted check: ${existing.name}`);
      }

      res.json({
        success: true,
        message: hard === 'true' ? 'Check deleted permanently' : 'Check deactivated'
      });
    } catch (error) {
      logger.error('[V2 Checks] Error deleting check:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete check definition'
      });
    }
  }

  /**
   * POST /api/admin/v2-checks/:id/toggle
   * Toggle check enabled status
   */
  async toggleCheck(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const check = await prisma.v2CheckDefinition.findUnique({
        where: { id }
      });

      if (!check) {
        return res.status(404).json({
          success: false,
          error: 'Check definition not found'
        });
      }

      const updated = await prisma.v2CheckDefinition.update({
        where: { id },
        data: {
          enabled: !check.enabled,
          updatedAt: new Date()
        }
      });

      logger.info(`[V2 Checks] Toggled check ${updated.name}: ${updated.enabled}`);

      res.json({
        success: true,
        data: updated,
        message: `Check ${updated.enabled ? 'enabled' : 'disabled'}`
      });
    } catch (error) {
      logger.error('[V2 Checks] Error toggling check:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle check'
      });
    }
  }

  /**
   * PUT /api/admin/v2-checks/bulk-update
   * Bulk update check weights/thresholds
   */
  async bulkUpdateChecks(req: Request, res: Response) {
    try {
      const { updates } = req.body; // Array of {id, weight?, threshold?, enabled?}

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Updates must be a non-empty array'
        });
      }

      const results = [];

      for (const update of updates) {
        if (!update.id) continue;

        try {
          const check = await prisma.v2CheckDefinition.update({
            where: { id: update.id },
            data: {
              ...(update.weight !== undefined && { weight: update.weight }),
              ...(update.threshold !== undefined && { threshold: update.threshold }),
              ...(update.enabled !== undefined && { enabled: update.enabled }),
              ...(update.points !== undefined && { points: update.points }),
              updatedAt: new Date()
            }
          });
          results.push({ id: check.id, name: check.name, success: true });
        } catch (err) {
          results.push({ id: update.id, success: false, error: (err as Error).message });
        }
      }

      logger.info(`[V2 Checks] Bulk updated ${results.filter(r => r.success).length}/${results.length} checks`);

      res.json({
        success: true,
        data: results,
        message: `Updated ${results.filter(r => r.success).length} checks`
      });
    } catch (error) {
      logger.error('[V2 Checks] Error bulk updating checks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk update checks'
      });
    }
  }

  /**
   * GET /api/admin/v2-checks/categories
   * Get list of check categories
   */
  async getCategories(req: Request, res: Response) {
    try {
      const checks = await prisma.v2CheckDefinition.findMany({
        select: { category: true, stage: true }
      });

      const categories = Array.from(new Set(checks.map(c => c.category)));
      const stages = Array.from(new Set(checks.map(c => c.stage)));

      res.json({
        success: true,
        data: {
          categories,
          stages,
          categoryMap: {
            policy: checks.filter(c => c.category === 'policy').length,
            stage1_lexical: checks.filter(c => c.category === 'stage1_lexical').length,
            stage1_tabular: checks.filter(c => c.category === 'stage1_tabular').length,
            ti: checks.filter(c => c.category === 'ti').length,
            stage2_text: checks.filter(c => c.category === 'stage2_text').length,
            stage2_screenshot: checks.filter(c => c.category === 'stage2_screenshot').length
          }
        }
      });
    } catch (error) {
      logger.error('[V2 Checks] Error getting categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get categories'
      });
    }
  }

  /**
   * POST /api/admin/v2-checks/:id/test
   * Test a specific check (mock test for now)
   */
  async testCheck(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { testUrl } = req.body;

      const check = await prisma.v2CheckDefinition.findUnique({
        where: { id }
      });

      if (!check) {
        return res.status(404).json({
          success: false,
          error: 'Check definition not found'
        });
      }

      if (!testUrl) {
        return res.status(400).json({
          success: false,
          error: 'testUrl is required'
        });
      }

      // Mock test result
      const testResult = {
        checkName: check.name,
        testUrl,
        passed: check.enabled,
        score: check.enabled ? Math.random() * check.maxPoints : 0,
        weight: check.weight,
        latency: Math.floor(Math.random() * 2000) + 100,
        details: {
          stage: check.stage,
          category: check.category,
          threshold: check.threshold
        }
      };

      logger.info(`[V2 Checks] Test check ${check.name} on ${testUrl}`);

      res.json({
        success: true,
        data: testResult,
        message: 'Check test completed (mock)'
      });
    } catch (error) {
      logger.error('[V2 Checks] Error testing check:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test check'
      });
    }
  }
}

export const v2ChecksController = new V2ChecksController();
