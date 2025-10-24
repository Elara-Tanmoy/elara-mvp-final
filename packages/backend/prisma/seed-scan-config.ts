import { PrismaClient } from '@prisma/client';
import { defaultScanConfiguration } from './seeds/defaultScanConfig.js';

const prisma = new PrismaClient();

async function seedScanConfiguration() {
  console.log('🌱 Seeding default scan configuration...');

  try {
    // Check if default config already exists
    const existing = await prisma.scanConfiguration.findFirst({
      where: { isDefault: true }
    });

    if (existing) {
      console.log('✅ Default configuration already exists, updating...');

      // Deactivate old default
      await prisma.scanConfiguration.updateMany({
        where: { isDefault: true },
        data: { isDefault: false, isActive: false }
      });
    }

    // Create new default configuration
    const config = await prisma.scanConfiguration.create({
      data: {
        name: defaultScanConfiguration.name,
        description: defaultScanConfiguration.description,
        version: defaultScanConfiguration.version,
        isActive: defaultScanConfiguration.isActive,
        isDefault: defaultScanConfiguration.isDefault,
        maxScore: defaultScanConfiguration.maxScore,
        categoryWeights: defaultScanConfiguration.categoryWeights,
        checkWeights: defaultScanConfiguration.checkWeights,
        algorithmConfig: defaultScanConfiguration.algorithmConfig,
        aiModelConfig: defaultScanConfiguration.aiModelConfig,
        tiConfig: defaultScanConfiguration.tiConfig,
        reachabilityConfig: defaultScanConfiguration.reachabilityConfig,
        whitelistRules: defaultScanConfiguration.whitelistRules,
        blacklistRules: defaultScanConfiguration.blacklistRules,
        createdBy: 'system'
      }
    });

    console.log(`✅ Created default configuration: ${config.id}`);
    console.log(`   - Name: ${config.name}`);
    console.log(`   - Max Score: ${config.maxScore}`);
    console.log(`   - Version: ${config.version}`);
    console.log(`   - Active: ${config.isActive}`);
    console.log(`   - Default: ${config.isDefault}`);

    // Create configuration history entry
    await prisma.scanConfigurationHistory.create({
      data: {
        configurationId: config.id,
        version: config.version,
        changes: {
          action: 'created',
          description: 'Initial default configuration',
          timestamp: new Date().toISOString()
        },
        changedBy: 'system',
        changeDescription: 'Initial seed: 570-point enterprise scanning system',
        newSnapshot: defaultScanConfiguration
      }
    });

    console.log('✅ Created configuration history entry');

    return config;
  } catch (error) {
    console.error('❌ Error seeding configuration:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting seed process...\n');

  try {
    const config = await seedScanConfiguration();

    console.log('\n✅ Seed completed successfully!');
    console.log(`\nConfiguration ID: ${config.id}`);
    console.log('You can now use this configuration for URL scans.\n');
  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
