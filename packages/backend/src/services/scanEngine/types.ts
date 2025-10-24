/**
 * Advanced URL Scan Engine - Type Definitions
 * 570-Point Enterprise Threat Detection System
 */

export enum ReachabilityState {
  ONLINE = 'ONLINE',           // Full analysis available
  OFFLINE = 'OFFLINE',         // DNS/TCP/HTTP failed - passive only
  PARKED = 'PARKED',           // Parking page detected
  WAF_CHALLENGE = 'WAF_CHALLENGE', // WAF/CAPTCHA detected
  SINKHOLE = 'SINKHOLE'        // Sinkhole/takedown detected - auto-critical
}

export enum PipelineType {
  FULL = 'FULL',               // All 17 categories + TI
  PASSIVE = 'PASSIVE',         // Only passive checks (4 categories)
  PARKED = 'PARKED',           // Parked domain pipeline
  WAF = 'WAF',                 // WAF challenge pipeline
  SINKHOLE = 'SINKHOLE'        // Automatic CRITICAL verdict
}

export interface URLComponents {
  original: string;
  canonical: string;
  protocol: string;
  hostname: string;
  domain: string;
  subdomain: string | null;
  tld: string;
  port: number | null;
  path: string;
  query: string | null;
  fragment: string | null;
  hash: string;  // SHA-256 of canonical URL
}

export interface ReachabilityProbeResult {
  state: ReachabilityState;
  dns: {
    resolved: boolean;
    ip?: string;
    ips?: string[];
    error?: string;
    duration: number;
  };
  tcp: {
    connected: boolean;
    port?: number;
    error?: string;
    duration: number;
  };
  http: {
    ok: boolean;
    statusCode?: number;
    headers?: Record<string, string>;
    body?: string;
    redirectChain?: string[];
    error?: string;
    duration: number;
  };
  detection: {
    isParked: boolean;
    isSinkhole: boolean;
    isWAF: boolean;
    patterns: string[];
  };
  totalDuration: number;
}

export interface CacheCheckResult {
  hit: boolean;
  age?: number;
  data?: any;
  source: 'redis' | 'memory' | 'none';
}

export interface TombstoneCheckResult {
  found: boolean;
  verdict?: string;
  source?: string;
  confidence?: number;
}

export interface TIPreGateResult {
  maliciousConfirmed: boolean;
  source?: string;
  confidence?: number;
  shouldStop: boolean;
  checks: {
    googleSafeBrowsing?: { safe: boolean; error?: string };
    virusTotal?: { detections: number; error?: string };
    phishTank?: { listed: boolean; error?: string };
    urlhaus?: { active: boolean; error?: string };
  };
  duration: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  isPrivateNetwork?: boolean;
  components?: URLComponents;
  nameservers?: string[];
}

export interface Stage0Result {
  validation: ValidationResult;
  cache: CacheCheckResult;
  tombstone: TombstoneCheckResult;
  tiPreGate: TIPreGateResult;
  reachability: ReachabilityProbeResult;
  pipeline: PipelineType;
  shouldContinue: boolean;
  fastPathVerdict?: {
    finalScore: number;
    riskLevel: string;
    reason: string;
  };
  totalDuration: number;
}

export interface CategoryResult {
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
  status: 'completed' | 'skipped' | 'partial' | 'failed';
  skipReason?: string;
  checks: CategoryCheck[];
  evidence: any;
}

export interface CategoryCheck {
  name: string;
  passed: boolean;
  points: number;
  description: string;
  evidence?: any;
}

export interface TISourceResult {
  source: string;
  verdict: 'safe' | 'malicious' | 'suspicious' | 'error';
  score: number;
  confidence: number;
  details: any;
  duration: number;
  cached: boolean;
}

export interface AIModelResult {
  model: string;
  verdict: 'SAFE' | 'SUSPICIOUS' | 'PHISHING' | 'MALWARE' | 'CRITICAL';
  confidence: number;
  multiplier: number;
  reasoning: string;
  duration: number;
}

export interface AIConsensusResult {
  finalMultiplier: number;
  agreementRate: number;
  averageConfidence: number;
  consensusVerdict: string;
  models: AIModelResult[];
  totalDuration: number;
}

export interface FinalScanResult {
  url: string;
  urlComponents: URLComponents;

  // Stage 0 Results
  reachabilityState: ReachabilityState;
  pipelineUsed: PipelineType;
  stage0: Stage0Result;

  // Scoring
  baseScore: number;
  aiMultiplier: number;
  finalScore: number;
  activeMaxScore: number;
  riskLevel: string;
  riskPercentage: number;

  // Detailed Results
  categories: CategoryResult[];
  tiResults: TISourceResult[];
  aiAnalysis: AIConsensusResult;

  // Exception Handling
  exceptionsHandled: string[];
  falsePositiveChecks: {
    cdnCheck: boolean;
    riotCheck: boolean;
    govCheck: boolean;
    legitimacyIndicators: number;
  };

  // Performance
  scanDuration: number;
  performanceMetrics: {
    stage0: number;
    categories: number;
    tiLayer: number;
    aiConsensus: number;
    finalization: number;
  };

  // Cache
  cacheStatus: {
    hit: boolean;
    age?: number;
    saved: boolean;
  };

  timestamp: Date;
  metadata: {
    scanId?: string;
    duration: number;
    timestamp: Date;
    configurationId: string;
    configurationName: string;
  };
}

export interface ScanConfiguration {
  id: string;
  name: string;
  maxScore: number;
  categoryWeights: Record<string, number>;
  checkWeights: Record<string, number>;
  algorithmConfig: {
    scoringMethod: string;
    enableDynamicScaling: boolean;
    enableCompensatoryWeights: boolean;
    enableFalsePositivePrevention: boolean;
    riskThresholds: Record<string, number>;
  };
  aiModelConfig: any;
  tiConfig: any;
  reachabilityConfig: any;
  whitelistRules: any[];
  blacklistRules: any[];
}
