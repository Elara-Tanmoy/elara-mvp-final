/**
 * Type definitions for URL Scanner V2
 *
 * This module defines all interfaces and types used across the V2 scanning pipeline.
 * The V2 architecture uses a two-stage ML model approach with calibrated probabilities.
 */

/**
 * Reachability status types
 */
export enum ReachabilityStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  WAF = 'WAF',
  PARKED = 'PARKED',
  SINKHOLE = 'SINKHOLE',
  ERROR = 'ERROR'
}

/**
 * Risk levels (A-F bands)
 */
export enum RiskLevel {
  A = 'A', // Safe (0-15%)
  B = 'B', // Low (15-30%)
  C = 'C', // Medium (30-50%)
  D = 'D', // High (50-75%)
  E = 'E', // Critical (75-90%)
  F = 'F'  // Severe (90-100%)
}

/**
 * Result of reachability probe
 */
export interface ReachabilityResult {
  status: ReachabilityStatus;
  httpStatusCode?: number;
  responseTime: number;
  dnsResolved: boolean;
  tcpConnectable: boolean;
  tlsValid: boolean;
  ipAddress?: string;
  details: {
    dnsError?: string;
    tcpError?: string;
    httpError?: string;
    tlsError?: string;
    redirectChain?: string[];
    wafSignatures?: string[];
    parkedIndicators?: string[];
    sinkholeIndicators?: string[];
  };
  timestamp: Date;
}

/**
 * Evidence collected from URL
 */
export interface EvidenceData {
  // HTML/DOM evidence
  html: string;
  dom: {
    title: string;
    metaTags: Record<string, string>;
    forms: FormEvidence[];
    scripts: ScriptEvidence[];
    iframes: string[];
    images: ImageEvidence[];
    links: LinkEvidence[];
  };

  // Network evidence
  har: HARData;
  redirectChain: RedirectEvidence[];
  cookies: CookieEvidence[];
  localStorage: Record<string, string>;

  // Infrastructure evidence
  tls: TLSEvidence;
  whois: WHOISEvidence;
  dns: DNSEvidence;
  asn: ASNEvidence;

  // Visual evidence
  screenshot: ScreenshotEvidence;

  // Behavioral flags
  autoDownload: boolean;
  autoRedirect: boolean;
  obfuscatedScripts: boolean;

  timestamp: Date;
}

export interface FormEvidence {
  action: string;
  method: string;
  inputs: Array<{
    type: string;
    name: string;
    required: boolean;
  }>;
  submitsToExternal: boolean;
}

export interface ScriptEvidence {
  src?: string;
  inline: boolean;
  obfuscated: boolean;
  suspiciousPatterns: string[];
}

export interface ImageEvidence {
  src: string;
  alt: string;
  isLogo: boolean;
}

export interface LinkEvidence {
  href: string;
  text: string;
  external: boolean;
}

export interface HARData {
  requests: number;
  externalDomains: string[];
  suspiciousRequests: Array<{
    url: string;
    method: string;
    reason: string;
  }>;
}

export interface RedirectEvidence {
  from: string;
  to: string;
  statusCode: number;
  homoglyphDetected: boolean;
}

export interface CookieEvidence {
  name: string;
  domain: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
}

export interface TLSEvidence {
  valid: boolean;
  issuer: string;
  subject: string;
  validFrom: Date;
  validTo: Date;
  selfSigned: boolean;
  daysUntilExpiry: number;
  certificateChain: string[];
  tlsVersion: string;
  anomalies: string[];
}

export interface WHOISEvidence {
  domainAge: number; // days
  registrar: string;
  createdDate: Date;
  updatedDate: Date;
  expiryDate: Date;
  privacyProtected: boolean;
  registrantCountry?: string;
}

export interface DNSEvidence {
  aRecords: string[];
  mxRecords: string[];
  nsRecords: string[];
  txtRecords: string[];
  caaRecords: string[];
  spfValid: boolean;
  dmarcValid: boolean;
}

export interface ASNEvidence {
  asn: number;
  organization: string;
  country: string;
  reputation: 'good' | 'neutral' | 'bad';
  isHosting: boolean;
  isCDN: boolean;
}

export interface ScreenshotEvidence {
  url: string;
  width: number;
  height: number;
  hasLoginForm: boolean;
  brandLogosDetected: string[];
  ocrText: string;
}

/**
 * Extracted features for ML models
 */
export interface ExtractedFeatures {
  // URL metadata
  hostname: string;

