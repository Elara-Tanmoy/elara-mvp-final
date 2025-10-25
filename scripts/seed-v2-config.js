/**
 * Seed V2 Scanner Configuration
 * Creates default config and system presets
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seedV2Config() {
  console.log('🌱 Seeding V2 Scanner Configuration...');

  try {
    // 1. Create default V2 scanner config
    console.log('Creating default V2 scanner config...');
    const defaultConfig = await prisma.v2ScannerConfig.upsert({
      where: { name: 'default' },
      create: {
        name: 'default',
        description: 'Default V2 Scanner Configuration',
        isActive: false,
        isDefault: true,
        rolloutPercentage: 0,
        shadowMode: false,
        enabledForOrgs: [],
        stage2ConfidenceThreshold: 0.85,
        branchThresholds: {
          ONLINE: {safe: 0.15, low: 0.30, medium: 0.50, high: 0.75, critical: 0.90},
          OFFLINE: {safe: 0.25, low: 0.45, medium: 0.65, high: 0.85, critical: 0.95},
          WAF: {safe: 0.10, low: 0.25, medium: 0.45, high: 0.70, critical: 0.88},
          PARKED: {safe: 0.30, low: 0.50, medium: 0.70, high: 0.88, critical: 0.96},
          SINKHOLE: {safe: 0.95, low: 0.97, medium: 0.98, high: 0.99, critical: 0.995}
        },
        stage1Weights: {
          lexicalA: 0.25,
          lexicalB: 0.35,
          tabular: 0.40
        },
        stage2Weights: {
          text: 0.60,
          screenshot: 0.40
        }
      },
      update: {
        description: 'Default V2 Scanner Configuration',
        isDefault: true
      }
    });
    console.log(`✅ Default config created: ${defaultConfig.id}`);

    // 2. Create strict preset
    console.log('Creating strict preset...');
    const strictPreset = await prisma.v2Preset.upsert({
      where: { name: 'strict' },
      create: {
        name: 'strict',
        displayName: 'Strict Security',
        description: 'High security with low false negative tolerance',
        category: 'security',
        config: {},
        branchThresholds: {
          ONLINE: {safe: 0.10, low: 0.20, medium: 0.40, high: 0.65, critical: 0.85},
          OFFLINE: {safe: 0.15, low: 0.30, medium: 0.50, high: 0.75, critical: 0.90},
          WAF: {safe: 0.08, low: 0.18, medium: 0.35, high: 0.60, critical: 0.80},
          PARKED: {safe: 0.20, low: 0.40, medium: 0.60, high: 0.80, critical: 0.92},
          SINKHOLE: {safe: 0.90, low: 0.93, medium: 0.95, high: 0.97, critical: 0.99}
        },
        stage1Weights: {
          lexicalA: 0.20,
          lexicalB: 0.30,
          tabular: 0.50
        },
        stage2Weights: {
          text: 0.70,
          screenshot: 0.30
        },
        isDefault: false,
        isSystem: true
      },
      update: {
        displayName: 'Strict Security',
        description: 'High security with low false negative tolerance',
        isSystem: true
      }
    });
    console.log(`✅ Strict preset created: ${strictPreset.id}`);

    // 3. Create balanced preset
    console.log('Creating balanced preset...');
    const balancedPreset = await prisma.v2Preset.upsert({
      where: { name: 'balanced' },
      create: {
        name: 'balanced',
        displayName: 'Balanced',
        description: 'Balanced security and user experience',
        category: 'balanced',
        config: {},
        branchThresholds: {
          ONLINE: {safe: 0.15, low: 0.30, medium: 0.50, high: 0.75, critical: 0.90},
          OFFLINE: {safe: 0.25, low: 0.45, medium: 0.65, high: 0.85, critical: 0.95},
          WAF: {safe: 0.10, low: 0.25, medium: 0.45, high: 0.70, critical: 0.88},
          PARKED: {safe: 0.30, low: 0.50, medium: 0.70, high: 0.88, critical: 0.96},
          SINKHOLE: {safe: 0.95, low: 0.97, medium: 0.98, high: 0.99, critical: 0.995}
        },
        stage1Weights: {
          lexicalA: 0.25,
          lexicalB: 0.35,
          tabular: 0.40
        },
        stage2Weights: {
          text: 0.60,
          screenshot: 0.40
        },
        isDefault: true,
        isSystem: true
      },
      update: {
        displayName: 'Balanced',
        description: 'Balanced security and user experience',
        isDefault: true,
        isSystem: true
      }
    });
    console.log(`✅ Balanced preset created: ${balancedPreset.id}`);

    // 4. Create lenient preset
    console.log('Creating lenient preset...');
    const lenientPreset = await prisma.v2Preset.upsert({
      where: { name: 'lenient' },
      create: {
        name: 'lenient',
        displayName: 'Lenient',
        description: 'Low false positives, better UX',
        category: 'ux',
        config: {},
        branchThresholds: {
          ONLINE: {safe: 0.20, low: 0.40, medium: 0.60, high: 0.82, critical: 0.94},
          OFFLINE: {safe: 0.35, low: 0.55, medium: 0.75, high: 0.90, critical: 0.97},
          WAF: {safe: 0.15, low: 0.35, medium: 0.55, high: 0.78, critical: 0.92},
          PARKED: {safe: 0.40, low: 0.60, medium: 0.78, high: 0.92, critical: 0.98},
          SINKHOLE: {safe: 0.97, low: 0.98, medium: 0.99, high: 0.995, critical: 0.998}
        },
        stage1Weights: {
          lexicalA: 0.30,
          lexicalB: 0.40,
          tabular: 0.30
        },
        stage2Weights: {
          text: 0.50,
          screenshot: 0.50
        },
        isDefault: false,
        isSystem: true
      },
      update: {
        displayName: 'Lenient',
        description: 'Low false positives, better UX',
        isSystem: true
      }
    });
    console.log(`✅ Lenient preset created: ${lenientPreset.id}`);

    console.log('\n🎉 V2 Scanner configuration seeded successfully!');
    console.log(`   - Default config: ${defaultConfig.id}`);
    console.log(`   - Strict preset: ${strictPreset.id}`);
    console.log(`   - Balanced preset: ${balancedPreset.id}`);
    console.log(`   - Lenient preset: ${lenientPreset.id}`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedV2Config()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
