/**
 * GLOBAL SETTINGS SEED
 *
 * Seeds all environment variables into GlobalSetting table.
 * This enables 100% admin dashboard control over configuration.
 */

import { PrismaClient } from '@prisma/client';
import { apiKeyEncryption } from '../../src/services/apiKeyEncryption.service.js';

const prisma = new PrismaClient();

interface SettingDefinition {
  key: string;
  category: string;
  isSensitive: boolean;
  description: string;
  required: boolean;
  validation?: string;
}

const SETTINGS: SettingDefinition[] = [
  // ========== API KEYS ==========
  {
    key: 'ANTHROPIC_API_KEY',
    category: 'api_keys',
    isSensitive: true,
    description: 'Anthropic Claude API key for AI analysis',
    required: true
  },
  {
    key: 'OPENAI_API_KEY',
    category: 'api_keys',
    isSensitive: true,
    description: 'OpenAI GPT API key for AI analysis',
    required: true
  },
  {
    key: 'GOOGLE_AI_API_KEY',
    category: 'api_keys',
    isSensitive: true,
    description: 'Google Gemini API key for AI analysis',
    required: true
  },
  {
    key: 'VIRUSTOTAL_API_KEY',
    category: 'api_keys',
    isSensitive: true,
    description: 'VirusTotal API key for threat intelligence',
    required: false
  },
  {
    key: 'GOOGLE_SAFE_BROWSING_API_KEY',
    category: 'api_keys',
    isSensitive: true,
    description: 'Google Safe Browsing API key',
    required: false
  },
  {
    key: 'ABUSEIPDB_API_KEY',
    category: 'api_keys',
    isSensitive: true,
    description: 'AbuseIPDB API key for IP reputation',
    required: false
  },

  // ========== DATABASE ==========
  {
    key: 'DATABASE_URL',
    category: 'database',
    isSensitive: true,
    description: 'PostgreSQL connection string',
    required: true
  },
  {
    key: 'REDIS_URL',
    category: 'database',
    isSensitive: true,
    description: 'Redis connection string for caching and queues',
    required: false
  },
  {
    key: 'NEO4J_URI',
    category: 'database',
    isSensitive: true,
    description: 'Neo4j graph database URI',
    required: false
  },
  {
    key: 'NEO4J_USERNAME',
    category: 'database',
    isSensitive: false,
    description: 'Neo4j username',
    required: false
  },
  {
    key: 'NEO4J_PASSWORD',
    category: 'database',
    isSensitive: true,
    description: 'Neo4j password',
    required: false
  },

  // ========== SECURITY ==========
  {
    key: 'JWT_SECRET',
    category: 'security',
    isSensitive: true,
    description: 'JWT signing secret',
    required: true
  },
  {
    key: 'JWT_REFRESH_SECRET',
    category: 'security',
    isSensitive: true,
    description: 'JWT refresh token secret',
    required: true
  },
  {
    key: 'API_KEY_ENCRYPTION_KEY',
    category: 'security',
    isSensitive: true,
    description: 'Encryption key for API keys (32 bytes)',
    required: true
  },
  {
    key: 'SESSION_SECRET',
    category: 'security',
    isSensitive: true,
    description: 'Session cookie secret',
    required: true
  },

  // ========== EXTERNAL SERVICES ==========
  {
    key: 'TWILIO_ACCOUNT_SID',
    category: 'services',
    isSensitive: false,
    description: 'Twilio account SID for WhatsApp',
    required: false
  },
  {
    key: 'TWILIO_AUTH_TOKEN',
    category: 'services',
    isSensitive: true,
    description: 'Twilio auth token',
    required: false
  },
  {
    key: 'TWILIO_WHATSAPP_NUMBER',
    category: 'services',
    isSensitive: false,
    description: 'Twilio WhatsApp number',
    required: false
  },
  {
    key: 'GOOGLE_CLIENT_ID',
    category: 'services',
    isSensitive: false,
    description: 'Google OAuth client ID',
    required: false
  },
  {
    key: 'GOOGLE_CLIENT_SECRET',
    category: 'services',
    isSensitive: true,
    description: 'Google OAuth client secret',
    required: false
  },
  {
    key: 'FACEBOOK_APP_ID',
    category: 'services',
    isSensitive: false,
    description: 'Facebook OAuth app ID',
    required: false
  },
  {
    key: 'FACEBOOK_APP_SECRET',
    category: 'services',
    isSensitive: true,
    description: 'Facebook OAuth app secret',
    required: false
  },

  // ========== PERFORMANCE ==========
  {
    key: 'SCAN_TIMEOUT',
    category: 'performance',
    isSensitive: false,
    description: 'Default scan timeout in milliseconds',
    required: false
  },
  {
    key: 'CACHE_TTL',
    category: 'performance',
    isSensitive: false,
    description: 'Default cache TTL in seconds',
    required: false
  },
  {
    key: 'MAX_CONCURRENT_SCANS',
    category: 'performance',
    isSensitive: false,
    description: 'Maximum concurrent scans',
    required: false
  },
  {
    key: 'RATE_LIMIT_WINDOW',
    category: 'performance',
    isSensitive: false,
    description: 'Rate limit window in seconds',
    required: false
  },
  {
    key: 'RATE_LIMIT_MAX_REQUESTS',
    category: 'performance',
    isSensitive: false,
    description: 'Max requests per rate limit window',
    required: false
  },

  // ========== FEATURES ==========
  {
    key: 'ENABLE_AI_CONSENSUS',
    category: 'features',
    isSensitive: false,
    description: 'Enable/disable AI consensus feature',
    required: false
  },
  {
    key: 'ENABLE_THREAT_INTELLIGENCE',
    category: 'features',
    isSensitive: false,
    description: 'Enable/disable threat intelligence checks',
    required: false
  },
  {
    key: 'ENABLE_CACHING',
    category: 'features',
    isSensitive: false,
    description: 'Enable/disable result caching',
    required: false
  },
  {
    key: 'ENABLE_QUEUE_PROCESSING',
    category: 'features',
    isSensitive: false,
    description: 'Enable/disable background queue processing',
    required: false
  },

  // ========== APPLICATION ==========
  {
    key: 'NODE_ENV',
    category: 'application',
    isSensitive: false,
    description: 'Node environment (development/staging/production)',
    required: true
  },
  {
    key: 'PORT',
    category: 'application',
    isSensitive: false,
    description: 'API server port',
    required: true
  },
  {
    key: 'FRONTEND_URL',
    category: 'application',
    isSensitive: false,
    description: 'Frontend application URL',
    required: true
  },
  {
    key: 'API_URL',
    category: 'application',
    isSensitive: false,
    description: 'Backend API URL',
    required: true
  },
  {
    key: 'CORS_ORIGIN',
    category: 'application',
    isSensitive: false,
    description: 'Allowed CORS origins (comma-separated)',
    required: true
  }
];

