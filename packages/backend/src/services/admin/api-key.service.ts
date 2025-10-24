import { prisma } from '../../config/database.js';
import { Pool } from 'pg';
import crypto from 'crypto';
import { logger } from '../../config/logger.js';

/**
 * API Key Management Service
 * Handles API keys for third-party integrations
 */

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  hashedKey: string;
  organizationId: string;
  permissions: string[];
  rateLimit: number;
  expiresAt?: Date;
  lastUsedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  headers?: Record<string, string>;
  retryPolicy: {
    maxRetries: number;
    retryDelay: number;
  };
  lastTriggeredAt?: Date;
  failureCount: number;
  createdAt: Date;
}

export class ApiKeyService {
  private prisma: PrismaClient;
  private pool: Pool;

  constructor() {
    this.prisma = new PrismaClient();
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  /**
   * Generate a new API key
   */
  async generateApiKey(params: {
    name: string;
    organizationId: string;
    permissions: string[];
    rateLimit?: number;
    expiresInDays?: number;
    createdBy: string;
  }): Promise<{ apiKey: ApiKey; plainKey: string }> {
    try {
      // Generate a secure random key and ID
      const plainKey = `elk_${crypto.randomBytes(32).toString('hex')}`;
      const keyPrefix = plainKey.substring(0, 12);
      const hashedKey = crypto.createHash('sha256').update(plainKey).digest('hex');
      const id = `key_${crypto.randomBytes(16).toString('hex')}`;

      const expiresAt = params.expiresInDays
        ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;

      const result = await this.pool.query(`
        INSERT INTO api_keys (
          id,
          name,
          key_prefix,
          hashed_key,
          organization_id,
          permissions,
          rate_limit,
          expires_at,
          is_active,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, name, key_prefix, organization_id, permissions, rate_limit, expires_at, is_active, created_at, created_by
      `, [
        id,
        params.name,
        keyPrefix,
        hashedKey,
        params.organizationId,
        JSON.stringify(params.permissions),
        params.rateLimit || 1000,
        expiresAt,
        true,
        params.createdBy
      ]);

      const row = result.rows[0];
      const apiKey: ApiKey = {
        id: row.id,
        name: row.name,
        key: '', // Never return the actual key
        keyPrefix: row.key_prefix,
        hashedKey: row.hashed_key,
        organizationId: row.organization_id,
        permissions: Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions),
        rateLimit: row.rate_limit,
        expiresAt: row.expires_at,
        isActive: row.is_active,
        createdAt: row.created_at,
        createdBy: row.created_by
      };

      logger.info(`[API Key] Generated new API key: ${keyPrefix}... for org ${params.organizationId}`);

      return { apiKey, plainKey };
    } catch (error) {
      logger.error('[API Key] Error generating API key:', error);
      throw error;
    }
  }

