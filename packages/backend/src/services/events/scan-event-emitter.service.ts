/**
 * Scan Event Emitter Service
 * Provides real-time event streaming for scan operations
 * Used by Scanner to emit granular progress updates to frontend
 */

import { emitToScanRoom } from '../../config/socket.js';
import { logger } from '../../config/logger.js';

export interface ScanEventData {
  scanId: string;
  timestamp: string;
  stage: string;
  message: string;
  data?: any;
}

export interface ScanStageEvent {
  scanId: string;
  stageNumber: number;
  stageName: string;
  status: 'started' | 'completed' | 'error';
  message?: string;
  data?: any;
}

export interface ScanCheckEvent {
  scanId: string;
  checkName: string;
  category?: string;
  status: 'started' | 'completed' | 'error';
  score?: number;
  message?: string;
  data?: any;
}

export interface ScanProgressEvent {
  scanId: string;
  percentage: number;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
}

export interface ScanLogEvent {
  scanId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  data?: any;
}

/**
 * Scan Event Emitter Service
 * Emits real-time events for scan progress
 */
export class ScanEventEmitter {
  private scanId: string;

  constructor(scanId: string) {
    this.scanId = scanId;
  }

  /**
   * Emit when a scan stage starts
   */
  emitStageStart(stageNumber: number, stageName: string, message?: string): void {
    const event: ScanStageEvent = {
      scanId: this.scanId,
      stageNumber,
      stageName,
      status: 'started',
      message: message || `Stage ${stageNumber}: ${stageName} started`
    };

    emitToScanRoom(this.scanId, 'scan:stage:start', event);
    logger.info(`[ScanEvent ${this.scanId}] Stage ${stageNumber} started: ${stageName}`);
  }

  /**
   * Emit when a scan stage completes
   */
  emitStageComplete(stageNumber: number, stageName: string, data?: any): void {
    const event: ScanStageEvent = {
      scanId: this.scanId,
      stageNumber,
      stageName,
      status: 'completed',
      message: `Stage ${stageNumber}: ${stageName} completed`,
      data
    };

    emitToScanRoom(this.scanId, 'scan:stage:complete', event);
    logger.info(`[ScanEvent ${this.scanId}] Stage ${stageNumber} completed: ${stageName}`);
  }

  /**
   * Emit when a scan stage encounters an error
   */
  emitStageError(stageNumber: number, stageName: string, error: Error): void {
    const event: ScanStageEvent = {
      scanId: this.scanId,
      stageNumber,
      stageName,
      status: 'error',
      message: `Stage ${stageNumber}: ${stageName} error: ${error.message}`,
      data: { error: error.message, stack: error.stack }
    };

    emitToScanRoom(this.scanId, 'scan:stage:error', event);
    logger.error(`[ScanEvent ${this.scanId}] Stage ${stageNumber} error: ${stageName}`, error);
  }

  /**
   * Emit when a specific check starts
   */
  emitCheckStart(checkName: string, category?: string): void {
    const event: ScanCheckEvent = {
      scanId: this.scanId,
      checkName,
      category,
      status: 'started',
      message: `Check started: ${checkName}`
    };

    emitToScanRoom(this.scanId, 'scan:check:start', event);
    logger.debug(`[ScanEvent ${this.scanId}] Check started: ${checkName}`);
  }

  /**
   * Emit when a specific check completes
   */
  emitCheckComplete(checkName: string, score: number, category?: string, data?: any): void {
    const event: ScanCheckEvent = {
      scanId: this.scanId,
      checkName,
      category,
      status: 'completed',
      score,
      message: `Check completed: ${checkName} (Score: ${score})`,
      data
    };

    emitToScanRoom(this.scanId, 'scan:check:complete', event);
    logger.debug(`[ScanEvent ${this.scanId}] Check completed: ${checkName} = ${score}`);
  }

