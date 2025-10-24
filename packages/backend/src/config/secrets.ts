/**
 * ==============================================================================
 * ELARA PLATFORM - GCP SECRET MANAGER CLIENT
 * ==============================================================================
 * Centralized secret management using Google Cloud Secret Manager
 * Automatically falls back to environment variables in development
 * ==============================================================================
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { logger } from './logger.js';

const client = new SecretManagerServiceClient();
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'elara-mvp-13082025-u1';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const USE_SECRET_MANAGER = process.env.USE_SECRET_MANAGER === 'true' || IS_PRODUCTION;

// Cache for secrets to avoid repeated API calls
const secretCache = new Map<string, string>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

/**
 * Access a secret from GCP Secret Manager
 * Falls back to environment variable if Secret Manager is disabled
 *
 * @param secretName - Name of the secret in GCP Secret Manager
 * @param envVarName - Optional environment variable name as fallback
 * @returns Secret value
 */
async function accessSecret(
  secretName: string,
  envVarName?: string
): Promise<string> {
  // Check cache first
  const cached = secretCache.get(secretName);
  const cacheTime = cacheTimestamps.get(secretName);

  if (cached && cacheTime && (Date.now() - cacheTime) < CACHE_TTL_MS) {
    return cached;
  }

  // In development or when Secret Manager is disabled, use environment variables
  if (!USE_SECRET_MANAGER) {
    const envValue = process.env[envVarName || secretName.toUpperCase().replace(/-/g, '_')];
    if (envValue) {
      logger.debug(`Using environment variable for secret: ${secretName}`);
      return envValue;
    }
    throw new Error(`Secret ${secretName} not found in environment variables`);
  }

  try {
    const secretPath = `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`;

    logger.debug(`Accessing secret: ${secretName}`);

    const [version] = await client.accessSecretVersion({
      name: secretPath,
    });

    const payload = version.payload?.data?.toString();

    if (!payload) {
      throw new Error(`Secret ${secretName} is empty`);
    }

    // Cache the secret
    secretCache.set(secretName, payload);
    cacheTimestamps.set(secretName, Date.now());

    logger.debug(`Successfully retrieved secret: ${secretName}`);
    return payload;
  } catch (error) {
    logger.error(`Failed to access secret ${secretName}:`, error);

    // Fallback to environment variable if Secret Manager fails
    const envValue = process.env[envVarName || secretName.toUpperCase().replace(/-/g, '_')];
    if (envValue) {
      logger.warn(`Using environment variable fallback for secret: ${secretName}`);
      return envValue;
    }

    throw new Error(`Failed to retrieve secret: ${secretName}`);
  }
}

/**
 * Clear secret cache (useful for testing or forced refresh)
 */
function clearSecretCache(): void {
  secretCache.clear();
  cacheTimestamps.clear();
  logger.info('Secret cache cleared');
}

/**
 * Pre-load commonly used secrets on startup
 */
async function preloadSecrets(): Promise<void> {
  logger.info('Pre-loading secrets...');

  const commonSecrets = [
    'database-url-prod',
    'redis-url',
    'jwt-secret',
    'anthropic-api-key',
    'openai-api-key',
    'gemini-api-key',
  ];

  const promises = commonSecrets.map(async (secret) => {
    try {
      await accessSecret(secret);
      logger.debug(`✓ Pre-loaded: ${secret}`);
    } catch (error) {
      logger.warn(`⚠ Failed to pre-load: ${secret}`);
    }
  });

  await Promise.allSettled(promises);
  logger.info('Secret pre-loading complete');
}

// ==============================================================================
// SECRET GETTERS - Typed accessors for specific secrets
// ==============================================================================

