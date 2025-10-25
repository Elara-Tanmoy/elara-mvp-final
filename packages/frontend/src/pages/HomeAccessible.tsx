import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Link as LinkIcon, Mail, FileText, CheckCircle, TrendingUp,
  Bot, Search, Loader2, AlertTriangle, X, MessageSquare, Minimize2,
  AlertCircle, Info, Clipboard, MapPin, Calendar, Globe, Building2,
  Server, Lock, Eye, Users, ChevronDown, ChevronUp, ExternalLink,
  Zap, Activity, BarChart3
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '../components/ui';

interface ScanResult {
  url: string;
  riskScore: number;
  maxScore: number;
  riskLevel: string;
  findings: Array<{
    category: string;
    severity: string;
    message: string;
  }>;
  aiAnalysis?: {
    summary: string;
    recommendations: string[];
  };
  networkInfo?: {
    ipAddress: string;
    country?: string;
    city?: string;
    isp?: string;
    org?: string;
  };
  categories?: Array<{
    name: string;
    score: number;
    maxScore: number;
    findings: any[];
  }>;
}

interface WebsiteInfo {
  domain: string;
  age?: string;
  location?: string;
  hosting?: string;
  sslStatus?: string;
  registrar?: string;
}

const getSeverityVariant = (severity: string) => {
  const s = severity.toLowerCase();
  if (s === 'critical') return 'sev5';
  if (s === 'high') return 'sev4';
  if (s === 'medium') return 'sev3';
  if (s === 'low') return 'sev2';
  if (s === 'info') return 'sev1';
  return 'sev0';
};

const getRiskIcon = (level: string) => {
  const l = level.toLowerCase();
  if (l === 'critical' || l === 'high') return <AlertTriangle className="w-6 h-6" />;
  if (l === 'medium') return <AlertCircle className="w-6 h-6" />;
  if (l === 'low') return <Info className="w-6 h-6" />;
  return <CheckCircle className="w-6 h-6" />;
};

