/**
 * URL SCANNER - ESS DESIGN
 * Enterprise-grade URL threat analysis with Elara Signature System
 * Mobile-first, accessible, and visually distinctive
 */

import React, { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Loader2, HelpCircle, RefreshCw, Globe, Server, Brain, Eye, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '../components/ui';
import V2ScanResults from '../components/ScanResults/V2ScanResults';
import { V2ResultsDisplay } from '../components/V2ResultsDisplay';
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
  networkInfo?: {
    ipAddress: string;
    country?: string;
    isp?: string;
    isHosting?: boolean;
    isProxy?: boolean;
  };
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
  const [scannerVersion, setScannerVersion] = useState<'v1' | 'v2'>('v2'); // Default to V2

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
      // Add version query parameter for V2 scanner
      const endpoint = scannerVersion === 'v2' ? '/v2/scan/url?version=v2' : '/v2/scan/url';
      const response = await api.post(endpoint, { url: urlToScan });
      console.log(`Scan response (${scannerVersion}):`, response.data);
      setResult(response.data);
    } catch (err: any) {
      console.error('Scan error:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Something went wrong. Please try again.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityVariant = (level: string): 'sev0' | 'sev1' | 'sev2' | 'sev3' | 'sev4' | 'sev5' => {
    switch (level) {
      case 'safe': return 'sev0';
      case 'low': return 'sev1';
      case 'medium': return 'sev2';
      case 'high': return 'sev3';
      case 'critical': return 'sev4';
      default: return 'sev0';
    }
  };

  const getRiskMessage = (level: string) => {
    switch (level) {
      case 'safe': return 'This link appears to be SAFE';
      case 'low': return 'This link seems mostly safe, but be careful';
      case 'medium': return 'WARNING: This link might be dangerous';
      case 'high': return 'DANGER: This link is likely a scam';
      case 'critical': return 'DANGER: DO NOT CLICK THIS LINK!';
      default: return 'Unknown risk level';
    }
  };

  return (
    <div className="min-h-screen bg-surface-base p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header - ESS Design */}
        <Card notched className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
          <CardContent className="p-6 sm:p-8 md:p-10">
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
              <Shield className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0" />
              <div className="text-center sm:text-left">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">
                  URL Threat Scanner
                </h1>
                <p className="text-lg sm:text-xl text-white/90">
                  Advanced multi-LLM analysis with real-time threat intelligence
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Card - ESS Design */}
        <Card notched className="bg-primary-50 border-2 border-primary-200">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <HelpCircle className="w-6 h-6 sm:w-8 sm:h-8 text-primary-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-text-primary mb-2">What is a URL?</h3>
                <p className="text-base sm:text-lg text-text-secondary leading-relaxed">
                  A URL (link) is a web address like: <span className="font-mono bg-white px-2 py-1 rounded text-sm sm:text-base text-primary-600">https://example.com</span>
                  <br className="hidden sm:block" />
                  You might receive links in emails, text messages, or social media posts.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scan Form - ESS Design with notched card */}
        <Card notched elevated>
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleScan} className="space-y-6">
              <div>
                <label htmlFor="url-input" className="block text-xl sm:text-2xl font-bold text-text-primary mb-4">
                  Enter URL to scan:
                </label>
                <input
                  id="url-input"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full text-lg sm:text-xl px-4 sm:px-6 py-3 sm:py-4 border-2 border-border-default rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all bg-surface-base text-text-primary"
                  disabled={loading}
                  autoFocus
                />
              </div>

              {/* Scanner Version Toggle */}
              <div className="flex items-center justify-between p-4 bg-surface-subtle border-2 border-border-default rounded-lg">
                <div className="flex-1">
                  <label className="block text-base sm:text-lg font-semibold text-text-primary mb-1">
                    Scanner Version
                  </label>
                  <p className="text-sm text-text-secondary">
                    {scannerVersion === 'v2' ? (
                      <>V2: Enhanced ML pipeline with Vertex AI models (recommended)</>
                    ) : (
                      <>V1: Original multi-LLM analysis</>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    type="button"
                    onClick={() => setScannerVersion('v1')}
                    disabled={loading}
                    className={`px-4 py-2 rounded-md font-medium transition-all ${
                      scannerVersion === 'v1'
                        ? 'bg-primary-600 text-white shadow-md'
                        : 'bg-surface-base text-text-secondary border-2 border-border-default hover:border-primary-300'
                    }`}
                  >
                    V1
                  </button>
                  <button
                    type="button"
                    onClick={() => setScannerVersion('v2')}
                    disabled={loading}
                    className={`px-4 py-2 rounded-md font-medium transition-all ${
                      scannerVersion === 'v2'
                        ? 'bg-primary-600 text-white shadow-md'
                        : 'bg-surface-base text-text-secondary border-2 border-border-default hover:border-primary-300'
                    }`}
                  >
                    V2
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !url.trim()}
                className="w-full text-lg sm:text-xl py-6"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    Analyzing URL...
                  </>
                ) : (
                  <>
                    <Search className="w-6 h-6 mr-2" />
                    Scan URL Now
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Error Message - ESS Design */}
        {error && (
          <Card notched className="border-2 border-red-500 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <XCircle className="w-10 h-10 sm:w-12 sm:h-12 text-red-600 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">Scan Failed</h3>
                  <p className="text-base sm:text-lg text-text-secondary break-words mb-4">{error}</p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setError(null);
                      setResult(null);
                    }}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results - ESS Design with Severity */}
        {result && (
          <div className="space-y-6">
            {/* V2 Results Display - Alienware Dark Theme */}
            {(result as any).version === 'v2' ? (
              <V2ScanResults scan={result as any} />
            ) : (
              /* V1 Results Display */
              <>
            {/* Main Result Card */}
            <Card notched elevated className="spectral-thread">
              <CardContent className="p-6 sm:p-8 md:p-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-6">
                  {result.riskLevel === 'safe' ? (
                    <CheckCircle className="w-16 h-16 sm:w-20 sm:h-20 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-16 h-16 sm:w-20 sm:h-20 text-red-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-3">
                      {getRiskMessage(result.riskLevel)}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 justify-center sm:justify-start">
                      <Badge variant={getSeverityVariant(result.riskLevel)} className="text-lg px-4 py-2">
                        {result.riskLevel.toUpperCase()}
                      </Badge>
                      <span className="text-xl font-semibold text-text-secondary">
                        Risk Score: {result.riskScore} / {result.maxScore || 350}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recommendation */}
                {result.riskLevel !== 'safe' && (
                  <Card className="bg-red-50 border-2 border-red-200">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-lg sm:text-xl font-bold text-red-900 mb-3">
                        ⚠️ Our Recommendation:
                      </p>
                      <p className="text-base sm:text-lg text-red-800 leading-relaxed">
                        {result.riskLevel === 'critical' || result.riskLevel === 'high'
                          ? 'DO NOT click this link! It appears to be a scam. Delete the message immediately.'
                          : 'Be very careful with this link. We found some suspicious signs. If you\'re not sure, it\'s safer not to click it.'}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {result.riskLevel === 'safe' && (
                  <Card className="bg-green-50 border-2 border-green-200">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-xl font-bold text-green-900">
                        ✓ It should be safe to visit this link
                      </p>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            {/* Website Overview */}
            {result.websiteOverview && (
              <Card notched elevated>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Globe className="w-6 h-6" />
                    About This Website
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-semibold text-text-tertiary uppercase tracking-wide">Title</span>
                      <p className="text-lg font-bold text-text-primary mt-1">{result.websiteOverview.title}</p>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-text-tertiary uppercase tracking-wide">Category</span>
                      <p className="mt-1">
                        <Badge variant="info">{result.websiteOverview.category}</Badge>
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-sm font-semibold text-text-tertiary uppercase tracking-wide">Description</span>
                      <p className="text-base text-text-secondary mt-1 leading-relaxed">{result.websiteOverview.description}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-sm font-semibold text-text-tertiary uppercase tracking-wide">Purpose</span>
                      <p className="text-base text-text-secondary mt-1 leading-relaxed">{result.websiteOverview.purpose}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Key Findings */}
            {result.findings && result.findings.length > 0 && (
              <Card notched elevated>
                <CardHeader>
                  <CardTitle>Why We Flagged This</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {result.findings.slice(0, 5).map((finding, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-surface-sunken">
                        <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-1" />
                        <span className="text-base text-text-primary">{finding.message}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Multi-LLM AI Analysis */}
            {result.multiLLMAnalysis && (
              <Card notched elevated className="border-2 border-purple-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Brain className="w-6 h-6 text-purple-600" />
                    Multi-LLM AI Analysis
                    <Badge variant="info" className="ml-auto">
                      {result.multiLLMAnalysis.consensus.agreement}% Agreement
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <Card className="bg-purple-50 mb-4">
                    <CardContent className="p-4">
                      <p className="text-lg font-semibold text-text-primary">
                        {result.multiLLMAnalysis.consensus.summary}
                      </p>
                    </CardContent>
                  </Card>

                  <div className="space-y-3">
                    {result.multiLLMAnalysis.claude && result.multiLLMAnalysis.claude.response && (
                      <details className="bg-surface-elevated rounded-lg p-4 border border-border-default">
                        <summary className="font-bold text-text-primary cursor-pointer flex items-center gap-2">
                          <span className="text-purple-600">🤖 Claude Sonnet 4.5</span>
                          <Badge variant="success" className="ml-auto">{result.multiLLMAnalysis.claude.confidence}% Confident</Badge>
                        </summary>
                        <p className="mt-3 text-sm sm:text-base text-text-secondary whitespace-pre-wrap leading-relaxed">
                          {result.multiLLMAnalysis.claude.response}
                        </p>
                      </details>
                    )}

                    {result.multiLLMAnalysis.gpt4 && result.multiLLMAnalysis.gpt4.response && (
                      <details className="bg-surface-elevated rounded-lg p-4 border border-border-default">
                        <summary className="font-bold text-text-primary cursor-pointer flex items-center gap-2">
                          <span className="text-green-600">🤖 GPT-4 Turbo</span>
                          <Badge variant="success" className="ml-auto">{result.multiLLMAnalysis.gpt4.confidence}% Confident</Badge>
                        </summary>
                        <p className="mt-3 text-sm sm:text-base text-text-secondary whitespace-pre-wrap leading-relaxed">
                          {result.multiLLMAnalysis.gpt4.response}
                        </p>
                      </details>
                    )}

                    {result.multiLLMAnalysis.gemini && result.multiLLMAnalysis.gemini.response && (
                      <details className="bg-surface-elevated rounded-lg p-4 border border-border-default">
                        <summary className="font-bold text-text-primary cursor-pointer flex items-center gap-2">
                          <span className="text-blue-600">🤖 Gemini 2.5 Pro</span>
                          <Badge variant="success" className="ml-auto">{result.multiLLMAnalysis.gemini.confidence}% Confident</Badge>
                        </summary>
                        <p className="mt-3 text-sm sm:text-base text-text-secondary whitespace-pre-wrap leading-relaxed">
                          {result.multiLLMAnalysis.gemini.response}
                        </p>
                      </details>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* External Security Checks */}
            {result.externalScans && result.externalScans.summary && (
              <Card notched elevated>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Eye className="w-6 h-6" />
                    External Security Checks
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-4 bg-surface-sunken rounded-lg">
                      <p className="text-3xl font-bold text-text-primary">{result.externalScans.summary.totalChecks}</p>
                      <p className="text-sm text-text-tertiary mt-1">Databases</p>
                    </div>
                    <div className="text-center p-4 bg-surface-sunken rounded-lg">
                      <p className="text-3xl font-bold text-red-600">{result.externalScans.summary.flaggedCount}</p>
                      <p className="text-sm text-text-tertiary mt-1">Flagged</p>
                    </div>
                    <div className="text-center p-4 bg-surface-sunken rounded-lg">
                      <p className="text-3xl font-bold text-green-600">{result.externalScans.summary.safeCount}</p>
                      <p className="text-sm text-text-tertiary mt-1">Safe</p>
                    </div>
                    <div className="text-center p-4 bg-surface-sunken rounded-lg">
                      <Badge variant={result.externalScans.summary.overallVerdict === 'Safe' ? 'success' : 'error'} className="text-base">
                        {result.externalScans.summary.overallVerdict}
                      </Badge>
                      <p className="text-sm text-text-tertiary mt-1">Verdict</p>
                    </div>
                  </div>
                  <p className="text-sm text-text-tertiary">
                    ✓ Checked against: VirusTotal, Google Safe Browsing, AbuseIPDB, PhishTank, URLhaus
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Network Information */}
            {result.networkInfo && (
              <Card notched elevated>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Server className="w-6 h-6" />
                    Network Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-surface-sunken rounded-lg">
                      <span className="font-semibold text-text-secondary">IP Address</span>
                      <span className="font-mono text-text-primary">{result.networkInfo.ipAddress}</span>
                    </div>
                    {result.networkInfo.country && (
                      <div className="flex justify-between items-center p-3 bg-surface-sunken rounded-lg">
                        <span className="font-semibold text-text-secondary">Country</span>
                        <span className="text-text-primary">{result.networkInfo.country}</span>
                      </div>
                    )}
                    {result.networkInfo.isp && (
                      <div className="flex justify-between items-center p-3 bg-surface-sunken rounded-lg">
                        <span className="font-semibold text-text-secondary">ISP</span>
                        <span className="text-text-primary">{result.networkInfo.isp}</span>
                      </div>
                    )}
                    {result.networkInfo.isProxy && (
                      <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border-2 border-red-300">
                        <span className="font-semibold text-red-900">Warning</span>
                        <Badge variant="error">Using Proxy/VPN</Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Technical Details */}
            {result.categories && result.categories.length > 0 && (
              <details>
                <summary className="cursor-pointer">
                  <Card notched className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between pointer-events-none">
                        <div className="flex items-center gap-3">
                          <Server className="w-6 h-6 text-text-secondary" />
                          <span className="text-lg font-bold text-text-primary">
                            Technical Details ({result.categories.length} checks)
                          </span>
                        </div>
                        <span className="text-text-tertiary">▼</span>
                      </div>
                    </CardContent>
                  </Card>
                </summary>
                <div className="mt-4 space-y-4">
                  {result.categories.map((category, index) => (
                    <Card key={index} notched className="border-l-4 border-primary-500">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-text-primary">{category.name}</h4>
                          <Badge variant={category.status === 'pass' ? 'success' : category.status === 'warning' ? 'warning' : 'error'}>
                            {category.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-text-tertiary mb-3">
                          Score: {category.score} / {category.maxScore} • {category.findings.length} findings
                        </p>
                        {category.findings && category.findings.length > 0 && (
                          <div className="space-y-2 pl-4 border-l-2 border-border-subtle">
                            {category.findings.map((finding: any, fIndex: number) => (
                              <div key={fIndex} className="text-sm flex items-start gap-2">
                                <Badge variant={finding.severity === 'critical' ? 'error' : finding.severity === 'high' ? 'warning' : 'info'} className="text-xs">
                                  {finding.severity}
                                </Badge>
                                <span className="text-text-secondary flex-1">{finding.message}</span>
                                {finding.points && (
                                  <span className="text-red-600 font-bold">+{finding.points}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </details>
            )}
              </>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => {
                  setUrl('');
                  setResult(null);
                  setError(null);
                }}
                variant="primary"
                size="lg"
                className="text-lg"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Scan Another URL
              </Button>
            </div>
          </div>
        )}

        {/* Examples Section */}
        {!result && !loading && !error && (
          <Card notched className="bg-surface-elevated">
            <CardHeader>
              <CardTitle>Common Dangerous Links</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {[
                  'Fake bank websites asking for login details',
                  'Prize winner or lottery scams',
                  'Fake package delivery notices',
                  'Romance scam profiles'
                ].map((example, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-surface-base">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
                    <span className="text-base text-text-primary">{example}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default URLScannerAccessible;
