/**
 * FEDERATED LEARNING SERVICE
 * Privacy-preserving collaborative threat detection
 *
 * How it works:
 * 1. Clients download the global model
 * 2. Clients train on their local data (scam URLs, patterns)
 * 3. Clients send only model gradients (not data) to server
 * 4. Server aggregates gradients using Federated Averaging
 * 5. Server updates global model
 * 6. Repeat
 *
 * Privacy: User data never leaves their device
 */

import { logger } from '../../config/logger.js';
import fs from 'fs/promises';
import path from 'path';

interface ModelGradients {
  clientId: string;
  modelVersion: number;
  gradients: number[][];  // Layer-wise gradients
  sampleCount: number;    // Number of samples trained on
  trainingMetrics: {
    loss: number;
    accuracy: number;
  };
  timestamp: number;
}

interface GlobalModel {
  version: number;
  weights: number[][];  // Layer-wise weights
  architecture: {
    inputSize: number;
    hiddenLayers: number[];
    outputSize: number;
  };
  trainingHistory: {
    version: number;
    timestamp: number;
    participatingClients: number;
    aggregatedLoss: number;
    aggregatedAccuracy: number;
  }[];
  createdAt: number;
  updatedAt: number;
}

interface FederatedRound {
  roundNumber: number;
  startTime: number;
  endTime: number | null;
  expectedClients: number;
  receivedGradients: number;
  status: 'collecting' | 'aggregating' | 'completed';
  gradients: ModelGradients[];
}

export class FederatedLearningService {
  private modelsDir: string;
  private globalModel: GlobalModel | null = null;
  private currentRound: FederatedRound | null = null;
  private readonly ROUND_DURATION = 3600000; // 1 hour
  private readonly MIN_CLIENTS_PER_ROUND = 5; // Minimum clients needed to aggregate
  private readonly MODEL_VERSION_FILE = 'global_model.json';

  constructor() {
    this.modelsDir = process.env.FL_MODELS_DIR || './federated_models';
  }

  /**
   * Initialize federated learning service
   */
  async initialize(): Promise<void> {
    try {
      // Ensure models directory exists
      await fs.mkdir(this.modelsDir, { recursive: true });

      // Load existing global model or create new one
      const modelPath = path.join(this.modelsDir, this.MODEL_VERSION_FILE);

      try {
        const modelData = await fs.readFile(modelPath, 'utf-8');
        this.globalModel = JSON.parse(modelData);
        logger.info(`Loaded existing federated model version ${this.globalModel!.version}`);
      } catch (error) {
        // Create initial model
        this.globalModel = this.initializeGlobalModel();
        await this.saveGlobalModel();
        logger.info('Created new federated learning model');
      }

      // Start first round if no round is active
      if (!this.currentRound) {
        this.startNewRound();
      }

      logger.info('Federated Learning service initialized');
    } catch (error) {
      logger.error('Failed to initialize Federated Learning service:', error);
      throw error;
    }
  }

