/**
 * V2 Scan Results Component - ScamAdviser Style
 *
 * Beautiful, comprehensive results display with:
 * - Trust score visual (0-100 with color-coded circle)
 * - Final verdict card (prominent at top)
 * - Positive/Negative highlights
 * - Evidence cards (organized beautifully)
 * - Icons and color coding everywhere
 */

import React, { useState } from 'react';
import {
  Shield, XCircle, CheckCircle, Info,
  Activity, Brain, Download, Share2, TrendingUp,
  Clock, Lock, Globe, Eye, AlertCircle,
  ChevronDown, ChevronUp, Zap, Gauge, List
} from 'lucide-react';

interface V2ScanResultsEnhancedProps {
  scan: any; // EnhancedScanResult type
}

const V2ScanResultsEnhanced: React.FC<V2ScanResultsEnhancedProps> = ({ scan }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['verdict', 'highlights', 'evidence'])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Trust score (inverse of risk score)
  const trustScore = scan.finalVerdict?.trustScore || (100 - scan.riskScore);
  const verdict = scan.finalVerdict?.verdict || 'UNKNOWN';

  // Get color based on trust score
  const getTrustColor = (score: number) => {
    if (score >= 76) return { bg: 'bg-green-500', text: 'text-green-700', light: 'bg-green-50', border: 'border-green-200' };
    if (score >= 61) return { bg: 'bg-yellow-500', text: 'text-yellow-700', light: 'bg-yellow-50', border: 'border-yellow-200' };
    if (score >= 31) return { bg: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-50', border: 'border-orange-200' };
    return { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50', border: 'border-red-200' };
  };

  const colorScheme = getTrustColor(trustScore);

  // Get verdict icon and styling
  const getVerdictInfo = () => {
    if (verdict === 'SAFE') {
      return {
        icon: CheckCircle,
        text: 'THIS WEBSITE IS SAFE',
        emoji: '✅',
        color: 'green',
        bg: 'bg-green-500',
        lightBg: 'bg-green-50',
        textColor: 'text-green-800'
      };
    }
    if (verdict === 'SUSPICIOUS') {
      return {
        icon: AlertCircle,
        text: 'THIS WEBSITE IS SUSPICIOUS',
        emoji: '⚠️',
        color: 'yellow',
        bg: 'bg-yellow-500',
        lightBg: 'bg-yellow-50',
        textColor: 'text-yellow-800'
      };
    }
    if (verdict === 'DANGEROUS') {
      return {
        icon: XCircle,
        text: 'THIS WEBSITE IS DANGEROUS',
        emoji: '⛔',
        color: 'red',
        bg: 'bg-red-500',
        lightBg: 'bg-red-50',
        textColor: 'text-red-800'
      };
    }
    return {
      icon: Info,
      text: 'UNABLE TO DETERMINE SAFETY',
      emoji: 'ℹ️',
      color: 'gray',
      bg: 'bg-gray-500',
      lightBg: 'bg-gray-50',
      textColor: 'text-gray-800'
    };
  };

  const verdictInfo = getVerdictInfo();

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Website Security Analysis</h1>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Globe className="w-4 h-4" />
              <span className="font-mono break-all">{scan.url}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {new Date(scan.timestamp).toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-4 h-4" />
            {scan.latency?.total}ms
          </span>
          <span className="flex items-center gap-1">
            <Activity className="w-4 h-4" />
            {scan.scanId}
          </span>
        </div>
      </div>

      {/* MAIN VERDICT CARD - Most Prominent */}
      <div className={`${verdictInfo.lightBg} rounded-2xl shadow-2xl border-4 ${verdictInfo.bg} border-opacity-20 overflow-hidden`}>
        <div className="p-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left: Trust Score Gauge */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative">
                {/* Circular gauge */}
                <svg className="w-56 h-56 transform -rotate-90" viewBox="0 0 200 200">
                  {/* Background circle */}
                  <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="20"
                  />
                  {/* Foreground circle - animated */}
                  <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill="none"
                    stroke={trustScore >= 76 ? '#22c55e' : trustScore >= 61 ? '#eab308' : trustScore >= 31 ? '#f97316' : '#ef4444'}
                    strokeWidth="20"
                    strokeDasharray={`${(trustScore / 100) * 534.07} 534.07`}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                {/* Score in center */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-6xl font-bold" style={{ color: trustScore >= 76 ? '#22c55e' : trustScore >= 61 ? '#eab308' : trustScore >= 31 ? '#f97316' : '#ef4444' }}>
                    {trustScore}
                  </span>
                  <span className="text-gray-600 text-sm font-semibold mt-1">TRUST SCORE</span>
                  <span className="text-gray-400 text-xs">out of 100</span>
                </div>
              </div>
            </div>

            {/* Right: Verdict Details */}
            <div className="flex flex-col justify-center space-y-6">
              <div>
                <div className={`inline-flex items-center gap-3 px-6 py-4 ${verdictInfo.bg} text-white rounded-xl shadow-lg text-2xl font-bold`}>
                  <span className="text-3xl">{verdictInfo.emoji}</span>
                  <span>{verdictInfo.text}</span>
                </div>
              </div>

              {/* Summary */}
              {scan.finalVerdict?.summary && (
                <p className="text-lg text-gray-800 leading-relaxed">
                  {scan.finalVerdict.summary}
                </p>
              )}

              {/* Recommendation */}
              {scan.finalVerdict?.recommendation && (
                <div className={`p-4 ${colorScheme.light} border-l-4 ${colorScheme.bg} rounded-r-lg`}>
                  <p className={`font-semibold ${colorScheme.text}`}>
                    {scan.finalVerdict.recommendation}
                  </p>
                </div>
              )}

              {/* Badges */}
              {scan.finalVerdict?.badges && scan.finalVerdict.badges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {scan.finalVerdict.badges.map((badge: any, idx: number) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                        badge.type === 'success' ? 'bg-green-100 text-green-800' :
                        badge.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        badge.type === 'danger' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <span>{badge.icon}</span>
                      <span>{badge.text}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* HIGHLIGHTS SECTION - ScamAdviser Style */}
      {(scan.finalVerdict?.positiveHighlights?.length > 0 || scan.finalVerdict?.negativeHighlights?.length > 0) && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-gray-100">
          <button
            onClick={() => toggleSection('highlights')}
            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-900">Key Findings</h2>
            </div>
            {expandedSections.has('highlights') ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
          </button>

          {expandedSections.has('highlights') && (
            <div className="border-t-2 border-gray-100 p-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Positive Highlights */}
                {scan.finalVerdict?.positiveHighlights?.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-green-800 flex items-center gap-2 mb-4">
                      <CheckCircle className="w-5 h-5" />
                      Positive Indicators
                    </h3>
                    {scan.finalVerdict.positiveHighlights.map((highlight: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-700 leading-relaxed">{highlight}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Negative Highlights */}
                {scan.finalVerdict?.negativeHighlights?.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-red-800 flex items-center gap-2 mb-4">
                      <XCircle className="w-5 h-5" />
                      Red Flags
                    </h3>
                    {scan.finalVerdict.negativeHighlights.map((highlight: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-700 leading-relaxed">{highlight}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* EVIDENCE CARDS - Organized Beautifully */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Domain Info Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Globe className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Domain Info</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Age:</span>
              <span className={`font-semibold ${scan.evidenceSummary.domainAge > 365 ? 'text-green-600' : 'text-orange-600'}`}>
                {scan.evidenceSummary.domainAge} days
              </span>
            </div>
            {scan.reputationInfo?.rank && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Global Rank:</span>
                <span className="font-semibold text-blue-600">
                  #{scan.reputationInfo.rank.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Status:</span>
              <span className={`font-semibold ${scan.reachability === 'ONLINE' ? 'text-green-600' : 'text-red-600'}`}>
                {scan.reachability}
              </span>
            </div>
          </div>
        </div>

        {/* Security Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Lock className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Security</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">SSL Certificate:</span>
              <span className={`font-semibold ${scan.evidenceSummary.tlsValid ? 'text-green-600' : 'text-red-600'}`}>
                {scan.evidenceSummary.tlsValid ? '✓ Valid' : '✗ Invalid'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Login Form:</span>
              <span className={`font-semibold ${scan.evidenceSummary.hasLoginForm ? 'text-yellow-600' : 'text-green-600'}`}>
                {scan.evidenceSummary.hasLoginForm ? '⚠ Detected' : '✓ None'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Auto Download:</span>
              <span className={`font-semibold ${scan.evidenceSummary.autoDownload ? 'text-red-600' : 'text-green-600'}`}>
                {scan.evidenceSummary.autoDownload ? '✗ Detected' : '✓ None'}
              </span>
            </div>
          </div>
        </div>

        {/* Threat Intel Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Threat Intelligence</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Database Hits:</span>
              <span className={`font-semibold ${scan.evidenceSummary.tiHits === 0 ? 'text-green-600' : 'text-red-600'}`}>
                {scan.evidenceSummary.tiHits === 0 ? '✓ Clean' : `⚠ ${scan.evidenceSummary.tiHits} source(s)`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Risk Score:</span>
              <span className={`font-semibold ${scan.riskScore < 30 ? 'text-green-600' : scan.riskScore < 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                {scan.riskScore}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Risk Level:</span>
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                ['A', 'B'].includes(scan.riskLevel) ? 'bg-green-100 text-green-800' :
                ['C', 'D'].includes(scan.riskLevel) ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {scan.riskLevel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SCREENSHOT CARD */}
      {scan.screenshotUrl && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-gray-100">
          <button
            onClick={() => toggleSection('screenshot')}
            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Eye className="w-6 h-6 text-indigo-600" />
              <h2 className="text-2xl font-bold text-gray-900">Page Screenshot</h2>
            </div>
            {expandedSections.has('screenshot') ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
          </button>

          {expandedSections.has('screenshot') && (
            <div className="border-t-2 border-gray-100 p-6">
              <div className="rounded-lg overflow-hidden border-2 border-gray-200 shadow-inner">
                <img
                  src={scan.screenshotUrl}
                  alt="Website screenshot"
                  className="w-full h-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"%3E%3Crect fill="%23f3f4f6" width="1920" height="1080"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="48" fill="%239ca3af"%3EScreenshot unavailable%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-3 text-center">
                Screenshot captured at {new Date(scan.timestamp).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* DETECTION STAGES - Technical Details */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-gray-100">
        <button
          onClick={() => toggleSection('stages')}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">ML Detection Stages</h2>
          </div>
          {expandedSections.has('stages') ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
        </button>

        {expandedSections.has('stages') && (
          <div className="border-t-2 border-gray-100 p-6 space-y-4">
            {/* Stage-1 Models */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
              <h3 className="font-bold text-lg text-blue-900 mb-4 flex items-center gap-2">
                <Gauge className="w-5 h-5" />
                Stage-1: Fast Models ({scan.latency?.stage1}ms)
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <ModelCard
                  label="URL Lexical A"
                  subtitle="XGBoost"
                  probability={scan.stage1.urlLexicalA.probability}
                  confidence={scan.stage1.urlLexicalA.confidence}
                />
                <ModelCard
                  label="URL Lexical B"
                  subtitle="BERT"
                  probability={scan.stage1.urlLexicalB.probability}
                  confidence={scan.stage1.urlLexicalB.confidence}
                />
                <ModelCard
                  label="Tabular Risk"
                  subtitle="Features"
                  probability={scan.stage1.tabularRisk.probability}
                  confidence={scan.stage1.tabularRisk.confidence}
                />
              </div>
              <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                <span className="text-sm font-semibold text-gray-700">Combined: </span>
                <span className="text-lg font-bold text-blue-600">
                  {(scan.stage1.combined.probability * 100).toFixed(1)}%
                </span>
                {scan.stage1.shouldExit && (
                  <span className="ml-3 px-2 py-1 bg-blue-600 text-white text-xs rounded-full font-semibold">
                    Early Exit
                  </span>
                )}
              </div>
            </div>

            {/* Stage-2 Models (if ran) */}
            {scan.stage2 && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                <h3 className="font-bold text-lg text-purple-900 mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Stage-2: Deep Analysis ({scan.latency?.stage2}ms)
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <ModelCard
                    label="Text Persuasion"
                    subtitle="Gemma"
                    probability={scan.stage2.textPersuasion.probability}
                    confidence={scan.stage2.textPersuasion.confidence}
                  />
                  <ModelCard
                    label="Screenshot CNN"
                    subtitle="Vision"
                    probability={scan.stage2.screenshotCnn.probability}
                    confidence={scan.stage2.screenshotCnn.confidence}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* GRANULAR CHECKS - Detailed */}
      {scan.granularChecks && scan.granularChecks.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-gray-100">
          <button
            onClick={() => toggleSection('granular')}
            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <List className="w-6 h-6 text-teal-600" />
              <h2 className="text-2xl font-bold text-gray-900">
                Detailed Security Checks ({scan.granularChecks.length})
              </h2>
            </div>
            {expandedSections.has('granular') ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
          </button>

          {expandedSections.has('granular') && (
            <div className="border-t-2 border-gray-100 p-6">
              <div className="grid gap-3">
                {scan.granularChecks
                  .filter((check: any) => check.status === 'FAIL' || check.status === 'WARNING')
                  .slice(0, 20)
                  .map((check: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border-l-4 ${
                        check.status === 'FAIL'
                          ? 'bg-red-50 border-red-500'
                          : 'bg-yellow-50 border-yellow-500'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                check.status === 'FAIL'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {check.status}
                            </span>
                            <span className="font-semibold text-gray-900">{check.name}</span>
                          </div>
                          <p className="text-sm text-gray-700">{check.description}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">{check.points}</div>
                          <div className="text-xs text-gray-500">/ {check.maxPoints}</div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="bg-gray-50 rounded-lg p-6 text-center text-sm text-gray-600">
        <p>
          Powered by Elara V2 Scanner • Analyzed {scan.granularChecks?.length || 0} security checks
          • Completed in {scan.latency?.total}ms
        </p>
      </div>
    </div>
  );
};

// Model Card Component
const ModelCard: React.FC<{
  label: string;
  subtitle: string;
  probability: number;
  confidence: number;
}> = ({ label, subtitle, probability, confidence }) => {
  const percent = (probability * 100).toFixed(1);
  const confPercent = (confidence * 100).toFixed(0);

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className="text-xs text-gray-500 mb-2">{subtitle}</div>
      <div className="text-2xl font-bold text-blue-600 mb-1">{percent}%</div>
      <div className="text-xs text-gray-500">Confidence: {confPercent}%</div>
    </div>
  );
};

export default V2ScanResultsEnhanced;
