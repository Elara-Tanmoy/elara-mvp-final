/**
 * ELARA - Enterprise Security Platform
 * 2025 Mobile-First UI/UX Design
 * Optimized for investor demos and multi-device support
 */

import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Link as LinkIcon,
  Mail,
  FileText,
  CheckCircle,
  TrendingUp,
  Bot,
  Search,
  Loader2,
  AlertTriangle,
  X,
  MessageSquare,
  Minimize2,
  AlertCircle,
  Info,
  Clipboard,
  MapPin,
  Calendar,
  Globe,
  Building2,
  Server,
  Lock,
  Eye,
  Users,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Zap,
  Activity,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

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

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
  };

  const handleUrlBlur = () => {
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      setUrl(formatUrl(url));
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

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'critical': return { bg: 'from-red-600 to-red-700', text: 'text-red-600', icon: 'bg-red-600' };
      case 'high': return { bg: 'from-orange-600 to-orange-700', text: 'text-orange-600', icon: 'bg-orange-600' };
      case 'medium': return { bg: 'from-yellow-600 to-yellow-700', text: 'text-yellow-600', icon: 'bg-yellow-600' };
      case 'low': return { bg: 'from-blue-600 to-blue-700', text: 'text-blue-600', icon: 'bg-blue-600' };
      default: return { bg: 'from-green-600 to-green-700', text: 'text-green-600', icon: 'bg-green-600' };
    }
  };

  const getRiskBg = (level: string) => {
    switch (level.toLowerCase()) {
      case 'critical': return 'bg-red-50 border-red-200';
      case 'high': return 'bg-orange-50 border-orange-200';
      case 'medium': return 'bg-yellow-50 border-yellow-200';
      case 'low': return 'bg-blue-50 border-blue-200';
      default: return 'bg-green-50 border-green-200';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="w-6 h-6 md:w-8 md:h-8" />;
      case 'medium':
        return <AlertCircle className="w-6 h-6 md:w-8 md:h-8" />;
      case 'low':
        return <Info className="w-6 h-6 md:w-8 md:h-8" />;
      default:
        return <CheckCircle className="w-6 h-6 md:w-8 md:h-8" />;
    }
  };

  const extractWebsiteInfo = (result: ScanResult): WebsiteInfo => {
    const info: WebsiteInfo = {
      domain: new URL(result.url).hostname
    };

    const domainCategory = result.categories?.find(c => c.name === 'Domain Analysis');
    if (domainCategory) {
      const ageFinding = domainCategory.findings.find(f => f.message?.includes('years old'));
      if (ageFinding) {
        const match = ageFinding.message.match(/(\d+\.?\d*)\s+years old/);
        if (match) {
          info.age = `${match[1]} years`;
        }
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

    if (domainCategory) {
      const registrarFinding = domainCategory.findings.find(f => f.message?.includes('Registrar:'));
      if (registrarFinding) {
        const match = registrarFinding.message.match(/Registrar:\s+(.+)/);
        if (match) {
          info.registrar = match[1];
        }
      }
    }

    return info;
  };

  const trustScore = scanResult ? Math.round(((scanResult.maxScore - scanResult.riskScore) / scanResult.maxScore) * 100) : 0;

  return (
    <div id="main-content" className="space-y-4 md:space-y-6 pb-24 animate-fadeIn">
      {/* Hero Section with Quick Scanner - Enhanced Mobile UI */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-2xl md:rounded-3xl shadow-2xl p-6 md:p-10 text-white">
        {/* Animated Background Effect */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-300 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 animate-pulse delay-1000"></div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto">
          {/* Welcome Header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 md:p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Shield className="w-7 h-7 md:w-10 md:h-10" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-3xl lg:text-4xl font-bold tracking-tight">
                Welcome back, {user?.firstName || 'User'}
              </h1>
              <p className="text-sm md:text-base text-blue-100 mt-1">
                AI-Powered Enterprise Security Platform
              </p>
            </div>
          </div>

          {/* Quick Scanner Panel - Mobile Optimized */}
          <div className="mt-6 bg-white/10 backdrop-blur-xl rounded-2xl p-5 md:p-7 border border-white/30 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 md:w-6 md:h-6 text-yellow-300" />
              <label className="text-base md:text-lg font-bold">Quick URL Security Scan</label>
            </div>

            <form onSubmit={handleQuickScan} className="space-y-3">
              <div className="relative flex-1">
                <input
                  ref={urlInputRef}
                  type="text"
                  value={url}
                  onChange={handleUrlChange}
                  onBlur={handleUrlBlur}
                  placeholder="example.com"
                  className="w-full px-4 md:px-5 py-4 md:py-5 pr-16 md:pr-20 text-base md:text-lg bg-white/95 backdrop-blur-sm border-0 rounded-xl md:rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-white/50 font-medium shadow-lg transition-all"
                  disabled={isScanning}
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-blue-600/90 hover:bg-blue-700 text-white rounded-lg md:rounded-xl transition-all hover:scale-110 transform shadow-md"
                  disabled={isScanning}
                  title="Paste from clipboard"
                >
                  <Clipboard className="w-5 h-5" />
                </button>
              </div>

              <button
                type="submit"
                disabled={!url.trim() || isScanning}
                className="w-full px-6 py-4 md:py-5 bg-gradient-to-r from-white to-blue-50 text-blue-700 rounded-xl md:rounded-2xl font-bold text-base md:text-lg hover:from-blue-50 hover:to-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xl hover:shadow-3xl hover:scale-[1.02] transform flex items-center justify-center gap-3"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Scanning with AI...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-6 h-6" />
                    <span>Scan URL Now</span>
                    <Activity className="w-5 h-5 animate-pulse" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs md:text-sm text-white/90">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                <span>350-Point Analysis</span>
              </div>
              <div className="w-px h-4 bg-white/30"></div>
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                <span>18+ Security Checks</span>
              </div>
              <div className="w-px h-4 bg-white/30"></div>
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4" />
                <span>Real-Time Intel</span>
              </div>
            </div>
          </div>

          {/* Enhanced Scan Results - Mobile Optimized */}
          {scanResult && (
            <div className="mt-6 bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 text-gray-900 shadow-2xl animate-slideUp">
              {/* Result Header - Enhanced */}
              <div className="flex items-center justify-between mb-6 pb-6 border-b-2 border-gray-200">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`bg-gradient-to-br ${getRiskColor(scanResult.riskLevel).icon} text-white p-4 md:p-5 rounded-2xl shadow-lg flex-shrink-0`}>
                    {getRiskIcon(scanResult.riskLevel)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg md:text-2xl font-black mb-2 uppercase tracking-tight">
                      {scanResult.riskLevel} Risk
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 break-all font-medium">
                      {scanResult.url}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setScanResult(null)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-all flex-shrink-0"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              {/* Trust Score - Large and Prominent */}
              <div className="mb-6 p-6 md:p-8 bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl border-2 border-gray-200 shadow-inner">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-3">
                    <Shield className="w-6 h-6 text-blue-600" />
                    Trust Score
                  </h4>
                  <div className="text-right">
                    <div className="text-4xl md:text-6xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {trustScore}%
                    </div>
                    <p className="text-xs md:text-sm text-gray-600 font-semibold mt-1">
                      {scanResult.riskLevel === 'safe' ? 'Safe to Visit' :
                       scanResult.riskLevel === 'low' ? 'Low Risk' :
                       scanResult.riskLevel === 'medium' ? 'Moderate Risk' :
                       scanResult.riskLevel === 'high' ? 'High Risk' : 'Critical Threat'}
                    </p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 md:h-6 overflow-hidden shadow-inner">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 bg-gradient-to-r ${
                      scanResult.riskLevel === 'safe' ? 'from-green-500 to-emerald-500' :
                      scanResult.riskLevel === 'low' ? 'from-blue-500 to-cyan-500' :
                      scanResult.riskLevel === 'medium' ? 'from-yellow-500 to-orange-500' :
                      scanResult.riskLevel === 'high' ? 'from-orange-500 to-red-500' : 'from-red-600 to-red-800'
                    } shadow-lg`}
                    style={{ width: `${trustScore}%` }}
                  />
                </div>
                <p className="text-xs md:text-sm text-gray-600 mt-3 text-center font-medium">
                  Based on {scanResult.categories?.length || 17} comprehensive security checks
                </p>
              </div>

              {/* Website Info - Redesigned Grid */}
              {(() => {
                const websiteInfo = extractWebsiteInfo(scanResult);
                return (
                  <div className={`mb-6 p-5 md:p-6 ${getRiskBg(scanResult.riskLevel)} rounded-2xl border-2`}>
                    <h4 className="text-base md:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Globe className="w-5 h-5" />
                      Website Information
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { icon: Building2, label: 'Domain', value: websiteInfo.domain },
                        { icon: Calendar, label: 'Age', value: websiteInfo.age },
                        { icon: MapPin, label: 'Location', value: websiteInfo.location },
                        { icon: Server, label: 'Hosting', value: websiteInfo.hosting },
                        { icon: Lock, label: 'SSL Status', value: websiteInfo.sslStatus },
                        { icon: FileText, label: 'Registrar', value: websiteInfo.registrar }
                      ].map((item, idx) => item.value && (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-xl shadow-sm">
                          <item.icon className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-600 font-medium">{item.label}</p>
                            <p className="text-sm md:text-base font-bold text-gray-900 truncate" title={item.value}>
                              {item.value}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* AI Analysis - Enhanced */}
              {scanResult.aiAnalysis?.summary && (
                <div className="mb-6 p-5 md:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
                  <h4 className="text-base md:text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-blue-600" />
                    AI-Powered Analysis
                  </h4>
                  <p className="text-sm md:text-base text-gray-800 leading-relaxed font-medium">
                    {scanResult.aiAnalysis.summary}
                  </p>
                </div>
              )}

              {/* Toggle Full Report Button - More Prominent */}
              {!showFullReport && scanResult.findings.length > 0 && (
                <button
                  onClick={() => setShowFullReport(true)}
                  className="w-full py-4 md:py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-base md:text-lg shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3 hover:scale-[1.02] transform"
                >
                  <BarChart3 className="w-6 h-6" />
                  View Complete Security Report
                  <ChevronDown className="w-5 h-5 animate-bounce" />
                </button>
              )}

              {/* Full Report Details - Collapsible */}
              {showFullReport && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Security Findings */}
                  {scanResult.findings.length > 0 && (
                    <div className="p-5 md:p-6 bg-gray-50 rounded-2xl border border-gray-200">
                      <h4 className="text-base md:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        Security Findings ({scanResult.findings.length})
                      </h4>
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {scanResult.findings.map((finding, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                            <span className={`
                              ${finding.severity === 'critical' ? 'bg-red-600 text-white' : ''}
                              ${finding.severity === 'high' ? 'bg-orange-600 text-white' : ''}
                              ${finding.severity === 'medium' ? 'bg-yellow-600 text-white' : ''}
                              ${finding.severity === 'low' ? 'bg-blue-600 text-white' : ''}
                              ${finding.severity === 'info' ? 'bg-gray-600 text-white' : ''}
                              font-bold uppercase text-xs px-3 py-1.5 rounded-lg flex-shrink-0
                            `}>
                              {finding.severity}
                            </span>
                            <span className="text-sm md:text-base text-gray-700 flex-1 leading-relaxed">{finding.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {scanResult.aiAnalysis?.recommendations && scanResult.aiAnalysis.recommendations.length > 0 && (
                    <div className="p-5 md:p-6 bg-green-50 rounded-2xl border-2 border-green-200">
                      <h4 className="text-base md:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-green-600" />
                        Safety Recommendations
                      </h4>
                      <ul className="space-y-3">
                        {scanResult.aiAnalysis.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-sm md:text-base">
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700 leading-relaxed">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Collapse Button */}
                  <button
                    onClick={() => setShowFullReport(false)}
                    className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2"
                  >
                    <ChevronUp className="w-5 h-5" />
                    Hide Full Report
                  </button>

                  {/* Advanced Tools Link */}
                  <Link
                    to="/scan/url"
                    className="block w-full py-4 md:py-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-base md:text-lg shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3 hover:scale-[1.02] transform"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Advanced URL Scanner Tools
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Scan Error - Enhanced */}
          {scanError && (
            <div className="mt-6 bg-red-50 border-2 border-red-200 rounded-2xl p-5 md:p-6 flex items-start gap-4 animate-shake">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1 min-w-0">
                <h4 className="text-base md:text-lg font-bold text-red-800 mb-1">Scan Failed</h4>
                <p className="text-sm md:text-base text-red-700">{scanError}</p>
              </div>
              <button
                onClick={() => setScanError(null)}
                className="p-2 hover:bg-red-100 rounded-xl transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 text-red-600" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats - Modern Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        {[
          { icon: CheckCircle, label: 'Status', value: 'Protected', color: 'from-green-500 to-emerald-600', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
          { icon: TrendingUp, label: 'Scans Today', value: '0', color: 'from-blue-500 to-cyan-600', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
          { icon: Shield, label: 'Threats Blocked', value: '0', color: 'from-purple-500 to-indigo-600', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
          { icon: Bot, label: 'AI Assists', value: '0', color: 'from-orange-500 to-red-600', iconBg: 'bg-orange-100', iconColor: 'text-orange-600' }
        ].map((stat, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-4 md:p-6 shadow-lg border border-gray-100 hover:shadow-2xl hover:scale-105 transition-all transform">
            <div className="flex flex-col items-center text-center">
              <div className={`p-3 md:p-4 ${stat.iconBg} rounded-2xl mb-3`}>
                <stat.icon className={`w-6 h-6 md:w-8 md:h-8 ${stat.iconColor}`} />
              </div>
              <p className="text-xs md:text-sm text-gray-600 font-semibold mb-1">{stat.label}</p>
              <p className="text-xl md:text-3xl font-black text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Security Tools - Stunning Redesigned Cards */}
      <div>
        <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-5 flex items-center gap-3">
          <Shield className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
          Security Tools
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {[
            { to: '/scan/url', icon: LinkIcon, title: 'URL Scanner', desc: '350-point deep analysis', gradient: 'from-blue-500 via-blue-600 to-indigo-600', iconColor: 'text-blue-100' },
            { to: '/scan/message', icon: Mail, title: 'Message Scanner', desc: 'AI phishing detection', gradient: 'from-emerald-500 via-green-600 to-teal-600', iconColor: 'text-emerald-100' },
            { to: '/scan/file', icon: FileText, title: 'File Scanner', desc: 'Multi-engine malware scan', gradient: 'from-purple-500 via-purple-600 to-indigo-600', iconColor: 'text-purple-100' },
            { to: '/proxy-browser', icon: Globe, title: 'Secure Web Proxy', desc: 'Browse safely & anonymously', gradient: 'from-cyan-500 via-cyan-600 to-blue-600', iconColor: 'text-cyan-100' }
          ].map((tool, idx) => (
            <Link
              key={idx}
              to={tool.to}
              className={`group relative overflow-hidden bg-gradient-to-br ${tool.gradient} rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 transform no-underline`}
            >
              {/* Animated background effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

              {/* Content */}
              <div className="relative flex flex-col items-center text-center">
                {/* Icon with glow effect */}
                <div className="relative mb-5">
                  <div className="absolute inset-0 bg-white/30 rounded-2xl blur-xl group-hover:bg-white/50 transition-all duration-300"></div>
                  <div className="relative p-4 md:p-5 bg-white/20 backdrop-blur-sm rounded-2xl group-hover:bg-white/30 group-hover:scale-110 transition-all duration-300">
                    <tool.icon className={`w-9 h-9 md:w-11 md:h-11 ${tool.iconColor} group-hover:scale-110 transition-transform duration-300`} />
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-lg md:text-xl font-black mb-3 text-white tracking-tight">
                  {tool.title}
                </h3>

                {/* Description */}
                <p className="text-sm md:text-base text-white/95 leading-relaxed font-medium mb-4">
                  {tool.desc}
                </p>

                {/* Action indicator */}
                <div className="flex items-center gap-2 text-sm font-bold text-white/90 group-hover:text-white transition-colors mt-auto">
                  <span className="bg-white/20 px-4 py-2 rounded-full group-hover:bg-white/30 transition-all">
                    Launch Tool
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 group-hover:translate-x-1 transition-all">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Security Tips - Modern Card */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 md:p-8 border-2 border-amber-200 shadow-lg">
        <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-5 flex items-center gap-3">
          <Shield className="w-6 h-6 text-amber-600" />
          Security Best Practices
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            'Never share passwords or personal info',
            'Always verify links before clicking',
            'Be suspicious of urgent requests',
            'Use Elara to check suspicious content'
          ].map((tip, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm md:text-base text-gray-700 font-medium">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* View History - Modern Button */}
      <Link
        to="/history"
        className="block bg-gradient-to-r from-gray-50 to-blue-50 border-2 border-gray-200 rounded-2xl p-5 md:p-6 hover:from-blue-50 hover:to-indigo-50 hover:border-blue-500 hover:shadow-xl transition-all text-center group"
      >
        <p className="text-base md:text-lg font-bold text-gray-700 group-hover:text-blue-600 transition-colors flex items-center justify-center gap-2">
          View Scan History
          <ExternalLink className="w-5 h-5" />
        </p>
      </Link>

      {/* Floating Chatbot Button - Enhanced */}
      {!chatbotOpen && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setChatbotOpen(true);
          }}
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-br from-purple-600 to-indigo-600 text-white p-5 md:p-6 rounded-full shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-300 group animate-bounce-slow"
          aria-label="Open AI Assistant"
        >
          <MessageSquare className="w-7 h-7 md:w-8 md:h-8" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-ping" />
        </button>
      )}

      {/* Floating Chatbot Modal - Enhanced */}
      {chatbotOpen && (
        <div
          className={`fixed z-50 bg-white rounded-3xl shadow-2xl border-2 border-gray-200 transition-all duration-300 ${
            chatbotMinimized
              ? 'bottom-6 right-6 w-72 h-16'
              : 'bottom-6 right-6 w-[95vw] sm:w-[420px] h-[700px] max-h-[85vh]'
          }`}
        >
          {/* Chatbot Header - Enhanced */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 md:p-5 rounded-t-3xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base md:text-lg">Elara AI Assistant</h3>
                {!chatbotMinimized && (
                  <p className="text-xs text-purple-200">Always here to help</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChatbotMinimized(!chatbotMinimized)}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                aria-label={chatbotMinimized ? 'Maximize' : 'Minimize'}
              >
                <Minimize2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setChatbotOpen(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Chatbot Content */}
          {!chatbotMinimized && (
            <div className="h-[calc(100%-76px)] overflow-hidden">
              <iframe
                src="/chatbot"
                className="w-full h-full border-0"
                title="Elara AI Chatbot"
              />
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .animate-fadeIn { animation: fadeIn 0.5s ease-out; }
        .animate-slideUp { animation: slideUp 0.5s ease-out; }
        .animate-shake { animation: shake 0.3s ease-out; }
        .animate-bounce-slow { animation: bounce-slow 3s ease-in-out infinite; }

        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: #888; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }

        /* Mobile Optimization */
        @media (max-width: 640px) {
          #main-content { padding-bottom: 7rem; }
        }
      `}</style>
    </div>
  );
};

export default HomeAccessible;
