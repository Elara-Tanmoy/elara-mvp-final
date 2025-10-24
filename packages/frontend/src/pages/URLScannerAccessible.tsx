/**
 * ACCESSIBILITY-FOCUSED URL SCANNER
 * Simple and clear for elderly users
 * COMPREHENSIVE: Shows full AI analysis, external scans, technical details
 */

import React, { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Loader2, HelpCircle, RefreshCw, Globe, Server, Brain, Eye } from 'lucide-react';
import api from '../lib/api';

interface ScanResult {
  riskScore: number;
  maxScore: number;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  findings: Array<{
    category: string;
    severity: string;
    message: string;
    points: number;
    details?: any;
  }>;
  categories: Array<{
    name: string;
    score: number;
    maxScore: number;
    findings: any[];
    status: string;
  }>;
  url: string;
  scanDuration: number;
  // Multi-LLM AI Analysis
  multiLLMAnalysis?: {
    claude?: {
      model: string;
      response: string;
      confidence: number;
      processingTime: number;
    };
    gpt4?: {
      model: string;
      response: string;
      confidence: number;
      processingTime: number;
    };
    gemini?: {
      model: string;
      response: string;
      confidence: number;
      processingTime: number;
    };
    consensus: {
      agreement: number;
      verdict: string;
      summary: string;
    };
  };
  // External threat intelligence
  externalScans?: {
    virustotal?: any;
    googleSafeBrowsing?: any;
    abuseIPDB?: any;
    phishtank?: any;
    urlhaus?: any;
    summary: {
      totalChecks: number;
      flaggedCount: number;
      safeCount: number;
      overallVerdict: string;
    };
  };
  // Network information
  networkInfo?: {
    ipAddress: string;
    country?: string;
    isp?: string;
    isHosting?: boolean;
    isProxy?: boolean;
  };
  // Website overview and description
  websiteOverview?: {
    title: string;
    description: string;
    category: string;
    purpose: string;
  };
}

