/**
 * Enhanced Scan Results Display Component
 *
 * PHASE 1 FEATURES DISPLAYED:
 * - Multi-LLM Consensus Analysis (Claude, GPT-4, Gemini)
 * - External Threat Intelligence (5 sources)
 * - Conversation Chain Analysis (for screenshots)
 * - Emotional Manipulation Detection
 * - Contact Information Extraction
 * - Network Infrastructure Details
 */

import React, { useState } from 'react';
import {
  Shield, AlertTriangle, CheckCircle, XCircle, Info,
  Brain, Target, TrendingUp, Eye, Globe,
  Activity, Zap, AlertCircle, FileText,
  Users, MessageSquare, Clock, MapPin, Server, Mail,
  Phone, ChevronDown, ChevronUp
} from 'lucide-react';

interface ScanResultsEnhancedProps {
  result: any;
  scanType: 'url' | 'message' | 'file';
}

export const ScanResultsEnhanced: React.FC<ScanResultsEnhancedProps> = ({ result, scanType }) => {
  if (!result) return null;

  const getRiskColor = (level: string) => {
    const colors = {
      safe: 'bg-green-50 border-green-200 text-green-800',
      low: 'bg-blue-50 border-blue-200 text-blue-800',
      medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      high: 'bg-orange-50 border-orange-200 text-orange-800',
      critical: 'bg-red-50 border-red-200 text-red-800'
    };
    return colors[level as keyof typeof colors] || colors.medium;
  };

  const getRiskIcon = (level: string) => {
    const icons = {
      safe: <CheckCircle className="w-16 h-16 text-green-500" />,
      low: <Info className="w-16 h-16 text-blue-500" />,
      medium: <AlertCircle className="w-16 h-16 text-yellow-500" />,
      high: <AlertTriangle className="w-16 h-16 text-orange-500" />,
      critical: <XCircle className="w-16 h-16 text-red-500" />
    };
    return icons[level as keyof typeof icons] || icons.medium;
  };

  const getSeverityBadge = (severity: string) => {
    const badges = {
      critical: 'bg-red-100 text-red-800 border-red-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-blue-100 text-blue-800 border-blue-300',
      info: 'bg-gray-100 text-gray-800 border-gray-300'
    };
    return badges[severity as keyof typeof badges] || badges.info;
  };

  return (
    <div className="space-y-6">
      {/* Overall Risk Summary */}
      <div className={`rounded-xl border-2 p-8 ${getRiskColor(result.riskLevel)}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              {getRiskIcon(result.riskLevel)}
              <div>
                <h2 className="text-3xl font-bold capitalize">{result.riskLevel} Risk</h2>
                <p className="text-lg opacity-80 mt-1">
                  Security Score: {result.riskScore}/350
                </p>
              </div>
            </div>

            {result.aiAnalysis?.summary && (
              <div className="mt-4 p-4 bg-white/50 rounded-lg border border-current/20">
                <div className="flex items-start gap-2">
                  <Brain className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">AI Analysis Summary</p>
                    <p className="text-sm leading-relaxed">{result.aiAnalysis.summary}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Risk Gauge */}
          <div className="ml-6">
            <div className="relative w-32 h-32">
              <svg className="transform -rotate-90 w-32 h-32">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="opacity-20"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${(result.riskScore / 350) * 352} 352`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold">{Math.round((result.riskScore / 350) * 100)}%</div>
                  <div className="text-xs opacity-70">Risk</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Emotion Analysis (for message/file scans) */}
      {result.emotionAnalysis && (
        <div className="bg-white rounded-xl border-2 border-purple-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-purple-600" />
            <h3 className="text-xl font-bold text-gray-900">Psychological Analysis</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {Object.entries(result.emotionAnalysis.emotions).map(([emotion, score]: [string, any]) => (
              <div key={emotion} className="bg-purple-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium capitalize text-gray-700">{emotion}</span>
                  <span className="text-lg font-bold text-purple-600">{score}%</span>
                </div>
                <div className="w-full bg-purple-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {result.emotionAnalysis.manipulationTactics?.length > 0 && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <div className="flex items-start gap-2">
                <Target className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-red-900 mb-2">Manipulation Tactics Detected</h4>
                  <ul className="space-y-1">
                    {result.emotionAnalysis.manipulationTactics.map((tactic: string, idx: number) => (
                      <li key={idx} className="text-sm text-red-800">• {tactic}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {result.emotionAnalysis.psychologicalTriggers?.length > 0 && (
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4">
              <div className="flex items-start gap-2">
                <Zap className="w-5 h-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-orange-900 mb-2">Psychological Triggers</h4>
                  <ul className="space-y-1">
                    {result.emotionAnalysis.psychologicalTriggers.map((trigger: string, idx: number) => (
                      <li key={idx} className="text-sm text-orange-800">• {trigger}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 p-4 bg-purple-100 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-purple-900">Overall Manipulation Score</span>
              <span className="text-2xl font-bold text-purple-600">
                {result.emotionAnalysis.overallManipulationScore}/100
              </span>
            </div>
          </div>
        </div>
      )}

      {/* AI-Powered Verdict for File/Screenshot Scans */}
      {scanType === 'file' && result.findings?.detailedReport?.verdict && (
        <AIVerdictDisplay verdict={result.findings.detailedReport.verdict} scanType="file" />
      )}

      {/* Extracted Text (for file scans) */}
      {result.extractedText && (
        <div className="bg-white rounded-xl border-2 border-blue-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-900">Extracted Text</h3>
            {result.ocrConfidence && (
              <span className="text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                {result.ocrConfidence}% confidence
              </span>
            )}
          </div>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap max-h-64 overflow-y-auto border border-gray-200">
            {result.extractedText}
          </div>
        </div>
      )}

      {/* Category Breakdown (for URL scans) */}
      {result.categories && result.categories.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-gray-700" />
            <h3 className="text-xl font-bold text-gray-900">Security Analysis Breakdown</h3>
          </div>

          <div className="space-y-4">
            {result.categories.map((category: any, idx: number) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      category.status === 'pass' ? 'bg-green-500' :
                      category.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <h4 className="font-semibold text-gray-900">{category.name}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      category.status === 'pass' ? 'bg-green-100 text-green-800' :
                      category.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {category.score}/{category.maxScore} points
                    </span>
                  </div>
                </div>

                {category.findings.length > 0 && (
                  <div className="space-y-2 mt-3 pl-6">
                    {category.findings.map((finding: any, fIdx: number) => (
                      <div key={fIdx} className={`border-l-2 pl-3 py-2 ${
                        finding.severity === 'critical' ? 'border-red-500 bg-red-50' :
                        finding.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                        finding.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                        'border-blue-500 bg-blue-50'
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-gray-800 flex-1">{finding.message}</p>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                            getSeverityBadge(finding.severity)
                          }`}>
                            +{finding.points}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        category.status === 'fail' ? 'bg-red-500' :
                        category.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${(category.score / category.maxScore) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PHASE 1: Multi-LLM Consensus Analysis */}
      {result.aiAnalysis?.multiLLMAnalysis && (
        <MultiLLMConsensusDisplay multiLLM={result.aiAnalysis.multiLLMAnalysis} />
      )}

      {/* PHASE 1: External Threat Intelligence */}
      {result.aiAnalysis?.externalScans && (
        <ExternalThreatIntelDisplay externalScans={result.aiAnalysis.externalScans} />
      )}

      {/* PHASE 1: Network Infrastructure Analysis */}
      {result.aiAnalysis?.networkInfo && (
        <NetworkInfoDisplay networkInfo={result.aiAnalysis.networkInfo} />
      )}

      {/* PHASE 1: Conversation Chain Analysis (for file/screenshot scans) */}
      {result.aiAnalysis?.conversationAnalysis?.detected && (
        <ConversationAnalysisDisplay conversation={result.aiAnalysis.conversationAnalysis} />
      )}

      {/* PHASE 1: Extracted Contact Information */}
      {result.aiAnalysis?.extractedData && (
        <ExtractedDataDisplay extractedData={result.aiAnalysis.extractedData} />
      )}

      {/* AI Detailed Analysis */}
      {result.aiAnalysis?.detailedExplanation && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border-2 border-purple-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-6 h-6 text-purple-600" />
            <h3 className="text-xl font-bold text-gray-900">AI-Powered Detailed Analysis</h3>
            {result.aiAnalysis.confidence && (
              <span className="ml-auto text-sm text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                {result.aiAnalysis.confidence}% confidence
              </span>
            )}
          </div>

          <div className="prose prose-sm max-w-none">
            <div className="bg-white/70 rounded-lg p-4 whitespace-pre-wrap text-gray-800 leading-relaxed">
              {result.aiAnalysis.detailedExplanation}
            </div>
          </div>

          {result.aiAnalysis.recommendations && result.aiAnalysis.recommendations.length > 0 && (
            <div className="mt-4 p-4 bg-white/70 rounded-lg">
              <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Security Recommendations
              </h4>
              <ul className="space-y-2">
                {result.aiAnalysis.recommendations.map((rec: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-800">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Scan Metadata */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <div className="flex flex-wrap gap-4">
          <div>
            <span className="font-medium">Scan Type:</span>{' '}
            <span className="capitalize">{scanType}</span>
          </div>
          {result.scanDuration && (
            <div>
              <span className="font-medium">Duration:</span>{' '}
              {(result.scanDuration / 1000).toFixed(2)}s
            </div>
          )}
          <div>
            <span className="font-medium">Timestamp:</span>{' '}
            {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * PHASE 1: Multi-LLM Consensus Display Component
 * Shows analysis from Claude, GPT-4, and Gemini with consensus verdict
 */
const MultiLLMConsensusDisplay: React.FC<{ multiLLM: any }> = ({ multiLLM }) => {
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  const getVerdictColor = (verdict: string) => {
    const upper = verdict?.toUpperCase();
    if (upper?.includes('SAFE') || upper?.includes('LEGITIMATE')) return 'text-green-600 bg-green-50 border-green-200';
    if (upper?.includes('SUSPICIOUS')) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (upper?.includes('PHISHING') || upper?.includes('SCAM') || upper?.includes('MALICIOUS')) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const models = [
    { key: 'claude', name: 'Claude Sonnet 4.5', icon: '🤖', data: multiLLM.claude },
    { key: 'gpt4', name: 'GPT-4', icon: '🧠', data: multiLLM.gpt4 },
    { key: 'gemini', name: 'Gemini 1.5 Flash', icon: '✨', data: multiLLM.gemini }
  ];

  const successfulModels = models.filter(m => m.data && !m.data.error);
  const failedModels = models.filter(m => m.data && m.data.error);

  return (
    <div className="bg-white rounded-xl border-2 border-purple-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="w-6 h-6 text-purple-600" />
        <h3 className="text-xl font-bold text-gray-900">Multi-AI Consensus Analysis</h3>
        <span className="ml-auto text-sm text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
          {successfulModels.length} AI Model{successfulModels.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Consensus Summary */}
      <div className={`p-4 rounded-lg border-2 mb-6 ${getVerdictColor(multiLLM.consensus.verdict)}`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-lg">Consensus Verdict</h4>
          <span className="text-2xl font-bold">{multiLLM.consensus.verdict}</span>
        </div>
        <p className="text-sm mb-2">{multiLLM.consensus.summary}</p>
        <div className="flex items-center gap-2 text-sm">
          <Activity className="w-4 h-4" />
          <span>Agreement Level: {multiLLM.consensus.agreement}%</span>
        </div>
      </div>

      {/* Individual AI Model Analyses */}
      <div className="space-y-3">
        {/* Successful Models */}
        {successfulModels.map((model) => (
          <div key={model.key} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedModel(expandedModel === model.key ? null : model.key)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{model.icon}</span>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">{model.name}</div>
                  <div className="text-sm text-gray-600">
                    Confidence: {model.data.confidence}% • Processing: {model.data.processingTime}ms
                  </div>
                </div>
              </div>
              {expandedModel === model.key ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {expandedModel === model.key && (
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-gray-800 text-sm leading-relaxed">
                    {model.data.response}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Failed/Unavailable Models */}
        {failedModels.map((model) => (
          <div key={model.key} className="border border-gray-300 rounded-lg overflow-hidden opacity-60">
            <div className="px-4 py-3 bg-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-2xl grayscale">{model.icon}</span>
                <div className="text-left flex-1">
                  <div className="font-semibold text-gray-700">{model.name}</div>
                  <div className="text-sm text-red-600">
                    ⚠️ {model.data.error || 'API not configured'}
                  </div>
                </div>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                  Unavailable
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * PHASE 1: External Threat Intelligence Display Component
 * Shows results from VirusTotal, Safe Browsing, AbuseIPDB, PhishTank, URLhaus
 */
const ExternalThreatIntelDisplay: React.FC<{ externalScans: any }> = ({ externalScans }) => {
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const getVerdictBadge = (verdict: string) => {
    const upper = verdict?.toUpperCase();
    if (upper === 'SAFE' || upper === 'CLEAN') return 'bg-green-100 text-green-800 border-green-300';
    if (upper === 'SUSPICIOUS' || upper === 'QUESTIONABLE') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (upper === 'MALICIOUS') return 'bg-red-100 text-red-800 border-red-300';
    if (upper === 'UNAVAILABLE' || upper === 'ERROR') return 'bg-gray-100 text-gray-600 border-gray-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  const sources = [
    { key: 'virustotal', name: 'VirusTotal', icon: Shield, data: externalScans.virustotal },
    { key: 'googleSafeBrowsing', name: 'Google Safe Browsing', icon: Eye, data: externalScans.googleSafeBrowsing },
    { key: 'abuseIPDB', name: 'AbuseIPDB', icon: Server, data: externalScans.abuseIPDB },
    { key: 'phishTank', name: 'PhishTank', icon: AlertTriangle, data: externalScans.phishTank },
    { key: 'urlhaus', name: 'URLhaus', icon: Globe, data: externalScans.urlhaus }
  ].filter(s => s.data);

  return (
    <div className="bg-white rounded-xl border-2 border-indigo-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Globe className="w-6 h-6 text-indigo-600" />
        <h3 className="text-xl font-bold text-gray-900">External Threat Intelligence</h3>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-indigo-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-indigo-600">{externalScans.summary?.totalChecks || 0}</div>
          <div className="text-sm text-gray-600">Total Checks</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{externalScans.summary?.flaggedCount || 0}</div>
          <div className="text-sm text-gray-600">Flagged</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{externalScans.summary?.safeCount || 0}</div>
          <div className="text-sm text-gray-600">Safe</div>
        </div>
      </div>

      {/* Overall Verdict */}
      {externalScans.summary?.overallVerdict && externalScans.summary.overallVerdict !== 'UNKNOWN' && (
        <div className={`p-3 rounded-lg mb-6 border-2 ${
          externalScans.summary.overallVerdict === 'SAFE' ? 'bg-green-50 border-green-200 text-green-800' :
          externalScans.summary.overallVerdict === 'SUSPICIOUS' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
          'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <span className="font-semibold">Overall External Verdict: {externalScans.summary.overallVerdict}</span>
          </div>
        </div>
      )}

      {/* Individual Source Results */}
      <div className="space-y-3">
        {sources.map((source) => {
          const Icon = source.icon;
          return (
            <div key={source.key} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedSource(expandedSource === source.key ? null : source.key)}
                className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-indigo-600" />
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">{source.name}</div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`px-2 py-0.5 rounded border text-xs font-medium ${getVerdictBadge(source.data.verdict)}`}>
                        {source.data.verdict}
                      </span>
                      {source.data.processingTime && (
                        <span className="text-gray-500">• {source.data.processingTime}ms</span>
                      )}
                    </div>
                  </div>
                </div>
                {expandedSource === source.key ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>

              {expandedSource === source.key && (
                <div className="p-4 bg-white border-t border-gray-200">
                  {source.data.error ? (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-semibold text-red-900 text-sm mb-1">Error Details</div>
                          <div className="text-xs text-red-700">{source.data.details?.message || source.data.error}</div>
                          {source.data.details?.error && source.data.details.error !== source.data.details.message && (
                            <div className="text-xs text-red-600 mt-1 font-mono">{source.data.details.error}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* User-friendly display of key details */}
                      <div className="space-y-2 mb-3">
                        {Object.entries(source.data.details || {}).map(([key, value]: [string, any]) => {
                          if (typeof value === 'object' || key === 'fullResults' || key === 'matches') return null;
                          return (
                            <div key={key} className="flex justify-between text-sm">
                              <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                              <span className="font-medium text-gray-900">{String(value)}</span>
                            </div>
                          );
                        })}
                      </div>
                      {/* Raw JSON for detailed inspection */}
                      <details className="mt-3">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          Show raw data
                        </summary>
                        <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto mt-2">
                          {JSON.stringify(source.data.details, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * PHASE 1: Network Infrastructure Display Component
 */
const NetworkInfoDisplay: React.FC<{ networkInfo: any }> = ({ networkInfo }) => {
  return (
    <div className="bg-white rounded-xl border-2 border-blue-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Server className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-900">Network Infrastructure</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Globe className="w-4 h-4" />
            <span className="text-sm font-medium">IP Address</span>
          </div>
          <div className="font-mono text-sm">{networkInfo.ipAddress}</div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-medium">Location</span>
          </div>
          <div className="text-sm">{networkInfo.country}</div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Server className="w-4 h-4" />
            <span className="text-sm font-medium">ISP</span>
          </div>
          <div className="text-sm">{networkInfo.isp}</div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Risk Indicators</span>
          </div>
          <div className="flex gap-2 text-xs">
            {networkInfo.isProxy && <span className="bg-red-100 text-red-700 px-2 py-1 rounded">Proxy</span>}
            {networkInfo.isHosting && <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Hosting</span>}
            {!networkInfo.isProxy && !networkInfo.isHosting && <span className="text-gray-500">None</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * PHASE 1: Conversation Chain Analysis Display Component
 */
const ConversationAnalysisDisplay: React.FC<{ conversation: any }> = ({ conversation }) => {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  return (
    <div className="bg-white rounded-xl border-2 border-pink-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="w-6 h-6 text-pink-600" />
        <h3 className="text-xl font-bold text-gray-900">Conversation Chain Analysis</h3>
        <span className="ml-auto text-sm text-pink-600 bg-pink-100 px-3 py-1 rounded-full">
          {conversation.platform}
        </span>
      </div>

      {/* Conversation Metadata */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-pink-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-pink-600">{conversation.totalMessages}</div>
          <div className="text-sm text-gray-600">Messages</div>
        </div>
        <div className="bg-pink-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-pink-600">{conversation.conversationSpan?.durationDays || 0}</div>
          <div className="text-sm text-gray-600">Days</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{conversation.redFlags?.length || 0}</div>
          <div className="text-sm text-gray-600">Red Flags</div>
        </div>
      </div>

      {/* Red Flags */}
      {conversation.redFlags && conversation.redFlags.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <h4 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Detected Red Flags
          </h4>
          <ul className="space-y-2">
            {conversation.redFlags.map((flag: string, idx: number) => (
              <li key={idx} className="text-sm text-red-800 flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Scam Progression Analysis */}
      {conversation.progression?.isTypicalScamProgression && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6">
          <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Scam Pattern Detected: {conversation.progression.progressionType}
          </h4>
          <p className="text-sm text-orange-800 mb-2">{conversation.progression.explanation}</p>
          <div className="text-sm">
            <span className="font-medium">Confidence:</span>{' '}
            <span className="text-orange-600 font-bold">{conversation.progression.confidence}%</span>
          </div>
        </div>
      )}

      {/* Timeline */}
      {conversation.timeline && conversation.timeline.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Conversation Timeline
          </h4>
          {conversation.timeline.map((day: any, idx: number) => (
            <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
                className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
              >
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Day {day.day} - {day.phase}</div>
                  <div className="text-sm text-gray-600">{day.messages.length} messages</div>
                </div>
                {expandedDay === day.day ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>

              {expandedDay === day.day && (
                <div className="p-4 bg-white border-t border-gray-200 space-y-2">
                  {day.messages.map((msg: any, mIdx: number) => (
                    <div key={mIdx} className="bg-gray-50 rounded p-3 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{msg.sender}</span>
                        <span className="text-xs text-gray-500">{msg.timestamp}</span>
                      </div>
                      <p className="text-gray-800">{msg.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Multi-LLM Analysis of Conversation */}
      {conversation.multiLLMAnalysis && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <MultiLLMConsensusDisplay multiLLM={conversation.multiLLMAnalysis} />
        </div>
      )}
    </div>
  );
};

/**
 * PHASE 1: Extracted Contact Data Display Component
 */
const ExtractedDataDisplay: React.FC<{ extractedData: any }> = ({ extractedData }) => {
  if (!extractedData.emails?.length && !extractedData.phoneNumbers?.length) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border-2 border-cyan-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Mail className="w-6 h-6 text-cyan-600" />
        <h3 className="text-xl font-bold text-gray-900">Extracted Contact Information</h3>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {extractedData.emails && extractedData.emails.length > 0 && (
          <div className="bg-cyan-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-cyan-600 mb-3">
              <Mail className="w-4 h-4" />
              <span className="font-semibold">Email Addresses ({extractedData.emails.length})</span>
            </div>
            <ul className="space-y-1">
              {extractedData.emails.map((email: string, idx: number) => (
                <li key={idx} className="text-sm font-mono bg-white px-2 py-1 rounded border border-cyan-200">
                  {email}
                </li>
              ))}
            </ul>
          </div>
        )}

        {extractedData.phoneNumbers && extractedData.phoneNumbers.length > 0 && (
          <div className="bg-cyan-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-cyan-600 mb-3">
              <Phone className="w-4 h-4" />
              <span className="font-semibold">Phone Numbers ({extractedData.phoneNumbers.length})</span>
            </div>
            <ul className="space-y-1">
              {extractedData.phoneNumbers.map((phone: string, idx: number) => (
                <li key={idx} className="text-sm font-mono bg-white px-2 py-1 rounded border border-cyan-200">
                  {phone}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-500 text-sm text-yellow-800">
        <AlertTriangle className="w-4 h-4 inline mr-2" />
        <strong>Warning:</strong> Do not contact these addresses or numbers. They may be associated with scam operations.
      </div>
    </div>
  );
};

/**
 * AI Verdict Display Component (for File/Screenshot scans)
 */
const AIVerdictDisplay: React.FC<{ verdict: any; scanType: string }> = ({ verdict }) => {
  const [verdictMode, setVerdictMode] = useState<'simple' | 'technical'>('simple');

  if (!verdict || (!verdict.simple && !verdict.technical)) {
    return null;
  }

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Brain className="w-6 h-6 text-blue-600" />
          🤖 AI Security Verdict
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setVerdictMode('simple')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              verdictMode === 'simple' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            For Everyone
          </button>
          <button
            onClick={() => setVerdictMode('technical')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              verdictMode === 'technical' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Technical
          </button>
        </div>
      </div>

      {/* Simple Explanation */}
      {verdictMode === 'simple' && verdict.simple && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
          <p className="text-gray-800 leading-relaxed whitespace-pre-line">{verdict.simple}</p>
        </div>
      )}

      {/* Technical Analysis */}
      {verdictMode === 'technical' && verdict.technical && (
        <div className="bg-gray-50 border-l-4 border-gray-500 p-4 rounded-r text-sm">
          <p className="text-gray-800 leading-relaxed whitespace-pre-line">{verdict.technical}</p>
        </div>
      )}

      {/* Recommendation */}
      {verdict.recommendation && (
        <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r">
          <h4 className="font-bold text-gray-900 mb-2">📋 Recommended Action:</h4>
          <p className="text-gray-800 leading-relaxed">{verdict.recommendation}</p>
        </div>
      )}

      {/* Safety Advice */}
      {verdict.safetyAdvice && verdict.safetyAdvice.length > 0 && (
        <div className="mt-4">
          <h4 className="font-bold text-gray-900 mb-3">🛡️ Safety Tips:</h4>
          <ul className="space-y-2">
            {verdict.safetyAdvice.map((advice: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span className="text-gray-700">{advice}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
