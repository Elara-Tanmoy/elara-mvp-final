/**
 * V2 Enhanced Results Display - Alienware Dark Theme
 * Shows comprehensive V2 scan results with screenshots, ML predictions, and AI analysis
 */

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Brain, Eye, Zap, TrendingUp, Target, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface V2ScanResult {
  // Core result
  url: string;
  scanId: string;
  timestamp: Date;
  version: 'v2';

  // Risk assessment
  riskScore: number;
  riskLevel: string; // A-F
  probability: number; // 0-1
  confidenceInterval: {
    lower: number;
    upper: number;
    width: number;
  };

  // Reachability
  reachability: string;

  // Model predictions
  stage1: {
    urlLexicalA: { probability: number; confidence: number };
    urlLexicalB: { probability: number; confidence: number };
    tabularRisk: { probability: number; confidence: number; featureImportance?: any };
    combined: { probability: number; confidence: number };
    shouldExit: boolean;
    latency: number;
  };
  stage2?: {
    textPersuasion: {
      probability: number;
      confidence: number;
      persuasionTactics: string[];
    };
    screenshotCnn: {
      probability: number;
      confidence: number;
      detectedBrands: string[];
      isFakeLogin: boolean;
    };
    combined: { probability: number; confidence: number };
    latency: number;
  };

  // Evidence
  evidenceSummary: {
    domainAge: number;
    tlsValid: boolean;
    tiHits: number;
    hasLoginForm: boolean;
    autoDownload: boolean;
  };

  // Decisions
  decisionGraph: Array<{
    step: number;
    component: string;
    input: any;
    output: any;
    contribution: number;
    timestamp: Date;
  }>;
  recommendedActions: string[];

  // Visual
  screenshotUrl?: string;

  // AI Summary
  aiSummary?: {
    explanation: string;
    keyFindings: string[];
    riskAssessment: string;
    recommendedActions: string[];
    technicalDetails?: string;
  };

  // Performance
  latency: {
    total: number;
    reachability: number;
    evidence: number;
    featureExtraction?: number;
    stage1: number;
    stage2?: number;
    combiner?: number;
    policy?: number;
  };

  // Policy
  policyOverride?: {
    overridden: boolean;
    action: string;
    reason: string;
    rule: string;
    riskLevel?: string;
  };

  // Additional fields
  skippedChecks?: string[];
  verdict?: string;
  confidence?: string;
}

interface Props {
  result: V2ScanResult;
}

