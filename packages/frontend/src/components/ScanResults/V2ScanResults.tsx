/**
 * V2 Scan Results Component
 *
 * VirusTotal/ScamAdviser-style comprehensive results display
 * Shows detailed threat analysis with all detection stages
 */

import React, { useState } from 'react';
import {
  Shield, AlertTriangle, XCircle, CheckCircle, Info,
  Activity, Target, Brain, Download, Share2,
  Clock, Server, Lock, Globe, Eye, Code, AlertCircle,
  ChevronDown, ChevronUp, Zap, Gauge
} from 'lucide-react';

interface V2ScanResultsProps {
  scan: any; // EnhancedScanResult type
}

const V2ScanResults: React.FC<V2ScanResultsProps> = ({ scan }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['verdict']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Risk level colors
  const getRiskColor = (level: string) => {
    const colors: Record<string, string> = {
      A: 'green',
      B: 'blue',
      C: 'yellow',
      D: 'orange',
      E: 'red',
      F: 'red'
    };
    return colors[level] || 'gray';
  };

  const getVerdictInfo = (verdict: string) => {
    const info: Record<string, { icon: any; text: string; color: string }> = {
      safe: { icon: CheckCircle, text: 'SAFE', color: 'green' },
      low_risk: { icon: Info, text: 'LOW RISK', color: 'blue' },
      medium_risk: { icon: AlertCircle, text: 'SUSPICIOUS', color: 'yellow' },
      high_risk: { icon: AlertTriangle, text: 'HIGH RISK', color: 'orange' },
      critical: { icon: XCircle, text: 'CRITICAL', color: 'red' },
      malicious: { icon: XCircle, text: 'DANGEROUS', color: 'red' }
    };
    return info[verdict] || info.safe;
  };

  const verdictInfo = getVerdictInfo(scan.verdict);
  const VerdictIcon = verdictInfo.icon;
  const riskColor = getRiskColor(scan.riskLevel);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header with URL */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">V2 Enhanced Scan Results</h2>
            <div className="flex items-center gap-2 text-gray-600 text-sm mb-4">
              <Globe className="w-4 h-4" />
              <span className="break-all">{scan.url}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {new Date(scan.timestamp).toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Activity className="w-4 h-4" />
                Scan ID: {scan.scanId}
              </span>
              <span className="flex items-center gap-1">
                <Zap className="w-4 h-4" />
                {scan.latency?.total}ms
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Download className="w-4 h-4" />
              Export PDF
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>
      </div>

      {/* Risk Score Gauge */}
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="relative inline-block">
            <svg className="w-64 h-64" viewBox="0 0 200 200">
              {/* Background circle */}
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="20"
              />
              {/* Foreground circle */}
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke={`rgb(${riskColor === 'green' ? '34,197,94' : riskColor === 'blue' ? '59,130,246' : riskColor === 'yellow' ? '234,179,8' : riskColor === 'orange' ? '249,115,22' : '239,68,68'})`}
                strokeWidth="20"
                strokeDasharray={`${(scan.riskScore / 100) * 502.65} 502.65`}
                strokeDashoffset="0"
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-6xl font-bold text-${riskColor}-600`}>{scan.riskScore}</span>
              <span className="text-gray-500 text-sm">/ 100</span>
            </div>
          </div>
          <div className="mt-4">
            <span className={`inline-flex items-center gap-2 px-6 py-3 bg-${riskColor}-100 text-${riskColor}-800 rounded-full text-xl font-bold`}>
              <VerdictIcon className="w-6 h-6" />
              {verdictInfo.text}
            </span>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Risk Level: <span className="font-bold">{scan.riskLevel}</span> |
            Confidence Interval: [{(scan.confidenceInterval.lower * 100).toFixed(1)}%, {(scan.confidenceInterval.upper * 100).toFixed(1)}%]
          </div>
        </div>
      </div>

      {/* Detection Stages */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <button
          onClick={() => toggleSection('stages')}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-900">Detection Stages</h3>
          </div>
          {expandedSections.has('stages') ? <ChevronUp /> : <ChevronDown />}
        </button>

        {expandedSections.has('stages') && (
          <div className="border-t border-gray-200 p-6 space-y-4">
            {/* Stage-1 */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                <Gauge className="w-5 h-5" />
                Stage-1: Lightweight Models ({scan.latency?.stage1}ms)
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded p-3">
                  <div className="text-sm text-gray-600 mb-1">URL Lexical A (XGBoost)</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {(scan.stage1.urlLexicalA.probability * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Confidence: {scan.stage1.urlLexicalA.confidence.toFixed(2)}
                  </div>
                </div>
                <div className="bg-white rounded p-3">
                  <div className="text-sm text-gray-600 mb-1">URL Lexical B (BERT)</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {(scan.stage1.urlLexicalB.probability * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Confidence: {scan.stage1.urlLexicalB.confidence.toFixed(2)}
                  </div>
                </div>
                <div className="bg-white rounded p-3">
                  <div className="text-sm text-gray-600 mb-1">Tabular Risk</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {(scan.stage1.tabularRisk.probability * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Confidence: {scan.stage1.tabularRisk.confidence.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-sm">
                <span className="font-semibold">Combined: </span>
                <span className="text-blue-600 font-bold">
                  {(scan.stage1.combined.probability * 100).toFixed(1)}%
                </span>
                {scan.stage1.shouldExit && (
                  <span className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded">
                    Early Exit
                  </span>
                )}
              </div>
            </div>

            {/* Stage-2 */}
            {scan.stage2 && (
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Stage-2: Deep Analysis ({scan.latency?.stage2}ms)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded p-3">
                    <div className="text-sm text-gray-600 mb-1">Text Persuasion (Gemma)</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {(scan.stage2.textPersuasion.probability * 100).toFixed(1)}%
                    </div>
                    {scan.stage2.textPersuasion.persuasionTactics.length > 0 && (
                      <div className="mt-2 text-xs">
                        <div className="font-semibold text-gray-700 mb-1">Tactics:</div>
                        <div className="flex flex-wrap gap-1">
                          {scan.stage2.textPersuasion.persuasionTactics.map((tactic: string) => (
                            <span key={tactic} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                              {tactic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="bg-white rounded p-3">
                    <div className="text-sm text-gray-600 mb-1">Screenshot CNN</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {(scan.stage2.screenshotCnn.probability * 100).toFixed(1)}%
                    </div>
                    {scan.stage2.screenshotCnn.isFakeLogin && (
                      <div className="mt-2">
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                          Fake Login Detected
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Policy Engine */}
            {scan.policyOverride && (
              <div className="bg-red-50 rounded-lg p-4">
                <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Policy Override
                </h4>
                <div className="text-sm">
                  <div><span className="font-semibold">Action:</span> {scan.policyOverride.action}</div>
                  <div><span className="font-semibold">Reason:</span> {scan.policyOverride.reason}</div>
                  <div><span className="font-semibold">Rule:</span> {scan.policyOverride.rule}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detailed Checks Grid */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <button
          onClick={() => toggleSection('checks')}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-green-600" />
            <h3 className="text-xl font-bold text-gray-900">Detailed Security Checks</h3>
          </div>
          {expandedSections.has('checks') ? <ChevronUp /> : <ChevronDown />}
        </button>

        {expandedSections.has('checks') && (
          <div className="border-t border-gray-200 p-6">
            <div className="grid grid-cols-2 gap-4">
              <CheckItem
                icon={Server}
                label="Reachability Status"
                value={scan.reachability}
                status={scan.reachability === 'ONLINE' ? 'pass' : 'fail'}
              />
              <CheckItem
                icon={Clock}
                label="Domain Age"
                value={`${scan.evidenceSummary.domainAge} days`}
                status={scan.evidenceSummary.domainAge > 30 ? 'pass' : 'warn'}
              />
              <CheckItem
                icon={Lock}
                label="TLS Certificate"
                value={scan.evidenceSummary.tlsValid ? 'Valid' : 'Invalid'}
                status={scan.evidenceSummary.tlsValid ? 'pass' : 'fail'}
              />
              <CheckItem
                icon={Shield}
                label="Threat Intelligence Hits"
                value={`${scan.evidenceSummary.tiHits} sources`}
                status={scan.evidenceSummary.tiHits === 0 ? 'pass' : 'fail'}
              />
              <CheckItem
                icon={Code}
                label="Login Form Detected"
                value={scan.evidenceSummary.hasLoginForm ? 'Yes' : 'No'}
                status={scan.evidenceSummary.hasLoginForm ? 'warn' : 'pass'}
              />
              <CheckItem
                icon={Download}
                label="Auto Download"
                value={scan.evidenceSummary.autoDownload ? 'Detected' : 'None'}
                status={scan.evidenceSummary.autoDownload ? 'fail' : 'pass'}
              />
            </div>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <button
          onClick={() => toggleSection('recommendations')}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Info className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-900">Recommendations</h3>
          </div>
          {expandedSections.has('recommendations') ? <ChevronUp /> : <ChevronDown />}
        </button>

        {expandedSections.has('recommendations') && (
          <div className="border-t border-gray-200 p-6">
            <div className="space-y-3">
              {scan.recommendedActions.map((action: string, idx: number) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                  <div className="mt-0.5">
                    {action.startsWith('⛔') || action.startsWith('🔴') ? (
                      <XCircle className="w-5 h-5 text-red-600" />
                    ) : action.startsWith('⚠️') ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                  <span className="text-gray-700">{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Summary */}
      {scan.aiSummary && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-lg p-6 border-2 border-purple-200">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-6 h-6 text-purple-600" />
            <h3 className="text-xl font-bold text-gray-900">AI Analysis (Gemini)</h3>
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Summary</h4>
              <p className="text-gray-700">{scan.aiSummary.explanation}</p>
            </div>
            {scan.aiSummary.keyFindings && scan.aiSummary.keyFindings.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Key Findings</h4>
                <ul className="list-disc list-inside space-y-1">
                  {scan.aiSummary.keyFindings.map((finding: string, idx: number) => (
                    <li key={idx} className="text-gray-700">{finding}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Screenshot */}
      {scan.screenshotUrl && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Eye className="w-6 h-6 text-gray-600" />
            <h3 className="text-xl font-bold text-gray-900">Page Screenshot</h3>
          </div>
          <img
            src={scan.screenshotUrl}
            alt="Page Screenshot"
            className="w-full rounded-lg border border-gray-200"
          />
        </div>
      )}
    </div>
  );
};

// CheckItem component
const CheckItem: React.FC<{
  icon: any;
  label: string;
  value: string;
  status: 'pass' | 'warn' | 'fail';
}> = ({ icon: Icon, label, value, status }) => {
  const colors = {
    pass: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-600' },
    warn: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: 'text-yellow-600' },
    fail: { bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-600' }
  };

  return (
    <div className={`${colors[status].bg} rounded-lg p-4`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${colors[status].icon}`} />
        <div className="flex-1">
          <div className="text-sm text-gray-600">{label}</div>
          <div className={`text-lg font-semibold ${colors[status].text}`}>{value}</div>
        </div>
      </div>
    </div>
  );
};

export default V2ScanResults;