  /**
   * Initialize a new global model with random weights
   */
  private initializeGlobalModel(): GlobalModel {
    // Simple MLP for URL classification:
    // Input: 100 features (URL characteristics)
    // Hidden: [64, 32] neurons
    // Output: 2 (safe vs scam)

    const architecture = {
      inputSize: 100,
      hiddenLayers: [64, 32],
      outputSize: 2,
    };

    // Xavier/He initialization for weights
    const weights: number[][] = [];

    // Input -> First hidden layer
    weights.push(this.randomWeights(architecture.inputSize, architecture.hiddenLayers[0]));

    // Hidden layers
    for (let i = 0; i < architecture.hiddenLayers.length - 1; i++) {
      weights.push(
        this.randomWeights(architecture.hiddenLayers[i], architecture.hiddenLayers[i + 1])
      );
    }

    // Last hidden -> Output
    weights.push(
      this.randomWeights(
        architecture.hiddenLayers[architecture.hiddenLayers.length - 1],
        architecture.outputSize
      )
    );

    return {
      version: 1,
      weights,
      architecture,
      trainingHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Generate random weights using Xavier initialization
   */
  private randomWeights(inputSize: number, outputSize: number): number[] {
    const limit = Math.sqrt(6 / (inputSize + outputSize));
    const size = inputSize * outputSize;
    const weights: number[] = [];

    for (let i = 0; i < size; i++) {
      weights.push((Math.random() * 2 - 1) * limit);
    }

    return weights;
  }

  /**
   * Get current global model for clients to download
   */
  async getGlobalModel(): Promise<GlobalModel> {
    if (!this.globalModel) {
      await this.initialize();
    }

    return this.globalModel!;
  }

  /**
   * Start a new federated learning round
   */
  private startNewRound(): void {
    if (this.currentRound && this.currentRound.status !== 'completed') {
      logger.warn('Cannot start new round - current round still active');
      return;
    }

    const roundNumber = this.currentRound ? this.currentRound.roundNumber + 1 : 1;

    this.currentRound = {
      roundNumber,
      startTime: Date.now(),
      endTime: null,
      expectedClients: 100, // Estimated
      receivedGradients: 0,
      status: 'collecting',
      gradients: [],
    };

    logger.info(`Started federated learning round ${roundNumber}`);

    // Auto-aggregate after ROUND_DURATION
    setTimeout(() => {
      this.aggregateRound();
    }, this.ROUND_DURATION);
  }

  /**
   * Submit client gradients
   */
  async submitGradients(gradients: ModelGradients): Promise<{
    success: boolean;
    message: string;
    nextRoundStartsAt?: number;
  }> {
    if (!this.currentRound) {
      return {
        success: false,
        message: 'No active federated learning round',
      };
    }

    if (this.currentRound.status !== 'collecting') {
      return {
        success: false,
        message: 'Round is not accepting gradients',
      };
    }

    // Validate model version
    if (gradients.modelVersion !== this.globalModel!.version) {
      return {
        success: false,
        message: `Model version mismatch. Expected ${this.globalModel!.version}, got ${gradients.modelVersion}`,
      };
    }

    // Validate gradients structure
    if (!this.validateGradients(gradients.gradients)) {
      return {
        success: false,
        message: 'Invalid gradients structure',
      };
    }

    // Add to round
    this.currentRound.gradients.push(gradients);
    this.currentRound.receivedGradients++;

    logger.info(
      `Received gradients from client ${gradients.clientId} (${this.currentRound.receivedGradients} total)`
    );

    // Check if we have enough clients to aggregate early
    if (this.currentRound.receivedGradients >= this.MIN_CLIENTS_PER_ROUND) {
      // Wait a bit more for other clients
      if (this.currentRound.receivedGradients >= this.MIN_CLIENTS_PER_ROUND * 2) {
        // Aggregate now if we have 2x minimum
        setTimeout(() => this.aggregateRound(), 5000);
      }
    }

    return {
      success: true,
      message: 'Gradients received successfully',
    };
  }

  /**
   * Validate gradients structure matches model
   */
  private validateGradients(gradients: number[][]): boolean {
    if (!this.globalModel) return false;

    // Check number of layers
    if (gradients.length !== this.globalModel.weights.length) {
      return false;
    }

    // Check each layer's dimensions
    for (let i = 0; i < gradients.length; i++) {
      if (gradients[i].length !== this.globalModel.weights[i].length) {
        return false;
      }
    }

    return true;
  }

  /**
   * Aggregate gradients using Federated Averaging (FedAvg)
   */
  private async aggregateRound(): Promise<void> {
    if (!this.currentRound) return;

    if (this.currentRound.status !== 'collecting') {
      logger.warn('Round already aggregated');
      return;
    }

    if (this.currentRound.receivedGradients < this.MIN_CLIENTS_PER_ROUND) {
      logger.warn(
        `Insufficient gradients for round ${this.currentRound.roundNumber}: ${this.currentRound.receivedGradients}/${this.MIN_CLIENTS_PER_ROUND}`
      );

      // Start new round
      this.currentRound.status = 'completed';
      this.startNewRound();
      return;
    }

    this.currentRound.status = 'aggregating';
    logger.info(`Aggregating round ${this.currentRound.roundNumber}...`);

    try {
      // Federated Averaging: weighted average of gradients by sample count
      const totalSamples = this.currentRound.gradients.reduce(
        (sum, g) => sum + g.sampleCount,
        0
      );

      const aggregatedGradients: number[][] = [];

      // Aggregate each layer
      for (let layerIdx = 0; layerIdx < this.globalModel!.weights.length; layerIdx++) {
        const layerSize = this.globalModel!.weights[layerIdx].length;
        const layerGradients = new Array(layerSize).fill(0);

        // Weighted sum of gradients
        for (const clientGradients of this.currentRound.gradients) {
          const weight = clientGradients.sampleCount / totalSamples;

          for (let i = 0; i < layerSize; i++) {
            layerGradients[i] += clientGradients.gradients[layerIdx][i] * weight;
          }
        }

        aggregatedGradients.push(layerGradients);
      }

      // Apply aggregated gradients to global model (gradient descent)
      const learningRate = 0.01;

      for (let layerIdx = 0; layerIdx < this.globalModel!.weights.length; layerIdx++) {
        for (let i = 0; i < this.globalModel!.weights[layerIdx].length; i++) {
          this.globalModel!.weights[layerIdx][i] -=
            learningRate * aggregatedGradients[layerIdx][i];
        }
      }

      // Calculate aggregated metrics
      const avgLoss =
        this.currentRound.gradients.reduce((sum, g) => sum + g.trainingMetrics.loss, 0) /
        this.currentRound.gradients.length;

      const avgAccuracy =
        this.currentRound.gradients.reduce((sum, g) => sum + g.trainingMetrics.accuracy, 0) /
        this.currentRound.gradients.length;

      // Update model version and history
      this.globalModel!.version++;
      this.globalModel!.updatedAt = Date.now();
      this.globalModel!.trainingHistory.push({
        version: this.globalModel!.version,
        timestamp: Date.now(),
        participatingClients: this.currentRound.receivedGradients,
        aggregatedLoss: avgLoss,
        aggregatedAccuracy: avgAccuracy,
      });

      // Save updated model
      await this.saveGlobalModel();

      // Mark round as completed
      this.currentRound.endTime = Date.now();
      this.currentRound.status = 'completed';

      logger.info(
        `Round ${this.currentRound.roundNumber} completed! New model version: ${this.globalModel!.version} (Loss: ${avgLoss.toFixed(4)}, Accuracy: ${avgAccuracy.toFixed(4)})`
      );

      // Save round history
      await this.saveRoundHistory(this.currentRound);

      // Start next round
      this.startNewRound();
    } catch (error) {
      logger.error('Error aggregating round:', error);
      this.currentRound.status = 'completed';
      this.startNewRound();
    }
  }

  /**
   * Save global model to disk
   */
  private async saveGlobalModel(): Promise<void> {
    const modelPath = path.join(this.modelsDir, this.MODEL_VERSION_FILE);
    await fs.writeFile(modelPath, JSON.stringify(this.globalModel, null, 2));

    // Also save versioned backup
    const versionedPath = path.join(
      this.modelsDir,
      `model_v${this.globalModel!.version}.json`
    );
    await fs.writeFile(versionedPath, JSON.stringify(this.globalModel, null, 2));

    logger.info(`Saved global model version ${this.globalModel!.version}`);
  }

  /**
   * Save round history
   */
  private async saveRoundHistory(round: FederatedRound): Promise<void> {
    const historyPath = path.join(this.modelsDir, 'rounds', `round_${round.roundNumber}.json`);
    await fs.mkdir(path.dirname(historyPath), { recursive: true });

    // Don't save full gradients (too large), just metadata
    const roundSummary = {
      roundNumber: round.roundNumber,
      startTime: round.startTime,
      endTime: round.endTime,
      receivedGradients: round.receivedGradients,
      status: round.status,
      clients: round.gradients.map((g) => ({
        clientId: g.clientId,
        sampleCount: g.sampleCount,
        trainingMetrics: g.trainingMetrics,
        timestamp: g.timestamp,
      })),
    };

    await fs.writeFile(historyPath, JSON.stringify(roundSummary, null, 2));
  }

  /**
   * Get current round status
   */
  getCurrentRound(): FederatedRound | null {
    return this.currentRound
      ? {
          ...this.currentRound,
          gradients: [], // Don't expose gradients
        }
      : null;
  }

  /**
   * Get training statistics
   */
  getTrainingStats(): {
    currentVersion: number;
    totalRounds: number;
    lastUpdate: number;
    recentHistory: any[];
  } {
    if (!this.globalModel) {
      return {
        currentVersion: 0,
        totalRounds: 0,
        lastUpdate: 0,
        recentHistory: [],
      };
    }

    return {
      currentVersion: this.globalModel.version,
      totalRounds: this.globalModel.trainingHistory.length,
      lastUpdate: this.globalModel.updatedAt,
      recentHistory: this.globalModel.trainingHistory.slice(-10), // Last 10 rounds
    };
  }

  /**
   * Predict using the global model (server-side inference)
   * Used for comparison and testing
   */
  async predict(features: number[]): Promise<{ safe: number; scam: number }> {
    if (!this.globalModel) {
      throw new Error('Model not initialized');
    }

    if (features.length !== this.globalModel.architecture.inputSize) {
      throw new Error(`Expected ${this.globalModel.architecture.inputSize} features, got ${features.length}`);
    }

    let activations = features;

    // Forward pass through network
    for (let layerIdx = 0; layerIdx < this.globalModel.weights.length; layerIdx++) {
      const weights = this.globalModel.weights[layerIdx];
      const inputSize = layerIdx === 0
        ? this.globalModel.architecture.inputSize
        : this.globalModel.architecture.hiddenLayers[layerIdx - 1];

      const outputSize = layerIdx < this.globalModel.architecture.hiddenLayers.length
        ? this.globalModel.architecture.hiddenLayers[layerIdx]
        : this.globalModel.architecture.outputSize;

      const newActivations = new Array(outputSize).fill(0);

      // Matrix multiplication
      for (let i = 0; i < outputSize; i++) {
        let sum = 0;
        for (let j = 0; j < inputSize; j++) {
          sum += activations[j] * weights[i * inputSize + j];
        }
        // ReLU activation (except last layer)
        newActivations[i] = layerIdx < this.globalModel.weights.length - 1
          ? Math.max(0, sum)
          : sum;
      }

      activations = newActivations;
    }

    // Softmax on output layer
    const expScores = activations.map(Math.exp);
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    const probabilities = expScores.map((exp) => exp / sumExp);

    return {
      safe: probabilities[0],
      scam: probabilities[1],
    };
  }
}

// Singleton instance
export const federatedLearningService = new FederatedLearningService();
