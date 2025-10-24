import React, { useState } from 'react';
import { UserCheck, AlertTriangle, Loader2, TrendingUp, Users, MessageSquare, CheckCircle } from 'lucide-react';
import api from '../lib/api';

interface ProfileAnalysisResult {
  authenticityScore: number;
  verdict: string;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  impersonating: string | null;
  confidence: number;
  redFlags: string[];
  recommendation: string;
  profileData: {
    platform: string;
    handle: string;
    displayName: string;
    bio: string;
    verified?: boolean;
    accountMetrics: {
      followers: number;
      following: number;
      posts: number;
      followerFollowingRatio: number;
      accountAge: string;
      accountAgeNumeric: number;
    };
    profilePhoto: {
      imageUrl: string | null;
      reverseSearchHits: number;
    };
    behaviorPattern: {
      postingFrequency: string;
      activityPattern: string;
      engagementRate: number;
    };
    impersonationAnalysis?: {
      targetPerson: string | null;
      confidence: number;
      visualSimilarity?: number;
    };
  };
  analysisMetadata?: {
    analyzedAt: string;
    latency: number;
    platform: string;
    dataSource: 'url' | 'manual';
  };
}

const ProfileAnalyzer: React.FC = () => {
  const [profileUrl, setProfileUrl] = useState('');
  const [platform, setPlatform] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ProfileAnalysisResult | null>(null);
  const [error, setError] = useState('');

  const platforms = [
    { id: 'facebook', name: 'Facebook', icon: '📘' },
    { id: 'instagram', name: 'Instagram', icon: '📷' },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼' },
    { id: 'twitter', name: 'Twitter/X', icon: '🐦' },
    { id: 'telegram', name: 'Telegram', icon: '✈️' },
    { id: 'other', name: 'Other', icon: '🌐' }
  ];

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!profileUrl.trim()) {
      setError('Please enter a profile URL');
      return;
    }

    setIsAnalyzing(true);

    try {
      console.log('[Profile Analyzer] Sending request:', {
        profileUrl: profileUrl.trim(),
        platform: platform || undefined
      });

      const response = await api.post('/v2/analyze/profile', {
        profileUrl: profileUrl.trim(),
        platform: platform || undefined
      });

      console.log('[Profile Analyzer] Response received:', response.data);

      if (response.data.success && response.data.data) {
        const profileData = response.data.data;

        // Log detailed profile data for debugging
        console.log('[Profile Analyzer] PROFILE DATA:', {
          username: profileData.profileData?.username,
          displayName: profileData.profileData?.displayName,
          followers: profileData.profileData?.accountMetrics?.followers,
          following: profileData.profileData?.accountMetrics?.following,
          posts: profileData.profileData?.accountMetrics?.posts,
          accountAge: profileData.profileData?.accountMetrics?.accountAge,
          verified: profileData.profileData?.verified || false,
          authenticityScore: profileData.authenticityScore,
          riskLevel: profileData.riskLevel
        });

        setResult(profileData);
        console.log('[Profile Analyzer] Result set successfully');
      } else {
        setError('Invalid response from server');
        console.error('[Profile Analyzer] Invalid response structure:', response.data);
      }
    } catch (err: any) {
      console.error('[Profile Analyzer] Error:', err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to analyze profile');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNewAnalysis = () => {
    setResult(null);
    setProfileUrl('');
    setPlatform('');
    setError('');
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    if (score >= 40) return 'bg-orange-100';
    return 'bg-red-100';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'safe': return 'text-green-600 bg-green-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (result) {
    const usedRealData = result.analysisMetadata?.dataSource === 'url' &&
                         result.profileData?.accountMetrics?.followers > 0;

    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          onClick={handleNewAnalysis}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          New Analysis
        </button>

        {/* Data Source Indicator */}
        {!usedRealData && result.profileData?.accountMetrics?.followers === 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-yellow-900 mb-1">Limited Data Available</p>
                <p className="text-yellow-800">
                  Unable to fetch real profile data from the platform. The profile may be private, rate-limited, or the platform blocks automated access. Analysis is based on URL pattern only.
                </p>
              </div>
            </div>
          </div>
        )}

        {usedRealData && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-green-900 mb-1">Real Profile Data Fetched</p>
                <p className="text-green-800">
                  Successfully retrieved actual profile data from {result.profileData.platform}. Analysis is based on real metrics.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Authenticity Score Gauge */}
        <div className={`bg-white shadow-lg rounded-lg p-8 ${getScoreBgColor(result.authenticityScore)}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Authenticity Score</h2>
            <span className={`px-4 py-2 rounded-full font-bold ${getRiskColor(result.riskLevel)}`}>
              {result.riskLevel.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center justify-center py-8">
            <div className="relative">
              <svg className="w-48 h-48 transform -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="#e5e7eb"
                  strokeWidth="16"
                  fill="none"
                />
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="currentColor"
                  strokeWidth="16"
                  fill="none"
                  strokeDasharray={`${result.authenticityScore * 5.53} 553`}
                  className={getScoreColor(result.authenticityScore)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className={`text-5xl font-bold ${getScoreColor(result.authenticityScore)}`}>
                    {result.authenticityScore}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">out of 100</div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-gray-700">
            {result.authenticityScore >= 80 && 'This profile appears to be highly authentic.'}
            {result.authenticityScore >= 60 && result.authenticityScore < 80 && 'This profile shows moderate authenticity.'}
            {result.authenticityScore >= 40 && result.authenticityScore < 60 && 'This profile has some suspicious indicators.'}
            {result.authenticityScore < 40 && 'This profile shows significant red flags.'}
          </p>
        </div>

        {/* Account Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-6 h-6 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Followers</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {result.profileData.accountMetrics.followers.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Ratio: {result.profileData.accountMetrics.followerFollowingRatio.toFixed(2)}
            </p>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <MessageSquare className="w-6 h-6 text-green-600" />
              <h3 className="font-semibold text-gray-900">Posts</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {result.profileData.accountMetrics.posts.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Pattern: {result.profileData.behaviorPattern.postingFrequency}
            </p>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-purple-600" />
              <h3 className="font-semibold text-gray-900">Engagement</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {(result.profileData.behaviorPattern.engagementRate * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-gray-600 mt-1">Average per post</p>
          </div>
        </div>

        {/* Impersonation Analysis */}
        {result.profileData?.impersonationAnalysis?.confidence && result.profileData.impersonationAnalysis.confidence > 0.5 && (
          <div className="bg-orange-50 border-l-4 border-orange-400 p-6 rounded-r-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-orange-900 mb-2">
                  Potential Impersonation Detected
                </h3>
                <p className="text-orange-800 mb-2">
                  This profile may be impersonating: <strong>{result.profileData.impersonationAnalysis?.targetPerson || result.impersonating || 'Unknown'}</strong>
                </p>
                <p className="text-sm text-orange-700">
                  Confidence: {((result.profileData.impersonationAnalysis?.confidence || 0) * 100).toFixed(0)}%
                  {result.profileData.impersonationAnalysis?.visualSimilarity !== undefined && (
                    <> | Visual Similarity: {((result.profileData.impersonationAnalysis?.visualSimilarity || 0) * 100).toFixed(0)}%</>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Red Flags */}
        {result.redFlags.length > 0 && (
          <div className="bg-white shadow-lg rounded-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              Red Flags Detected ({result.redFlags.length})
            </h3>
            <ul className="space-y-2">
              {result.redFlags.map((flag, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-red-600 mt-1">•</span>
                  <span className="text-gray-700">{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        <div className="bg-white shadow-lg rounded-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Recommendation
          </h3>
          <div className="flex items-start gap-3">
            <span className="text-blue-600 text-xl flex-shrink-0">ℹ️</span>
            <p className="text-gray-700 leading-relaxed">{result.recommendation}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <UserCheck className="w-8 h-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900">Social Profile Analyzer</h1>
        </div>

        <p className="text-gray-600 mb-8">
          Analyze social media profiles for authenticity, detect impersonation attempts, and identify suspicious behavior patterns.
        </p>

        <form onSubmit={handleAnalyze} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Profile URL
            </label>
            <input
              type="url"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              placeholder="https://facebook.com/username or https://twitter.com/username"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isAnalyzing}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Platform (Optional - Auto-detected)
            </label>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(platform === p.id ? '' : p.id)}
                  className={`p-3 border-2 rounded-lg text-center transition-colors ${
                    platform === p.id
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  disabled={isAnalyzing}
                >
                  <div className="text-2xl mb-1">{p.icon}</div>
                  <div className="text-xs font-medium">{p.name}</div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isAnalyzing || !profileUrl.trim()}
            className="w-full bg-primary-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Profile...
              </>
            ) : (
              <>
                <UserCheck className="w-5 h-5" />
                Analyze Profile
              </>
            )}
          </button>
        </form>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">What We Analyze:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Account age and verification status</li>
            <li>• Follower/following ratios and engagement rates</li>
            <li>• Profile photo reverse image search</li>
            <li>• Behavioral patterns and posting frequency</li>
            <li>• Impersonation detection using name similarity algorithms</li>
            <li>• Known scam keywords and suspicious content</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ProfileAnalyzer;