export const V2ResultsDisplay: React.FC<Props> = ({ result }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'ai-summary']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getRiskColor = (level: string) => {
    const colors: Record<string, string> = {
      'A': 'from-green-500 to-emerald-600',
      'B': 'from-blue-500 to-cyan-600',
      'C': 'from-yellow-500 to-orange-500',
      'D': 'from-orange-500 to-red-500',
      'E': 'from-red-500 to-rose-600',
      'F': 'from-red-600 to-red-800'
    };
    return colors[level] || 'from-gray-500 to-gray-600';
  };

  const getRiskLabel = (level: string) => {
    const labels: Record<string, string> = {
      'A': 'SAFE',
      'B': 'LOW RISK',
      'C': 'MEDIUM RISK',
      'D': 'HIGH RISK',
      'E': 'CRITICAL',
      'F': 'MALICIOUS'
    };
    return labels[level] || 'UNKNOWN';
  };

  const getRiskIcon = (level: string) => {
    if (level === 'A' || level === 'B') return CheckCircle;
    if (level === 'C') return AlertTriangle;
    return XCircle;
  };

  const Section = ({ id, title, icon: Icon, children }: any) => {
    const isExpanded = expandedSections.has(id);
    return (
      <div className="border-2 border-cyan-500/30 bg-gray-900/50 backdrop-blur-sm rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection(id)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-cyan-500/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Icon className="w-6 h-6 text-cyan-400" />
            <h3 className="text-xl font-bold text-white">{title}</h3>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-cyan-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-cyan-400" />
          )}
        </button>
        {isExpanded && (
          <div className="px-6 py-4 border-t-2 border-cyan-500/20">
            {children}
          </div>
        )}
      </div>
    );
  };

  const RiskIcon = getRiskIcon(result.riskLevel);

  return (
    <div className="space-y-6 bg-gray-950 p-6 rounded-xl">
      {/* Hero Risk Assessment - Alienware Style */}
      <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${getRiskColor(result.riskLevel)} p-1`}>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20"></div>
        <div className="relative bg-gray-900 m-0.5 rounded-lg p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <RiskIcon className="w-20 h-20 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
              <div>
                <div className="text-5xl font-black text-white mb-2">
                  {getRiskLabel(result.riskLevel)}
                </div>
                <div className="text-xl text-gray-300">
                  Risk Score: {result.riskScore}% | Band: {result.riskLevel}
                </div>
                <div className="text-sm text-cyan-400 font-mono mt-2">
                  Probability: {(result.probability * 100).toFixed(2)}%
                  <span className="text-gray-400 ml-2">
                    (CI: {(result.confidenceInterval.lower * 100).toFixed(1)}%-{(result.confidenceInterval.upper * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Confidence Gauge */}
            <div className="flex flex-col items-center">
              <div className="text-sm text-gray-400 mb-2">Confidence</div>
              <div className="relative w-32 h-32">
                <svg className="transform -rotate-90 w-32 h-32">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="url(#gradient)"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(1 - result.confidenceInterval.width) * 351.68} 351.68`}
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {((1 - result.confidenceInterval.width) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Screenshot Display */}
      {result.screenshotUrl && (
        <Section id="screenshot" title="Website Screenshot" icon={Eye}>
          <div className="bg-black/50 p-4 rounded-lg">
            <img
              src={result.screenshotUrl}
              alt="Website screenshot"
              className="w-full rounded-lg border-2 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
            />
            <div className="mt-3 text-sm text-gray-400">
              Captured at: {new Date(result.timestamp).toLocaleString()}
            </div>
          </div>
        </Section>
      )}

      {/* AI Summary */}
      {result.aiSummary && (
        <Section id="ai-summary" title="AI Analysis" icon={Brain}>
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 p-4 rounded-lg border border-purple-500/30">
              <div className="text-sm font-semibold text-purple-300 mb-2">EXECUTIVE SUMMARY</div>
              <p className="text-gray-200 leading-relaxed">{result.aiSummary.explanation}</p>
            </div>

            {result.aiSummary.keyFindings && result.aiSummary.keyFindings.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-cyan-400 mb-2">KEY FINDINGS</div>
                <ul className="space-y-2">
                  {result.aiSummary.keyFindings.map((finding, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Zap className="w-4 h-4 text-yellow-400 mt-1 flex-shrink-0" />
                      <span className="text-gray-300">{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.aiSummary.riskAssessment && (
              <div className="bg-red-900/20 p-4 rounded-lg border border-red-500/30">
                <div className="text-sm font-semibold text-red-300 mb-2">RISK ASSESSMENT</div>
                <p className="text-gray-200">{result.aiSummary.riskAssessment}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ML Model Predictions */}
      <Section id="ml-predictions" title="Machine Learning Analysis" icon={Brain}>
        <div className="space-y-4">
          {/* Stage 1 */}
          <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/30">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-bold text-blue-300">Stage 1: Fast Analysis</div>
              <div className="text-sm text-gray-400">{result.stage1.latency}ms</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-black/30 p-3 rounded">
                <div className="text-xs text-gray-400 mb-1">URL Lexical A (XGBoost)</div>
                <div className="text-2xl font-bold text-white">
                  {(result.stage1.urlLexicalA.probability * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-cyan-400">
                  Confidence: {(result.stage1.urlLexicalA.confidence * 100).toFixed(1)}%
                </div>
              </div>

              <div className="bg-black/30 p-3 rounded">
                <div className="text-xs text-gray-400 mb-1">URL Lexical B (BERT)</div>
                <div className="text-2xl font-bold text-white">
                  {(result.stage1.urlLexicalB.probability * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-cyan-400">
                  Confidence: {(result.stage1.urlLexicalB.confidence * 100).toFixed(1)}%
                </div>
              </div>

              <div className="bg-black/30 p-3 rounded">
                <div className="text-xs text-gray-400 mb-1">Tabular Risk (XGBoost)</div>
                <div className="text-2xl font-bold text-white">
                  {(result.stage1.tabularRisk.probability * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-cyan-400">
                  Confidence: {(result.stage1.tabularRisk.confidence * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-blue-500/20">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Combined Stage-1 Prediction:</span>
                <span className="text-xl font-bold text-white">
                  {(result.stage1.combined.probability * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Stage 2 */}
          {result.stage2 && (
            <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-500/30">
              <div className="flex items-center justify-between mb-3">
                <div className="text-lg font-bold text-purple-300">Stage 2: Deep Analysis</div>
                <div className="text-sm text-gray-400">{result.stage2.latency}ms</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/30 p-3 rounded">
                  <div className="text-xs text-gray-400 mb-1">Text Persuasion (LLM)</div>
                  <div className="text-2xl font-bold text-white">
                    {(result.stage2.textPersuasion.probability * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-cyan-400">
                    Confidence: {(result.stage2.textPersuasion.confidence * 100).toFixed(1)}%
                  </div>
                  {result.stage2.textPersuasion.persuasionTactics.length > 0 && (
                    <div className="mt-2 text-xs text-yellow-400">
                      Tactics: {result.stage2.textPersuasion.persuasionTactics.join(', ')}
                    </div>
                  )}
                </div>

                <div className="bg-black/30 p-3 rounded">
                  <div className="text-xs text-gray-400 mb-1">Screenshot CNN</div>
                  <div className="text-2xl font-bold text-white">
                    {(result.stage2.screenshotCnn.probability * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-cyan-400">
                    Confidence: {(result.stage2.screenshotCnn.confidence * 100).toFixed(1)}%
                  </div>
                  {result.stage2.screenshotCnn.detectedBrands.length > 0 && (
                    <div className="mt-2 text-xs text-yellow-400">
                      Brands: {result.stage2.screenshotCnn.detectedBrands.join(', ')}
                    </div>
                  )}
                  {result.stage2.screenshotCnn.isFakeLogin && (
                    <div className="mt-1 text-xs text-red-400 font-bold">⚠️ Fake Login Detected</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Evidence Summary */}
      <Section id="evidence" title="Evidence Collected" icon={Target}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-black/30 p-4 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">Domain Age</div>
            <div className="text-2xl font-bold text-white">{result.evidenceSummary.domainAge}</div>
            <div className="text-xs text-gray-400">days</div>
          </div>

          <div className="bg-black/30 p-4 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">TLS Certificate</div>
            <div className="text-2xl font-bold">
              {result.evidenceSummary.tlsValid ? (
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto" />
              ) : (
                <XCircle className="w-8 h-8 text-red-400 mx-auto" />
              )}
            </div>
            <div className="text-xs text-gray-400">{result.evidenceSummary.tlsValid ? 'Valid' : 'Invalid'}</div>
          </div>

          <div className="bg-black/30 p-4 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">TI Hits</div>
            <div className="text-2xl font-bold text-white">{result.evidenceSummary.tiHits}</div>
            <div className="text-xs text-gray-400">sources</div>
          </div>

          <div className="bg-black/30 p-4 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">Login Form</div>
            <div className="text-2xl font-bold">
              {result.evidenceSummary.hasLoginForm ? (
                <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto" />
              ) : (
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto" />
              )}
            </div>
            <div className="text-xs text-gray-400">{result.evidenceSummary.hasLoginForm ? 'Found' : 'None'}</div>
          </div>

          <div className="bg-black/30 p-4 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">Auto Download</div>
            <div className="text-2xl font-bold">
              {result.evidenceSummary.autoDownload ? (
                <XCircle className="w-8 h-8 text-red-400 mx-auto" />
              ) : (
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto" />
              )}
            </div>
            <div className="text-xs text-gray-400">{result.evidenceSummary.autoDownload ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </Section>

      {/* Recommended Actions */}
      <Section id="actions" title="Recommended Actions" icon={TrendingUp}>
        <div className="space-y-2">
          {result.recommendedActions.map((action, i) => (
            <div key={i} className="flex items-start gap-3 bg-black/30 p-3 rounded-lg">
              <Target className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
              <span className="text-gray-200">{action}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Performance Metrics */}
      <Section id="performance" title="Performance Metrics" icon={Clock}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-black/30 p-3 rounded text-center">
            <div className="text-xs text-gray-400">Total</div>
            <div className="text-2xl font-bold text-white">{result.latency.total}ms</div>
          </div>
          <div className="bg-black/30 p-3 rounded text-center">
            <div className="text-xs text-gray-400">Reachability</div>
            <div className="text-2xl font-bold text-white">{result.latency.reachability}ms</div>
          </div>
          <div className="bg-black/30 p-3 rounded text-center">
            <div className="text-xs text-gray-400">Evidence</div>
            <div className="text-2xl font-bold text-white">{result.latency.evidence}ms</div>
          </div>
          <div className="bg-black/30 p-3 rounded text-center">
            <div className="text-xs text-gray-400">Analysis</div>
            <div className="text-2xl font-bold text-white">
              {result.latency.stage1 + (result.latency.stage2 || 0)}ms
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-400">
          Scan ID: <span className="font-mono text-cyan-400">{result.scanId}</span>
        </div>
      </Section>
    </div>
  );
};
