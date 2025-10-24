import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Link as LinkIcon, Mail, FileText, UserCheck, Search, GraduationCap, Heart, Sparkles, Crown, Zap, AlertCircle, Shield, Globe, Lock, ExternalLink } from 'lucide-react';
import ChatbotWidget from '../components/ChatbotWidget';
import EmbeddedChatbot from '../components/EmbeddedChatbot';
import { useAuth } from '../contexts/AuthContext';

const Home: React.FC = () => {
  const { user, organization } = useAuth();
  const navigate = useNavigate();
  const [usageStats, setUsageStats] = useState<any>(null);

  const tier = organization?.tier || 'free';
  const isPremium = tier === 'premium' || tier === 'enterprise';
  const isAdmin = user?.role === 'admin';
  const isFreeUser = tier === 'free' && !isAdmin;

  useEffect(() => {
    loadUsageStats();
  }, []);

  const loadUsageStats = async () => {
    try {
      // In production, this would fetch actual usage from an API endpoint
      // For now, we'll use mock data
      setUsageStats({
        scansToday: 12,
        scansThisMonth: 45,
        maxScansPerDay: tier === 'free' ? 50 : tier === 'premium' ? 500 : 10000,
        maxScansPerMonth: tier === 'free' ? 1000 : tier === 'premium' ? 10000 : 999999
      });
    } catch (error) {
      console.error('Error loading usage stats:', error);
    }
  };

  return (
    <div className="space-y-8">
      {/* Admin Status Banner */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg rounded-lg p-6">
          <div className="flex items-center gap-3">
            <Crown className="w-8 h-8 text-yellow-300" />
            <div>
              <h3 className="text-xl font-bold">Administrator Access</h3>
              <p className="text-red-100">You have full administrative privileges. Access the admin panel to manage the platform.</p>
            </div>
          </div>
        </div>
      )}

      {/* Tier Status Banner - Only for non-admin free users */}
      {isFreeUser && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-6 h-6 text-yellow-300" />
                <h3 className="text-xl font-bold">Upgrade to Premium</h3>
              </div>
              <p className="text-white/90">
                Unlock unlimited scans, priority support, advanced AI features, and more!
              </p>
            </div>
            <button className="bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Upgrade Now
            </button>
          </div>
        </div>
      )}

      {isPremium && !isAdmin && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg rounded-lg p-6">
          <div className="flex items-center gap-3">
            <Crown className="w-8 h-8 text-yellow-300" />
            <div>
              <h3 className="text-xl font-bold">Premium Member</h3>
              <p className="text-purple-100">Thank you for supporting Elara! Enjoy unlimited access to all features.</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-xl text-gray-600 mb-6">
          Comprehensive scam protection with AI-powered threat detection and recovery support
        </p>

        {/* Usage Stats for Free Users */}
        {isFreeUser && usageStats && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">Daily Usage</h4>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">Scans Today</span>
                      <span className="font-medium text-gray-900">
                        {usageStats.scansToday} / {usageStats.maxScansPerDay}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-600 h-2 rounded-full transition-all"
                        style={{ width: `${(usageStats.scansToday / usageStats.maxScansPerDay) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">Monthly Scans</span>
                      <span className="font-medium text-gray-900">
                        {usageStats.scansThisMonth} / {usageStats.maxScansPerMonth}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-600 h-2 rounded-full transition-all"
                        style={{ width: `${(usageStats.scansThisMonth / usageStats.maxScansPerMonth) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Premium Usage Stats */}
        {isPremium && usageStats && (
          <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-purple-600" />
                <div>
                  <h4 className="font-semibold text-gray-900">This Month's Activity</h4>
                  <p className="text-sm text-gray-600">
                    {usageStats.scansToday} scans today • {usageStats.scansThisMonth} scans this month
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-purple-600">Unlimited</div>
                <div className="text-xs text-gray-500">Premium Access</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-primary-600 mb-1">7</div>
            <div className="text-sm text-gray-700">Protection Tools</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600 mb-1">13</div>
            <div className="text-sm text-gray-700">Threat Categories</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600 mb-1">350</div>
            <div className="text-sm text-gray-700">Max Risk Score</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600 mb-1">{isPremium ? '5' : '3'}</div>
            <div className="text-sm text-gray-700">AI Models</div>
          </div>
        </div>
      </div>

      {/* Ask Elara AI Assistant - Embedded */}
      <div className="relative">
        <EmbeddedChatbot />
      </div>

      {/* Chatbot Widget - Keep for mobile or quick access */}
      <ChatbotWidget defaultOpen={false} />

      {/* Tier-Specific Benefits */}
      {isFreeUser && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl p-6 shadow-md">
          <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-600" />
            Unlock Premium Features
          </h3>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg p-4 border border-yellow-200">
              <div className="font-semibold text-gray-900 mb-1">Unlimited Scans</div>
              <div className="text-sm text-gray-600">No daily limits on URL, message, or file scans</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-yellow-200">
              <div className="font-semibold text-gray-900 mb-1">Priority Support</div>
              <div className="text-sm text-gray-600">24/7 dedicated support team access</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-yellow-200">
              <div className="font-semibold text-gray-900 mb-1">Advanced AI Models</div>
              <div className="text-sm text-gray-600">Access to GPT-4, Claude, and Gemini</div>
            </div>
          </div>
          <button className="w-full md:w-auto bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-8 py-3 rounded-lg font-bold hover:from-yellow-600 hover:to-orange-600 transition-all transform hover:scale-105">
            Upgrade to Premium - $29/month
          </button>
        </div>
      )}

      {isPremium && !isAdmin && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-xl p-6 shadow-md">
          <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Crown className="w-6 h-6 text-purple-600" />
            Premium Member Benefits
          </h3>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-purple-200">
              <div className="text-2xl font-bold text-purple-600 mb-1">∞</div>
              <div className="text-sm font-semibold text-gray-900">Unlimited Scans</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-200">
              <div className="text-2xl font-bold text-purple-600 mb-1">5</div>
              <div className="text-sm font-semibold text-gray-900">AI Models</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-200">
              <div className="text-2xl font-bold text-purple-600 mb-1">24/7</div>
              <div className="text-sm font-semibold text-gray-900">Priority Support</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-200">
              <div className="text-2xl font-bold text-purple-600 mb-1">100%</div>
              <div className="text-sm font-semibold text-gray-900">All Features</div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 rounded-xl p-6 shadow-md">
          <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Crown className="w-6 h-6 text-red-600" />
            Administrator Dashboard
          </h3>
          <div className="grid md:grid-cols-4 gap-4">
            <Link to="/admin" className="bg-white rounded-lg p-4 border border-red-200 hover:shadow-lg transition-shadow">
              <div className="text-2xl font-bold text-red-600 mb-1">⚙️</div>
              <div className="text-sm font-semibold text-gray-900">System Settings</div>
              <div className="text-xs text-gray-600 mt-1">Configure platform</div>
            </Link>
            <Link to="/admin" className="bg-white rounded-lg p-4 border border-red-200 hover:shadow-lg transition-shadow">
              <div className="text-2xl font-bold text-red-600 mb-1">👥</div>
              <div className="text-sm font-semibold text-gray-900">User Management</div>
              <div className="text-xs text-gray-600 mt-1">Manage all users</div>
            </Link>
            <Link to="/admin" className="bg-white rounded-lg p-4 border border-red-200 hover:shadow-lg transition-shadow">
              <div className="text-2xl font-bold text-red-600 mb-1">📊</div>
              <div className="text-sm font-semibold text-gray-900">Analytics</div>
              <div className="text-xs text-gray-600 mt-1">View platform stats</div>
            </Link>
            <Link to="/admin" className="bg-white rounded-lg p-4 border border-red-200 hover:shadow-lg transition-shadow">
              <div className="text-2xl font-bold text-red-600 mb-1">🔌</div>
              <div className="text-sm font-semibold text-gray-900">Integrations</div>
              <div className="text-xs text-gray-600 mt-1">Manage services</div>
            </Link>
          </div>
        </div>
      )}

      {/* SecureVPN Browser - Premium Feature */}
      {(isPremium || isAdmin) && (
        <div className="relative">
          <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-2xl shadow-2xl overflow-hidden border-2 border-indigo-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                      SecureVPN Browser
                      <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-normal">Premium</span>
                    </h3>
                    <p className="text-purple-100 text-sm">Professional secure web browsing with multi-tab support</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="text-center max-w-3xl mx-auto">
                <div className="inline-flex p-6 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full mb-6">
                  <Globe className="w-16 h-16 text-indigo-600" />
                </div>

                <h4 className="text-2xl font-bold text-gray-900 mb-4">
                  Browse Any Website Securely & Anonymously
                </h4>

                <p className="text-gray-600 mb-8 text-lg">
                  Access the professional SecureVPN Browser with full-page experience, multi-tab support,
                  and real-time statistics. Your IP is hidden, all traffic is encrypted.
                </p>

                <button
                  onClick={() => navigate('/proxy-browser')}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600
                    text-white font-bold rounded-xl hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700
                    transition-all duration-200 transform hover:scale-105 shadow-lg text-lg"
                >
                  <Lock className="w-6 h-6" />
                  Launch SecureVPN Browser
                  <ExternalLink className="w-5 h-5" />
                </button>

                <div className="mt-8 grid md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-indigo-200 shadow-sm">
                    <Shield className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <h5 className="font-semibold text-gray-900 text-sm">Anonymous</h5>
                    <p className="text-xs text-gray-600">IP Hidden</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
                    <Lock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                    <h5 className="font-semibold text-gray-900 text-sm">Encrypted</h5>
                    <p className="text-xs text-gray-600">Secure Traffic</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-pink-200 shadow-sm">
                    <Globe className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                    <h5 className="font-semibold text-gray-900 text-sm">Multi-Tab</h5>
                    <p className="text-xs text-gray-600">Up to 10 Tabs</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-indigo-200 shadow-sm">
                    <Zap className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                    <h5 className="font-semibold text-gray-900 text-sm">Live Stats</h5>
                    <p className="text-xs text-gray-600">Real-time Metrics</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Threat Detection Tools */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">🛡️ Threat Detection</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link to="/scan/url" className="bg-white shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow border-l-4 border-blue-500">
            <div className="flex items-center gap-4 mb-4">
              <LinkIcon className="w-10 h-10 text-blue-600" />
              <h3 className="text-xl font-bold text-gray-900">URL Scanner</h3>
            </div>
            <p className="text-gray-600 mb-4 text-sm">
              Scan URLs for phishing, malware, and other threats across 13 categories
            </p>
            <div className="text-blue-600 font-medium">Start Scan →</div>
          </Link>

          <Link to="/scan/message" className="bg-white shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow border-l-4 border-green-500">
            <div className="flex items-center gap-4 mb-4">
              <Mail className="w-10 h-10 text-green-600" />
              <h3 className="text-xl font-bold text-gray-900">Message Scanner</h3>
            </div>
            <p className="text-gray-600 mb-4 text-sm">
              Analyze messages for phishing, social engineering, and malicious content
            </p>
            <div className="text-green-600 font-medium">Start Scan →</div>
          </Link>

          <Link to="/scan/file" className="bg-white shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow border-l-4 border-purple-500">
            <div className="flex items-center gap-4 mb-4">
              <FileText className="w-10 h-10 text-purple-600" />
              <h3 className="text-xl font-bold text-gray-900">File Scanner</h3>
            </div>
            <p className="text-gray-600 mb-4 text-sm">
              Upload and scan files with OCR support for images and PDFs
            </p>
            <div className="text-purple-600 font-medium">Start Scan →</div>
          </Link>
        </div>
      </div>

      {/* Advanced Analysis Tools */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">🔍 Advanced Analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link to="/analyze/profile" className="bg-white shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow border-l-4 border-indigo-500">
            <div className="flex items-center gap-4 mb-4">
              <UserCheck className="w-10 h-10 text-indigo-600" />
              <h3 className="text-xl font-bold text-gray-900">Profile Analyzer</h3>
            </div>
            <p className="text-gray-600 mb-4 text-sm">
              Verify social media profiles for authenticity and detect impersonation
            </p>
            <div className="text-indigo-600 font-medium">Analyze Profile →</div>
          </Link>

          <Link to="/analyze/fact" className="bg-white shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow border-l-4 border-orange-500">
            <div className="flex items-center gap-4 mb-4">
              <Search className="w-10 h-10 text-orange-600" />
              <h3 className="text-xl font-bold text-gray-900">Fact Checker</h3>
            </div>
            <p className="text-gray-600 mb-4 text-sm">
              Verify claims against authoritative sources and expert consensus
            </p>
            <div className="text-orange-600 font-medium">Check Facts →</div>
          </Link>
        </div>
      </div>

      {/* Education & Recovery */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">📚 Learn & Recover</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link to="/literacy" className="bg-white shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow border-l-4 border-teal-500">
            <div className="flex items-center gap-4 mb-4">
              <GraduationCap className="w-10 h-10 text-teal-600" />
              <h3 className="text-xl font-bold text-gray-900">Digital Literacy Coach</h3>
            </div>
            <p className="text-gray-600 mb-4 text-sm">
              Take quizzes and learn about phishing, passwords, and digital safety
            </p>
            <div className="text-teal-600 font-medium">Start Learning →</div>
          </Link>

          <Link to="/recovery" className="bg-white shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow border-l-4 border-red-500">
            <div className="flex items-center gap-4 mb-4">
              <Heart className="w-10 h-10 text-red-600" />
              <h3 className="text-xl font-bold text-gray-900">Recovery Support</h3>
            </div>
            <p className="text-gray-600 mb-4 text-sm">
              Get personalized help and resources if you've fallen victim to a scam
            </p>
            <div className="text-red-600 font-medium">Get Support →</div>
          </Link>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary-500 to-primary-700 text-white shadow-lg rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-4">Multi-LLM AI Analysis</h2>
        <p className="mb-6">
          Powered by Claude Sonnet 4.5, GPT-4, and Gemini with RAG-enhanced threat intelligence
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="font-semibold mb-1">Primary AI</div>
            <div className="text-primary-100">Claude Sonnet 4.5</div>
          </div>
          <div>
            <div className="font-semibold mb-1">Fallback</div>
            <div className="text-primary-100">GPT-4 Turbo</div>
          </div>
          <div>
            <div className="font-semibold mb-1">RAG Database</div>
            <div className="text-primary-100">ChromaDB Vector Store</div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Home;
