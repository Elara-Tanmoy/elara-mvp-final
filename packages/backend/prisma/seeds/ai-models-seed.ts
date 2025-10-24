/**
 * AI Models Seed - Migrates existing env-based AI config to database
 *
 * Seeds the 3 AI models currently configured via environment variables:
 * - Claude Sonnet 4.5 (Anthropic)
 * - GPT-4 (OpenAI)
 * - Gemini 1.5 Flash (Google)
 *
 * This enables admin panel management and Test Connection functionality.
 */

import { PrismaClient } from '@prisma/client';
import { apiKeyEncryption } from '../../src/services/apiKeyEncryption.service.js';

const prisma = new PrismaClient();

async function seedAIModels() {
  console.log('🤖 Seeding AI Models from environment variables...');

  // Read API keys from environment
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const googleKey = process.env.GOOGLE_AI_API_KEY;

  if (!anthropicKey || !openaiKey || !googleKey) {
    console.warn('⚠️ WARNING: Some AI API keys missing from environment!');
    console.warn('   ANTHROPIC_API_KEY:', anthropicKey ? '✓ present' : '✗ missing');
    console.warn('   OPENAI_API_KEY:', openaiKey ? '✓ present' : '✗ missing');
    console.warn('   GOOGLE_AI_API_KEY:', googleKey ? '✓ present' : '✗ missing');
    console.warn('   Proceeding with available keys...');
  }

  const models = [];

  // ============================================================================
  // 1. CLAUDE SONNET 4.5 (Anthropic)
  // ============================================================================
  if (anthropicKey) {
    try {
      const encryptedClaudeKey = apiKeyEncryption.encrypt(anthropicKey);

      const claude = await prisma.aIModelDefinition.upsert({
        where: { modelId: 'claude-sonnet-4-20250514' },
        update: {
          name: 'Claude Sonnet 4.5',
          provider: 'anthropic',
          description: 'Anthropic Claude Sonnet 4.5 - Advanced reasoning and analysis',
          modelEndpoint: 'https://api.anthropic.com/v1/messages',
          modelVersion: '2025-05-14',
          contextWindow: 200000,
          apiKey: encryptedClaudeKey,
          avgResponseTime: 2000,
          reliability: 0.98,
          costPer1kTokens: 0.003,
          enabled: true,
          weight: 0.35,
          rank: 1,
          minConfidence: 0.5,
          useInConsensus: true,
          tieBreaker: false,
          requiredForScan: false,
          maxConcurrentReqs: 10,
          maxRequestsPerMin: 50,
          cooldownOnError: 5000
        },
        create: {
          modelId: 'claude-sonnet-4-20250514',
          name: 'Claude Sonnet 4.5',
          provider: 'anthropic',
          description: 'Anthropic Claude Sonnet 4.5 - Advanced reasoning and analysis',
          modelEndpoint: 'https://api.anthropic.com/v1/messages',
          modelVersion: '2025-05-14',
          contextWindow: 200000,
          apiKey: encryptedClaudeKey,
          avgResponseTime: 2000,
          reliability: 0.98,
          costPer1kTokens: 0.003,
          enabled: true,
          weight: 0.35,
          rank: 1,
          minConfidence: 0.5,
          useInConsensus: true,
          tieBreaker: false,
          requiredForScan: false,
          maxConcurrentReqs: 10,
          maxRequestsPerMin: 50,
          cooldownOnError: 5000
        }
      });
      models.push(claude);
      console.log('  ✓ Claude Sonnet 4.5 seeded (weight: 0.35, rank: 1)');
    } catch (error) {
      console.error('  ✗ Failed to seed Claude:', error);
    }
  }

  // ============================================================================
  // 2. GPT-4 (OpenAI)
  // ============================================================================
  if (openaiKey) {
    try {
      const encryptedOpenaiKey = apiKeyEncryption.encrypt(openaiKey);

      const gpt4 = await prisma.aIModelDefinition.upsert({
        where: { modelId: 'gpt-4' },
        update: {
          name: 'OpenAI GPT-4',
          provider: 'openai',
          description: 'OpenAI GPT-4 - Powerful language understanding',
          modelEndpoint: 'https://api.openai.com/v1/chat/completions',
          modelVersion: 'gpt-4-0613',
          contextWindow: 8192,
          apiKey: encryptedOpenaiKey,
          avgResponseTime: 2500,
          reliability: 0.97,
          costPer1kTokens: 0.03,
          enabled: true,
          weight: 0.35,
          rank: 2,
          minConfidence: 0.5,
          useInConsensus: true,
          tieBreaker: false,
          requiredForScan: false,
          maxConcurrentReqs: 10,
          maxRequestsPerMin: 50,
          cooldownOnError: 5000
        },
        create: {
          modelId: 'gpt-4',
          name: 'OpenAI GPT-4',
          provider: 'openai',
          description: 'OpenAI GPT-4 - Powerful language understanding',
          modelEndpoint: 'https://api.openai.com/v1/chat/completions',
          modelVersion: 'gpt-4-0613',
          contextWindow: 8192,
          apiKey: encryptedOpenaiKey,
          avgResponseTime: 2500,
          reliability: 0.97,
          costPer1kTokens: 0.03,
          enabled: true,
          weight: 0.35,
          rank: 2,
          minConfidence: 0.5,
          useInConsensus: true,
          tieBreaker: false,
          requiredForScan: false,
          maxConcurrentReqs: 10,
          maxRequestsPerMin: 50,
          cooldownOnError: 5000
        }
      });
      models.push(gpt4);
      console.log('  ✓ GPT-4 seeded (weight: 0.35, rank: 2)');
    } catch (error) {
      console.error('  ✗ Failed to seed GPT-4:', error);
    }
  }

  // ============================================================================
  // 3. GEMINI 1.5 FLASH (Google)
  // ============================================================================
  if (googleKey) {
    try {
      const encryptedGoogleKey = apiKeyEncryption.encrypt(googleKey);

      const gemini = await prisma.aIModelDefinition.upsert({
        where: { modelId: 'gemini-1.5-flash' },
        update: {
          name: 'Google Gemini 1.5 Flash',
          provider: 'google',
          description: 'Google Gemini 1.5 Flash - Fast and efficient',
          modelEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
          modelVersion: '1.5-flash',
          contextWindow: 1000000,
          apiKey: encryptedGoogleKey,
          avgResponseTime: 1500,
          reliability: 0.96,
          costPer1kTokens: 0.0001,
          enabled: true,
          weight: 0.30,
          rank: 3,
          minConfidence: 0.5,
          useInConsensus: true,
          tieBreaker: true,
          requiredForScan: false,
          maxConcurrentReqs: 10,
          maxRequestsPerMin: 50,
          cooldownOnError: 5000
        },
        create: {
          modelId: 'gemini-1.5-flash',
          name: 'Google Gemini 1.5 Flash',
          provider: 'google',
          description: 'Google Gemini 1.5 Flash - Fast and efficient',
          modelEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
          modelVersion: '1.5-flash',
          contextWindow: 1000000,
          apiKey: encryptedGoogleKey,
          avgResponseTime: 1500,
          reliability: 0.96,
          costPer1kTokens: 0.0001,
          enabled: true,
          weight: 0.30,
          rank: 3,
          minConfidence: 0.5,
          useInConsensus: true,
          tieBreaker: true,
          requiredForScan: false,
          maxConcurrentReqs: 10,
          maxRequestsPerMin: 50,
          cooldownOnError: 5000
        }
      });
      models.push(gemini);
      console.log('  ✓ Gemini 1.5 Flash seeded (weight: 0.30, rank: 3)');
    } catch (error) {
      console.error('  ✗ Failed to seed Gemini:', error);
    }
  }

  console.log(`\n✅ AI Models seed complete: ${models.length}/3 models seeded`);

  if (models.length === 0) {
    console.error('\n❌ ERROR: No AI models were seeded!');
    console.error('   Please check your environment variables and try again.');
    process.exit(1);
  }

  return models;
}

async function main() {
  try {
    await seedAIModels();
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

export { seedAIModels };
