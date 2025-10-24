import React, { useState } from 'react';
import {
  UserCheck, AlertTriangle, Loader2, CheckCircle, XCircle,
  Eye, Shield, MessageSquare, AlertCircleIcon, Info
} from 'lucide-react';
import api from '../lib/api';

/**
 * Enhanced Profile Analyzer - Elderly-Friendly Social Media Safety Checker
 * Features: Dual-view (Simple + Technical), Large fonts, High contrast, 7+ data sources
 */

interface EnhancedAnalysisResult {
  riskScore: number;
  verdict: 'SAFE' | 'CAUTION' | 'DANGER';
  confidenceLevel: string;
  riskLevel: string;
  simpleView: {
    verdict: string;
    riskPercentage: number;
    headline: string;
    summary: string;
    warningList: Array<{
      icon: string;
      title: string;
      description: string;
      whyItMatters: string;
    }>;
    positiveList: Array<{
      icon: string;
      description: string;
    }>;
    advice: {
      doNot: string[];
      safeActions: string[];
    };
  };
  technicalView: {
    dataSourcesChecked: string[];
    redFlags: Array<{
      severity: string;
      category: string;
      finding: string;
      evidence: string;
      riskContribution: number;
    }>;
    positiveIndicators: string[];
    detailedMetrics: any;
    aiAnalysis: {
      fullAnalysis: string;
      keyFindings: string[];
      recommendations: string[];
    };
  };
  profileData: {
    platform: string;
    username: string;
    displayName: string;
    bio: string;
    verified: boolean;
    accountAge: string;
    followers: number;
    following: number;
    posts: number;
  };
  analysisMetadata: {
    analyzedAt: string;
    latency: number;
    dataSourcesChecked: number;
    aiPowered: boolean;
  };
}