const HomeAccessible: React.FC = () => {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [chatbotMinimized, setChatbotMinimized] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const formatUrl = (input: string): string => {
    let formatted = input.trim();
    if (!formatted) return '';
    formatted = formatted.replace(/^(https?:\/\/)/, '');
    formatted = formatted.replace(/^www\./, '');
    return `https://${formatted}`;
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const formatted = formatUrl(text);
      setUrl(formatted);
      urlInputRef.current?.focus();
    } catch (error) {
      console.error('Failed to read clipboard:', error);
    }
  };

  const handleQuickScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const formattedUrl = url.startsWith('http') ? url : formatUrl(url);
    setUrl(formattedUrl);
    setIsScanning(true);
    setScanError(null);
    setScanResult(null);
    setShowFullReport(false);

    try {
      const response = await api.post('/v2/scan/url', { url: formattedUrl });
      setScanResult(response.data);
    } catch (error: any) {
      setScanError(error.response?.data?.message || 'Failed to scan URL. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const extractWebsiteInfo = (result: ScanResult): WebsiteInfo => {
    const info: WebsiteInfo = { domain: new URL(result.url).hostname };
    const domainCategory = result.categories?.find(c => c.name === 'Domain Analysis');

    if (domainCategory) {
      const ageFinding = domainCategory.findings.find(f => f.message?.includes('years old'));
      if (ageFinding) {
        const match = ageFinding.message.match(/(\d+\.?\d*)\s+years old/);
        if (match) info.age = `${match[1]} years`;
      }
      const registrarFinding = domainCategory.findings.find(f => f.message?.includes('Registrar:'));
      if (registrarFinding) {
        const match = registrarFinding.message.match(/Registrar:\s+(.+)/);
        if (match) info.registrar = match[1];
      }
    }

    if (result.networkInfo?.country) {
      info.location = result.networkInfo.city
        ? `${result.networkInfo.city}, ${result.networkInfo.country}`
        : result.networkInfo.country;
    }

    if (result.networkInfo?.isp || result.networkInfo?.org) {
      info.hosting = result.networkInfo.org || result.networkInfo.isp;
    }

    const sslCategory = result.categories?.find(c => c.name === 'SSL/TLS Security');
    if (sslCategory) {
      info.sslStatus = sslCategory.score === 0 ? 'Valid SSL' : 'SSL Issues';
    }

    return info;
  };

  const trustScore = scanResult ? Math.round(((scanResult.maxScore - scanResult.riskScore) / scanResult.maxScore) * 100) : 0;

  return (
    <div className="min-h-screen bg-surface-base p-6 pb-24">
      {/* Hero Section */}
      <Card notched elevated className="mb-8 bg-gradient-to-br from-primary-600 to-primary-800 text-white spectral-thread">
        <CardContent className="p-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Shield className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">Welcome back, {user?.firstName || 'User'}</h1>
              <p className="text-primary-100 mt-1">AI-Powered Enterprise Security Platform</p>
            </div>
          </div>

          {/* Quick Scanner */}
          <Card className="bg-white/10 backdrop-blur-xl border-white/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-6 h-6 text-yellow-300" />
                <h2 className="text-lg font-bold">Quick URL Security Scan</h2>
              </div>

              <form onSubmit={handleQuickScan} className="space-y-4">
                <div className="relative">
                  <input
                    ref={urlInputRef}
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onBlur={() => { if (url && !url.startsWith('http')) setUrl(formatUrl(url)); }}
                    placeholder="example.com"
                    className="w-full px-5 py-4 pr-16 text-lg bg-white/95 border-0 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
                    disabled={isScanning}
                  />
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all"
                    disabled={isScanning}
                  >
                    <Clipboard className="w-5 h-5" />
                  </button>
                </div>

                <Button type="submit" disabled={!url.trim() || isScanning} className="w-full" size="lg">
                  {isScanning ? (
                    <><Loader2 className="w-6 h-6 animate-spin" /> Scanning...</>
                  ) : (
                    <><Search className="w-6 h-6" /> Scan URL Now</>
                  )}
                </Button>
              </form>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-white/90">
                <div className="flex items-center gap-2"><Shield className="w-4 h-4" /> 350-Point Analysis</div>
                <div className="flex items-center gap-2"><Eye className="w-4 h-4" /> 18+ Security Checks</div>
                <div className="flex items-center gap-2"><Activity className="w-4 h-4" /> Real-Time Intel</div>
              </div>
            </CardContent>
          </Card>

          {/* Scan Results */}
          {scanResult && (
            <Card notched elevated className="mt-6 bg-surface-base text-text-primary">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6 pb-6 border-b border-border-default">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-primary-600 text-white rounded-lg">
                      {getRiskIcon(scanResult.riskLevel)}
                    </div>
                    <div>
                      <Badge variant={getSeverityVariant(scanResult.riskLevel)} className="mb-2">
                        {scanResult.riskLevel} Risk
                      </Badge>
                      <p className="text-sm text-text-secondary break-all">{scanResult.url}</p>
                    </div>
                  </div>
                  <button onClick={() => setScanResult(null)} className="p-2 hover:bg-surface-elevated rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Trust Score */}
                <Card className="mb-6 bg-surface-elevated">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary-600" /> Trust Score
                      </h3>
                      <div className="text-6xl font-black text-primary-600">{trustScore}%</div>
                    </div>
                    <div className="w-full bg-surface-sunken rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-500 to-primary-700 rounded-full transition-all duration-1000"
                        style={{ width: `${trustScore}%` }}
                      />
                    </div>
                    <p className="text-sm text-text-secondary mt-2 text-center">
                      Based on {scanResult.categories?.length || 17} security checks
                    </p>
                  </CardContent>
                </Card>

                {/* Website Info */}
                {(() => {
                  const websiteInfo = extractWebsiteInfo(scanResult);
                  return (
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Globe className="w-5 h-5" /> Website Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { icon: Building2, label: 'Domain', value: websiteInfo.domain },
                            { icon: Calendar, label: 'Age', value: websiteInfo.age },
                            { icon: MapPin, label: 'Location', value: websiteInfo.location },
                            { icon: Server, label: 'Hosting', value: websiteInfo.hosting },
                            { icon: Lock, label: 'SSL', value: websiteInfo.sslStatus },
                            { icon: FileText, label: 'Registrar', value: websiteInfo.registrar }
                          ].map((item, idx) => item.value && (
                            <div key={idx} className="flex items-start gap-2">
                              <item.icon className="w-5 h-5 text-text-tertiary mt-0.5" />
                              <div>
                                <p className="text-xs text-text-tertiary">{item.label}</p>
                                <p className="text-sm font-semibold">{item.value}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* AI Analysis */}
                {scanResult.aiAnalysis?.summary && (
                  <Card className="mb-6 bg-primary-50 dark:bg-primary-900/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5" /> AI Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{scanResult.aiAnalysis.summary}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Full Report Toggle */}
                {!showFullReport && scanResult.findings.length > 0 && (
                  <Button onClick={() => setShowFullReport(true)} className="w-full" size="lg">
                    <BarChart3 className="w-5 h-5" /> View Complete Report
                    <ChevronDown className="w-5 h-5" />
                  </Button>
                )}

                {/* Full Report */}
                {showFullReport && (
                  <div className="space-y-4">
                    {scanResult.findings.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" /> Findings ({scanResult.findings.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {scanResult.findings.map((finding, idx) => (
                              <div key={idx} className="flex items-start gap-3 p-3 bg-surface-elevated rounded-lg">
                                <Badge variant={getSeverityVariant(finding.severity)}>
                                  {finding.severity}
                                </Badge>
                                <span className="text-sm flex-1">{finding.message}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {scanResult.aiAnalysis?.recommendations && (
                      <Card className="bg-green-50 dark:bg-green-900/20">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" /> Recommendations
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {scanResult.aiAnalysis.recommendations.map((rec, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    <Button onClick={() => setShowFullReport(false)} variant="secondary" className="w-full">
                      <ChevronUp className="w-5 h-5" /> Hide Report
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {scanError && (
            <Card className="mt-6 border-red-500 bg-red-50 dark:bg-red-900/20">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div className="flex-1">
                  <p className="font-semibold text-red-800 dark:text-red-300">Scan Failed</p>
                  <p className="text-sm text-red-700 dark:text-red-400">{scanError}</p>
                </div>
                <button onClick={() => setScanError(null)} className="p-1">
                  <X className="w-4 h-4" />
                </button>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: CheckCircle, label: 'Status', value: 'Protected', color: 'text-green-600' },
          { icon: TrendingUp, label: 'Scans Today', value: '0', color: 'text-blue-600' },
          { icon: Shield, label: 'Threats Blocked', value: '0', color: 'text-purple-600' },
          { icon: Bot, label: 'AI Assists', value: '0', color: 'text-orange-600' }
        ].map((stat, idx) => (
          <Card key={idx} notched elevated className="hover:shadow-xl transition-shadow">
            <CardContent className="p-6 text-center">
              <stat.icon className={`w-8 h-8 ${stat.color} mx-auto mb-2`} />
              <p className="text-sm text-text-secondary">{stat.label}</p>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Security Tools */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary-600" /> Security Tools
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { to: '/scan/url', icon: LinkIcon, title: 'URL Scanner', desc: '350-point analysis', color: 'from-blue-500 to-blue-700' },
            { to: '/scan/message', icon: Mail, title: 'Message Scanner', desc: 'AI phishing detection', color: 'from-green-500 to-green-700' },
            { to: '/scan/file', icon: FileText, title: 'File Scanner', desc: 'Malware scanning', color: 'from-purple-500 to-purple-700' },
            { to: '/proxy-browser', icon: Globe, title: 'Secure Proxy', desc: 'Browse safely', color: 'from-cyan-500 to-cyan-700' }
          ].map((tool, idx) => (
            <Link
              key={idx}
              to={tool.to}
              className={`group relative overflow-hidden bg-gradient-to-br ${tool.color} text-white rounded-xl p-6 hover:shadow-2xl transition-all hover:scale-105`}
            >
              <div className="flex flex-col items-center text-center">
                <div className="p-4 bg-white/20 rounded-xl mb-4 group-hover:scale-110 transition-transform">
                  <tool.icon className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold mb-2">{tool.title}</h3>
                <p className="text-sm text-white/90 mb-4">{tool.desc}</p>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  Launch <ExternalLink className="w-4 h-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Security Tips */}
      <Card className="mb-6 bg-amber-50 dark:bg-amber-900/20 border-amber-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600" /> Security Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              'Never share passwords or personal info',
              'Always verify links before clicking',
              'Be suspicious of urgent requests',
              'Use Elara to check suspicious content'
            ].map((tip, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{tip}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* View History */}
      <Link to="/history">
        <Card className="hover:border-primary-500 transition-colors">
          <CardContent className="p-4 text-center">
            <p className="font-semibold flex items-center justify-center gap-2">
              View Scan History <ExternalLink className="w-4 h-4" />
            </p>
          </CardContent>
        </Card>
      </Link>

      {/* Floating Chatbot Button */}
      {!chatbotOpen && (
        <button
          onClick={() => setChatbotOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-br from-purple-600 to-indigo-600 text-white p-5 rounded-full shadow-2xl hover:scale-110 transition-transform"
        >
          <MessageSquare className="w-7 h-7" />
        </button>
      )}

      {/* Chatbot Modal */}
      {chatbotOpen && (
        <div className={`fixed z-50 bg-surface-base rounded-2xl shadow-2xl border border-border-default transition-all ${
          chatbotMinimized ? 'bottom-6 right-6 w-72 h-16' : 'bottom-6 right-6 w-[420px] h-[700px]'
        }`}>
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6" />
              <div>
                <h3 className="font-bold">Elara AI</h3>
                {!chatbotMinimized && <p className="text-xs text-purple-200">Always here to help</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setChatbotMinimized(!chatbotMinimized)} className="p-1 hover:bg-white/20 rounded">
                <Minimize2 className="w-4 h-4" />
              </button>
              <button onClick={() => setChatbotOpen(false)} className="p-1 hover:bg-white/20 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {!chatbotMinimized && (
            <div className="h-[calc(100%-60px)]">
              <iframe src="/chatbot" className="w-full h-full border-0" title="Elara AI" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HomeAccessible;
