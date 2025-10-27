/**
 * V2 Scanner Admin Controller
 *
 * Comprehensive admin endpoints for managing V2 scanner configuration
 */

import { Request, Response } from 'express';
import { V2CategoryConfigService } from '../../services/config/v2-category-config.service.js';
import { V2CheckConfigService } from '../../services/config/v2-check-config.service.js';
import { V2PolicyRuleService } from '../../services/config/v2-policy-rule.service.js';
import { V2BranchThresholdService } from '../../services/config/v2-branch-threshold.service.js';
import { V2TestCalibrateService } from '../../services/config/v2-test-calibrate.service.js';
import { V2GeminiSummarizer } from '../../services/gemini/v2-summarizer.service.js';

const categoryConfigService = new V2CategoryConfigService();
const checkConfigService = new V2CheckConfigService();
const policyRuleService = new V2PolicyRuleService();
const branchThresholdService = new V2BranchThresholdService();
const testCalibrateService = new V2TestCalibrateService();
const geminiSummarizer = new V2GeminiSummarizer();

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY CONFIG ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

export const getAllCategoryConfigs = async (req: Request, res: Response) => {
  try {
    const configs = await categoryConfigService.getAllConfigs();
    res.json({ success: true, data: configs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getCategoryConfigById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const config = await categoryConfigService.getConfigById(id);

    if (!config) {
      return res.status(404).json({ success: false, error: 'Configuration not found' });
    }

    res.json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getActiveCategoryConfig = async (req: Request, res: Response) => {
  try {
    const config = await categoryConfigService.getActiveConfig();

    if (!config) {
      return res.status(404).json({ success: false, error: 'No active configuration found' });
    }

    res.json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createCategoryConfig = async (req: Request, res: Response) => {
  try {
    const { name, description, version, categoryWeights } = req.body;
    const userId = (req as any).user?.id;

    if (!name || !version || !categoryWeights) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, version, categoryWeights'
      });
    }

    const config = await categoryConfigService.createConfig({
      name,
      description,
      version,
      categoryWeights,
      createdBy: userId
    });

    // Create default thresholds
    await branchThresholdService.createDefaultThresholds(config.id);

    res.status(201).json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateCategoryConfig = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, categoryWeights } = req.body;

    const config = await categoryConfigService.updateConfig(id, {
      name,
      description,
      categoryWeights
    });

    res.json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const activateCategoryConfig = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const config = await categoryConfigService.activateConfig(id);

    res.json({ success: true, data: config, message: 'Configuration activated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteCategoryConfig = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await categoryConfigService.deleteConfig(id);

    res.json({ success: true, message: 'Configuration deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const duplicateCategoryConfig = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = (req as any).user?.id;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const config = await categoryConfigService.duplicateConfig(id, name, userId);

    res.status(201).json({ success: true, data: config, message: 'Configuration duplicated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CHECK CONFIG ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

export const getChecksByConfigId = async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const checks = await checkConfigService.getChecksByConfigId(configId);

    res.json({ success: true, data: checks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getCheckById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const check = await checkConfigService.getCheckById(id);

    if (!check) {
      return res.status(404).json({ success: false, error: 'Check not found' });
    }

    res.json({ success: true, data: check });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createCheck = async (req: Request, res: Response) => {
  try {
    const {
      checkId,
      name,
      category,
      defaultPoints,
      currentPoints,
      maxPoints,
      enabled,
      severity,
      description,
      config,
      configId
    } = req.body;
    const userId = (req as any).user?.id;

    if (!checkId || !name || !category || !configId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: checkId, name, category, configId'
      });
    }

    const check = await checkConfigService.createCheck({
      checkId,
      name,
      category,
      defaultPoints: defaultPoints || 10,
      currentPoints: currentPoints || defaultPoints || 10,
      maxPoints: maxPoints || 100,
      enabled: enabled !== undefined ? enabled : true,
      severity: severity || 'medium',
      description,
      config,
      configId,
      updatedBy: userId
    });

    res.status(201).json({ success: true, data: check });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateCheck = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      defaultPoints,
      currentPoints,
      maxPoints,
      enabled,
      severity,
      description,
      config
    } = req.body;
    const userId = (req as any).user?.id;

    const check = await checkConfigService.updateCheck(id, {
      name,
      defaultPoints,
      currentPoints,
      maxPoints,
      enabled,
      severity,
      description,
      config,
      updatedBy: userId
    });

    res.json({ success: true, data: check });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const toggleCheck = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const userId = (req as any).user?.id;

    if (enabled === undefined) {
      return res.status(400).json({ success: false, error: 'enabled field is required' });
    }

    const check = await checkConfigService.toggleCheck(id, enabled, userId);

    res.json({ success: true, data: check });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteCheck = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await checkConfigService.deleteCheck(id);

    res.json({ success: true, message: 'Check deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const bulkUpdateChecks = async (req: Request, res: Response) => {
  try {
    const { checks } = req.body;
    const userId = (req as any).user?.id;

    if (!Array.isArray(checks)) {
      return res.status(400).json({ success: false, error: 'checks must be an array' });
    }

    const updated = await checkConfigService.bulkUpdateChecks(checks, userId);

    res.json({ success: true, data: updated, message: 'Checks updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const resetCheckPoints = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const check = await checkConfigService.resetCheckPoints(id, userId);

    res.json({ success: true, data: check, message: 'Check points reset to default' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const resetAllChecks = async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const userId = (req as any).user?.id;

    const checks = await checkConfigService.resetAllChecks(configId, userId);

    res.json({ success: true, data: checks, message: 'All checks reset to defaults' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getCheckStats = async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const stats = await checkConfigService.getCheckStats(configId);

    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// POLICY RULE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

export const getAllPolicyRules = async (req: Request, res: Response) => {
  try {
    const rules = await policyRuleService.getAllRules();
    res.json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getEnabledPolicyRules = async (req: Request, res: Response) => {
  try {
    const rules = await policyRuleService.getEnabledRules();
    res.json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getPolicyRuleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule = await policyRuleService.getRuleById(id);

    if (!rule) {
      return res.status(404).json({ success: false, error: 'Policy rule not found' });
    }

    res.json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createPolicyRule = async (req: Request, res: Response) => {
  try {
    const { name, priority, enabled, condition, action } = req.body;
    const userId = (req as any).user?.id;

    if (!name || !priority || !condition || !action) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, priority, condition, action'
      });
    }

    const rule = await policyRuleService.createRule({
      name,
      priority,
      enabled: enabled !== undefined ? enabled : true,
      condition,
      action,
      createdBy: userId
    });

    res.status(201).json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updatePolicyRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, priority, enabled, condition, action } = req.body;

    const rule = await policyRuleService.updateRule(id, {
      name,
      priority,
      enabled,
      condition,
      action
    });

    res.json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const togglePolicyRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    if (enabled === undefined) {
      return res.status(400).json({ success: false, error: 'enabled field is required' });
    }

    const rule = await policyRuleService.toggleRule(id, enabled);

    res.json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deletePolicyRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await policyRuleService.deleteRule(id);

    res.json({ success: true, message: 'Policy rule deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const reorderPolicyRules = async (req: Request, res: Response) => {
  try {
    const { ruleIds } = req.body;

    if (!Array.isArray(ruleIds)) {
      return res.status(400).json({ success: false, error: 'ruleIds must be an array' });
    }

    const rules = await policyRuleService.reorderRules(ruleIds);

    res.json({ success: true, data: rules, message: 'Rules reordered successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const testPolicyRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sampleResult } = req.body;

    if (!sampleResult) {
      return res.status(400).json({ success: false, error: 'sampleResult is required' });
    }

    const result = await policyRuleService.testRule(id, sampleResult);

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getPolicyRuleStats = async (req: Request, res: Response) => {
  try {
    const stats = await policyRuleService.getRuleStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// BRANCH THRESHOLD ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

export const getThresholdsByConfigId = async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const thresholds = await branchThresholdService.getThresholdsByConfigId(configId);

    res.json({ success: true, data: thresholds });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getThresholdByBranch = async (req: Request, res: Response) => {
  try {
    const { configId, branch } = req.params;
    const threshold = await branchThresholdService.getThresholdByBranch(configId, branch);

    if (!threshold) {
      return res.status(404).json({ success: false, error: 'Threshold not found' });
    }

    res.json({ success: true, data: threshold });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createThreshold = async (req: Request, res: Response) => {
  try {
    const {
      branch,
      safeThreshold,
      lowThreshold,
      mediumThreshold,
      highThreshold,
      criticalThreshold,
      configId
    } = req.body;

    if (!branch || !configId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: branch, configId'
      });
    }

    // Validate thresholds
    const validation = branchThresholdService.validateThresholds({
      safeThreshold,
      lowThreshold,
      mediumThreshold,
      highThreshold,
      criticalThreshold
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.errors.join(', ')
      });
    }

    const threshold = await branchThresholdService.createThreshold({
      branch,
      safeThreshold,
      lowThreshold,
      mediumThreshold,
      highThreshold,
      criticalThreshold,
      configId
    });

    res.status(201).json({ success: true, data: threshold });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateThreshold = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      safeThreshold,
      lowThreshold,
      mediumThreshold,
      highThreshold,
      criticalThreshold
    } = req.body;

    // Validate if provided
    if (safeThreshold !== undefined) {
      const validation = branchThresholdService.validateThresholds({
        safeThreshold,
        lowThreshold,
        mediumThreshold,
        highThreshold,
        criticalThreshold
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.errors.join(', ')
        });
      }
    }

    const threshold = await branchThresholdService.updateThreshold(id, {
      safeThreshold,
      lowThreshold,
      mediumThreshold,
      highThreshold,
      criticalThreshold
    });

    res.json({ success: true, data: threshold });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteThreshold = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await branchThresholdService.deleteThreshold(id);

    res.json({ success: true, message: 'Threshold deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const bulkUpdateThresholds = async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const { thresholds } = req.body;

    if (!Array.isArray(thresholds)) {
      return res.status(400).json({ success: false, error: 'thresholds must be an array' });
    }

    const updated = await branchThresholdService.bulkUpdateThresholds(configId, thresholds);

    res.json({ success: true, data: updated, message: 'Thresholds updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getThresholdSummary = async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const summary = await branchThresholdService.getThresholdSummary(configId);

    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// TEST & CALIBRATE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

export const testScan = async (req: Request, res: Response) => {
  try {
    const { url, configId } = req.body;

    if (!url || !configId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: url, configId'
      });
    }

    // TODO: Get scanner instance
    const scanner = null; // Replace with actual scanner

    const result = await testCalibrateService.runTestScan(url, configId, scanner);

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const batchTest = async (req: Request, res: Response) => {
  try {
    const { urls, configId } = req.body;

    if (!Array.isArray(urls) || !configId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: urls (array), configId'
      });
    }

    const scanner = null; // Replace with actual scanner

    const result = await testCalibrateService.batchTest(urls, configId, scanner);

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const compareConfigs = async (req: Request, res: Response) => {
  try {
    const { url, configId1, configId2 } = req.body;

    if (!url || !configId1 || !configId2) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: url, configId1, configId2'
      });
    }

    const scanner = null; // Replace with actual scanner

    const result = await testCalibrateService.compareConfigs(url, configId1, configId2, scanner);

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const calibrateThresholds = async (req: Request, res: Response) => {
  try {
    const { testResults, configId } = req.body;

    if (!Array.isArray(testResults) || !configId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: testResults (array), configId'
      });
    }

    const result = await testCalibrateService.calibrateThresholds(testResults, configId);

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const simulateABTest = async (req: Request, res: Response) => {
  try {
    const { urls, configA, configB } = req.body;

    if (!Array.isArray(urls) || !configA || !configB) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: urls (array), configA, configB'
      });
    }

    const scanner = null; // Replace with actual scanner

    const result = await testCalibrateService.simulateABTest(urls, configA, configB, scanner);

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GEMINI AI SUMMARY ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════

export const generateAISummary = async (req: Request, res: Response) => {
  try {
    const { scanResult } = req.body;

    if (!scanResult) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: scanResult'
      });
    }

    const summary = await geminiSummarizer.generateSummary(scanResult);

    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
