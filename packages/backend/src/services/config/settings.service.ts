/**
 * GLOBAL SETTINGS SERVICE
 *
 * Manages ALL environment variables and global configuration from database.
 * Replaces hardcoded process.env calls throughout the application.
 *
 * Features:
 * - Get/Set settings with encryption for sensitive values
 * - In-memory caching with TTL
 * - Category-based organization
 * - Environment-specific configs (dev/staging/prod)
 * - Version history tracking
 */

import { prisma } from '../../config/database.js';
import { apiKeyEncryption } from '../apiKeyEncryption.service.js';
import { logger } from '../../config/logger.js';


// In-memory cache
interface CachedSetting {
  value: any;
  timestamp: number;
}

const settingsCache = new Map<string, CachedSetting>();
const CACHE_TTL = 60000; // 1 minute

class SettingsService {
  /**
   * Get a setting value by key
   * Returns from cache if available, otherwise queries database
   */
  async get(key: string, defaultValue?: any): Promise<any> {
    try {
      // Check cache first
      const cached = settingsCache.get(key);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logger.debug(`[Settings] Cache hit for: ${key}`);
        return cached.value;
      }

      // Query database
      const setting = await prisma.globalSetting.findUnique({
        where: { key, isActive: true }
      });

      if (!setting) {
        logger.warn(`[Settings] Key not found: ${key}, using default`);
        return defaultValue !== undefined ? defaultValue : process.env[key];
      }

      // Decrypt if sensitive
      const value = setting.isSensitive && setting.value
        ? apiKeyEncryption.decrypt(setting.value)
        : setting.value;

      // Parse JSON if needed
      let parsedValue = value;
      if (value && typeof value === 'string') {
        try {
          parsedValue = JSON.parse(value);
        } catch {
          // Not JSON, use as-is
          parsedValue = value;
        }
      }

      // Update cache
      settingsCache.set(key, {
        value: parsedValue,
        timestamp: Date.now()
      });

      logger.debug(`[Settings] Retrieved: ${key}`);
      return parsedValue;

    } catch (error) {
      logger.error(`[Settings] Error getting ${key}:`, error);
      return defaultValue !== undefined ? defaultValue : process.env[key];
    }
  }

  /**
   * Get multiple settings by category
   */
  async getByCategory(category: string): Promise<Record<string, any>> {
    try {
      const settings = await prisma.globalSetting.findMany({
        where: { category, isActive: true }
      });

      const result: Record<string, any> = {};
      for (const setting of settings) {
        const value = setting.isSensitive && setting.value
          ? apiKeyEncryption.decrypt(setting.value)
          : setting.value;

        result[setting.key] = value;
      }

      return result;

    } catch (error) {
      logger.error(`[Settings] Error getting category ${category}:`, error);
      return {};
    }
  }

  /**
   * Get all settings (admin use only)
   */
  async getAll(includeValues = false): Promise<any[]> {
    try {
      const settings = await prisma.globalSetting.findMany({
        where: { isActive: true },
        orderBy: [{ category: 'asc' }, { key: 'asc' }]
      });

      return settings.map(setting => ({
        id: setting.id,
        key: setting.key,
        category: setting.category,
        description: setting.description,
        isSensitive: setting.isSensitive,
        required: setting.required,
        environment: setting.environment,
        // Only include value if requested and not sensitive (or encrypted)
        value: includeValues
          ? setting.isSensitive
            ? '***ENCRYPTED***'
            : setting.value
          : undefined,
        version: setting.version,
        updatedAt: setting.updatedAt
      }));

    } catch (error) {
      logger.error('[Settings] Error getting all settings:', error);
      return [];
    }
  }

  /**
   * Set a setting value
   */
  async set(
    key: string,
    value: any,
    options: {
      category?: string;
      isSensitive?: boolean;
      description?: string;
      required?: boolean;
      environment?: string;
      updatedBy?: string;
    } = {}
  ): Promise<boolean> {
    try {
      // Get existing setting
      const existing = await prisma.globalSetting.findUnique({
        where: { key }
      });

      // Prepare value (encrypt if sensitive)
      let storedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (options.isSensitive && storedValue) {
        storedValue = apiKeyEncryption.encrypt(storedValue);
      }

      if (existing) {
        // Update existing
        await prisma.globalSetting.update({
          where: { key },
          data: {
            value: storedValue,
            previousValue: existing.value,
            version: existing.version + 1,
            lastEditedBy: options.updatedBy,
            updatedAt: new Date(),
            ...(options.category && { category: options.category }),
            ...(options.isSensitive !== undefined && { isSensitive: options.isSensitive }),
            ...(options.description && { description: options.description }),
            ...(options.required !== undefined && { required: options.required }),
            ...(options.environment && { environment: options.environment })
          }
        });
      } else {
        // Create new
        await prisma.globalSetting.create({
          data: {
            key,
            value: storedValue,
            category: options.category || 'general',
            isSensitive: options.isSensitive || false,
            description: options.description,
            required: options.required || false,
            environment: options.environment || 'all',
            createdBy: options.updatedBy,
            version: 1
          }
        });
      }

      // Invalidate cache
      settingsCache.delete(key);

      logger.info(`[Settings] Updated: ${key} (sensitive: ${options.isSensitive})`);
      return true;

    } catch (error) {
      logger.error(`[Settings] Error setting ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a setting
   */
  async delete(key: string): Promise<boolean> {
    try {
      await prisma.globalSetting.update({
        where: { key },
        data: { isActive: false }
      });

      settingsCache.delete(key);
      logger.info(`[Settings] Deleted: ${key}`);
      return true;

    } catch (error) {
      logger.error(`[Settings] Error deleting ${key}:`, error);
      return false;
    }
  }

  /**
   * Test a connection (for API keys)
   */
  async testConnection(key: string): Promise<{ success: boolean; message: string; responseTime?: number }> {
    // This will be implemented based on the key type
    // For now, just check if the key exists
    const value = await this.get(key);

    if (!value) {
      return { success: false, message: 'Setting not found or empty' };
    }

    return { success: true, message: 'Setting exists', responseTime: 0 };
  }

  /**
   * Clear all cache (use after bulk updates)
   */
  clearCache(): void {
    settingsCache.clear();
    logger.info('[Settings] Cache cleared');
  }

  /**
   * Get cache stats (for monitoring)
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: settingsCache.size,
      keys: Array.from(settingsCache.keys())
    };
  }
}

export const settingsService = new SettingsService();
