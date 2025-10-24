import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, ChevronDown, ChevronUp, Shield, Database } from 'lucide-react';

interface EnhancedScanResultsProps {
  scan: any;
}

export default function EnhancedScanResults({ scan }: EnhancedScanResultsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'sources' | 'ai'>('overview');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [verdictMode, setVerdictMode] = useState<'simple' | 'technical'>('simple');

  const findings = scan.findings || {};
  const categories = findings.categories || [];
  const detailedReport = findings.detailedReport || {};
  const verdict = detailedReport.verdict || scan.verdict || {};

  const totalScore = scan.riskScore || 0;
  const maxScore = detailedReport.maxScore || 350;

  // Get risk level color
  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-400 text-gray-900';
      case 'low': return 'bg-green-500 text-white';
      case 'safe': return 'bg-green-600 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'high': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'medium': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'low': return <Info className="w-5 h-5 text-blue-500" />;
      case 'info': return <CheckCircle className="w-5 h-5 text-green-600" />;
      default: return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  // Count findings by severity
  const allFindings = categories.flatMap((cat: any) => cat.findings || []);
  const summary = {
    total: allFindings.length,
    critical: allFindings.filter((f: any) => f.severity === 'critical').length,
    high: allFindings.filter((f: any) => f.severity === 'high').length,
    medium: allFindings.filter((f: any) => f.severity === 'medium').length,
    low: allFindings.filter((f: any) => f.severity === 'low').length
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'categories'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Detailed Checks ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('sources')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'sources'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Data Sources
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'ai'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            AI Analysis
          </button>
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Risk Score Card */}
          <div className="bg-white shadow-lg rounded-lg p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gray-100 mb-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-900">{totalScore}</div>
                  <div className="text-sm text-gray-500">/ {maxScore}</div>
                </div>
              </div>

              <div className={`inline-block px-6 py-2 rounded-full text-lg font-bold ${getRiskColor(scan.riskLevel)}`}>
                {scan.riskLevel?.toUpperCase() || 'UNKNOWN'} RISK
              </div>

              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-red-600">{summary.critical}</div>
                  <div className="text-sm text-gray-600">Critical</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-500">{summary.high}</div>
                  <div className="text-sm text-gray-600">High</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-500">{summary.medium}</div>
                  <div className="text-sm text-gray-600">Medium</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-500">{summary.low}</div>
                  <div className="text-sm text-gray-600">Low</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Summary */}
          <div className="bg-white shadow-lg rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Summary</h3>
            <div className="space-y-2">
              {allFindings
                .filter((f: any) => f.severity === 'critical' || f.severity === 'high')
                .slice(0, 5)
                .map((finding: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                    {getSeverityIcon(finding.severity)}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{finding.message}</div>
                      <div className="text-sm text-gray-500">Source: {finding.source}</div>
                    </div>
                    <div className="text-sm font-bold text-gray-700">+{finding.points} pts</div>
                  </div>
                ))}
            </div>
          </div>

          {/* AI-Powered Verdict */}
          {verdict && (verdict.simple || verdict.technical) && (
            <div className="bg-white shadow-lg rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">🤖 AI Security Verdict</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVerdictMode('simple')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      verdictMode === 'simple'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    For Everyone
                  </button>
                  <button
                    onClick={() => setVerdictMode('technical')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      verdictMode === 'technical'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Technical
                  </button>
                </div>
              </div>

              <div className="prose max-w-none">
                {verdictMode === 'simple' && verdict.simple && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
                    <p className="text-gray-800 leading-relaxed whitespace-pre-line">{verdict.simple}</p>
                  </div>
                )}

                {verdictMode === 'technical' && verdict.technical && (
                  <div className="bg-gray-50 border-l-4 border-gray-500 p-4 rounded-r text-sm">
                    <p className="text-gray-800 leading-relaxed whitespace-pre-line">{verdict.technical}</p>
                  </div>
                )}
              </div>

              {verdict.recommendation && (
                <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r">
                  <h4 className="font-bold text-gray-900 mb-2">📋 Recommended Action:</h4>
                  <p className="text-gray-800 leading-relaxed">{verdict.recommendation}</p>
                </div>
              )}

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
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          {categories.map((category: any, idx: number) => {
            const isExpanded = expandedCategories.has(category.name);

            return (
              <div key={idx} className="bg-white shadow rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(category.name)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <Shield className="w-6 h-6 text-blue-600" />
                    <div className="text-left">
                      <div className="font-bold text-gray-900">{category.name}</div>
                      <div className="text-sm text-gray-500">
                        {category.findings?.length || 0} checks • {category.score}/{category.maxScore} points
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                        category.score === 0
                          ? 'bg-green-100 text-green-800'
                          : category.score < category.maxScore / 2
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {category.score === 0 ? 'PASSED' : `${category.score} RISK POINTS`}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp /> : <ChevronDown />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-6 pb-6 border-t border-gray-200">
                    <div className="mt-4 space-y-3">
                      {(category.findings || []).map((finding: any, fidx: number) => (
                        <div key={fidx} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                          {getSeverityIcon(finding.severity)}
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{finding.message}</div>
                            <div className="text-sm text-gray-600 mt-1">
                              <span className="font-semibold">Source:</span> {finding.source}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">+{finding.points}</div>
                            <div className="text-xs text-gray-500">points</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Evidence Section */}
                    {category.evidence && Object.keys(category.evidence).length > 0 && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <div className="font-semibold text-blue-900 mb-2">Evidence:</div>
                        <div className="text-sm text-blue-800 space-y-1">
                          {Object.entries(category.evidence).map(([key, value]: [string, any]) => (
                            <div key={key}>
                              <span className="font-medium">{key}:</span>{' '}
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Data Sources Tab */}
      {activeTab === 'sources' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Database className="w-6 h-6" />
            Data Sources Used
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from(new Set(allFindings.map((f: any) => f.source)))
              .sort()
              .map((source: any, idx: number) => {
                const sourceFindings = allFindings.filter((f: any) => f.source === source);
                return (
                  <div key={idx} className="p-4 border border-gray-200 rounded-lg">
                    <div className="font-bold text-gray-900">{source}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {sourceFindings.length} check{sourceFindings.length !== 1 ? 's' : ''}
                    </div>
                    <div className="mt-2">
                      <CheckCircle className="w-5 h-5 text-green-600 inline" />
                      <span className="text-sm text-gray-600 ml-2">Queried successfully</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* AI Analysis Tab */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          {/* AI Summary Analysis */}
          {scan.aiAnalysis && (
            <div className="bg-white shadow-lg rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">AI Summary Analysis</h3>
              <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
                {scan.aiAnalysis}
              </div>
            </div>
          )}

          {/* Multi-LLM Analysis (if available) */}
          {detailedReport.aiAnalysis && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900">Multi-LLM Consensus Analysis</h3>

              {/* Claude Analysis */}
              {detailedReport.aiAnalysis.claude && (
                <div className="bg-white shadow rounded-lg p-6 border-l-4 border-purple-500">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 font-bold text-lg">C</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">Claude AI Analysis</h4>
                      <p className="text-sm text-gray-600">
                        Weight: 35% • Confidence: {detailedReport.aiAnalysis.claude.confidence || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 prose max-w-none text-gray-700 whitespace-pre-wrap">
                    {detailedReport.aiAnalysis.claude.analysis || detailedReport.aiAnalysis.claude}
                  </div>
                  {detailedReport.aiAnalysis.claude.riskScore && (
                    <div className="mt-4 flex items-center gap-2">
                      <span className="font-semibold">Risk Score:</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        detailedReport.aiAnalysis.claude.riskScore >= 200 ? 'bg-red-100 text-red-800' :
                        detailedReport.aiAnalysis.claude.riskScore >= 120 ? 'bg-orange-100 text-orange-800' :
                        detailedReport.aiAnalysis.claude.riskScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {detailedReport.aiAnalysis.claude.riskScore}/350
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* GPT-4 Analysis */}
              {detailedReport.aiAnalysis.gpt4 && (
                <div className="bg-white shadow rounded-lg p-6 border-l-4 border-green-500">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-bold text-lg">G</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">GPT-4 Analysis</h4>
                      <p className="text-sm text-gray-600">
                        Weight: 35% • Confidence: {detailedReport.aiAnalysis.gpt4.confidence || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 prose max-w-none text-gray-700 whitespace-pre-wrap">
                    {detailedReport.aiAnalysis.gpt4.analysis || detailedReport.aiAnalysis.gpt4}
                  </div>
                  {detailedReport.aiAnalysis.gpt4.riskScore && (
                    <div className="mt-4 flex items-center gap-2">
                      <span className="font-semibold">Risk Score:</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        detailedReport.aiAnalysis.gpt4.riskScore >= 200 ? 'bg-red-100 text-red-800' :
                        detailedReport.aiAnalysis.gpt4.riskScore >= 120 ? 'bg-orange-100 text-orange-800' :
                        detailedReport.aiAnalysis.gpt4.riskScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {detailedReport.aiAnalysis.gpt4.riskScore}/350
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Gemini Analysis */}
              {detailedReport.aiAnalysis.gemini && (
                <div className="bg-white shadow rounded-lg p-6 border-l-4 border-blue-500">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-lg">G</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">Gemini Analysis</h4>
                      <p className="text-sm text-gray-600">
                        Weight: 30% • Confidence: {detailedReport.aiAnalysis.gemini.confidence || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 prose max-w-none text-gray-700 whitespace-pre-wrap">
                    {detailedReport.aiAnalysis.gemini.analysis || detailedReport.aiAnalysis.gemini}
                  </div>
                  {detailedReport.aiAnalysis.gemini.riskScore && (
                    <div className="mt-4 flex items-center gap-2">
                      <span className="font-semibold">Risk Score:</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        detailedReport.aiAnalysis.gemini.riskScore >= 200 ? 'bg-red-100 text-red-800' :
                        detailedReport.aiAnalysis.gemini.riskScore >= 120 ? 'bg-orange-100 text-orange-800' :
                        detailedReport.aiAnalysis.gemini.riskScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {detailedReport.aiAnalysis.gemini.riskScore}/350
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Consensus Verdict */}
              {detailedReport.aiAnalysis.consensus && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 shadow-lg rounded-lg p-6 border-2 border-blue-300">
                  <h4 className="text-lg font-bold text-gray-900 mb-3">Consensus Verdict</h4>
                  <div className="space-y-2">
                    {detailedReport.aiAnalysis.consensus.verdict && (
                      <div>
                        <span className="font-semibold">Verdict:</span>{' '}
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${getRiskColor(detailedReport.aiAnalysis.consensus.riskLevel)}`}>
                          {detailedReport.aiAnalysis.consensus.verdict}
                        </span>
                      </div>
                    )}
                    {detailedReport.aiAnalysis.consensus.confidence && (
                      <div>
                        <span className="font-semibold">Confidence:</span>{' '}
                        <span className="text-gray-700">{detailedReport.aiAnalysis.consensus.confidence}%</span>
                      </div>
                    )}
                    {detailedReport.aiAnalysis.consensus.agreement && (
                      <div>
                        <span className="font-semibold">Model Agreement:</span>{' '}
                        <span className="text-gray-700">{detailedReport.aiAnalysis.consensus.agreement}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fallback if no AI analysis available */}
          {!scan.aiAnalysis && !detailedReport.aiAnalysis && (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Info className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No AI Analysis Available</h3>
              <p className="text-gray-600">
                AI analysis was not performed for this scan or is not yet available.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Scan Metadata */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="font-semibold">Scan Type</div>
            <div>{scan.scanType}</div>
          </div>
          <div>
            <div className="font-semibold">Duration</div>
            <div>{scan.scanDuration || findings.scanDuration || 'N/A'} ms</div>
          </div>
          <div>
            <div className="font-semibold">Total Checks</div>
            <div>{summary.total}</div>
          </div>
          <div>
            <div className="font-semibold">Scanned At</div>
            <div>{new Date(scan.createdAt).toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