export async function seedGlobalSettings() {
  console.log('🌐 Seeding Global Settings from environment variables...\n');

  let seededCount = 0;
  let skippedCount = 0;
  let missingRequired: string[] = [];

  for (const setting of SETTINGS) {
    const envValue = process.env[setting.key];

    if (!envValue) {
      if (setting.required) {
        console.warn(`  ⚠️  REQUIRED setting missing: ${setting.key}`);
        missingRequired.push(setting.key);
      } else {
        console.log(`  ⊘  Skipped (not in env): ${setting.key}`);
        skippedCount++;
      }
      continue;
    }

    try {
      // Encrypt sensitive values
      const storedValue = setting.isSensitive
        ? apiKeyEncryption.encrypt(envValue)
        : envValue;

      await prisma.globalSetting.upsert({
        where: { key: setting.key },
        update: {
          value: storedValue,
          category: setting.category,
          isSensitive: setting.isSensitive,
          description: setting.description,
          required: setting.required,
          isActive: true,
          updatedAt: new Date()
        },
        create: {
          key: setting.key,
          value: storedValue,
          category: setting.category,
          isSensitive: setting.isSensitive,
          description: setting.description,
          required: setting.required,
          validation: setting.validation,
          environment: process.env.NODE_ENV || 'development',
          isActive: true
        }
      });

      const displayValue = setting.isSensitive
        ? '***ENCRYPTED***'
        : envValue.length > 50
        ? envValue.substring(0, 47) + '...'
        : envValue;

      console.log(`  ✓ ${setting.key} = ${displayValue}`);
      seededCount++;

    } catch (error) {
      console.error(`  ✗ Failed to seed ${setting.key}:`, error);
    }
  }

  console.log(`\n✅ Global Settings seed complete:`);
  console.log(`   - Seeded: ${seededCount} settings`);
  console.log(`   - Skipped: ${skippedCount} settings (not in env)`);

  if (missingRequired.length > 0) {
    console.warn(`\n⚠️  WARNING: ${missingRequired.length} REQUIRED settings missing:`);
    missingRequired.forEach(key => console.warn(`   - ${key}`));
    console.warn(`\n   These should be added to environment variables!`);
  }

  return { seededCount, skippedCount, missingRequired };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedGlobalSettings()
    .then(() => {
      console.log('\n🎉 Global Settings seed completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Global Settings seed failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
