/**
 * Training Data Validation Service
 *
 * Validates training data quality and enforces schema requirements:
 * - Required fields validation
 * - URL format validation
 * - Label consistency
 * - Data quality metrics
 * - Duplicate detection
 * - Feature completeness checks
 */

import { logger } from '../../config/logger.js';
import crypto from 'crypto';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    duplicates: number;
    missingFields: Record<string, number>;
  };
}

export interface DataQualityMetrics {
  completeness: number; // % of records with all required fields
  consistency: number; // % of records with valid labels
  uniqueness: number; // % of unique URLs
  validity: number; // % of valid URLs
  overall: number; // Average of all metrics
}

class DataValidationService {
  private readonly REQUIRED_FIELDS = ['url', 'label', 'source'];
  private readonly OPTIONAL_FIELDS = ['confidence', 'timestamp', 'features', 'metadata'];
  private readonly VALID_LABELS = ['phishing', 'benign', 'suspicious'];

  /**
   * Validate training data batch
   */
  validate(records: any[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const seenHashes = new Set<string>();
    let validCount = 0;
    let duplicateCount = 0;
    const missingFields: Record<string, number> = {};

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const recordErrors: string[] = [];

      // Check required fields
      for (const field of this.REQUIRED_FIELDS) {
        if (!record[field]) {
          recordErrors.push(`Missing required field: ${field}`);
          missingFields[field] = (missingFields[field] || 0) + 1;
        }
      }

      // Validate URL
      if (record.url) {
        if (!this.isValidURL(record.url)) {
          recordErrors.push(`Invalid URL format: ${record.url}`);
        }
      }

      // Validate label
      if (record.label && !this.VALID_LABELS.includes(record.label)) {
        recordErrors.push(`Invalid label: ${record.label}. Must be one of: ${this.VALID_LABELS.join(', ')}`);
      }

      // Check for duplicates
      if (record.url) {
        const hash = this.hashURL(record.url);
        if (seenHashes.has(hash)) {
          duplicateCount++;
          warnings.push(`Duplicate URL at record ${i + 1}: ${record.url}`);
        } else {
          seenHashes.add(hash);
        }
      }

      // Validate confidence (if present)
      if (record.confidence !== undefined) {
        const conf = parseFloat(record.confidence);
        if (isNaN(conf) || conf < 0 || conf > 1) {
          recordErrors.push(`Invalid confidence value: ${record.confidence}. Must be between 0 and 1`);
        }
      }

      if (recordErrors.length === 0) {
        validCount++;
      } else {
        errors.push(`Record ${i + 1}: ${recordErrors.join(', ')}`);
      }
    }

    const isValid = errors.length === 0;

    const result: ValidationResult = {
      isValid,
      errors,
      warnings,
      stats: {
        totalRecords: records.length,
        validRecords: validCount,
        invalidRecords: records.length - validCount,
        duplicates: duplicateCount,
        missingFields
      }
    };

    logger.info(`[Data Validation] Validated ${records.length} records: ${validCount} valid, ${errors.length} errors, ${warnings.length} warnings`);

    return result;
  }

  /**
   * Calculate data quality metrics
   */
  calculateQualityMetrics(records: any[]): DataQualityMetrics {
    let completeCount = 0;
    let consistentCount = 0;
    let validUrlCount = 0;
    const uniqueUrls = new Set<string>();

    for (const record of records) {
      // Completeness: has all required fields
      const isComplete = this.REQUIRED_FIELDS.every(field => record[field]);
      if (isComplete) completeCount++;

      // Consistency: valid label
      if (this.VALID_LABELS.includes(record.label)) {
        consistentCount++;
      }

      // Validity: valid URL
      if (record.url && this.isValidURL(record.url)) {
        validUrlCount++;
      }

      // Uniqueness
      if (record.url) {
        uniqueUrls.add(this.hashURL(record.url));
      }
    }

    const total = records.length || 1; // Avoid division by zero

    const completeness = (completeCount / total) * 100;
    const consistency = (consistentCount / total) * 100;
    const validity = (validUrlCount / total) * 100;
    const uniqueness = (uniqueUrls.size / total) * 100;
    const overall = (completeness + consistency + validity + uniqueness) / 4;

    const metrics: DataQualityMetrics = {
      completeness: Math.round(completeness * 10) / 10,
      consistency: Math.round(consistency * 10) / 10,
      uniqueness: Math.round(uniqueness * 10) / 10,
      validity: Math.round(validity * 10) / 10,
      overall: Math.round(overall * 10) / 10
    };

    logger.info(`[Data Validation] Quality metrics:`, metrics);

    return metrics;
  }

