import React, { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, XCircle, HelpCircle, Loader2, ExternalLink } from 'lucide-react';
import api from '../lib/api';

interface Evidence {
  source: string;
  url: string;
  excerpt: string;
  supports: boolean;
  credibilityScore: number;
  publishedDate?: string;
}

interface FactCheckResult {
  veracity: 'TRUE' | 'FALSE' | 'MISLEADING' | 'UNVERIFIED' | 'OUTDATED';
  confidence: number;
  explanation: string;
  harmAssessment: {
    level: 'NONE' | 'LOW' | 'MEDIUM' | 'SEVERE';
    description: string;
  };
  evidence: Evidence[];
  expertConsensus: string;
  recommendations: string[];
  category: string;
}

const FactChecker: React.FC = () => {
  const [claim, setClaim] = useState('');
  const [category, setCategory] = useState('general');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<FactCheckResult | null>(null);
  const [error, setError] = useState('');

  const categories = [
    { id: 'health', name: 'Health & Medicine', icon: '🏥', color: '#4CAF50' },
    { id: 'political', name: 'Political', icon: '🏛️', color: '#2196F3' },
    { id: 'financial', name: 'Financial', icon: '💰', color: '#FF9800' },
    { id: 'scientific', name: 'Scientific', icon: '🔬', color: '#9C27B0' },
    { id: 'general', name: 'General', icon: '📰', color: '#607D8B' }
  ];

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!claim.trim() || claim.trim().length < 10) {
      setError('Please enter a claim (at least 10 characters)');
      return;
    }

    setIsChecking(true);

    try {
      const response = await api.post('/v2/analyze/fact', {
        claim: claim.trim(),
        category
      });

      setResult(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to check fact');
    } finally {
      setIsChecking(false);
    }
  };

  const handleNewCheck = () => {
    setResult(null);
    setClaim('');
    setCategory('general');
    setError('');
  };

  const getVeracityIcon = (veracity: string) => {
    switch (veracity) {
      case 'TRUE':
        return <CheckCircle className="w-12 h-12 text-green-600" />;
      case 'FALSE':
        return <XCircle className="w-12 h-12 text-red-600" />;
      case 'MISLEADING':
        return <AlertTriangle className="w-12 h-12 text-orange-600" />;
      case 'OUTDATED':
        return <AlertTriangle className="w-12 h-12 text-yellow-600" />;
      default:
        return <HelpCircle className="w-12 h-12 text-gray-600" />;
    }
  };

  const getVeracityColor = (veracity: string) => {
    switch (veracity) {
      case 'TRUE':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'FALSE':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'MISLEADING':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'OUTDATED':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getHarmColor = (level: string) => {
    switch (level) {
      case 'SEVERE':
        return 'bg-red-100 text-red-800';
      case 'MEDIUM':
        return 'bg-orange-100 text-orange-800';
      case 'LOW':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  if (result) {
    const supportingEvidence = result.evidence.filter(e => e.supports);
    const opposingEvidence = result.evidence.filter(e => !e.supports);

    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          onClick={handleNewCheck}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          New Fact Check
        </button>

        {/* Veracity Badge */}
        <div className={`bg-white shadow-lg rounded-lg p-8 border-4 ${getVeracityColor(result.veracity)}`}>
          <div className="flex items-center gap-6">
            {getVeracityIcon(result.veracity)}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-3xl font-bold">{result.veracity}</h2>
                <span className="text-lg font-semibold">
                  {(result.confidence * 100).toFixed(0)}% Confidence
                </span>
              </div>
              <p className="text-lg font-medium mb-4">"{claim}"</p>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    result.confidence >= 0.8
                      ? 'bg-green-600'
                      : result.confidence >= 0.6
                      ? 'bg-yellow-600'
                      : 'bg-orange-600'
                  }`}
                  style={{ width: `${result.confidence * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Harm Assessment */}
        {result.harmAssessment.level !== 'NONE' && (
          <div className={`shadow rounded-lg p-6 ${getHarmColor(result.harmAssessment.level)}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold mb-2">
                  Harm Assessment: {result.harmAssessment.level}
                </h3>
                <p>{result.harmAssessment.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Explanation */}
        <div className="bg-white shadow-lg rounded-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Explanation</h3>
          <p className="text-gray-700 leading-relaxed">{result.explanation}</p>
        </div>

        {/* Expert Consensus */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-r-lg">
          <h3 className="text-lg font-bold text-blue-900 mb-2">Expert Consensus</h3>
          <p className="text-blue-800">{result.expertConsensus}</p>
        </div>

        {/* Evidence Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Supporting Evidence */}
          <div className="bg-white shadow-lg rounded-lg p-6">
            <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Supporting Evidence ({supportingEvidence.length})
            </h3>
            {supportingEvidence.length > 0 ? (
              <div className="space-y-4">
                {supportingEvidence.map((evidence, idx) => (
                  <div key={idx} className="border-l-4 border-green-400 pl-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{evidence.source}</h4>
                      <span className="text-sm text-gray-600 flex-shrink-0">
                        {evidence.credibilityScore}/100
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2 italic">"{evidence.excerpt}"</p>
                    <a
                      href={evidence.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      View Source <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 italic">No supporting evidence found</p>
            )}
          </div>

          {/* Opposing Evidence */}
          <div className="bg-white shadow-lg rounded-lg p-6">
            <h3 className="text-lg font-bold text-red-900 mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Opposing Evidence ({opposingEvidence.length})
            </h3>
            {opposingEvidence.length > 0 ? (
              <div className="space-y-4">
                {opposingEvidence.map((evidence, idx) => (
                  <div key={idx} className="border-l-4 border-red-400 pl-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{evidence.source}</h4>
                      <span className="text-sm text-gray-600 flex-shrink-0">
                        {evidence.credibilityScore}/100
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2 italic">"{evidence.excerpt}"</p>
                    <a
                      href={evidence.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      View Source <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 italic">No opposing evidence found</p>
            )}
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white shadow-lg rounded-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Recommendations</h3>
          <ul className="space-y-3">
            {result.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="text-blue-600 text-xl">✓</span>
                <span className="text-gray-700">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <Search className="w-8 h-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900">Fact Checker</h1>
        </div>

        <p className="text-gray-600 mb-8">
          Verify claims and statements by checking them against authoritative sources and expert consensus.
        </p>

        <form onSubmit={handleCheck} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Claim to Verify
            </label>
            <textarea
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder="Enter the claim you want to fact-check (e.g., 'Coffee consumption reduces risk of heart disease')"
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              disabled={isChecking}
            />
            <p className="text-sm text-gray-500 mt-1">
              {claim.length}/10,000 characters (minimum 10)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-3 border-2 rounded-lg text-center transition-colors ${
                    category === cat.id
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  disabled={isChecking}
                  style={{
                    borderColor: category === cat.id ? cat.color : undefined,
                    backgroundColor: category === cat.id ? `${cat.color}15` : undefined
                  }}
                >
                  <div className="text-2xl mb-1">{cat.icon}</div>
                  <div className="text-xs font-medium">{cat.name}</div>
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
            disabled={isChecking || claim.trim().length < 10}
            className="w-full bg-primary-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {isChecking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Checking Fact...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Check Fact
              </>
            )}
          </button>
        </form>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">How It Works:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Extract key claims from your statement</li>
            <li>• Search authoritative sources (WHO, CDC, Reuters, AP, etc.)</li>
            <li>• Assess source credibility and reliability</li>
            <li>• Determine expert consensus on the claim</li>
            <li>• Evaluate potential harm of misinformation</li>
            <li>• Provide evidence-based verdict and recommendations</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FactChecker;