  // Lexical features
  lexical: {
    charNgrams: number[]; // For XGBoost model
    urlTokens: string[];  // For BERT model
    entropy: number;
    lengthMetrics: {
      totalLength: number;
      domainLength: number;
      pathLength: number;
      queryLength: number;
      subdomainCount: number;
    };
    suspiciousPatterns: {
      ipInUrl: boolean;
      excessiveDashes: boolean;
      excessiveDots: boolean;
      homoglyphs: boolean;
      randomStrings: boolean;
    };
  };

  // Tabular features (for monotonic XGBoost)
  tabular: {
    domainAge: number;
    tldRiskScore: number;
    asnReputation: number;
    tiHitCount: number;
    tiTier1Hits: number;
    tlsScore: number;
    dnsHealthScore: number;
    certificateAge: number;
    redirectCount: number;
    externalDomainCount: number;
  };

  // Causal signals (hard rules)
  causal: {
    formOriginMismatch: boolean;
    brandInfraDivergence: boolean;
    redirectHomoglyphDelta: boolean;
    autoDownload: boolean;
    tombstone: boolean;
    sinkhole: boolean;
    dualTier1Hits: boolean;
  };

  // Text for Stage-2 analysis
  text: {
    aggregatedText: string;
    altText: string[];
    titleAttributes: string[];
    scriptHints: string[];
  };

  // Screenshot for CNN analysis
  screenshot?: {
    imageUrl: string;
    preprocessed: boolean;
  };
}

/**
 * Stage-1 model predictions
 */
export interface Stage1Predictions {
  urlLexicalA: {
    probability: number; // XGBoost output
    confidence: number;
  };
  urlLexicalB: {
    probability: number; // BERT output
    confidence: number;
  };
  tabularRisk: {
    probability: number; // Monotonic XGBoost output
    confidence: number;
    featureImportance: Record<string, number>;
  };
  combined: {
    probability: number;
    confidence: number;
  };
  shouldExit: boolean; // Early exit if high confidence
  latency: number; // ms
}

/**
 * Stage-2 model predictions (only run if Stage-1 uncertain)
 */
export interface Stage2Predictions {
  textPersuasion: {
    probability: number; // Gemma/Mixtral output
    confidence: number;
    persuasionTactics: string[];
  };
  screenshotCnn: {
    probability: number; // EfficientNet output
    confidence: number;
    detectedBrands: string[];
    isFakeLogin: boolean;
  };
  combined: {
    probability: number;
    confidence: number;
  };
  latency: number; // ms
}

/**
 * Combiner output with calibration
 */
export interface CombinerResult {
  probability: number; // Calibrated probability
  confidenceInterval: {
    lower: number;
    upper: number;
    width: number;
  };
  decisionGraph: DecisionNode[];
  modelContributions: {
    stage1Weight: number;
    stage2Weight?: number;
    causalSignalsWeight: number;
  };
  calibrationMethod: 'ICP' | 'PLATT' | 'ISOTONIC';
  branchThresholds: BranchThresholds;
}

export interface DecisionNode {
  step: number;
  component: string;
  input: any;
  output: any;
  contribution: number;
  timestamp: Date;
}

export interface BranchThresholds {
  branch: ReachabilityStatus;
  safeThreshold: number;
  lowThreshold: number;
  mediumThreshold: number;
  highThreshold: number;
  criticalThreshold: number;
}

/**
 * Policy override result
 */
export interface PolicyResult {
  overridden: boolean;
  riskLevel?: RiskLevel;
  reason?: string;
  rule?: string;
  action: 'BLOCK' | 'ALLOW' | 'NONE';
}

/**
 * Granular check result for detailed analysis
 */
export interface GranularCheckResult {
  checkId: string;
  name: string;
  category: 'security' | 'legitimacy' | 'reputation' | 'technical';
  status: 'PASS' | 'FAIL' | 'WARNING' | 'INFO' | 'SKIPPED';
  points: number;
  maxPoints: number;
  description: string;
  evidence?: any;
  timestamp: Date;
}

/**
 * Final V2 scan result
 */
export interface EnhancedScanResult {
  // Core result
  url: string;
  scanId: string;
  timestamp: Date;
  version: 'v2';

  // Risk assessment
  riskScore: number; // probability × 100
  riskLevel: RiskLevel;
  probability: number; // 0-1
  confidenceInterval: {
    lower: number;
    upper: number;
    width: number;
  };

  // Reachability
  reachability: ReachabilityStatus;

  // Model predictions
  stage1: Stage1Predictions;
  stage2?: Stage2Predictions;

  // Granular checks for detailed UI display
  granularChecks?: GranularCheckResult[];

  // Category results summary
  categoryResults?: {
    totalPoints: number;
    totalPossible: number;
    riskFactor: number;
    categories: Array<{
      name: string;
      points: number;
      maxPoints: number;
      skipped: boolean;
    }>;
  };

