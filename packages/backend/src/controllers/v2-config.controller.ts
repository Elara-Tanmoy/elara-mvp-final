/**
 * V2 Scanner Configuration Controller
 *
 * Manages V2 scanner configuration, presets, and testing
 */

import { Request, Response } from 'express';
import { RiskLevel, ReachabilityStatus } from '../scanners/url-scanner-v2/types';
import { getDefaultBranchThresholds } from '../scanners/url-scanner-v2/combiner';

/**
 * V2 Configuration interface
 */
interface V2ConfigData {
  stage1Threshold: number;
  stage2Threshold: number;
  policySensitivity: 'low' | 'medium' | 'high' | 'custom';
  branchThresholds: Record<string, {
    safeThreshold: number;
    lowThreshold: number;
    mediumThreshold: number;
    highThreshold: number;
    criticalThreshold: number;
  }>;
  rules: {
    enableDualTier1Block: boolean;
    enableSinkholeBlock: boolean;
    enableBrandInfraCheck: boolean;
    enableFormOriginCheck: boolean;
    enableHomoglyphDetection: boolean;
  };
}

/**
 * Preset configurations
 */
const PRESETS: Record<string, V2ConfigData> = {
  balanced: {
    stage1Threshold: 85,
    stage2Threshold: 85,
    policySensitivity: 'medium',
    branchThresholds: getDefaultBranchThresholds() as any,
    rules: {
      enableDualTier1Block: true,
      enableSinkholeBlock: true,
      enableBrandInfraCheck: true,
      enableFormOriginCheck: true,
      enableHomoglyphDetection: true
    }
  },
  aggressive: {
    stage1Threshold: 70,
    stage2Threshold: 70,
    policySensitivity: 'high',
    branchThresholds: {
      ONLINE: {
        safeThreshold: 0.10,
        lowThreshold: 0.25,
        mediumThreshold: 0.40,
        highThreshold: 0.60,
        criticalThreshold: 0.80
      },
      OFFLINE: {
        safeThreshold: 0.30,
        lowThreshold: 0.45,
        mediumThreshold: 0.60,
        highThreshold: 0.75,
        criticalThreshold: 0.90
      },
      WAF: {
        safeThreshold: 0.40,
        lowThreshold: 0.55,
        mediumThreshold: 0.70,
        highThreshold: 0.85,
        criticalThreshold: 0.95
      },
      PARKED: {
        safeThreshold: 0.50,
        lowThreshold: 0.65,
        mediumThreshold: 0.80,
        highThreshold: 0.90,
        criticalThreshold: 0.95
      },
      SINKHOLE: {
        safeThreshold: 0.95,
        lowThreshold: 0.97,
        mediumThreshold: 0.98,
        highThreshold: 0.99,
        criticalThreshold: 0.995
      },
      ERROR: {
        safeThreshold: 0.30,
        lowThreshold: 0.45,
        mediumThreshold: 0.60,
        highThreshold: 0.75,
        criticalThreshold: 0.90
      }
    },
    rules: {
      enableDualTier1Block: true,
      enableSinkholeBlock: true,
      enableBrandInfraCheck: true,
      enableFormOriginCheck: true,
      enableHomoglyphDetection: true
    }
  },
  conservative: {
    stage1Threshold: 95,
    stage2Threshold: 95,
    policySensitivity: 'low',
    branchThresholds: {
      ONLINE: {
        safeThreshold: 0.20,
        lowThreshold: 0.40,
        mediumThreshold: 0.60,
        highThreshold: 0.80,
        criticalThreshold: 0.95
      },
      OFFLINE: {
        safeThreshold: 0.40,
        lowThreshold: 0.55,
        mediumThreshold: 0.70,
        highThreshold: 0.85,
        criticalThreshold: 0.95
      },
      WAF: {
        safeThreshold: 0.50,
        lowThreshold: 0.65,
        mediumThreshold: 0.80,
        highThreshold: 0.90,
        criticalThreshold: 0.97
      },
      PARKED: {
        safeThreshold: 0.60,
        lowThreshold: 0.75,
        mediumThreshold: 0.85,
        highThreshold: 0.93,
        criticalThreshold: 0.98
      },
      SINKHOLE: {
        safeThreshold: 0.95,
        lowThreshold: 0.97,
        mediumThreshold: 0.98,
        highThreshold: 0.99,
        criticalThreshold: 0.995
      },
      ERROR: {
        safeThreshold: 0.40,
        lowThreshold: 0.55,
        mediumThreshold: 0.70,
        highThreshold: 0.85,
        criticalThreshold: 0.95
      }
    },
    rules: {
      enableDualTier1Block: true,
      enableSinkholeBlock: true,
      enableBrandInfraCheck: false,
      enableFormOriginCheck: false,
      enableHomoglyphDetection: true
    }
  }
};