const URLScannerAccessible: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url || !url.trim()) {
      alert('Please enter a link to check');
      return;
    }

    // Basic URL validation
    let urlToScan = url.trim();
    if (!urlToScan.startsWith('http://') && !urlToScan.startsWith('https://')) {
      if (window.confirm('The link should start with http:// or https://\n\nDo you want us to add https:// automatically?')) {
        urlToScan = 'https://' + urlToScan;
        setUrl(urlToScan);
      }
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.post('/v2/scan/url', { url: urlToScan });

      console.log('Scan response:', response.data);
      setResult(response.data);
    } catch (err: any) {
      console.error('Scan error:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Something went wrong. Please try again.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const getResultBoxClasses = (level: string) => {
    switch (level) {
      case 'safe':
        return 'bg-green-50 border-4 border-green-500';
      case 'low':
        return 'bg-blue-50 border-4 border-blue-500';
      case 'medium':
        return 'bg-yellow-50 border-4 border-yellow-500';
      case 'high':
        return 'bg-orange-50 border-4 border-orange-500';
      case 'critical':
        return 'bg-red-50 border-4 border-red-500';
      default:
        return 'bg-gray-50 border-4 border-gray-500';
    }
  };

  const getIconClasses = (level: string) => {
    switch (level) {
      case 'safe':
        return 'text-green-600';
      case 'low':
        return 'text-blue-600';
      case 'medium':
        return 'text-yellow-600';
      case 'high':
        return 'text-orange-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getRecommendationBoxClasses = (level: string) => {
    switch (level) {
      case 'safe':
        return 'bg-green-100 border-2 border-green-400';
      case 'low':
        return 'bg-blue-100 border-2 border-blue-400';
      case 'medium':
        return 'bg-yellow-100 border-2 border-yellow-400';
      case 'high':
        return 'bg-orange-100 border-2 border-orange-400';
      case 'critical':
        return 'bg-red-100 border-2 border-red-400';
      default:
        return 'bg-gray-100 border-2 border-gray-400';
    }
  };

  const getRiskMessage = (level: string) => {
    switch (level) {
      case 'safe':
        return 'This link appears to be SAFE';
      case 'low':
        return 'This link seems mostly safe, but be careful';
      case 'medium':
        return 'WARNING: This link might be dangerous';
      case 'high':
        return 'DANGER: This link is likely a scam';
      case 'critical':
        return 'DANGER: DO NOT CLICK THIS LINK!';
      default:
        return 'Unknown risk level';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 px-2 sm:px-4">
      {/* Header - Mobile optimized */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl sm:rounded-2xl shadow-2xl p-6 sm:p-8 md:p-10">
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-4">
          <Shield className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex-shrink-0" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center sm:text-left">
            Check if a Link is Safe
          </h1>
        </div>
        <p className="text-lg sm:text-xl md:text-2xl text-white/90 leading-relaxed text-center sm:text-left">
          Paste any link here and we'll tell you if it's safe to click on.
        </p>
      </div>

      {/* Help Box - Mobile optimized */}
      <div className="bg-blue-50 border-2 sm:border-4 border-blue-200 rounded-lg sm:rounded-xl p-4 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <HelpCircle className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">What is a link?</h3>
            <p className="text-base sm:text-lg text-gray-800 leading-relaxed">
              A link (or URL) is a web address that looks like: <span className="font-mono bg-white px-2 py-1 rounded text-sm sm:text-base">https://example.com</span>
              <br />
              You might receive links in emails, text messages, or social media posts.
            </p>
          </div>
        </div>
      </div>

      {/* Scan Form - Mobile optimized */}
      <form onSubmit={handleScan} className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8">
        <label htmlFor="url-input" className="block text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
          Paste the link you want to check:
        </label>

        <input
          id="url-input"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="w-full text-lg sm:text-xl md:text-2xl px-4 sm:px-6 py-3 sm:py-4 md:py-5 border-2 sm:border-4 border-gray-300 rounded-lg sm:rounded-xl focus:border-blue-500 focus:ring-2 sm:focus:ring-4 focus:ring-blue-200 transition-all"
          disabled={loading}
          autoFocus
        />

        <button
          type="submit"
          disabled={loading || !url.trim()}
          className={`w-full mt-4 sm:mt-6 flex items-center justify-center gap-3 sm:gap-4 px-6 sm:px-8 py-4 sm:py-5 md:py-6 text-lg sm:text-xl md:text-2xl font-bold text-white rounded-lg sm:rounded-xl shadow-lg transition-all
            ${loading || !url.trim()
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
            }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin" />
              <span className="text-base sm:text-lg md:text-2xl">Checking... Please wait</span>
            </>
          ) : (
            <>
              <Shield className="w-6 h-6 sm:w-8 sm:h-8" />
              <span className="text-base sm:text-lg md:text-2xl">Check This Link Now</span>
            </>
          )}
        </button>
      </form>

      {/* Error Message - Mobile optimized */}
      {error && (
        <div className="bg-red-50 border-2 sm:border-4 border-red-500 rounded-lg sm:rounded-xl p-4 sm:p-6 md:p-8">
          <div className="flex items-start gap-3 sm:gap-4">
            <XCircle className="w-10 h-10 sm:w-12 sm:h-12 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-2">Something went wrong</h3>
              <p className="text-base sm:text-lg md:text-xl text-gray-800 break-words">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setResult(null);
                }}
                className="mt-4 px-4 py-2 text-sm sm:text-base font-semibold text-red-600 bg-white border-2 border-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results - Mobile optimized */}
      {result && (
        <div className={`${getResultBoxClasses(result.riskLevel)} rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 md:p-10`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
            {result.riskLevel === 'safe' ? (
              <CheckCircle className={`w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 ${getIconClasses(result.riskLevel)} flex-shrink-0`} />
            ) : (
              <AlertTriangle className={`w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 ${getIconClasses(result.riskLevel)} flex-shrink-0`} />
            )}
            <div className="flex-1">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">
                {getRiskMessage(result.riskLevel)}
              </h2>
              <div className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-800">
                Risk Score: {result.riskScore} out of {result.maxScore || 350}
              </div>
            </div>
          </div>

          {/* Simple Recommendation */}
          {result.riskLevel === 'safe' && (
            <div className={`${getRecommendationBoxClasses(result.riskLevel)} rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-6`}>
              <p className="text-xl sm:text-2xl font-bold text-green-900">
                ✓ It should be safe to visit this link
              </p>
            </div>
          )}

          {result.riskLevel !== 'safe' && (
            <div className={`${getRecommendationBoxClasses(result.riskLevel)} rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-6`}>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
                ⚠️ Our Recommendation:
              </p>
              <p className="text-base sm:text-lg md:text-xl text-gray-800 leading-relaxed">
                {result.riskLevel === 'critical' || result.riskLevel === 'high'
                  ? 'DO NOT click this link! It appears to be a scam. Delete the message immediately.'
                  : 'Be very careful with this link. We found some suspicious signs. If you\'re not sure, it\'s safer not to click it.'}
              </p>
            </div>
          )}

          {/* WEBSITE OVERVIEW - ScamAdviser Style */}
          {result.websiteOverview && (
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border-2 border-teal-300 rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-8 h-8 text-teal-600" />
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">About This Website</h3>
              </div>

              <div className="bg-white rounded-lg p-4 space-y-3">
                <div>
                  <span className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Website Title</span>
                  <p className="text-lg font-bold text-gray-900 mt-1">{result.websiteOverview.title}</p>
                </div>

                <div>
                  <span className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Category</span>
                  <p className="text-base text-gray-800 mt-1">
                    <span className="inline-block bg-teal-100 text-teal-800 px-3 py-1 rounded-full font-semibold">
                      {result.websiteOverview.category}
                    </span>
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Description</span>
                  <p className="text-base text-gray-800 mt-1 leading-relaxed">{result.websiteOverview.description}</p>
                </div>

                <div>
                  <span className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Purpose</span>
                  <p className="text-base text-gray-800 mt-1 leading-relaxed">{result.websiteOverview.purpose}</p>
                </div>
              </div>
            </div>
          )}

          {/* Why - In Simple Terms */}
          {result.findings && result.findings.length > 0 && (
            <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Why we say this:</h3>
              <ul className="space-y-2 sm:space-y-3">
                {result.findings.slice(0, 5).map((finding, index) => (
                  <li key={index} className="flex items-start gap-2 sm:gap-3">
                    <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 flex-shrink-0 mt-1" />
                    <span className="text-sm sm:text-base md:text-lg text-gray-800">{finding.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* What to do next */}
          {result.riskLevel !== 'safe' && (
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-3">What should you do?</h3>
              <ol className="space-y-2 sm:space-y-3 text-base sm:text-lg text-gray-800">
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="font-bold text-blue-600 flex-shrink-0">1.</span>
                  <span>Do NOT click on the link</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="font-bold text-blue-600 flex-shrink-0">2.</span>
                  <span>Delete the message or email</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="font-bold text-blue-600 flex-shrink-0">3.</span>
                  <span>If it claims to be from a bank or company, contact them directly using their official phone number</span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <span className="font-bold text-blue-600 flex-shrink-0">4.</span>
                  <span>Tell your friends and family to be careful</span>
                </li>
              </ol>
            </div>
          )}

          {/* AI EXPERT ANALYSIS - 3 AI Models */}
          {result.multiLLMAnalysis && (
            <div className="bg-purple-50 border-2 border-purple-300 rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Brain className="w-8 h-8 text-purple-600" />
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">AI Expert Analysis</h3>
              </div>

              {/* Consensus Summary */}
              <div className="bg-white rounded-lg p-4 mb-4">
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  {result.multiLLMAnalysis.consensus.summary}
                </p>
                <p className="text-base text-gray-700">
                  Agreement: <span className="font-bold text-purple-600">{result.multiLLMAnalysis.consensus.agreement}%</span>
                </p>
              </div>

              {/* Individual AI Analyses */}
              <div className="space-y-3">
                {result.multiLLMAnalysis.claude && result.multiLLMAnalysis.claude.response && (
                  <details className="bg-white rounded-lg p-4">
                    <summary className="font-bold text-gray-900 cursor-pointer flex items-center gap-2">
                      <span className="text-purple-600">🤖 Claude Sonnet 4.5</span>
                      <span className="text-sm text-gray-600">(Confidence: {result.multiLLMAnalysis.claude.confidence}%)</span>
                    </summary>
                    <p className="mt-3 text-sm sm:text-base text-gray-700 whitespace-pre-wrap">{result.multiLLMAnalysis.claude.response}</p>
                  </details>
                )}

                {result.multiLLMAnalysis.gpt4 && result.multiLLMAnalysis.gpt4.response && (
                  <details className="bg-white rounded-lg p-4">
                    <summary className="font-bold text-gray-900 cursor-pointer flex items-center gap-2">
                      <span className="text-green-600">🤖 GPT-4 Turbo</span>
                      <span className="text-sm text-gray-600">(Confidence: {result.multiLLMAnalysis.gpt4.confidence}%)</span>
                    </summary>
                    <p className="mt-3 text-sm sm:text-base text-gray-700 whitespace-pre-wrap">{result.multiLLMAnalysis.gpt4.response}</p>
                  </details>
                )}

                {result.multiLLMAnalysis.gemini && result.multiLLMAnalysis.gemini.response && (
                  <details className="bg-white rounded-lg p-4">
                    <summary className="font-bold text-gray-900 cursor-pointer flex items-center gap-2">
                      <span className="text-blue-600">🤖 Gemini 2.5 Pro</span>
                      <span className="text-sm text-gray-600">(Confidence: {result.multiLLMAnalysis.gemini.confidence}%)</span>
                    </summary>
                    <p className="mt-3 text-sm sm:text-base text-gray-700 whitespace-pre-wrap">{result.multiLLMAnalysis.gemini.response}</p>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* EXTERNAL SECURITY CHECKS */}
          {result.externalScans && result.externalScans.summary && (
            <div className="bg-indigo-50 border-2 border-indigo-300 rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Eye className="w-8 h-8 text-indigo-600" />
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">External Security Checks</h3>
              </div>

              <div className="bg-white rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{result.externalScans.summary.totalChecks}</p>
                    <p className="text-sm text-gray-600">Security Databases</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{result.externalScans.summary.flaggedCount}</p>
                    <p className="text-sm text-gray-600">Flagged as Threat</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{result.externalScans.summary.safeCount}</p>
                    <p className="text-sm text-gray-600">Marked Safe</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-indigo-600">{result.externalScans.summary.overallVerdict}</p>
                    <p className="text-sm text-gray-600">Overall Verdict</p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-700">
                ✓ Checked against: VirusTotal, Google Safe Browsing, AbuseIPDB, PhishTank, URLhaus
              </p>
            </div>
          )}

          {/* WEBSITE INFORMATION */}
          {result.networkInfo && (
            <div className="bg-cyan-50 border-2 border-cyan-300 rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-8 h-8 text-cyan-600" />
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Website Information</h3>
              </div>

              <div className="bg-white rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-700">IP Address:</span>
                  <span className="text-gray-900 font-mono">{result.networkInfo.ipAddress}</span>
                </div>
                {result.networkInfo.country && (
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-700">Country:</span>
                    <span className="text-gray-900">{result.networkInfo.country}</span>
                  </div>
                )}
                {result.networkInfo.isp && (
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-700">Internet Provider:</span>
                    <span className="text-gray-900">{result.networkInfo.isp}</span>
                  </div>
                )}
                {result.networkInfo.isProxy && (
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-700">Warning:</span>
                    <span className="text-red-600 font-bold">Using Proxy/VPN</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TECHNICAL DETAILS (Collapsible) - ENHANCED */}
          {result.categories && result.categories.length > 0 && (
            <details className="bg-gray-50 border-2 border-gray-300 rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <summary className="font-bold text-gray-900 cursor-pointer flex items-center gap-2 text-lg sm:text-xl hover:text-blue-600 transition-colors">
                <Server className="w-6 h-6 text-gray-600" />
                <span>Technical Details ({result.categories.length} security checks)</span>
              </summary>
              <div className="mt-4 space-y-4">
                {result.categories.map((category, index) => (
                  <details key={index} className="bg-white rounded-lg p-4 border-l-4 border-gray-400 hover:border-blue-500 transition-colors">
                    <summary className="cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-gray-900 inline-block">{category.name}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-bold ml-2 ${
                          category.status === 'pass' ? 'bg-green-100 text-green-800' :
                          category.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {category.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Score: {category.score} / {category.maxScore} points • {category.findings.length} findings
                      </p>
                    </summary>

                    {/* Expanded findings list */}
                    {category.findings && category.findings.length > 0 && (
                      <div className="mt-3 pl-4 border-l-2 border-gray-200 space-y-2">
                        {category.findings.map((finding: any, fIndex: number) => (
                          <div key={fIndex} className="text-sm">
                            <div className="flex items-start gap-2">
                              <span className={`font-semibold ${
                                finding.severity === 'critical' ? 'text-red-600' :
                                finding.severity === 'high' ? 'text-orange-600' :
                                finding.severity === 'medium' ? 'text-yellow-600' :
                                'text-gray-600'
                              }`}>
                                [{finding.severity?.toUpperCase() || 'INFO'}]
                              </span>
                              <span className="text-gray-700">{finding.message}</span>
                              {finding.points && (
                                <span className="text-red-600 font-bold ml-auto">+{finding.points} pts</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>
                ))}
              </div>
            </details>
          )}

          {/* Scan Another */}
          <div className="text-center">
            <button
              onClick={() => {
                setUrl('');
                setResult(null);
                setError(null);
              }}
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg md:text-xl font-bold text-blue-600 bg-white border-2 border-blue-600 rounded-lg sm:rounded-xl hover:bg-blue-50 transition-colors"
            >
              <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6" />
              Check Another Link
            </button>
          </div>
        </div>
      )}

      {/* Examples - Mobile optimized */}
      {!result && !loading && !error && (
        <div className="bg-gray-50 border-2 border-gray-300 rounded-lg sm:rounded-xl p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Common Types of Dangerous Links:</h3>
          <ul className="space-y-2 sm:space-y-3 text-base sm:text-lg text-gray-800">
            <li className="flex items-start gap-2 sm:gap-3">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 flex-shrink-0 mt-1" />
              <span>Fake bank websites asking for your login details</span>
            </li>
            <li className="flex items-start gap-2 sm:gap-3">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 flex-shrink-0 mt-1" />
              <span>"Prize winner" or lottery scams</span>
            </li>
            <li className="flex items-start gap-2 sm:gap-3">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 flex-shrink-0 mt-1" />
              <span>Fake package delivery notices</span>
            </li>
            <li className="flex items-start gap-2 sm:gap-3">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 flex-shrink-0 mt-1" />
              <span>Romance scam profiles</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default URLScannerAccessible;
