/**
 * V2 Scanner Initial Data Seed
 *
 * Seeds the database with:
 * - V2CheckDefinitions (26 checks across all stages)
 * - V2Presets (strict, balanced, lenient)
 * - Default V2ScannerConfig
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedV2Data() {
  console.log('🌱 Seeding V2 Scanner initial data...');

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. V2 CHECK DEFINITIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const v2Checks = [
    // ─────────────────────────────────────────────────────────────────────────
    // POLICY CHECKS (Stage: policy, auto-block rules)
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'dual_tier1_ti_hits',
      displayName: 'Dual Tier-1 TI Hits',
      description: 'Two or more tier-1 threat intelligence hits within 7 days',
      category: 'policy',
      stage: 'policy',
      modelType: 'ti',
      weight: 1.0,
      points: 100,
      maxPoints: 100,
      threshold: null,
      enabled: true,
      criticalCheck: true,
      requiresEvidence: false,
      order: 1
    },
    {
      name: 'tombstone_detection',
      displayName: 'Tombstone Detection',
      description: 'Domain marked as tombstoned/parked by registrar',
      category: 'policy',
      stage: 'policy',
      modelType: null,
      weight: 1.0,
      points: 100,
      maxPoints: 100,
      threshold: null,
      enabled: true,
      criticalCheck: true,
      requiresEvidence: false,
      order: 2
    },
    {
      name: 'sinkhole_detection',
      displayName: 'Sinkhole Detection',
      description: 'IP address is a known sinkhole',
      category: 'policy',
      stage: 'policy',
      modelType: null,
      weight: 1.0,
      points: 100,
      maxPoints: 100,
      threshold: null,
      enabled: true,
      criticalCheck: true,
      requiresEvidence: false,
      order: 3
    },
    {
      name: 'form_origin_mismatch',
      displayName: 'Form Origin Mismatch',
      description: 'Form action points to different domain',
      category: 'policy',
      stage: 'policy',
      modelType: null,
      weight: 0.9,
      points: 80,
      maxPoints: 100,
      threshold: null,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: true,
      order: 4
    },
    {
      name: 'brand_infra_divergence',
      displayName: 'Brand Infrastructure Divergence',
      description: 'Hosting infrastructure differs from expected brand provider',
      category: 'policy',
      stage: 'policy',
      modelType: null,
      weight: 0.8,
      points: 70,
      maxPoints: 100,
      threshold: null,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: true,
      order: 5
    },
    {
      name: 'redirect_homoglyph_delta',
      displayName: 'Redirect Homoglyph Delta',
      description: 'Redirect chain contains homoglyph/punycode variations',
      category: 'policy',
      stage: 'policy',
      modelType: null,
      weight: 0.85,
      points: 75,
      maxPoints: 100,
      threshold: null,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: true,
      order: 6
    },
    {
      name: 'auto_download_detection',
      displayName: 'Auto-Download Detection',
      description: 'Page triggers automatic file downloads',
      category: 'policy',
      stage: 'policy',
      modelType: null,
      weight: 0.9,
      points: 85,
      maxPoints: 100,
      threshold: null,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: true,
      order: 7
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE-1 LEXICAL CHECKS (fast, local models)
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'url_lexical_a_ngrams',
      displayName: 'URL Lexical A (N-grams)',
      description: 'Character n-gram analysis using local XGBoost model',
      category: 'stage1_lexical',
      stage: 'stage1',
      modelType: 'lexical_a',
      weight: 0.25,
      points: 25,
      maxPoints: 100,
      threshold: 0.5,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: false,
      apiTimeout: 2000,
      order: 10
    },
    {
      name: 'url_lexical_b_phishbert',
      displayName: 'URL Lexical B (PhishBERT)',
      description: 'URL encoder using PhishBERT transformer model',
      category: 'stage1_lexical',
      stage: 'stage1',
      modelType: 'lexical_b',
      weight: 0.35,
      points: 35,
      maxPoints: 100,
      threshold: 0.5,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: false,
      apiEndpoint: process.env.VERTEX_URL_LEXICAL_B_ENDPOINT || 'placeholder',
      apiTimeout: 3000,
      order: 11
    },
    {
      name: 'url_entropy_analysis',
      displayName: 'URL Entropy Analysis',
      description: 'Shannon entropy and character distribution analysis',
      category: 'stage1_lexical',
      stage: 'stage1',
      modelType: 'lexical_a',
      weight: 0.15,
      points: 15,
      maxPoints: 100,
      threshold: 0.6,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: false,
      order: 12
    },
    {
      name: 'url_special_chars',
      displayName: 'URL Special Characters',
      description: 'Suspicious special character patterns (@, -, unicode)',
      category: 'stage1_lexical',
      stage: 'stage1',
      modelType: 'lexical_a',
      weight: 0.1,
      points: 10,
      maxPoints: 100,
      threshold: 0.7,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: false,
      order: 13
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE-1 TABULAR CHECKS (metadata-based risk)
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'tabular_risk_xgboost',
      displayName: 'Tabular Risk (XGBoost)',
      description: 'Monotonic XGBoost model on domain age, TI, SSL, ASN features',
      category: 'stage1_tabular',
      stage: 'stage1',
      modelType: 'tabular',
      weight: 0.4,
      points: 40,
      maxPoints: 100,
      threshold: 0.5,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: false,
      apiEndpoint: process.env.VERTEX_TABULAR_RISK_ENDPOINT || 'placeholder',
      apiTimeout: 3000,
      order: 20
    },
    {
      name: 'domain_age_check',
      displayName: 'Domain Age',
      description: 'Domain registration age (high risk if < 30 days)',
      category: 'stage1_tabular',
      stage: 'stage1',
      modelType: 'tabular',
      weight: 0.2,
      points: 20,
      maxPoints: 100,
      threshold: 30, // days
      enabled: true,
      criticalCheck: false,
      requiresEvidence: false,
      order: 21
    },
    {
      name: 'ssl_tls_validation',
      displayName: 'SSL/TLS Validation',
      description: 'Certificate validity, issuer, chain verification',
      category: 'stage1_tabular',
      stage: 'stage1',
      modelType: 'tabular',
      weight: 0.15,
      points: 15,
      maxPoints: 100,
      threshold: 0.5,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: false,
      order: 22
    },
    {
      name: 'asn_reputation',
      displayName: 'ASN Reputation',
      description: 'Autonomous System Number reputation score',
      category: 'stage1_tabular',
      stage: 'stage1',
      modelType: 'tabular',
      weight: 0.1,
      points: 10,
      maxPoints: 100,
      threshold: 0.6,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: false,
      order: 23
    },
    {
      name: 'ti_hit_count',
      displayName: 'Threat Intel Hit Count',
      description: 'Number of threat intelligence feed matches',
      category: 'stage1_tabular',
      stage: 'stage1',
      modelType: 'ti',
      weight: 0.15,
      points: 15,
      maxPoints: 100,
      threshold: 1, // hits
      enabled: true,
      criticalCheck: false,
      requiresEvidence: false,
      order: 24
    },

    // ─────────────────────────────────────────────────────────────────────────
    // TI GATE CHECKS
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'ti_gate_tier1',
      displayName: 'TI Tier-1 Check',
      description: 'Check against tier-1 feeds (Google Safe Browsing, VirusTotal)',
      category: 'ti',
      stage: 'ti_gate',
      modelType: 'ti',
      weight: 1.0,
      points: 90,
      maxPoints: 100,
      threshold: null,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: false,
      order: 30
    },
    {
      name: 'ti_gate_tier2',
      displayName: 'TI Tier-2 Check',
      description: 'Check against tier-2 feeds (PhishTank, URLhaus)',
      category: 'ti',
      stage: 'ti_gate',
      modelType: 'ti',
      weight: 0.8,
      points: 70,
      maxPoints: 100,
      threshold: null,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: false,
      order: 31
    },
    {
      name: 'ti_gate_tier3',
      displayName: 'TI Tier-3 Check',
      description: 'Check against tier-3 feeds (community sources)',
      category: 'ti',
      stage: 'ti_gate',
      modelType: 'ti',
      weight: 0.5,
      points: 40,
      maxPoints: 100,
      threshold: null,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: false,
      order: 32
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE-2 TEXT CHECKS (deep analysis, only if Stage-1 uncertain)
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'text_persuasion_gemma',
      displayName: 'Text Persuasion (Gemma)',
      description: 'Persuasion/social engineering analysis using Gemma/Mixtral',
      category: 'stage2_text',
      stage: 'stage2',
      modelType: 'text',
      weight: 0.6,
      points: 60,
      maxPoints: 100,
      threshold: 0.5,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: true,
      requiresScreenshot: false,
      apiEndpoint: process.env.VERTEX_TEXT_PERSUASION_ENDPOINT || 'placeholder',
      apiTimeout: 5000,
      order: 40
    },
    {
      name: 'text_urgency_detection',
      displayName: 'Text Urgency Detection',
      description: 'Detects urgent language patterns (limited time, act now, etc.)',
      category: 'stage2_text',
      stage: 'stage2',
      modelType: 'text',
      weight: 0.3,
      points: 30,
      maxPoints: 100,
      threshold: 0.6,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: true,
      order: 41
    },
    {
      name: 'text_brand_impersonation',
      displayName: 'Brand Impersonation (Text)',
      description: 'Detects brand name mentions without authorization',
      category: 'stage2_text',
      stage: 'stage2',
      modelType: 'text',
      weight: 0.4,
      points: 40,
      maxPoints: 100,
      threshold: 0.5,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: true,
      order: 42
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE-2 SCREENSHOT CHECKS (visual analysis)
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'screenshot_cnn_efficientnet',
      displayName: 'Screenshot CNN (EfficientNet)',
      description: 'Visual analysis using EfficientNet for login/brand detection',
      category: 'stage2_screenshot',
      stage: 'stage2',
      modelType: 'screenshot',
      weight: 0.4,
      points: 40,
      maxPoints: 100,
      threshold: 0.5,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: true,
      requiresScreenshot: true,
      apiEndpoint: process.env.VERTEX_SCREENSHOT_CNN_ENDPOINT || 'placeholder',
      apiTimeout: 7000,
      order: 50
    },
    {
      name: 'screenshot_login_detection',
      displayName: 'Login Form Detection',
      description: 'Detects fake login forms in screenshot',
      category: 'stage2_screenshot',
      stage: 'stage2',
      modelType: 'screenshot',
      weight: 0.35,
      points: 35,
      maxPoints: 100,
      threshold: 0.6,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: true,
      requiresScreenshot: true,
      order: 51
    },
    {
      name: 'screenshot_brand_logo_match',
      displayName: 'Brand Logo Matching',
      description: 'Matches detected logos against known brand database',
      category: 'stage2_screenshot',
      stage: 'stage2',
      modelType: 'screenshot',
      weight: 0.25,
      points: 25,
      maxPoints: 100,
      threshold: 0.7,
      enabled: true,
      criticalCheck: false,
      requiresEvidence: true,
      requiresScreenshot: true,
      order: 52
    }
  ];

  console.log(`📋 Creating ${v2Checks.length} V2 check definitions...`);

  for (const check of v2Checks) {
    await prisma.v2CheckDefinition.upsert({
      where: { name: check.name },
      update: check,
      create: check
    });
  }

  console.log('✅ V2 check definitions created');

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. V2 PRESETS
  // ═══════════════════════════════════════════════════════════════════════════

  const presets = [
    {
      name: 'strict',
      displayName: 'Strict (High Security)',
      description: 'Maximum protection with low false negative rate. Higher false positives.',
      category: 'default',
      isSystem: true,
      isDefault: false,
      config: {
        isActive: false,
        rolloutPercentage: 0,
        shadowMode: true,
        stage2ConfidenceThreshold: 0.75 // Lower threshold = more Stage-2 checks
      },
      branchThresholds: {
        ONLINE: { safe: 0.10, low: 0.25, medium: 0.45, high: 0.65, critical: 0.85 },
        OFFLINE: { safe: 0.15, low: 0.35, medium: 0.55, high: 0.75, critical: 0.90 },
        WAF: { safe: 0.05, low: 0.15, medium: 0.35, high: 0.60, critical: 0.80 },
        PARKED: { safe: 0.20, low: 0.40, medium: 0.60, high: 0.80, critical: 0.95 },
        SINKHOLE: { safe: 0.00, low: 0.00, medium: 0.00, high: 0.50, critical: 0.90 }
      },
      stage1Weights: { lexicalA: 0.30, lexicalB: 0.40, tabular: 0.30 },
      stage2Weights: { text: 0.65, screenshot: 0.35 },
      checkOverrides: []
    },
    {
      name: 'balanced',
      displayName: 'Balanced (Recommended)',
      description: 'Balanced protection with optimized precision and recall.',
      category: 'default',
      isSystem: true,
      isDefault: true, // Default preset
      config: {
        isActive: false,
        rolloutPercentage: 0,
        shadowMode: true,
        stage2ConfidenceThreshold: 0.85 // Standard threshold
      },
      branchThresholds: {
        ONLINE: { safe: 0.15, low: 0.30, medium: 0.50, high: 0.75, critical: 0.90 },
        OFFLINE: { safe: 0.25, low: 0.45, medium: 0.65, high: 0.85, critical: 0.95 },
        WAF: { safe: 0.10, low: 0.25, medium: 0.45, high: 0.70, critical: 0.88 },
        PARKED: { safe: 0.30, low: 0.50, medium: 0.70, high: 0.85, critical: 0.97 },
        SINKHOLE: { safe: 0.00, low: 0.00, medium: 0.10, high: 0.60, critical: 0.95 }
      },
      stage1Weights: { lexicalA: 0.25, lexicalB: 0.35, tabular: 0.40 },
      stage2Weights: { text: 0.60, screenshot: 0.40 },
      checkOverrides: []
    },
    {
      name: 'lenient',
      displayName: 'Lenient (Low False Positives)',
      description: 'Minimizes false positives, may miss some threats.',
      category: 'default',
      isSystem: true,
      isDefault: false,
      config: {
        isActive: false,
        rolloutPercentage: 0,
        shadowMode: true,
        stage2ConfidenceThreshold: 0.95 // High threshold = fewer Stage-2 checks
      },
      branchThresholds: {
        ONLINE: { safe: 0.20, low: 0.40, medium: 0.60, high: 0.80, critical: 0.93 },
        OFFLINE: { safe: 0.35, low: 0.55, medium: 0.75, high: 0.90, critical: 0.97 },
        WAF: { safe: 0.15, low: 0.35, medium: 0.55, high: 0.75, critical: 0.92 },
        PARKED: { safe: 0.40, low: 0.60, medium: 0.80, high: 0.92, critical: 0.98 },
        SINKHOLE: { safe: 0.10, low: 0.20, medium: 0.40, high: 0.70, critical: 0.96 }
      },
      stage1Weights: { lexicalA: 0.20, lexicalB: 0.30, tabular: 0.50 },
      stage2Weights: { text: 0.55, screenshot: 0.45 },
      checkOverrides: []
    }
  ];

  console.log(`🎨 Creating ${presets.length} V2 presets...`);

  for (const preset of presets) {
    await prisma.v2Preset.upsert({
      where: { name: preset.name },
      update: preset,
      create: preset
    });
  }

  console.log('✅ V2 presets created');

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. DEFAULT V2 SCANNER CONFIG
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('⚙️  Creating default V2 scanner config...');

  await prisma.v2ScannerConfig.upsert({
    where: { name: 'default' },
    update: {
      description: 'Default V2 scanner configuration with balanced settings',
      isActive: false,
      isDefault: true,
      shadowMode: true,
      rolloutPercentage: 0,
      enabledForOrgs: []
    },
    create: {
      name: 'default',
      description: 'Default V2 scanner configuration with balanced settings',
      isActive: false,
      isDefault: true,
      shadowMode: true,
      rolloutPercentage: 0,
      enabledForOrgs: []
    }
  });

  console.log('✅ Default V2 config created');

  console.log('');
  console.log('🎉 V2 Scanner initial data seeded successfully!');
  console.log('');
  console.log('Summary:');
  console.log(`- ${v2Checks.length} check definitions`);
  console.log(`- ${presets.length} presets (strict, balanced, lenient)`);
  console.log('- 1 default scanner configuration');
}

// Run the seed
seedV2Data()
  .catch((e) => {
    console.error('❌ Error seeding V2 data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