  // Policy
  policyOverride?: PolicyResult;

  // Evidence & features
  evidenceSummary: {
    domainAge: number;
    tlsValid: boolean;
    tiHits: number;
    hasLoginForm: boolean;
    autoDownload: boolean;
  };

  // Decisions
  decisionGraph: DecisionNode[];
  recommendedActions: string[];

  // Artifacts
  screenshotUrl?: string;
  skippedChecks: string[];

  // External API results
  externalAPIs?: {
    virusTotal?: {
      detected: boolean;
      positives: number;
      total: number;
      scanDate?: Date;
      permalink?: string;
      engines?: Array<{
        engine: string;
        detected: boolean;
        result?: string;
      }>;
    };
    scamAdviser?: {
      trustScore: number;
      riskLevel: string;
      country?: string;
      age?: number;
      warnings?: string[];
      badges?: string[];
    };
  };

  // AI-generated summary
  aiSummary?: {
    explanation: string;
    keyFindings: string[];
    riskAssessment: string;
    recommendedActions: string[];
    technicalDetails?: string;
  };

  // Scoring explanation (new)
  scoringExplanation?: ScoringExplanation;

  // Reputation info (new)
  reputationInfo?: ReputationInfo;

  // Final verdict (new - ScamAdviser style)
  finalVerdict?: FinalVerdict;

  // Performance
  latency: {
    total: number;
    reachability: number;
    evidence: number;
    featureExtraction: number;
    stage1: number;
    stage2?: number;
    combiner: number;
    policy: number;
  };

  // Backward compatibility fields for V1 API
  verdict?: string;
  confidence?: number;
  threatIntelligence?: any;
  categories?: any;
}

/**
 * Final verdict for frontend display
 */
export interface FinalVerdict {
  verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' | 'UNKNOWN';
  trustScore: number; // 0-100 (inverse of risk score)
  summary: string;
  recommendation: string;
  positiveHighlights: string[];
  negativeHighlights: string[];
  badges: VerdictBadge[];
}

export interface VerdictBadge {
  type: 'success' | 'warning' | 'danger' | 'info';
  icon: string;
  text: string;
}

/**
 * V2 scan options
 */
export interface V2ScanOptions {
  skipStage2?: boolean; // Force early exit after Stage-1
  skipScreenshot?: boolean;
  skipTLS?: boolean;
  skipWHOIS?: boolean;
  timeoutMs?: number;
  enableExplainability?: boolean; // Include SHAP values
}

/**
 * Vertex AI model endpoints
 */
export interface VertexAIEndpoints {
  urlLexicalB: string; // PhishBERT endpoint
  tabularRisk: string; // Monotonic XGBoost endpoint
  textPersuasion: string; // Gemma/Mixtral endpoint
  screenshotCnn: string; // EfficientNet endpoint
  combiner: string; // Calibrated combiner endpoint
}

/**
 * Feature Store configuration
 */
export interface FeatureStoreConfig {
  type: 'firestore' | 'vertex';
  firestoreCollection?: string;
  vertexFeatureStore?: string;
  cacheTTL: number; // seconds
}

/**
 * Calibration configuration
 */
export interface CalibrationConfig {
  method: 'ICP' | 'PLATT' | 'ISOTONIC';
  alpha: number; // Significance level for ICP (e.g., 0.1 for 90% CI)
  calibrationDataPath?: string;
}

/**
 * V2 configuration
 */
export interface V2Config {
  enabled: boolean;
  vertexEndpoints: VertexAIEndpoints;
  featureStore: FeatureStoreConfig;
  calibration: CalibrationConfig;
  branchThresholds: Record<ReachabilityStatus, BranchThresholds>;
  stage2Threshold: number; // Confidence threshold to skip Stage-2
  timeouts: {
    reachability: number;
    evidence: number;
    stage1: number;
    stage2: number;
    total: number;
  };
}

/**
 * Scoring explanation for transparency
 */
export interface ScoringExplanation {
  finalVerdict: string;
  riskReasoning: string;
  probabilityBreakdown: {
    stage1Combined: number;
    stage2Combined: number | null;
    causalAdjustments: number;
    branchCorrection: number;
    categoryBoost: number;
    reputationDiscount: number;
    domainAgeDiscount: number;
    final: number;
  };
  keyFactors: Array<{
    factor: string;
    impact: 'positive' | 'negative';
    weight: number;
    description: string;
  }>;
}

/**
 * Reputation information
 */
export interface ReputationInfo {
  rank: number | null;
  trustScore: number | null;
  trustLevel: string;
  source: string;
}
