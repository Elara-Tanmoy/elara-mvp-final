/**
 * COMPREHENSIVE DATABASE SEEDING SCRIPT
 *
 * Seeds all database tables with initial data:
 * 1. AI Model Definitions (Claude, GPT-4, Gemini)
 * 2. Consensus Configurations (presets for voting)
 * 3. Global Settings (all environment variables)
 * 4. Check Definitions (scan engine configurations)
 *
 * Run this after database migration to populate all necessary data.
 */

import { PrismaClient } from '@prisma/client';
import { seedAIModels } from './ai-models-seed.js';
import { seedConsensusConfigs } from './consensus-config-seed.js';
import { seedGlobalSettings } from './global-settings-seed.js';
import { seedCheckTypes } from './check-types-seed.js';
import { seedEnhancedChecks } from './enhanced-checks-seed.js';

const prisma = new PrismaClient();

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       COMPREHENSIVE DATABASE SEEDING                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Seed AI Model Definitions
    console.log('📊 Step 1: Seeding AI Model Definitions...');
    await seedAIModels();
    console.log('✅ AI Models seeded successfully\n');

    // Step 2: Seed Consensus Configurations
    console.log('⚖️  Step 2: Seeding Consensus Configurations...');
    await seedConsensusConfigs();
    console.log('✅ Consensus Configurations seeded successfully\n');

    // Step 3: Seed Global Settings
    console.log('⚙️  Step 3: Seeding Global Settings (Environment Variables)...');
    await seedGlobalSettings();
    console.log('✅ Global Settings seeded successfully\n');

    // Step 4: Seed Check Types
    console.log('🔍 Step 4: Seeding URL Scan Check Type Definitions...');
    await seedCheckTypes();
    console.log('✅ Check Types seeded successfully\n');

    // Step 5: Seed Enhanced Checks
    console.log('🔍 Step 5: Seeding Enhanced Check Definitions (Advanced Patterns)...');
    await seedEnhancedChecks();
    console.log('✅ Enhanced Checks seeded successfully\n');

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║       ✅ COMPREHENSIVE SEEDING COMPLETE!                  ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('📋 Summary:');
    const aiModelCount = await prisma.aIModelDefinition.count();
    const consensusCount = await prisma.consensusConfiguration.count();
    const settingsCount = await prisma.globalSetting.count();
    const checkTypeCount = await prisma.checkType.count();

    console.log(`   • AI Models: ${aiModelCount}`);
    console.log(`   • Consensus Configs: ${consensusCount}`);
    console.log(`   • Global Settings: ${settingsCount}`);
    console.log(`   • URL Check Types: ${checkTypeCount}`);
    console.log('');

    console.log('🎯 Next Steps:');
    console.log('   1. ✅ Database is fully seeded');
    console.log('   2. 🔄 Restart backend and worker pods');
    console.log('   3. 🌐 Visit admin panel: /admin/scan-engine');
    console.log('   4. 🧪 Test AI model connections');
    console.log('   5. 🚀 Run URL scan to verify integration');
    console.log('');

  } catch (error) {
    console.error('\n❌ Error during comprehensive seeding:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