  /**
   * Emit when a specific check encounters an error
   */
  emitCheckError(checkName: string, error: Error, category?: string): void {
    const event: ScanCheckEvent = {
      scanId: this.scanId,
      checkName,
      category,
      status: 'error',
      message: `Check error: ${checkName} - ${error.message}`,
      data: { error: error.message }
    };

    emitToScanRoom(this.scanId, 'scan:check:error', event);
    logger.error(`[ScanEvent ${this.scanId}] Check error: ${checkName}`, error);
  }

  /**
   * Emit overall scan progress
   */
  emitProgress(percentage: number, currentStep: string, completedSteps: number, totalSteps: number): void {
    const event: ScanProgressEvent = {
      scanId: this.scanId,
      percentage: Math.round(percentage),
      currentStep,
      totalSteps,
      completedSteps
    };

    emitToScanRoom(this.scanId, 'scan:progress', event);
    logger.debug(`[ScanEvent ${this.scanId}] Progress: ${percentage}% - ${currentStep}`);
  }

  /**
   * Emit a log message
   */
  emitLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): void {
    const event: ScanLogEvent = {
      scanId: this.scanId,
      level,
      message,
      timestamp: new Date().toISOString(),
      data
    };

    emitToScanRoom(this.scanId, 'scan:log', event);
  }

  /**
   * Emit scan completion
   */
  emitScanComplete(result: any): void {
    const event: ScanEventData = {
      scanId: this.scanId,
      timestamp: new Date().toISOString(),
      stage: 'complete',
      message: 'Scan completed successfully',
      data: result
    };

    emitToScanRoom(this.scanId, 'scan:complete', event);
    logger.info(`[ScanEvent ${this.scanId}] Scan completed`);
  }

  /**
   * Emit scan error
   */
  emitScanError(error: Error): void {
    const event: ScanEventData = {
      scanId: this.scanId,
      timestamp: new Date().toISOString(),
      stage: 'error',
      message: `Scan failed: ${error.message}`,
      data: { error: error.message, stack: error.stack }
    };

    emitToScanRoom(this.scanId, 'scan:error', event);
    logger.error(`[ScanEvent ${this.scanId}] Scan error`, error);
  }

  /**
   * Emit when AI model is called
   */
  emitAIModelCall(modelName: string, provider: string, data?: any): void {
    const event = {
      scanId: this.scanId,
      modelName,
      provider,
      timestamp: new Date().toISOString(),
      message: `Calling AI model: ${modelName} (${provider})`,
      data
    };

    emitToScanRoom(this.scanId, 'scan:ai:call', event);
    logger.info(`[ScanEvent ${this.scanId}] AI Model Called: ${modelName}`);
  }

  /**
   * Emit when AI model responds
   */
  emitAIModelResponse(modelName: string, provider: string, response: any): void {
    const event = {
      scanId: this.scanId,
      modelName,
      provider,
      timestamp: new Date().toISOString(),
      message: `AI model responded: ${modelName} (${provider})`,
      data: response
    };

    emitToScanRoom(this.scanId, 'scan:ai:response', event);
    logger.info(`[ScanEvent ${this.scanId}] AI Model Response: ${modelName}`);
  }

  /**
   * Emit threat intelligence API call
   */
  emitThreatIntelCall(source: string, data?: any): void {
    const event = {
      scanId: this.scanId,
      source,
      timestamp: new Date().toISOString(),
      message: `Querying threat intelligence: ${source}`,
      data
    };

    emitToScanRoom(this.scanId, 'scan:ti:call', event);
    logger.debug(`[ScanEvent ${this.scanId}] TI Call: ${source}`);
  }

  /**
   * Emit threat intelligence API response
   */
  emitThreatIntelResponse(source: string, response: any): void {
    const event = {
      scanId: this.scanId,
      source,
      timestamp: new Date().toISOString(),
      message: `Threat intelligence response: ${source}`,
      data: response
    };

    emitToScanRoom(this.scanId, 'scan:ti:response', event);
    logger.debug(`[ScanEvent ${this.scanId}] TI Response: ${source}`);
  }
}
