/**
 * Stage 0 Orchestrator
 * Coordinates all pre-flight checks and determines scan pipeline
 *
 * Flow:
 * 1. Validate URL → 2. Check Cache → 3. Check Tombstone →
 * 4. TI Pre-Gate → 5. Probe Reachability → 6. Route to Pipeline
 */

import { URLValidator } from './validator.js';
import { CacheManager } from './cacheManager.js';
import { TombstoneChecker } from './tombstoneChecker.js';
import { TIPreGate } from './tiPreGate.js';
import { ReachabilityProbe } from './reachabilityProbe.js';
import {
  Stage0Result,
  ValidationResult,
  PipelineType,
  ReachabilityState
} from './types.js';
import { logger } from '../../config/logger.js';

export class Stage0Orchestrator {
  private cacheManager: CacheManager;

  constructor(cacheManager: CacheManager) {
    this.cacheManager = cacheManager;
  }

  /**
   * Execute Stage 0: Pre-Flight Checks
   * Returns complete Stage0Result with pipeline routing
   */
  async execute(url: string, config?: any): Promise<Stage0Result> {
    const startTime = Date.now();
    logger.info(`[Stage 0] Starting pre-flight checks for: ${url}`);

    // =================================================================
    // STEP 1: URL Validation & Normalization (≤100ms)
    // =================================================================
    logger.info('[Stage 0] Step 1/5: Validating URL...');
    const stepStart = Date.now();

    const validation = await URLValidator.validate(url);

    if (!validation.valid || !validation.components) {
      logger.warn(`[Stage 0] FAILED validation: ${validation.error}`);
      return {
        validation,
        cache: { hit: false, source: 'none' },
        tombstone: { found: false },
        tiPreGate: {
          maliciousConfirmed: false,
          shouldStop: false,
          checks: {},
          duration: 0
        },
        reachability: {
          state: ReachabilityState.OFFLINE,
          dns: { resolved: false, duration: 0 },
          tcp: { connected: false, duration: 0 },
          http: { ok: false, duration: 0 },
          detection: { isParked: false, isSinkhole: false, isWAF: false, patterns: [] },
          totalDuration: 0
        },
        pipeline: PipelineType.PASSIVE,
        shouldContinue: false,
        totalDuration: Date.now() - startTime
      };
    }

    const { components } = validation;
    logger.info(`[Stage 0] ✅ Step 1 complete (${Date.now() - stepStart}ms) - Hash: ${components.hash.slice(0, 8)}...`);

    // =================================================================
    // STEP 2: Cache Check (≤50ms)
    // =================================================================
    logger.info('[Stage 0] Step 2/5: Checking cache...');
    const cacheStepStart = Date.now();

    const cache = await this.cacheManager.checkScanCache(components.hash);

    if (cache.hit) {
      logger.info(`[Stage 0] ✅ CACHE HIT (${Date.now() - cacheStepStart}ms) - age: ${cache.age}s - Returning cached result`);

      // Return cached result as fast-path
      return {
        validation,
        cache,
        tombstone: { found: false },
        tiPreGate: {
          maliciousConfirmed: false,
          shouldStop: false,
          checks: {},
          duration: 0
        },
        reachability: {
          state: ReachabilityState.ONLINE,
          dns: { resolved: true, duration: 0 },
          tcp: { connected: true, duration: 0 },
          http: { ok: true, duration: 0 },
          detection: { isParked: false, isSinkhole: false, isWAF: false, patterns: [] },
          totalDuration: 0
        },
        pipeline: PipelineType.FULL,
        shouldContinue: false, // Don't run scan, return cache
        fastPathVerdict: {
          finalScore: cache.data.finalScore,
          riskLevel: cache.data.riskLevel,
          reason: 'cached_result'
        },
        totalDuration: Date.now() - startTime
      };
    }

    logger.info(`[Stage 0] ✅ Step 2 complete (${Date.now() - cacheStepStart}ms) - Cache miss`);

    // =================================================================
    // STEP 3: Tombstone Check (≤100ms)
    // =================================================================
    logger.info('[Stage 0] Step 3/5: Checking tombstone database...');
    const tombstoneStepStart = Date.now();

    const tombstone = await TombstoneChecker.check(components.hash);

    if (tombstone.found) {
      logger.warn(`[Stage 0] ⚠️  TOMBSTONE HIT (${Date.now() - tombstoneStepStart}ms) - ${tombstone.source} - Returning CRITICAL`);

      // Immediate CRITICAL verdict for known malicious
      return {
        validation,
        cache,
        tombstone,
        tiPreGate: {
          maliciousConfirmed: true,
          source: tombstone.source,
          confidence: tombstone.confidence,
          shouldStop: true,
          checks: {},
          duration: 0
        },
        reachability: {
          state: ReachabilityState.SINKHOLE,
          dns: { resolved: false, duration: 0 },
          tcp: { connected: false, duration: 0 },
          http: { ok: false, duration: 0 },
          detection: { isParked: false, isSinkhole: true, isWAF: false, patterns: [`tombstone:${tombstone.source}`] },
          totalDuration: 0
        },
        pipeline: PipelineType.SINKHOLE,
        shouldContinue: false,
        fastPathVerdict: {
          finalScore: 570, // Maximum score
          riskLevel: 'critical',
          reason: `tombstone_${tombstone.source}`
        },
        totalDuration: Date.now() - startTime
      };
    }

    logger.info(`[Stage 0] ✅ Step 3 complete (${Date.now() - tombstoneStepStart}ms) - Not in tombstone`);

    // =================================================================
    // STEP 4: Threat Intelligence Pre-Gate (≤2s)
    // =================================================================
    logger.info('[Stage 0] Step 4/5: Running TI pre-gate checks...');
    const tiStepStart = Date.now();

    const tiPreGate = await TIPreGate.check(components.canonical, config);

    if (tiPreGate.maliciousConfirmed && tiPreGate.shouldStop) {
      logger.warn(`[Stage 0] ⚠️  TI PRE-GATE confirms MALICIOUS (${Date.now() - tiStepStart}ms) - ${tiPreGate.source} - STOPPING`);

      // Create tombstone for future fast-path
      await TombstoneChecker.create(components.hash, components.canonical, 'ti_consensus', tiPreGate.confidence || 95);

      // Immediate CRITICAL verdict
      return {
        validation,
        cache,
        tombstone: { found: false },
        tiPreGate,
        reachability: {
          state: ReachabilityState.SINKHOLE,
          dns: { resolved: false, duration: 0 },
          tcp: { connected: false, duration: 0 },
          http: { ok: false, duration: 0 },
          detection: { isParked: false, isSinkhole: true, isWAF: false, patterns: [`ti_pregate:${tiPreGate.source}`] },
          totalDuration: 0
        },
        pipeline: PipelineType.SINKHOLE,
        shouldContinue: false,
        fastPathVerdict: {
          finalScore: 570,
          riskLevel: 'critical',
          reason: `ti_pregate_${tiPreGate.source}`
        },
        totalDuration: Date.now() - startTime
      };
    }

    logger.info(`[Stage 0] ✅ Step 4 complete (${Date.now() - tiStepStart}ms) - TI clean`);

    // =================================================================
    // STEP 5: Reachability Probe (≤7s)
    // =================================================================
    logger.info('[Stage 0] Step 5/5: Probing reachability...');
    const reachStepStart = Date.now();

    const reachability = await ReachabilityProbe.probe(components, config);

    logger.info(`[Stage 0] ✅ Step 5 complete (${Date.now() - reachStepStart}ms) - State: ${reachability.state}`);

    // =================================================================
    // STEP 6: Determine Pipeline & Fast-Path Verdicts
    // =================================================================
    let pipeline: PipelineType;
    let shouldContinue = true;
    let fastPathVerdict;

    switch (reachability.state) {
      case ReachabilityState.SINKHOLE:
        // Auto-CRITICAL for sinkholed domains
        pipeline = PipelineType.SINKHOLE;
        shouldContinue = false;
        fastPathVerdict = {
          finalScore: 570,
          riskLevel: 'critical',
          reason: 'sinkhole_detected'
        };

        // Create tombstone
        await TombstoneChecker.create(components.hash, components.canonical, 'sinkhole', 100);

        logger.warn(`[Stage 0] ⚠️  SINKHOLE detected - Returning CRITICAL`);
        break;

      case ReachabilityState.ONLINE:
        // Full analysis available
        pipeline = PipelineType.FULL;
        logger.info(`[Stage 0] ℹ️  ONLINE - Running full analysis (17 categories)`);
        break;

      case ReachabilityState.OFFLINE:
        // Passive analysis only
        pipeline = PipelineType.PASSIVE;
        logger.info(`[Stage 0] ℹ️  OFFLINE - Running passive analysis (4 categories)`);
        break;

      case ReachabilityState.PARKED:
        // Parked domain analysis
        pipeline = PipelineType.PARKED;
        logger.info(`[Stage 0] ℹ️  PARKED - Running parked domain analysis`);
        break;

      case ReachabilityState.WAF_CHALLENGE:
        // WAF challenge analysis
        pipeline = PipelineType.WAF;
        logger.info(`[Stage 0] ℹ️  WAF - Running WAF challenge analysis`);
        break;
    }

    const totalDuration = Date.now() - startTime;

    logger.info(`[Stage 0] ✅ COMPLETE (${totalDuration}ms) - Pipeline: ${pipeline}, Continue: ${shouldContinue}`);

    return {
      validation,
      cache,
      tombstone,
      tiPreGate,
      reachability,
      pipeline,
      shouldContinue,
      fastPathVerdict,
      totalDuration
    };
  }
}