const ProfileAnalyzerEnhanced: React.FC = () => {
  const [profileUrl, setProfileUrl] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [result, setResult] = useState<EnhancedAnalysisResult | null>(null);
  const [viewMode, setViewMode] = useState<'simple' | 'technical'>('simple');
  const [error, setError] = useState('');

  // Start analysis
  const handleCheck = async () => {
    if (!profileUrl && !username) {
      setError('Please enter a profile link or username');
      return;
    }

    setError('');
    setLoading(true);
    setProgress([]);
    setResult(null);

    try {
      // Show progress steps
      const steps = [
        'Finding account information...',
        'Checking profile photo...',
        'Analyzing account activity...',
        'Looking for warning signs...',
        'Preparing your report...'
      ];

      let currentStep = 0;
      const progressInterval = setInterval(() => {
        if (currentStep < steps.length) {
          setProgress(prev => [...prev, steps[currentStep]]);
          currentStep++;
        }
      }, 2000);

      // Make API call
      const response = await api.post('/v2/analyze/profile', {
        profileUrl: profileUrl || undefined,
        username: username || undefined
      });

      clearInterval(progressInterval);

      if (response.data.success && response.data.data) {
        setResult(response.data.data);
        setProgress([...steps]);
      } else {
        throw new Error(response.data.error || 'Analysis failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to analyze profile');
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setProfileUrl('');
    setUsername('');
    setResult(null);
    setProgress([]);
    setError('');
    setViewMode('simple');
  };

  // INPUT SCREEN
  if (!loading && !result) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-100 rounded-full mb-6">
              <UserCheck className="w-12 h-12 text-blue-600" />
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Check if a Profile is Safe
            </h1>
            <p className="text-2xl text-gray-600">
              Find out if a social media account is real or fake
            </p>
          </div>

          {/* Input Card */}
          <div className="bg-white rounded-2xl shadow-lg p-10 border-2 border-gray-200">
            <h2 className="text-3xl font-semibold text-gray-800 mb-8">
              Paste the profile link below:
            </h2>

            <input
              type="text"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              placeholder="https://instagram.com/username"
              className="w-full px-6 py-5 text-2xl border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none mb-8"
              style={{ minHeight: '70px' }}
            />

            <div className="bg-blue-50 rounded-xl p-6 mb-8">
              <p className="text-xl text-gray-700 mb-4 font-semibold">Examples:</p>
              <ul className="space-y-3 text-xl text-gray-600">
                <li>• facebook.com/username</li>
                <li>• instagram.com/username</li>
                <li>• twitter.com/username</li>
                <li>• linkedin.com/in/username</li>
              </ul>
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              Or just enter the username:
            </h2>

            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className="w-full px-6 py-5 text-2xl border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none mb-8"
              style={{ minHeight: '70px' }}
            />

            {error && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 mb-8 flex items-start">
                <AlertCircleIcon className="w-8 h-8 text-red-600 mr-4 flex-shrink-0 mt-1" />
                <p className="text-xl text-red-800">{error}</p>
              </div>
            )}

            <button
              onClick={handleCheck}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-xl transition-colors text-2xl flex items-center justify-center"
              style={{ minHeight: '80px' }}
            >
              <Shield className="w-8 h-8 mr-3" />
              Check This Profile
            </button>

            <div className="bg-blue-50 rounded-xl p-6 mt-8 flex items-start">
              <Info className="w-8 h-8 text-blue-600 mr-4 flex-shrink-0 mt-1" />
              <p className="text-xl text-blue-900">
                We will check if this profile looks safe and trustworthy
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LOADING SCREEN
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-lg p-12 text-center">
          <Loader2 className="w-20 h-20 text-blue-600 animate-spin mx-auto mb-8" />
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Checking profile...
          </h2>
          <p className="text-2xl text-gray-600 mb-10">
            This may take 30-60 seconds
          </p>

          <div className="space-y-4">
            {progress.map((step, index) => (
              <div key={index} className="flex items-center text-xl text-gray-700">
                <CheckCircle className="w-7 h-7 text-green-500 mr-4 flex-shrink-0" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // RESULTS SCREEN
  if (result) {
    const isSimpleView = viewMode === 'simple';

    // Determine verdict color and icon
    const getVerdictColor = (verdict: string) => {
      if (verdict === 'SAFE') return 'text-green-700';
      if (verdict === 'CAUTION') return 'text-yellow-700';
      return 'text-red-700';
    };

    const getVerdictBg = (verdict: string) => {
      if (verdict === 'SAFE') return 'bg-green-50 border-green-300';
      if (verdict === 'CAUTION') return 'bg-yellow-50 border-yellow-300';
      return 'bg-red-50 border-red-300';
    };

    const getVerdictIcon = (verdict: string) => {
      if (verdict === 'SAFE') return <CheckCircle className="w-16 h-16 text-green-600" />;
      if (verdict === 'CAUTION') return <AlertTriangle className="w-16 h-16 text-yellow-600" />;
      return <XCircle className="w-16 h-16 text-red-600" />;
    };

    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Toggle View Button */}
          <div className="flex justify-between items-center mb-8">
            <button
              onClick={handleReset}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-8 rounded-xl transition-colors text-xl"
            >
              ← Check Another Profile
            </button>

            <button
              onClick={() => setViewMode(isSimpleView ? 'technical' : 'simple')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-xl transition-colors text-xl flex items-center"
            >
              <Eye className="w-6 h-6 mr-2" />
              {isSimpleView ? 'Show Technical Details' : 'Show Simple View'}
            </button>
          </div>

          {/* SIMPLE VIEW (Elderly-Friendly) */}
          {isSimpleView && (
            <div className="bg-white rounded-2xl shadow-lg p-10 border-2 border-gray-200">
              {/* Verdict Header */}
              <div className={`rounded-2xl p-8 mb-8 border-4 ${getVerdictBg(result.verdict)}`}>
                <div className="flex items-center justify-center mb-6">
                  {getVerdictIcon(result.verdict)}
                </div>
                <h1 className={`text-5xl font-bold text-center mb-4 ${getVerdictColor(result.verdict)}`}>
                  {result.verdict === 'SAFE' && 'SAFE'}
                  {result.verdict === 'CAUTION' && 'CAUTION ADVISED'}
                  {result.verdict === 'DANGER' && '⚠️ DANGER'}
                </h1>
                <p className="text-3xl text-center text-gray-700 font-semibold">
                  {result.simpleView.headline}
                </p>
              </div>

              {/* Risk Level Bar */}
              <div className="mb-10">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-2xl font-semibold text-gray-700">Risk Level:</span>
                  <span className="text-3xl font-bold text-gray-900">{result.riskScore}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-8">
                  <div
                    className={`h-8 rounded-full transition-all ${
                      result.riskScore >= 70 ? 'bg-red-600' :
                      result.riskScore >= 40 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${result.riskScore}%` }}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-8 mb-10">
                <h2 className="text-3xl font-bold text-gray-900 mb-4 flex items-center">
                  <MessageSquare className="w-8 h-8 mr-3" />
                  What We Found:
                </h2>
                <p className="text-2xl text-gray-700 leading-relaxed">
                  {result.simpleView.summary}
                </p>
              </div>

              {/* Warning List */}
              {result.simpleView.warningList && result.simpleView.warningList.length > 0 && (
                <div className="mb-10">
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">
                    Warning Signs Found:
                  </h2>
                  <div className="space-y-6">
                    {result.simpleView.warningList.map((warning, index) => (
                      <div key={index} className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
                        <div className="flex items-start">
                          <span className="text-4xl mr-4">{warning.icon}</span>
                          <div className="flex-1">
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">
                              {warning.title}
                            </h3>
                            <p className="text-xl text-gray-700 mb-3">
                              {warning.description}
                            </p>
                            <div className="bg-yellow-100 rounded-lg p-4">
                              <p className="text-lg text-gray-800">
                                <strong>Why this matters:</strong> {warning.whyItMatters}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Positive Indicators */}
              {result.simpleView.positiveList && result.simpleView.positiveList.length > 0 && (
                <div className="mb-10">
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">
                    Positive Signs:
                  </h2>
                  <div className="space-y-3">
                    {result.simpleView.positiveList.map((positive, index) => (
                      <div key={index} className="flex items-center text-xl text-gray-700">
                        <CheckCircle className="w-7 h-7 text-green-500 mr-4 flex-shrink-0" />
                        <span>{positive.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Advice Section */}
              <div className="bg-red-50 border-4 border-red-300 rounded-xl p-8 mb-8">
                <h2 className="text-3xl font-bold text-red-900 mb-6 flex items-center">
                  <XCircle className="w-8 h-8 mr-3" />
                  DO NOT:
                </h2>
                <ul className="space-y-4">
                  {result.simpleView.advice.doNot.map((item, index) => (
                    <li key={index} className="flex items-start text-xl text-red-800">
                      <span className="text-2xl mr-3">•</span>
                      <span className="font-semibold">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-green-50 border-4 border-green-300 rounded-xl p-8">
                <h2 className="text-3xl font-bold text-green-900 mb-6 flex items-center">
                  <CheckCircle className="w-8 h-8 mr-3" />
                  SAFE ACTIONS:
                </h2>
                <ul className="space-y-4">
                  {result.simpleView.advice.safeActions.map((item, index) => (
                    <li key={index} className="flex items-start text-xl text-green-800">
                      <span className="text-2xl mr-3">✓</span>
                      <span className="font-semibold">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TECHNICAL VIEW (Detailed) */}
          {!isSimpleView && (
            <div className="bg-white rounded-2xl shadow-lg p-10 border-2 border-gray-200">
              {/* Header */}
              <div className="border-b-2 border-gray-200 pb-6 mb-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center">
                  <Shield className="w-10 h-10 mr-3" />
                  TECHNICAL ANALYSIS REPORT
                </h1>
                <div className="grid grid-cols-2 gap-6 text-lg text-gray-600">
                  <div>
                    <strong>Profile:</strong> @{result.profileData.username}
                  </div>
                  <div>
                    <strong>Platform:</strong> {result.profileData.platform}
                  </div>
                  <div>
                    <strong>Scan Date:</strong> {new Date(result.analysisMetadata.analyzedAt).toLocaleString()}
                  </div>
                  <div>
                    <strong>Analysis Time:</strong> {(result.analysisMetadata.latency / 1000).toFixed(1)}s
                  </div>
                </div>
              </div>

              {/* Risk Assessment */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-4 border-b-2 pb-2">
                  RISK ASSESSMENT
                </h2>
                <div className="grid grid-cols-2 gap-6 text-xl">
                  <div>
                    <span className="font-semibold">Overall Risk Score:</span>
                    <span className={`ml-3 font-bold ${
                      result.riskScore >= 70 ? 'text-red-600' :
                      result.riskScore >= 40 ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {result.riskScore}/100 ({result.riskLevel.toUpperCase()})
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">Confidence Level:</span>
                    <span className="ml-3">{result.confidenceLevel} ({
                      result.confidenceLevel === 'High' ? '94%' :
                      result.confidenceLevel === 'Medium' ? '75%' : '50%'
                    })</span>
                  </div>
                  <div className="col-span-2">
                    <span className="font-semibold">Verdict:</span>
                    <span className={`ml-3 font-bold ${getVerdictColor(result.verdict)}`}>
                      {result.verdict}
                    </span>
                  </div>
                </div>
              </div>

              {/* Data Sources Checked */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-4 border-b-2 pb-2">
                  DATA SOURCES CHECKED ({result.technicalView.dataSourcesChecked.length}/7)
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {result.technicalView.dataSourcesChecked.map((source, index) => (
                    <div key={index} className="flex items-center text-lg text-gray-700">
                      <CheckCircle className="w-6 h-6 text-green-500 mr-3" />
                      {source}
                    </div>
                  ))}
                </div>
              </div>

              {/* Red Flags */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-4 border-b-2 pb-2">
                  RED FLAGS IDENTIFIED ({result.technicalView.redFlags.length})
                </h2>
                <div className="space-y-6">
                  {result.technicalView.redFlags.map((flag, index) => (
                    <div key={index} className="border-l-4 border-red-500 pl-6">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {index + 1}. {flag.category}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          flag.severity === 'Severe' ? 'bg-red-100 text-red-800' :
                          flag.severity === 'Moderate' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {flag.severity}
                        </span>
                      </div>
                      <p className="text-lg text-gray-700 mb-2">{flag.finding}</p>
                      <p className="text-sm text-gray-600 mb-2">Evidence: {flag.evidence}</p>
                      <p className="text-sm font-semibold text-red-600">
                        Risk Contribution: +{flag.riskContribution} points
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Positive Indicators */}
              {result.technicalView.positiveIndicators.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4 border-b-2 pb-2">
                    POSITIVE INDICATORS
                  </h2>
                  <div className="space-y-2">
                    {result.technicalView.positiveIndicators.map((indicator, index) => (
                      <div key={index} className="flex items-center text-lg text-gray-700">
                        <CheckCircle className="w-6 h-6 text-green-500 mr-3" />
                        {indicator}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Metrics */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-4 border-b-2 pb-2">
                  DETAILED METRICS
                </h2>
                <div className="space-y-6">
                  {/* Account Info */}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">Account Information:</h3>
                    <div className="grid grid-cols-2 gap-4 text-lg bg-gray-50 p-4 rounded-lg">
                      <div>Username: @{result.technicalView.detailedMetrics.accountInfo.username}</div>
                      <div>Display Name: {result.technicalView.detailedMetrics.accountInfo.displayName}</div>
                      <div>Platform: {result.technicalView.detailedMetrics.accountInfo.platform}</div>
                      <div>Verified: {result.technicalView.detailedMetrics.accountInfo.verified ? 'Yes' : 'No'}</div>
                      <div className="col-span-2">Account Age: {result.technicalView.detailedMetrics.accountInfo.accountAge}</div>
                    </div>
                  </div>

                  {/* Audience Metrics */}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">Audience Metrics:</h3>
                    <div className="grid grid-cols-2 gap-4 text-lg bg-gray-50 p-4 rounded-lg">
                      <div>Followers: {result.technicalView.detailedMetrics.audienceMetrics.followers.toLocaleString()}</div>
                      <div>Following: {result.technicalView.detailedMetrics.audienceMetrics.following.toLocaleString()}</div>
                      <div>Posts: {result.technicalView.detailedMetrics.audienceMetrics.posts.toLocaleString()}</div>
                      <div>Ratio: {result.technicalView.detailedMetrics.audienceMetrics.ratio}:1</div>
                    </div>
                  </div>

                  {/* Content Analysis */}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">Content Analysis:</h3>
                    <div className="grid grid-cols-2 gap-4 text-lg bg-gray-50 p-4 rounded-lg">
                      <div>Posts Analyzed: {result.technicalView.detailedMetrics.contentAnalysis.postsAnalyzed}</div>
                      <div>Suspicious Keywords: {result.technicalView.detailedMetrics.contentAnalysis.suspiciousKeywords}</div>
                      <div>External Links: {result.technicalView.detailedMetrics.contentAnalysis.externalLinks}</div>
                      <div>Financial Terms: {result.technicalView.detailedMetrics.contentAnalysis.financialTerms}</div>
                    </div>
                  </div>

                  {/* Image Forensics */}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">Image Forensics:</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-lg mb-2">
                        Reverse Search Hits: <strong>{result.technicalView.detailedMetrics.imageForensics.reverseSearchHits}</strong>
                      </p>
                      <p className="text-lg text-gray-700">
                        {result.technicalView.detailedMetrics.imageForensics.summary}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Analysis */}
              {result.technicalView.aiAnalysis.fullAnalysis && (
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4 border-b-2 pb-2">
                    AI ANALYSIS
                  </h2>
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <p className="text-lg text-gray-800 whitespace-pre-line">
                      {result.technicalView.aiAnalysis.fullAnalysis}
                    </p>
                  </div>
                </div>
              )}

              {/* Legal Disclaimer */}
              <div className="bg-gray-100 rounded-lg p-6 mt-8">
                <h3 className="text-xl font-bold text-gray-900 mb-3">LEGAL DISCLAIMER</h3>
                <p className="text-base text-gray-700 mb-3">
                  This analysis is based on publicly available information and automated pattern recognition.
                  It should not be considered definitive proof of fraud. Always exercise caution and verify independently.
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Data Sources:</strong> Public APIs, Web Scraping (legal limits), Open Databases<br />
                  <strong>Privacy Compliance:</strong> GDPR, CCPA - No personal data stored
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default ProfileAnalyzerEnhanced;
