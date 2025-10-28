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
  ChevronDown, ChevronUp, Zap, Gauge, List, BarChart3
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


      {/* NEW: Scoring Explanation Card */}
      {scan.scoringExplanation && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('scoring')}
          >
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Scoring Explanation
            </h3>
            {expandedSections.has('scoring') ? <ChevronUp /> : <ChevronDown />}
          </div>

          {expandedSections.has('scoring') && (
            <div className="mt-4 space-y-4">
              {/* Final Verdict */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-lg font-semibold text-gray-900">
                  {scan.scoringExplanation.finalVerdict}
                </p>
                <p className="mt-2 text-gray-700">
                  {scan.scoringExplanation.riskReasoning}
                </p>
              </div>

              {/* Probability Breakdown */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Probability Calculation:</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Stage-1 Models Combined:</span>
                    <span className="font-mono">{(scan.scoringExplanation.probabilityBreakdown.stage1Combined * 100).toFixed(1)}%</span>
                  </div>
                  {scan.scoringExplanation.probabilityBreakdown.stage2Combined !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Stage-2 Models Combined:</span>
                      <span className="font-mono">{(scan.scoringExplanation.probabilityBreakdown.stage2Combined * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Causal Adjustments:</span>
                    <span className="font-mono">{(scan.scoringExplanation.probabilityBreakdown.causalAdjustments * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Branch Correction:</span>
                    <span className="font-mono">{(scan.scoringExplanation.probabilityBreakdown.branchCorrection * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Category Boost/Discount:</span>
                    <span className="font-mono">{(scan.scoringExplanation.probabilityBreakdown.categoryBoost * 100).toFixed(1)}%</span>
                  </div>
                  {scan.scoringExplanation.probabilityBreakdown.reputationDiscount !== 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span className="font-medium">Reputation Discount:</span>
                      <span className="font-mono">{(scan.scoringExplanation.probabilityBreakdown.reputationDiscount * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  {scan.scoringExplanation.probabilityBreakdown.domainAgeDiscount !== 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span className="font-medium">Domain Age Discount:</span>
                      <span className="font-mono">{(scan.scoringExplanation.probabilityBreakdown.domainAgeDiscount * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
                    <span>Final Probability:</span>
                    <span className="font-mono">{(scan.probability * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Key Factors */}
              {scan.scoringExplanation.keyFactors && scan.scoringExplanation.keyFactors.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Key Risk Factors:</h4>
                  <div className="space-y-2">
                    {scan.scoringExplanation.keyFactors.map((factor: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg ${
                          factor.impact === 'positive' ? 'bg-green-50 border-l-4 border-green-500' : 'bg-red-50 border-l-4 border-red-500'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className={`font-semibold ${factor.impact === 'positive' ? 'text-green-800' : 'text-red-800'}`}>
                              {factor.factor}
                            </p>
                            <p className="text-sm text-gray-700 mt-1">{factor.description}</p>
                          </div>
                          <span className={`text-sm font-mono ${factor.impact === 'positive' ? 'text-green-700' : 'text-red-700'}`}>
                            {factor.impact === 'positive' ? '+' : '-'}{(factor.weight * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* NEW: Reputation Info Card */}
      {scan.reputationInfo && scan.reputationInfo.rank && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('reputation')}
          >
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Domain Reputation
            </h3>
            {expandedSections.has('reputation') ? <ChevronUp /> : <ChevronDown />}
          </div>

          {expandedSections.has('reputation') && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Global Ranking</p>
                  <p className="text-2xl font-bold text-blue-700">
                    #{scan.reputationInfo.rank.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Tranco Top 1M</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Trust Score</p>
                  <p className="text-2xl font-bold text-green-700">
                    {scan.reputationInfo.trustScore}/100
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {scan.reputationInfo.trustLevel === 'very-high' && 'Very High Trust'}
                    {scan.reputationInfo.trustLevel === 'high' && 'High Trust'}
                    {scan.reputationInfo.trustLevel === 'medium' && 'Medium Trust'}
                    {scan.reputationInfo.trustLevel === 'low' && 'Low Trust'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                This domain is ranked #{scan.reputationInfo.rank.toLocaleString()} globally according to Tranco
                (combines Alexa, Umbrella, and Majestic rankings). Higher rankings indicate more established,
                widely-visited domains.
              </p>
            </div>
          )}
        </div>
      )}

      {/* NEW: Screenshot Display */}
      {(scan.screenshot || scan.screenshotUrl) && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('screenshot')}
          >
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Page Screenshot
            </h3>
            {expandedSections.has('screenshot') ? <ChevronUp /> : <ChevronDown />}
          </div>

          {expandedSections.has('screenshot') && (
            <div className="mt-4">
              <img
                src={scan.screenshot || scan.screenshotUrl}
                alt="Page screenshot"
                className="w-full rounded-lg border-2 border-gray-200"
              />
              <p className="text-sm text-gray-500 mt-2">
                Screenshot captured at scan time ({new Date(scan.timestamp).toLocaleString()})
              </p>
            </div>
          )}
        </div>
      )}

      {/* ENHANCED: Decision Graph */}
      {scan.decisionGraph && scan.decisionGraph.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('decisionGraph')}
          >
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Decision Graph ({scan.decisionGraph.length} steps)
            </h3>
            {expandedSections.has('decisionGraph') ? <ChevronUp /> : <ChevronDown />}
          </div>

          {expandedSections.has('decisionGraph') && (
            <div className="mt-4 space-y-3">
              {scan.decisionGraph.map((node: any, idx: number) => (
                <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        Step {node.step}: {node.component}
                      </p>
                      {node.explanation && (
                        <p className="text-sm text-gray-600 mt-1">{node.explanation}</p>
                      )}
                      <div className="mt-2 text-xs font-mono text-gray-500">
                        <div>Input: {JSON.stringify(node.input).substring(0, 100)}...</div>
                        <div>Output: {JSON.stringify(node.output).substring(0, 100)}...</div>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold px-2 py-1 rounded ${
                      (node.contribution || 0) > 0 ? 'bg-red-100 text-red-700' :
                      (node.contribution || 0) < 0 ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {(node.contribution || 0) >= 0 ? '+' : ''}{((node.contribution || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ENHANCED: Granular Checks */}
      {scan.granularChecks && scan.granularChecks.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <button onClick={() => toggleSection('granularChecks')} className="w-full flex items-center justify-between p-6 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <List className="w-6 h-6 text-purple-600" />
              <h3 className="text-xl font-bold text-gray-900">Granular Security Checks ({scan.granularChecks.length})</h3>
            </div>
            {expandedSections.has('granularChecks') ? <ChevronUp /> : <ChevronDown />}
          </button>
          {expandedSections.has('granularChecks') && (
            <div className="border-t p-6 space-y-3">
              {scan.granularChecks.map((check: any, i: number) => (
                <div
                  key={i}
                  className={`p-4 rounded-lg border-l-4 ${
                    check.status === 'PASS' ? 'bg-green-50 border-green-500' :
                    check.status === 'FAIL' ? 'bg-red-50 border-red-500' :
                    'bg-yellow-50 border-yellow-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          check.status === 'PASS' ? 'bg-green-100 text-green-700' :
                          check.status === 'FAIL' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {check.status}
                        </span>
                        <span className="font-semibold text-gray-900">{check.name}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{check.description}</p>
                      {check.details && (
                        <div className="text-xs text-gray-600 bg-white rounded p-2 font-mono">
                          {typeof check.details === 'string' ? check.details : JSON.stringify(check.details)}
                        </div>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-lg font-bold text-gray-900">{check.points}</div>
                      <div className="text-xs text-gray-500">of {check.maxPoints}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ENHANCED: Categories */}
      {scan.categoryResults && (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <button onClick={() => toggleSection('categories')} className="w-full flex items-center justify-between p-6 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-bold">Risk Categories ({scan.categoryResults.totalPoints}/{scan.categoryResults.totalPossible} pts)</h3>
            </div>
            {expandedSections.has('categories') ? <ChevronUp /> : <ChevronDown />}
          </button>
          {expandedSections.has('categories') && (
            <div className="border-t p-6 space-y-4">
              {/* Overall Score */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-lg">Overall Score</span>
                  <span className="text-2xl font-bold text-blue-700">
                    {scan.categoryResults.totalPoints}/{scan.categoryResults.totalPossible}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                    style={{ width: `${Math.min((scan.categoryResults.totalPoints / scan.categoryResults.totalPossible) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Score: {((scan.categoryResults.totalPoints / scan.categoryResults.totalPossible) * 100).toFixed(1)}%
                </p>
              </div>

              {/* Individual Categories */}
              {scan.categoryResults.categories && scan.categoryResults.categories.map((cat: any, i: number) => (
                <div key={i} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900">{cat.name}</span>
                      {cat.description && (
                        <p className="text-sm text-gray-600 mt-1">{cat.description}</p>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <span className="text-xl font-bold text-gray-900">{cat.points}</span>
                      <span className="text-gray-500">/{cat.maxPoints}</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${
                        (cat.points / cat.maxPoints) > 0.7 ? 'bg-red-500' :
                        (cat.points / cat.maxPoints) > 0.4 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((cat.points / cat.maxPoints) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-500">
                      {((cat.points / cat.maxPoints) * 100).toFixed(1)}% risk score
                    </span>
                    {cat.impact && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        cat.impact === 'high' ? 'bg-red-100 text-red-700' :
                        cat.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {cat.impact} impact
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