  /**
   * Validate an API key
   */
  async validateApiKey(plainKey: string): Promise<ApiKey | null> {
    try {
      const hashedKey = crypto.createHash('sha256').update(plainKey).digest('hex');

      const result = await this.pool.query(`
        SELECT
          id, name, key_prefix, hashed_key, organization_id, permissions,
          rate_limit, expires_at, last_used_at, is_active, created_at, created_by
        FROM api_keys
        WHERE hashed_key = $1 AND is_active = true
      `, [hashedKey]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      // Check expiration
      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        logger.warn(`[API Key] Expired API key used: ${row.key_prefix}...`);
        return null;
      }

      // Update last used timestamp
      await this.pool.query(`
        UPDATE api_keys SET last_used_at = NOW() WHERE id = $1
      `, [row.id]);

      return {
        id: row.id,
        name: row.name,
        key: '',
        keyPrefix: row.key_prefix,
        hashedKey: row.hashed_key,
        organizationId: row.organization_id,
        permissions: Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions),
        rateLimit: row.rate_limit,
        expiresAt: row.expires_at,
        lastUsedAt: row.last_used_at,
        isActive: row.is_active,
        createdAt: row.created_at,
        createdBy: row.created_by
      };
    } catch (error) {
      logger.error('[API Key] Error validating API key:', error);
      return null;
    }
  }

  /**
   * List all API keys for an organization
   */
  async listApiKeys(organizationId: string): Promise<ApiKey[]> {
    try {
      const result = await this.pool.query(`
        SELECT
          id, name, key_prefix, organization_id, permissions,
          rate_limit, expires_at, last_used_at, is_active, created_at, created_by
        FROM api_keys
        WHERE organization_id = $1
        ORDER BY created_at DESC
      `, [organizationId]);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        key: '',
        keyPrefix: row.key_prefix,
        hashedKey: '',
        organizationId: row.organization_id,
        permissions: Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions),
        rateLimit: row.rate_limit,
        expiresAt: row.expires_at,
        lastUsedAt: row.last_used_at,
        isActive: row.is_active,
        createdAt: row.created_at,
        createdBy: row.created_by
      }));
    } catch (error) {
      logger.error('[API Key] Error listing API keys:', error);
      throw error;
    }
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string, organizationId: string): Promise<void> {
    try {
      await this.pool.query(`
        UPDATE api_keys
        SET is_active = false
        WHERE id = $1 AND organization_id = $2
      `, [keyId, organizationId]);

      logger.info(`[API Key] Revoked API key: ${keyId}`);
    } catch (error) {
      logger.error('[API Key] Error revoking API key:', error);
      throw error;
    }
  }

  /**
   * Create a webhook configuration
   */
  async createWebhook(params: {
    name: string;
    url: string;
    events: string[];
    organizationId: string;
    headers?: Record<string, string>;
    maxRetries?: number;
    retryDelay?: number;
  }): Promise<WebhookConfig> {
    try {
      // Generate webhook secret and ID
      const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
      const id = `wh_${crypto.randomBytes(16).toString('hex')}`;

      const result = await this.pool.query(`
        INSERT INTO webhooks (
          id, name, url, events, organization_id, secret, headers,
          max_retries, retry_delay, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, name, url, events, secret, is_active, headers,
          max_retries, retry_delay, failure_count, created_at
      `, [
        id,
        params.name,
        params.url,
        JSON.stringify(params.events),
        params.organizationId,
        secret,
        JSON.stringify(params.headers || {}),
        params.maxRetries || 3,
        params.retryDelay || 5000,
        true
      ]);

      const row = result.rows[0];

      return {
        id: row.id,
        name: row.name,
        url: row.url,
        events: Array.isArray(row.events) ? row.events : JSON.parse(row.events),
        secret: row.secret,
        isActive: row.is_active,
        headers: typeof row.headers === 'object' ? row.headers : JSON.parse(row.headers || '{}'),
        retryPolicy: {
          maxRetries: row.max_retries,
          retryDelay: row.retry_delay
        },
        failureCount: row.failure_count,
        createdAt: row.created_at
      };
    } catch (error) {
      logger.error('[Webhook] Error creating webhook:', error);
      throw error;
    }
  }

  /**
   * List webhooks for an organization
   */
  async listWebhooks(organizationId: string): Promise<WebhookConfig[]> {
    try {
      const result = await this.pool.query(`
        SELECT
          id, name, url, events, secret, is_active, headers,
          max_retries, retry_delay, last_triggered_at, failure_count, created_at
        FROM webhooks
        WHERE organization_id = $1
        ORDER BY created_at DESC
      `, [organizationId]);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        url: row.url,
        events: Array.isArray(row.events) ? row.events : JSON.parse(row.events),
        secret: row.secret,
        isActive: row.is_active,
        headers: typeof row.headers === 'object' ? row.headers : JSON.parse(row.headers || '{}'),
        retryPolicy: {
          maxRetries: row.max_retries,
          retryDelay: row.retry_delay
        },
        lastTriggeredAt: row.last_triggered_at,
        failureCount: row.failure_count,
        createdAt: row.created_at
      }));
    } catch (error) {
      logger.error('[Webhook] Error listing webhooks:', error);
      throw error;
    }
  }

  /**
   * Trigger a webhook
   */
  async triggerWebhook(webhookId: string, event: string, payload: any): Promise<boolean> {
    try {
      const result = await this.pool.query(`
        SELECT url, secret, is_active, headers, max_retries, retry_delay
        FROM webhooks
        WHERE id = $1 AND is_active = true
      `, [webhookId]);

      if (result.rows.length === 0) {
        logger.warn(`[Webhook] Webhook not found or inactive: ${webhookId}`);
        return false;
      }

      const webhook = result.rows[0];

      // Generate signature for payload
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const webhookHeaders = typeof webhook.headers === 'object' ? webhook.headers : JSON.parse(webhook.headers || '{}');
      const headers = {
        ...webhookHeaders,
        'Content-Type': 'application/json',
        'X-Elara-Event': event,
        'X-Elara-Signature': signature,
        'X-Elara-Webhook-ID': webhookId
      };

      // Send webhook request
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // Update success
        await this.pool.query(`
          UPDATE webhooks
          SET last_triggered_at = NOW(), failure_count = 0
          WHERE id = $1
        `, [webhookId]);

        logger.info(`[Webhook] Successfully triggered webhook: ${webhookId} for event: ${event}`);
        return true;
      } else {
        // Update failure
        await this.pool.query(`
          UPDATE webhooks
          SET failure_count = failure_count + 1
          WHERE id = $1
        `, [webhookId]);

        logger.error(`[Webhook] Failed to trigger webhook: ${webhookId}, status: ${response.status}`);
        return false;
      }
    } catch (error) {
      logger.error('[Webhook] Error triggering webhook:', error);
      return false;
    }
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string, organizationId: string): Promise<void> {
    try {
      await this.pool.query(`
        DELETE FROM webhooks
        WHERE id = $1 AND organization_id = $2
      `, [webhookId, organizationId]);

      logger.info(`[Webhook] Deleted webhook: ${webhookId}`);
    } catch (error) {
      logger.error('[Webhook] Error deleting webhook:', error);
      throw error;
    }
  }

  /**
   * Get API key usage statistics
   */
  async getApiKeyUsage(keyId: string, days: number = 30): Promise<any> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await this.pool.query(`
        SELECT
          DATE(timestamp) as date,
          COUNT(*)::int as requests,
          AVG("responseTime")::int as avg_response_time,
          COUNT(CASE WHEN "statusCode" >= 400 THEN 1 END)::int as errors
        FROM "api_usage"
        WHERE metadata->>'apiKeyId' = $1
          AND timestamp >= $2
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
      `, [keyId, startDate]);

      return {
        keyId,
        usage: result.rows.map(row => ({
          date: row.date,
          requests: row.requests,
          avgResponseTime: row.avg_response_time,
          errors: row.errors
        }))
      };
    } catch (error) {
      logger.error('[API Key] Error getting usage stats:', error);
      throw error;
    }
  }
}

export const apiKeyService = new ApiKeyService();