  /**
   * Deduplicate records by URL
   */
  deduplicate(records: any[]): any[] {
    const seen = new Set<string>();
    const unique: any[] = [];

    for (const record of records) {
      if (!record.url) continue;

      const hash = this.hashURL(record.url);
      if (!seen.has(hash)) {
        seen.add(hash);
        unique.push(record);
      }
    }

    logger.info(`[Data Validation] Deduplicated ${records.length} → ${unique.length} records`);

    return unique;
  }

  /**
   * Validate schema against expected format
   */
  validateSchema(records: any[]): {
    isValid: boolean;
    detectedSchema: Record<string, string>;
    missingRequiredFields: string[];
  } {
    if (records.length === 0) {
      return {
        isValid: false,
        detectedSchema: {},
        missingRequiredFields: this.REQUIRED_FIELDS
      };
    }

    const firstRecord = records[0];
    const detectedSchema: Record<string, string> = {};

    // Detect schema from first record
    for (const key of Object.keys(firstRecord)) {
      const value = firstRecord[key];
      detectedSchema[key] = typeof value;
    }

    // Check required fields
    const missingRequiredFields = this.REQUIRED_FIELDS.filter(
      field => !detectedSchema[field]
    );

    const isValid = missingRequiredFields.length === 0;

    return {
      isValid,
      detectedSchema,
      missingRequiredFields
    };
  }

  /**
   * Filter out invalid records
   */
  filterValid(records: any[]): any[] {
    return records.filter(record => {
      // Must have required fields
      for (const field of this.REQUIRED_FIELDS) {
        if (!record[field]) return false;
      }

      // Must have valid URL
      if (!this.isValidURL(record.url)) return false;

      // Must have valid label
      if (!this.VALID_LABELS.includes(record.label)) return false;

      return true;
    });
  }

  /**
   * Validate URL format
   */
  private isValidURL(url: string): boolean {
    try {
      const parsed = new URL(url);
      // Must have protocol and hostname
      return !!(parsed.protocol && parsed.hostname);
    } catch {
      return false;
    }
  }

  /**
   * Hash URL for duplicate detection
   */
  private hashURL(url: string): string {
    try {
      // Normalize URL before hashing
      const parsed = new URL(url);
      const normalized = `${parsed.hostname}${parsed.pathname}${parsed.search}`.toLowerCase();
      return crypto.createHash('sha256').update(normalized).digest('hex');
    } catch {
      // If URL parsing fails, hash raw string
      return crypto.createHash('sha256').update(url.toLowerCase()).digest('hex');
    }
  }

  /**
   * Validate features object (if present)
   */
  validateFeatures(features: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (typeof features !== 'object' || features === null) {
      errors.push('Features must be an object');
      return { isValid: false, errors };
    }

    // Check for recommended feature fields
    const recommendedFields = ['domainAge', 'tldRisk', 'tiHitCount', 'lexicalFeatures'];
    const missingRecommended = recommendedFields.filter(field => !features[field]);

    if (missingRecommended.length > 0) {
      // Just a warning, not an error
      logger.debug(`[Data Validation] Missing recommended feature fields: ${missingRecommended.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Balance dataset (ensure equal phishing/benign distribution)
   */
  balanceDataset(records: any[]): {
    balanced: any[];
    removed: {
      phishing: number;
      benign: number;
    };
  } {
    const phishing = records.filter(r => r.label === 'phishing');
    const benign = records.filter(r => r.label === 'benign');
    const suspicious = records.filter(r => r.label === 'suspicious');

    // Find minimum count
    const minCount = Math.min(phishing.length, benign.length);

    // Sample equal amounts
    const balancedPhishing = this.sampleRandom(phishing, minCount);
    const balancedBenign = this.sampleRandom(benign, minCount);

    const balanced = [
      ...balancedPhishing,
      ...balancedBenign,
      ...suspicious // Keep all suspicious
    ];

    logger.info(`[Data Validation] Balanced dataset: ${phishing.length} phishing, ${benign.length} benign → ${minCount} each`);

    return {
      balanced,
      removed: {
        phishing: phishing.length - balancedPhishing.length,
        benign: benign.length - balancedBenign.length
      }
    };
  }

  /**
   * Random sample from array
   */
  private sampleRandom<T>(arr: T[], count: number): T[] {
    if (count >= arr.length) return arr;

    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}

export const dataValidationService = new DataValidationService();
export default dataValidationService;