export const secrets = {
  /**
   * Get database connection URL
   */
  getDatabaseUrl: async (env: 'prod' | 'dev' | 'staging' = 'prod'): Promise<string> => {
    const secretName = `database-url-${env}`;
    return accessSecret(secretName, 'DATABASE_URL');
  },

  /**
   * Get Redis connection URL
   */
  getRedisUrl: async (): Promise<string> => {
    return accessSecret('redis-url', 'REDIS_URL');
  },

  /**
   * Get JWT signing secret
   */
  getJwtSecret: async (): Promise<string> => {
    return accessSecret('jwt-secret', 'JWT_SECRET');
  },

  /**
   * Get JWT refresh token secret
   */
  getJwtRefreshSecret: async (): Promise<string> => {
    return accessSecret('jwt-refresh-secret', 'JWT_REFRESH_SECRET');
  },

  /**
   * Get Anthropic (Claude) API key
   */
  getAnthropicApiKey: async (): Promise<string> => {
    return accessSecret('anthropic-api-key', 'ANTHROPIC_API_KEY');
  },

  /**
   * Get OpenAI (GPT-4) API key
   */
  getOpenAiApiKey: async (): Promise<string> => {
    return accessSecret('openai-api-key', 'OPENAI_API_KEY');
  },

  /**
   * Get Google Gemini API key
   */
  getGeminiApiKey: async (): Promise<string> => {
    return accessSecret('gemini-api-key', 'GEMINI_API_KEY');
  },

  /**
   * Get OAuth client secret
   */
  getOAuthClientSecret: async (provider: 'google' | 'facebook' | 'linkedin'): Promise<string> => {
    const secretName = `oauth-${provider}-client-secret`;
    const envVar = `${provider.toUpperCase()}_CLIENT_SECRET`;
    return accessSecret(secretName, envVar);
  },

  /**
   * Get OAuth client ID
   */
  getOAuthClientId: async (provider: 'google' | 'facebook' | 'linkedin'): Promise<string> => {
    const secretName = `oauth-${provider}-client-id`;
    const envVar = `${provider.toUpperCase()}_CLIENT_ID`;
    return accessSecret(secretName, envVar);
  },

  /**
   * Get VirusTotal API key
   */
  getVirusTotalApiKey: async (): Promise<string> => {
    return accessSecret('virustotal-api-key', 'VIRUSTOTAL_API_KEY');
  },

  /**
   * Get Google Safe Browsing API key
   */
  getGoogleSafeBrowsingApiKey: async (): Promise<string> => {
    return accessSecret('google-safe-browsing-api-key', 'GOOGLE_SAFE_BROWSING_KEY');
  },

  /**
   * Get URLScan.io API key
   */
  getUrlScanApiKey: async (): Promise<string> => {
    return accessSecret('urlscan-api-key', 'URLSCAN_API_KEY');
  },

  /**
   * Get AbuseIPDB API key
   */
  getAbuseIpDbApiKey: async (): Promise<string> => {
    return accessSecret('abuseipdb-api-key', 'ABUSEIPDB_API_KEY');
  },

  /**
   * Get Twilio Account SID
   */
  getTwilioAccountSid: async (): Promise<string> => {
    return accessSecret('twilio-account-sid', 'TWILIO_ACCOUNT_SID');
  },

  /**
   * Get Twilio Auth Token
   */
  getTwilioAuthToken: async (): Promise<string> => {
    return accessSecret('twilio-auth-token', 'TWILIO_AUTH_TOKEN');
  },

  /**
   * Get WhatsApp Phone Number ID
   */
  getWhatsAppPhoneNumberId: async (): Promise<string> => {
    return accessSecret('whatsapp-phone-number-id', 'WHATSAPP_PHONE_NUMBER_ID');
  },

  /**
   * Get encryption key
   */
  getEncryptionKey: async (): Promise<string> => {
    return accessSecret('encryption-key', 'ENCRYPTION_KEY');
  },

  /**
   * Get Ethereum private key
   */
  getEthereumPrivateKey: async (): Promise<string> => {
    return accessSecret('ethereum-private-key', 'ETHEREUM_PRIVATE_KEY');
  },

  /**
   * Get Infura Project ID
   */
  getInfuraProjectId: async (): Promise<string> => {
    return accessSecret('infura-project-id', 'INFURA_PROJECT_ID');
  },

  /**
   * Generic secret accessor (use typed methods above when possible)
   */
  get: accessSecret,
};

export { accessSecret, clearSecretCache, preloadSecrets };
export default secrets;
