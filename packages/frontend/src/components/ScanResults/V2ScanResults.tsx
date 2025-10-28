/**
 * V2 Scan Results Component - REDESIGNED
 *
 * New user-friendly layout:
 * 1. Final Verdict + Risk Score (prominent, top)
 * 2. Executive Summary (2-3 sentences)
 * 3. Website Screenshot (large, always visible)
 * 4. About This Website (auto-generated from HTML)
 * 5. Rest of detailed analysis sections
 */

import React, { useState } from 'react';
import {
  Shield, AlertTriangle, XCircle, CheckCircle, Info,
  Activity, Target, Brain,
  Clock, Server, Globe, Eye, Code, AlertCircle,
  ChevronDown, ChevronUp, Zap, Gauge, List,
  FileText, Award
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

  const getVerdictInfo = (verdict: string) => {
    const info: Record<string, { icon: any; text: string; color: string; emoji: string }> = {
      safe: { icon: CheckCircle, text: 'SAFE', color: 'green', emoji: '🟢' },
      low_risk: { icon: Info, text: 'LOW RISK', color: 'blue', emoji: '🔵' },
      medium_risk: { icon: AlertCircle, text: 'SUSPICIOUS', color: 'yellow', emoji: '🟡' },
      high_risk: { icon: AlertTriangle, text: 'HIGH RISK', color: 'orange', emoji: '🟠' },
      critical: { icon: XCircle, text: 'CRITICAL', color: 'red', emoji: '🔴' },
      malicious: { icon: XCircle, text: 'DANGEROUS', color: 'red', emoji: '🔴' }
    };
    return info[verdict] || info.safe;
  };

  const verdictInfo = getVerdictInfo(scan.verdict);

  // Generate executive summary
  const generateExecutiveSummary = () => {
    const score = scan.riskScore;
    const verdict = scan.verdict;

    if (verdict === 'safe' || verdict === 'low_risk') {
      return `This website appears to be legitimate with a low risk score of ${score}/100. Our analysis found no significant security concerns or malicious indicators. The site demonstrates positive trust signals and standard security practices.`;
    } else if (verdict === 'medium_risk') {
      return `This website has been flagged with moderate concerns (risk score: ${score}/100). While not definitively malicious, several warning signs suggest caution is advised. Review the detailed analysis below before proceeding.`;
    } else {
      return `This website poses significant security risks (risk score: ${score}/100) and may be attempting to steal your information or distribute malware. We strongly recommend avoiding this site and not entering any personal information.`;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* SECTION 1: FINAL VERDICT + RISK SCORE (PROMINENT) */}
      <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl shadow-2xl p-8 border-2 border-gray-200">
        <div className="text-center">
          {/* Large Verdict Badge */}
          <div className="mb-6">
            <div className={`inline-flex items-center gap-3 px-8 py-4 bg-${verdictInfo.color}-100 border-2 border-${verdictInfo.color}-500 text-${verdictInfo.color}-800 rounded-2xl`}>
              <span className="text-4xl">{verdictInfo.emoji}</span>
              <span className="text-3xl font-bold">{verdictInfo.text}</span>
            </div>
          </div>

          {/* Risk Score */}
          <div className="mb-4">
            <div className="text-6xl font-bold text-gray-900">{scan.riskScore}<span className="text-3xl text-gray-500">/100</span></div>
            <div className="text-lg text-gray-600 font-medium mt-2">Risk Score</div>
            <div className="text-sm text-gray-500 mt-1">
              Risk Level: <span className="font-bold">{scan.riskLevel}</span>
              {scan.confidenceInterval && (
                <> | Confidence: [{(scan.confidenceInterval.lower * 100).toFixed(0)}%-{(scan.confidenceInterval.upper * 100).toFixed(0)}%]</>
              )}
            </div>
          </div>

          {/* URL Info */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2 text-gray-700 text-sm">
              <Globe className="w-4 h-4" />
              <span className="break-all font-mono">{scan.url}</span>
            </div>
            <div className="flex items-center justify-center gap-4 text-xs text-gray-500 mt-2">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(scan.timestamp).toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Scan ID: {scan.scanId}
              </span>
              {scan.latency?.total && (
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {scan.latency.total}ms
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: EXECUTIVE SUMMARY */}
      <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
        <div className="flex items-start gap-3">
          <FileText className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Executive Summary</h3>
            <p className="text-gray-700 leading-relaxed">{generateExecutiveSummary()}</p>
          </div>
        </div>
      </div>

      {/* SECTION 3: WEBSITE SCREENSHOT (LARGE, ALWAYS VISIBLE) */}
      {((scan.screenshot && scan.screenshot !== 'N/A') || (scan.screenshotUrl && scan.screenshotUrl !== 'N/A')) && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Eye className="w-6 h-6 text-purple-600" />
            <h3 className="text-xl font-bold text-gray-900">Website Screenshot</h3>
          </div>
          <div className="max-w-4xl mx-auto">
            <img
              src={scan.screenshot || scan.screenshotUrl}
              alt="Website screenshot"
              className="w-full rounded-lg border-2 border-gray-200 shadow-md"
            />
            <p className="text-sm text-gray-500 text-center mt-3">
              Screenshot captured at scan time ({new Date(scan.timestamp).toLocaleString()})
            </p>
          </div>
        </div>
      )}

      {/* SECTION 4: ABOUT THIS WEBSITE (AUTO-GENERATED) */}
      {scan.websiteSummary && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-blue-200">
          <div className="flex items-center gap-3 mb-4">
            <Info className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-900">About This Website</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4 italic">Based on homepage/landing page analysis:</p>

          <div className="space-y-4">
            {/* Title */}
            {scan.websiteSummary.title && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Website Title:</h4>
                <p className="text-gray-700">{scan.websiteSummary.title}</p>
              </div>
            )}

            {/* Description */}
            {scan.websiteSummary.description && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Description:</h4>
                <p className="text-gray-700">{scan.websiteSummary.description}</p>
              </div>
            )}

            {/* Purpose */}
            {scan.websiteSummary.purpose && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Purpose:</h4>
                <p className="text-gray-700">{scan.websiteSummary.purpose}</p>
              </div>
            )}

            {/* Target Audience */}
            {scan.websiteSummary.targetAudience && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Target Audience:</h4>
                <p className="text-gray-700">{scan.websiteSummary.targetAudience}</p>
              </div>
            )}

            {/* Main Claims */}
            {scan.websiteSummary.mainClaims && scan.websiteSummary.mainClaims.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What the site claims:</h4>
                <ul className="space-y-1">
                  {scan.websiteSummary.mainClaims.map((claim: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-gray-700">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{claim}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key Features */}
            {scan.websiteSummary.keyFeatures && scan.websiteSummary.keyFeatures.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Key Features Mentioned:</h4>
                <ul className="space-y-1">
                  {scan.websiteSummary.keyFeatures.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-gray-700">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 5: KEY FINDINGS (Positive and Negative Highlights) */}
      {scan.finalVerdict && (scan.finalVerdict.positiveHighlights?.length > 0 || scan.finalVerdict.negativeHighlights?.length > 0) && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Key Findings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Negative Highlights */}
            {scan.finalVerdict.negativeHighlights?.length > 0 && (
              <div className="bg-red-50 rounded-lg p-4 border-l-4 border-red-500">
                <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Security Concerns
                </h4>
                <ul className="space-y-1">
                  {scan.finalVerdict.negativeHighlights.map((h: string, i: number) => (
                    <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                      <span className="mt-1">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Positive Highlights */}
            {scan.finalVerdict.positiveHighlights?.length > 0 && (
              <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
                <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Positive Indicators
                </h4>
                <ul className="space-y-1">
                  {scan.finalVerdict.positiveHighlights.map((h: string, i: number) => (
                    <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                      <span className="mt-1">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 6: Domain Reputation (if available) */}
      {scan.reputationInfo && scan.reputationInfo.rank && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Award className="w-6 h-6 text-indigo-600" />
            <h3 className="text-xl font-bold text-gray-900">Domain Reputation</h3>
          </div>
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
          <p className="text-sm text-gray-600 mt-4">
            This domain is ranked #{scan.reputationInfo.rank.toLocaleString()} globally according to Tranco
            (combines Alexa, Umbrella, and Majestic rankings). Higher rankings indicate more established,
            widely-visited domains.
          </p>
        </div>
      )}

      {/* SECTION 7: Recommendations */}
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

      {/* REST OF DETAILED SECTIONS (collapsed by default) */}

      {/* Stage-by-Stage Analysis */}
      {scan.stageVerdicts && (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <button
            onClick={() => toggleSection('stageVerdicts')}
            className="w-full flex items-center justify-between p-6 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6 text-indigo-600" />
              <h3 className="text-xl font-bold text-gray-900">Stage-by-Stage Analysis</h3>
            </div>
            {expandedSections.has('stageVerdicts') ? <ChevronUp /> : <ChevronDown />}
          </button>

          {expandedSections.has('stageVerdicts') && (
            <div className="border-t border-gray-200 p-6 space-y-4">
              {/* Reachability */}
              {scan.stageVerdicts.reachability && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    Reachability Check
                  </h4>
                  <div className="text-sm space-y-1">
                    <div><span className="font-semibold">Status:</span> {scan.stageVerdicts.reachability.status}</div>
                    <div><span className="font-semibold">Explanation:</span> {scan.stageVerdicts.reachability.explanation}</div>
                  </div>
                </div>
              )}

              {/* Threat Intelligence */}
              {scan.stageVerdicts.threatIntel && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Threat Intelligence
                  </h4>
                  <div className="text-sm space-y-1">
                    <div><span className="font-semibold">Verdict:</span> {scan.stageVerdicts.threatIntel.verdict}</div>
                    <div><span className="font-semibold">Total Hits:</span> {scan.stageVerdicts.threatIntel.hits}</div>
                    <div><span className="font-semibold">Tier-1 Hits:</span> {scan.stageVerdicts.threatIntel.tier1Hits}</div>
                    {scan.stageVerdicts.threatIntel.sources && scan.stageVerdicts.threatIntel.sources.length > 0 && (
                      <div><span className="font-semibold">Sources:</span> {scan.stageVerdicts.threatIntel.sources.join(', ')}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Domain Analysis */}
              {scan.stageVerdicts.domainAnalysis && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Domain Analysis
                  </h4>
                  <div className="text-sm space-y-1">
                    <div><span className="font-semibold">Age:</span> {scan.stageVerdicts.domainAnalysis.age} days</div>
                    <div><span className="font-semibold">Verdict:</span> {scan.stageVerdicts.domainAnalysis.verdict}</div>
                    <div><span className="font-semibold">Explanation:</span> {scan.stageVerdicts.domainAnalysis.explanation}</div>
                  </div>
                </div>
              )}

              {/* Content Analysis */}
              {scan.stageVerdicts.contentAnalysis && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Content Analysis
                  </h4>
                  <div className="text-sm space-y-1">
                    <div><span className="font-semibold">Login Form:</span> {scan.stageVerdicts.contentAnalysis.hasLoginForm ? 'Yes' : 'No'}</div>
                    <div><span className="font-semibold">Auto Download:</span> {scan.stageVerdicts.contentAnalysis.autoDownload ? 'Yes' : 'No'}</div>
                    <div><span className="font-semibold">Verdict:</span> {scan.stageVerdicts.contentAnalysis.verdict}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Detection Stages */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <button
          onClick={() => toggleSection('stages')}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-900">ML Model Predictions</h3>
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

      {/* Granular Security Checks */}
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

export default V2ScanResults;
