/**
 * REAL-TIME SCAN LOGGER SERVICE
 *
 * Provides debug-level logging for URL scans with WebSocket streaming
 * Allows admins to see the full stack trace and flow in real-time
 */

import { EventEmitter } from 'events';
import { logger } from '../../config/logger.js';

export interface ScanLogEntry {
  timestamp: string;
  scanId: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'success';
  category: string;
  message: string;
  data?: any;
  duration?: number;
  phase?: string;
}

class ScanLoggerService extends EventEmitter {
  private activeScanLogs: Map<string, ScanLogEntry[]> = new Map();
  private readonly MAX_LOGS_PER_SCAN = 1000;

  /**
   * Start logging for a scan
   */
  startScan(scanId: string, url: string) {
    this.activeScanLogs.set(scanId, []);

    this.log(scanId, {
      level: 'info',
      category: 'SCAN_START',
      message: `🚀 Starting URL scan for: ${url}`,
      data: { url }
    });
  }

  /**
   * Log a message for a specific scan
   */
  log(scanId: string, entry: Omit<ScanLogEntry, 'timestamp' | 'scanId'>) {
    const logEntry: ScanLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      scanId
    };

    // Store in memory
    const logs = this.activeScanLogs.get(scanId) || [];
    logs.push(logEntry);

    // Limit log size
    if (logs.length > this.MAX_LOGS_PER_SCAN) {
      logs.shift();
    }

    this.activeScanLogs.set(scanId, logs);

    // Emit to WebSocket clients
    this.emit('log', logEntry);

    // Also log to console for debugging
    const emoji = this.getEmoji(entry.level);
    const msg = `[${entry.category}] ${emoji} ${entry.message}`;

    switch (entry.level) {
      case 'error':
        logger.error(msg, entry.data);
        break;
      case 'warn':
        logger.warn(msg, entry.data);
        break;
      case 'debug':
        logger.debug(msg, entry.data);
        break;
      default:
        logger.info(msg, entry.data);
    }
  }

  /**
   * Log phase start
   */
  logPhaseStart(scanId: string, phase: string, description: string) {
    this.log(scanId, {
      level: 'info',
      category: 'PHASE_START',
      message: `📋 ${phase}: ${description}`,
      phase
    });
  }

  /**
   * Log phase complete
   */
  logPhaseComplete(scanId: string, phase: string, duration: number, result?: any) {
    this.log(scanId, {
      level: 'success',
      category: 'PHASE_COMPLETE',
      message: `✅ ${phase} completed in ${duration}ms`,
      phase,
      duration,
      data: result
    });
  }

  /**
   * Log analyzer execution
   */
  logAnalyzer(scanId: string, analyzer: string, action: 'start' | 'complete' | 'error', data?: any) {
    const emoji = action === 'start' ? '🔍' : action === 'complete' ? '✓' : '❌';
    const level = action === 'error' ? 'error' : action === 'start' ? 'debug' : 'info';

    this.log(scanId, {
      level,
      category: 'ANALYZER',
      message: `${emoji} ${analyzer} - ${action}`,
      data
    });
  }

  /**
   * Log AI model call
   */
  logAIModel(scanId: string, model: string, action: 'request' | 'response' | 'error', data?: any) {
    const emoji = action === 'request' ? '🤖' : action === 'response' ? '💬' : '⚠️';
    const level = action === 'error' ? 'error' : 'debug';

    this.log(scanId, {
      level,
      category: 'AI_MODEL',
      message: `${emoji} ${model} - ${action}`,
      data
    });
  }

  /**
   * Log external API call
   */
  logExternalAPI(scanId: string, service: string, action: 'request' | 'response' | 'error', data?: any) {
    const emoji = action === 'request' ? '🌐' : action === 'response' ? '📥' : '🔴';
    const level = action === 'error' ? 'warn' : 'debug';

    this.log(scanId, {
      level,
      category: 'EXTERNAL_API',
      message: `${emoji} ${service} - ${action}`,
      data
    });
  }

  /**
   * Log threat detection
   */
  logThreat(scanId: string, severity: 'low' | 'medium' | 'high' | 'critical', finding: string, details?: any) {
    const emoji = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : severity === 'medium' ? '⚡' : 'ℹ️';

    this.log(scanId, {
      level: severity === 'critical' || severity === 'high' ? 'warn' : 'info',
      category: 'THREAT_DETECTED',
      message: `${emoji} ${severity.toUpperCase()}: ${finding}`,
      data: details
    });
  }

  /**
   * Log consensus voting
   */
  logConsensus(scanId: string, phase: string, votes: any) {
    this.log(scanId, {
      level: 'info',
      category: 'CONSENSUS',
      message: `🗳️ AI Consensus - ${phase}`,
      data: votes
    });
  }

  /**
   * End logging for a scan
   */
  endScan(scanId: string, result: any) {
    this.log(scanId, {
      level: 'success',
      category: 'SCAN_COMPLETE',
      message: `🏁 Scan completed - Risk Score: ${result.riskScore}/${result.maxScore} (${result.riskLevel})`,
      data: {
        riskScore: result.riskScore,
        maxScore: result.maxScore,
        riskLevel: result.riskLevel,
        duration: result.scanDuration
      }
    });

    // Clean up after 5 minutes
    setTimeout(() => {
      this.activeScanLogs.delete(scanId);
    }, 5 * 60 * 1000);
  }

  /**
   * Get logs for a specific scan
   */
  getScanLogs(scanId: string): ScanLogEntry[] {
    return this.activeScanLogs.get(scanId) || [];
  }

  /**
   * Get emoji for log level
   */
  private getEmoji(level: string): string {
    switch (level) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'success': return '✅';
      case 'debug': return '🔍';
      default: return 'ℹ️';
    }
  }
}

export const scanLogger = new ScanLoggerService();
