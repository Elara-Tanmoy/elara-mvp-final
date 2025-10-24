/**
 * AI Consensus Config Seed
 *
 * Creates the default active consensus configuration that links to the AI models.
 * This configuration defines how the 3 AI models work together to produce
 * the final risk multiplier (0.7-1.3×).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedConsensusConfig() {
  console.log('⚖️ Seeding AI Consensus Configuration...');

  try {
    // Get the AI model IDs
    const claude = await prisma.aIModelDefinition.findUnique({
      where: { modelId: 'claude-sonnet-4-20250514' }
    });

    const gpt4 = await prisma.aIModelDefinition.findUnique({
      where: { modelId: 'gpt-4' }
    });

    const gemini = await prisma.aIModelDefinition.findUnique({
      where: { modelId: 'gemini-1.5-flash' }
    });

    const enabledModels = [];
    if (claude) enabledModels.push(claude.modelId);
    if (gpt4) enabledModels.push(gpt4.modelId);
    if (gemini) enabledModels.push(gemini.modelId);

    if (enabledModels.length === 0) {
      console.error('  ✗ No AI models found in database. Run ai-models-seed first!');
      return null;
    }

    // Create or update the default consensus configuration
    const consensusConfig = await prisma.aIConsensusConfig.upsert({
      where: { name: 'Production Consensus' },
      update: {
        description: 'Production consensus configuration using weighted vote from all available AI models',
        isActive: true,
        strategy: 'weighted_vote',
        minimumModels: Math.min(2, enabledModels.length), // Require at least 2 models, or all if less than 2
        confidenceThreshold: 0.7,
        multiplierMethod: 'average_confidence',
        multiplierRange: {
          min: 0.7,
          max: 1.3
        },
        penalizeDisagreement: true,
        disagreementPenalty: 0.1,
        enabledModels,
        allowPartialConsensus: true,
        timeoutMs: 30000,
        retryFailedModels: true
      },
      create: {
        name: 'Production Consensus',
        description: 'Production consensus configuration using weighted vote from all available AI models',
        isActive: true,
        strategy: 'weighted_vote',
        minimumModels: Math.min(2, enabledModels.length),
        confidenceThreshold: 0.7,
        multiplierMethod: 'average_confidence',
        multiplierRange: {
          min: 0.7,
          max: 1.3
        },
        penalizeDisagreement: true,
        disagreementPenalty: 0.1,
        enabledModels,
        allowPartialConsensus: true,
        timeoutMs: 30000,
        retryFailedModels: true,
        createdBy: 'system'
      }
    });

    console.log('  ✓ Production Consensus config created/updated');
    console.log(`    - Strategy: ${consensusConfig.strategy}`);
    console.log(`    - Enabled Models: ${consensusConfig.enabledModels.length}`);
    console.log(`    - Multiplier Range: ${(consensusConfig.multiplierRange as any).min} - ${(consensusConfig.multiplierRange as any).max}`);
    console.log(`    - Is Active: ${consensusConfig.isActive}`);

    // Create additional preset configurations
    const presets = [
      {
        name: 'Strict Consensus',
        description: 'Requires unanimous agreement from all models (highest confidence)',
        strategy: 'unanimous',
        minimumModels: enabledModels.length,
        confidenceThreshold: 0.85,
        multiplierMethod: 'max_confidence',
        multiplierRange: { min: 0.8, max: 1.2 },
        penalizeDisagreement: true,
        disagreementPenalty: 0.15,
        enabledModels,
        allowPartialConsensus: false
      },
      {
        name: 'Fast Consensus',
        description: 'Uses highest confidence model only (fastest, single model)',
        strategy: 'highest_confidence',
        minimumModels: 1,
        confidenceThreshold: 0.6,
        multiplierMethod: 'max_confidence',
        multiplierRange: { min: 0.7, max: 1.3 },
        penalizeDisagreement: false,
        disagreementPenalty: 0,
        enabledModels: enabledModels.slice(0, 1), // Only use first model
        allowPartialConsensus: true
      },
      {
        name: 'Balanced Consensus',
        description: 'Balanced approach with majority vote (2 out of 3 models)',
        strategy: 'majority',
        minimumModels: 2,
        confidenceThreshold: 0.75,
        multiplierMethod: 'average_confidence',
        multiplierRange: { min: 0.7, max: 1.3 },
        penalizeDisagreement: true,
        disagreementPenalty: 0.05,
        enabledModels,
        allowPartialConsensus: true
      }
    ];

    for (const preset of presets) {
      try {
        await prisma.aIConsensusConfig.upsert({
          where: { name: preset.name },
          update: {
            ...preset,
            isActive: false // Presets are not active by default
          },
          create: {
            ...preset,
            isActive: false,
            timeoutMs: 30000,
            retryFailedModels: true,
            createdBy: 'system'
          }
        });
        console.log(`  ✓ ${preset.name} preset created/updated`);
      } catch (error) {
        console.error(`  ✗ Failed to create ${preset.name}:`, error);
      }
    }

    console.log('\n✅ Consensus configuration seed complete');
    console.log(`   Active: Production Consensus (${enabledModels.length} models)`);
    console.log(`   Presets: 3 additional configurations available`);

    return consensusConfig;
  } catch (error) {
    console.error('  ✗ Failed to seed consensus config:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedConsensusConfig();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      console.log('\n🎉 Seed completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Seed failed:', error);
      process.exit(1);
    });
}

export { seedConsensusConfig };
