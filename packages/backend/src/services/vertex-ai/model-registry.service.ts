/**
 * Vertex AI Model Registry Service
 *
 * Manages model versions, metadata, and deployment status:
 * - Model registration and versioning
 * - Performance metrics tracking
 * - Deployment status monitoring
 * - Model lineage
 */

import { logger } from '../../config/logger.js';
import { prisma } from '../../config/database.js';

export interface ModelMetrics {
  f1Score: number;
  precision: number;
  recall: number;
  fpr: number; // False positive rate
  fnr: number; // False negative rate
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
}

export interface RegisteredModel {
  id: string;
  name: string;
  version: string;
  stage: 'development' | 'staging' | 'production';
  vertexModelId?: string;
  vertexEndpointId?: string;
  metrics?: ModelMetrics;
  trainedAt: Date;
  deployedAt?: Date;
  isActive: boolean;
}

class ModelRegistryService {
  /**
   * Register a new model version
   */
  async registerModel(model: {
    name: string;
    version: string;
    vertexModelId?: string;
    metrics?: ModelMetrics;
    metadata?: Record<string, any>;
  }): Promise<RegisteredModel> {
    try {
      const registered = await prisma.v2ModelRegistry.create({
        data: {
          modelName: model.name,
          version: model.version,
          vertexModelId: model.vertexModelId,
          vertexEndpointId: null,
          stage: 'development',
          metrics: model.metrics as any,
          metadata: model.metadata as any,
          isActive: false,
          trainedAt: new Date()
        }
      });

      logger.info(`[Model Registry] Registered model ${model.name} v${model.version}`);

      return this.toRegisteredModel(registered);
    } catch (error) {
      logger.error('[Model Registry] Error registering model:', error);
      throw error;
    }
  }

  /**
   * Deploy model to endpoint
   */
  async deployModel(
    modelId: string,
    endpointId: string,
    stage: 'staging' | 'production'
  ): Promise<void> {
    try {
      await prisma.v2ModelRegistry.update({
        where: { id: modelId },
        data: {
          vertexEndpointId: endpointId,
          stage,
          deployedAt: new Date(),
          isActive: true
        }
      });

      logger.info(`[Model Registry] Deployed model ${modelId} to ${stage}`);
    } catch (error) {
      logger.error('[Model Registry] Error deploying model:', error);
      throw error;
    }
  }

  /**
   * Get active model for a given name
   */
  async getActiveModel(modelName: string): Promise<RegisteredModel | null> {
    try {
      const model = await prisma.v2ModelRegistry.findFirst({
        where: {
          modelName,
          isActive: true,
          stage: 'production'
        },
        orderBy: {
          deployedAt: 'desc'
        }
      });

      return model ? this.toRegisteredModel(model) : null;
    } catch (error) {
      logger.error('[Model Registry] Error getting active model:', error);
      return null;
    }
  }

  /**
   * List all versions of a model
   */
  async listModelVersions(modelName: string): Promise<RegisteredModel[]> {
    try {
      const models = await prisma.v2ModelRegistry.findMany({
        where: { modelName },
        orderBy: { trainedAt: 'desc' }
      });

      return models.map(m => this.toRegisteredModel(m));
    } catch (error) {
      logger.error('[Model Registry] Error listing model versions:', error);
      return [];
    }
  }

  /**
   * Update model metrics
   */
  async updateMetrics(modelId: string, metrics: Partial<ModelMetrics>): Promise<void> {
    try {
      const model = await prisma.v2ModelRegistry.findUnique({
        where: { id: modelId }
      });

      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }

      const updatedMetrics = {
        ...(model.metrics as any || {}),
        ...metrics
      };

      await prisma.v2ModelRegistry.update({
        where: { id: modelId },
        data: { metrics: updatedMetrics as any }
      });

      logger.info(`[Model Registry] Updated metrics for model ${modelId}`);
    } catch (error) {
      logger.error('[Model Registry] Error updating metrics:', error);
      throw error;
    }
  }

  /**
   * Deactivate a model
   */
  async deactivateModel(modelId: string): Promise<void> {
    try {
      await prisma.v2ModelRegistry.update({
        where: { id: modelId },
        data: { isActive: false }
      });

      logger.info(`[Model Registry] Deactivated model ${modelId}`);
    } catch (error) {
      logger.error('[Model Registry] Error deactivating model:', error);
      throw error;
    }
  }

  /**
   * Get model statistics
   */
  async getStats(): Promise<{
    totalModels: number;
    activeModels: number;
    productionModels: number;
    averageF1: number;
    averageLatency: number;
  }> {
    try {
      const models = await prisma.v2ModelRegistry.findMany();

      const activeModels = models.filter(m => m.isActive);
      const productionModels = models.filter(m => m.stage === 'production');

      const metricsModels = models.filter(m => m.metrics);
      const avgF1 = metricsModels.reduce((sum, m) => sum + ((m.metrics as any)?.f1Score || 0), 0) / (metricsModels.length || 1);
      const avgLatency = metricsModels.reduce((sum, m) => sum + ((m.metrics as any)?.latencyP95 || 0), 0) / (metricsModels.length || 1);

      return {
        totalModels: models.length,
        activeModels: activeModels.length,
        productionModels: productionModels.length,
        averageF1: Math.round(avgF1 * 100) / 100,
        averageLatency: Math.round(avgLatency)
      };
    } catch (error) {
      logger.error('[Model Registry] Error getting stats:', error);
      return {
        totalModels: 0,
        activeModels: 0,
        productionModels: 0,
        averageF1: 0,
        averageLatency: 0
      };
    }
  }

  /**
   * Convert Prisma model to RegisteredModel
   */
  private toRegisteredModel(model: any): RegisteredModel {
    return {
      id: model.id,
      name: model.modelName,
      version: model.version,
      stage: model.stage,
      vertexModelId: model.vertexModelId || undefined,
      vertexEndpointId: model.vertexEndpointId || undefined,
      metrics: model.metrics as ModelMetrics | undefined,
      trainedAt: model.trainedAt,
      deployedAt: model.deployedAt || undefined,
      isActive: model.isActive
    };
  }
}

export const modelRegistryService = new ModelRegistryService();
export default modelRegistryService;