// In-memory config storage (in production, use database)
let currentConfig: V2ConfigData = PRESETS.balanced;

/**
 * Get current V2 configuration
 */
export const getV2Config = async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      config: currentConfig,
      currentPreset: findCurrentPreset()
    });
  } catch (error: any) {
    console.error('Get V2 config error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get V2 configuration'
    });
  }
};

/**
 * Update V2 configuration
 */
export const updateV2Config = async (req: Request, res: Response) => {
  try {
    const newConfig: V2ConfigData = req.body;

    // Validate configuration
    validateConfig(newConfig);

    // Update config
    currentConfig = newConfig;

    res.json({
      success: true,
      config: currentConfig,
      message: 'V2 configuration updated successfully'
    });
  } catch (error: any) {
    console.error('Update V2 config error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update V2 configuration'
    });
  }
};

/**
 * Get available presets
 */
export const getV2Presets = async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      presets: Object.keys(PRESETS).map(name => ({
        name,
        config: PRESETS[name],
        description: getPresetDescription(name)
      }))
    });
  } catch (error: any) {
    console.error('Get V2 presets error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get V2 presets'
    });
  }
};

/**
 * Apply a preset
 */
export const applyV2Preset = async (req: Request, res: Response) => {
  try {
    const { preset } = req.body;

    if (!PRESETS[preset]) {
      return res.status(400).json({
        success: false,
        error: `Unknown preset: ${preset}`
      });
    }

    currentConfig = PRESETS[preset];

    res.json({
      success: true,
      config: currentConfig,
      message: `Preset '${preset}' applied successfully`
    });
  } catch (error: any) {
    console.error('Apply V2 preset error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to apply preset'
    });
  }
};

/**
 * Test URL with custom configuration
 */
export const testV2Config = async (req: Request, res: Response) => {
  try {
    const { url, config } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Import scanner
    const { createURLScannerV2, getDefaultV2Config } = await import('../scanners/url-scanner-v2/index.js');

    // Create scanner with custom config if provided
    const scannerConfig = config ? mapToScannerConfig(config) : getDefaultV2Config();
    const scanner = createURLScannerV2(scannerConfig);

    // Run scan
    const result = await scanner.scan(url, {
      skipScreenshot: false, // ENABLE screenshots for proper testing
      skipWHOIS: false       // ENABLE WHOIS for domain age checks
    });

    res.json({
      success: true,
      result,
      message: 'Test scan completed'
    });
  } catch (error: any) {
    console.error('Test V2 config error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test configuration'
    });
  }
};

/**
 * Helper: Validate configuration
 */
function validateConfig(config: V2ConfigData): void {
  if (config.stage1Threshold < 0 || config.stage1Threshold > 100) {
    throw new Error('Stage-1 threshold must be between 0 and 100');
  }

  if (config.stage2Threshold < 0 || config.stage2Threshold > 100) {
    throw new Error('Stage-2 threshold must be between 0 and 100');
  }

  if (!['low', 'medium', 'high', 'custom'].includes(config.policySensitivity)) {
    throw new Error('Invalid policy sensitivity');
  }

  // Validate branch thresholds
  for (const [branch, thresholds] of Object.entries(config.branchThresholds)) {
    const values = [
      thresholds.safeThreshold,
      thresholds.lowThreshold,
      thresholds.mediumThreshold,
      thresholds.highThreshold,
      thresholds.criticalThreshold
    ];

    // Check ascending order
    for (let i = 1; i < values.length; i++) {
      if (values[i] <= values[i - 1]) {
        throw new Error(`Branch ${branch}: thresholds must be in ascending order`);
      }
    }
  }
}

/**
 * Helper: Find current preset name
 */
function findCurrentPreset(): string | null {
  for (const [name, preset] of Object.entries(PRESETS)) {
    if (JSON.stringify(preset) === JSON.stringify(currentConfig)) {
      return name;
    }
  }
  return 'custom';
}

/**
 * Helper: Get preset description
 */
function getPresetDescription(preset: string): string {
  const descriptions: Record<string, string> = {
    balanced: 'Balanced detection with moderate false positive rate. Recommended for most users.',
    aggressive: 'High sensitivity detection. May produce more false positives but catches more threats.',
    conservative: 'Low false positive rate. Only flags URLs with very high confidence of being malicious.'
  };
  return descriptions[preset] || '';
}

/**
 * Helper: Map UI config to scanner config
 */
function mapToScannerConfig(uiConfig: V2ConfigData): any {
  const { getDefaultV2Config } = require('../scanners/url-scanner-v2/index.js');
  const defaultConfig = getDefaultV2Config();

  return {
    ...defaultConfig,
    stage2Threshold: uiConfig.stage2Threshold / 100,
    branchThresholds: uiConfig.branchThresholds
  };
}
