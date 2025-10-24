/**
 * Circuit Breaker Pattern
 * Prevents cascading failures when TI sources are down
 *
 * States:
 * - CLOSED: Normal operation, requests go through
 * - OPEN: Too many failures, requests fail immediately
 * - HALF_OPEN: Testing if service recovered
 */

import { logger } from '../../../config/logger.js';

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number;  // Failures before opening circuit
  successThreshold: number;  // Successes in half-open before closing
  timeout: number;           // Time in ms before trying half-open
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private nextAttempt: number = Date.now();
  private readonly serviceName: string;
  private readonly options: CircuitBreakerOptions;

  constructor(serviceName: string, options: CircuitBreakerOptions) {
    this.serviceName = serviceName;
    this.options = options;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker OPEN for ${this.serviceName}`);
      }
      // Try half-open
      this.state = CircuitState.HALF_OPEN;
      logger.info(`[Circuit Breaker] ${this.serviceName}: Transitioning to HALF_OPEN`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        logger.info(`[Circuit Breaker] ${this.serviceName}: CLOSED (recovered)`);
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed in half-open, go back to open
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.timeout;
      this.successCount = 0;
      logger.warn(`[Circuit Breaker] ${this.serviceName}: Back to OPEN (failed in half-open)`);
    } else if (this.failureCount >= this.options.failureThreshold) {
      // Too many failures, open circuit
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.timeout;
      logger.warn(`[Circuit Breaker] ${this.serviceName}: OPEN (${this.failureCount} failures)`);
    }
  }

  /**
   * Get current state
   */
  getState(): string {
    return this.state;
  }

  /**
   * Get stats
   */
  getStats(): {
    state: string;
    failureCount: number;
    successCount: number;
    nextAttempt: number | null;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.state === CircuitState.OPEN ? this.nextAttempt : null
    };
  }

  /**
   * Manually reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    logger.info(`[Circuit Breaker] ${this.serviceName}: Manually RESET`);
  }
}
