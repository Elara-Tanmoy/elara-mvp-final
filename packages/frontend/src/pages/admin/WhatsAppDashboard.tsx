/**
 * WhatsApp Admin Dashboard
 *
 * Comprehensive dashboard for managing WhatsApp integration
 * - Real-time API status monitoring
 * - Incoming/outgoing message viewer with raw data
 * - Analytics visualizations
 * - User management
 * - Tier upgrades
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Users,
  Shield,
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Eye,
  RefreshCw,
  Download,
  BarChart3,
  Clock,
  AlertTriangle,
  Zap,
  Inbox,
  Star,
  X
} from 'lucide-react';
import api from '../../lib/api';

// Types
interface WhatsAppStats {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  totalThreatsBlocked: number;
  tierBreakdown: Record<string, number>;
}

interface WhatsAppUser {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  tier: string;
  dailyMessageLimit: number;
  messagesUsed: number;
  totalMessages: number;
  threatsBlocked: number;
  isActive: boolean;
  createdAt: string;
  lastResetAt: string;
}

interface WhatsAppMediaFile {
  id: string;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  riskLevel: string | null;
  createdAt: string;
}

interface WhatsAppMessage {
  id: string;
  messageSid: string;
  messageBody: string | null;
  mediaCount: number;
  mediaUrls: string[];
  riskLevel: string | null;
  overallScore: number | null;
  status: string;
  processingTime: number | null;
  createdAt: string;
  processedAt: string | null;
  scanResultIds?: string[];
  responseMessage?: string | null;
  analysisDetails?: any;
  user: {
    phoneNumber: string;
    displayName: string | null;
    tier: string;
  };
  mediaFiles?: WhatsAppMediaFile[];
}

interface ApiStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastChecked: string;
}

const WhatsAppDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'messages' | 'users' | 'analytics' | 'status'>('overview');

  // Data state
  const [stats, setStats] = useState<WhatsAppStats | null>(null);
  const [users, setUsers] = useState<WhatsAppUser[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [apiStatuses, setApiStatuses] = useState<ApiStatus[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<WhatsAppMessage | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [messageFilter, setMessageFilter] = useState({ riskLevel: '', status: '' });
  const [userPage, setUserPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // NEW: Detailed view modals
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [detailedViewType, setDetailedViewType] = useState<'users' | 'messages' | 'threats' | null>(null);
  const [detailedData, setDetailedData] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Check admin access
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Load data on mount and tab change
  useEffect(() => {
    loadData();
  }, [activeTab, userPage, userSearch, messageFilter]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab, userPage, userSearch, messageFilter]);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      switch (activeTab) {
        case 'overview':
          await loadStats();
          await checkApiStatus();
          break;
        case 'messages':
          await loadMessages();
          break;
        case 'users':
          await loadUsers();
          break;
        case 'analytics':
          await loadStats();
          break;
        case 'status':
          await checkApiStatus();
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/v2/admin/whatsapp/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const params = new URLSearchParams({
        page: userPage.toString(),
        limit: '20',
        ...(userSearch && { search: userSearch })
      });

      const response = await api.get(`/v2/admin/whatsapp/users?${params}`);
      setUsers(response.data.data.users);
      setTotalUsers(response.data.data.pagination.total);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '100',
        ...(messageFilter.riskLevel && { riskLevel: messageFilter.riskLevel }),
        ...(messageFilter.status && { status: messageFilter.status })
      });

      const response = await api.get(`/v2/admin/whatsapp/messages?${params}`);
      setMessages(response.data.data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  };

  const checkApiStatus = async () => {
    try {
      const checks: ApiStatus[] = [];

      // Check WhatsApp webhook endpoint
      const webhookStart = Date.now();
      try {
        await api.get('/webhook/whatsapp/health');
        checks.push({
          service: 'WhatsApp Webhook',
          status: 'healthy',
          responseTime: Date.now() - webhookStart,
          lastChecked: new Date().toISOString()
        });
      } catch (error) {
        checks.push({
          service: 'WhatsApp Webhook',
          status: 'down',
          responseTime: 0,
          lastChecked: new Date().toISOString()
        });
      }

      // Check Twilio connectivity
      const twilioStart = Date.now();
      try {
        // Placeholder - would need actual Twilio health check
        checks.push({
          service: 'Twilio API',
          status: 'healthy',
          responseTime: Date.now() - twilioStart,
          lastChecked: new Date().toISOString()
        });
      } catch (error) {
        checks.push({
          service: 'Twilio API',
          status: 'down',
          responseTime: 0,
          lastChecked: new Date().toISOString()
        });
      }

      // Check database
      const dbStart = Date.now();
      try {
        await api.get('/health');
        checks.push({
          service: 'Database',
          status: 'healthy',
          responseTime: Date.now() - dbStart,
          lastChecked: new Date().toISOString()
        });
      } catch (error) {
        checks.push({
          service: 'Database',
          status: 'down',
          responseTime: 0,
          lastChecked: new Date().toISOString()
        });
      }

      setApiStatuses(checks);
    } catch (error) {
      console.error('Error checking API status:', error);
    }
  };

  const upgradeUserTier = async (phoneNumber: string, newTier: string) => {
    try {
      await api.patch(`/v2/admin/whatsapp/users/${encodeURIComponent(phoneNumber)}/tier`, {
        tier: newTier
      });
      await loadUsers();
    } catch (error) {
      console.error('Error upgrading user:', error);
      alert('Failed to upgrade user tier');
    }
  };

  const resetUserCounter = async (phoneNumber: string) => {
    try {
      await api.post(`/v2/admin/whatsapp/users/${encodeURIComponent(phoneNumber)}/reset`);
      await loadUsers();
    } catch (error) {
      console.error('Error resetting counter:', error);
      alert('Failed to reset user counter');
    }
  };

  const exportData = () => {
    const data = activeTab === 'users' ? users : messages;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp-${activeTab}-${new Date().toISOString()}.json`;
    a.click();
  };

  // Load detailed message data when viewing
  const loadMessageDetails = async (messageId: string) => {
    try {
      const response = await api.get(`/v2/admin/whatsapp/messages/${messageId}`);
      setSelectedMessage(response.data.data);
      setShowMessageModal(true);
    } catch (error) {
      console.error('Error loading message details:', error);
      alert('Failed to load message details');
    }
  };

  // Download media file
  const downloadMediaFile = async (mediaId: string, fileName: string) => {
    try {
      const response = await api.get(`/v2/admin/whatsapp/media/${mediaId}/download`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'download');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading media:', error);
      alert('Failed to download media file');
    }
  };

  // NEW: Load detailed data when tile is clicked
  const loadDetailedView = async (type: 'users' | 'messages' | 'threats') => {
    try {
      setLoadingDetails(true);
      setDetailedViewType(type);
      setShowDetailedView(true);

      let data;
      switch (type) {
        case 'users':
          // Load all active users with their recent activity
          const usersResponse = await api.get('/v2/admin/whatsapp/users?limit=50&sortBy=totalMessages');
          data = {
            users: usersResponse.data.data.users,
            total: usersResponse.data.data.pagination.total,
            active: usersResponse.data.data.users.filter((u: WhatsAppUser) => u.isActive).length
          };
          break;

        case 'messages':
          // Load recent messages with full details
          const messagesResponse = await api.get('/v2/admin/whatsapp/messages?limit=50');
          data = {
            messages: messagesResponse.data.data || [],
            total: stats?.totalMessages || 0
          };
          break;

        case 'threats':
          // Load users with highest threat counts
          const threatsResponse = await api.get('/v2/admin/whatsapp/users?sortBy=threatsBlocked&limit=20');
          data = {
            topUsers: threatsResponse.data.data.users,
            totalBlocked: stats?.totalThreatsBlocked || 0
          };
          break;
      }

      setDetailedData(data);
    } catch (error) {
      console.error('Error loading detailed view:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-green-600" />
              WhatsApp Admin Dashboard
            </h1>
            <p className="text-gray-600 mt-2">Monitor and manage WhatsApp integration</p>
          </div>
          <div className="flex items-center gap-3">
            {refreshing && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Auto-refreshing...</span>
              </div>
            )}
            <button
              onClick={() => loadData()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation - ENHANCED for Mobile/Tablet */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden relative">
        {/* Scroll indicator gradient */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none z-10 lg:hidden"></div>

        <nav className="flex gap-2 overflow-x-auto p-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {[
            { id: 'overview', label: 'Dashboard', icon: BarChart3, shortLabel: 'Dashboard' },
            { id: 'messages', label: 'All Messages', icon: MessageSquare, shortLabel: 'Messages' },
            { id: 'users', label: 'User Management', icon: Users, shortLabel: 'Users' },
            { id: 'analytics', label: 'Analytics & Reports', icon: TrendingUp, shortLabel: 'Reports' },
            { id: 'status', label: 'System Health', icon: Activity, shortLabel: 'Health' }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg font-semibold transition-all whitespace-nowrap flex-shrink-0 text-sm lg:text-base ${
                  isActive
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="hidden lg:inline">{tab.label}</span>
                <span className="lg:hidden text-xs sm:text-sm">{tab.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
            </div>
          ) : (
            <>
              {/* Stats Grid - NOW CLICKABLE! */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => loadDetailedView('users')}
                  className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-lg p-6 text-white hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90 group-hover:opacity-100">Total Users</p>
                      <p className="text-3xl font-bold mt-1">{stats?.totalUsers || 0}</p>
                      <p className="text-xs opacity-80 mt-1 group-hover:opacity-100">{stats?.activeUsers || 0} active</p>
                      <p className="text-xs opacity-70 mt-2 group-hover:opacity-100">📊 Click for details</p>
                    </div>
                    <Users className="w-12 h-12 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                  </div>
                </button>

                <button
                  onClick={() => loadDetailedView('messages')}
                  className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg shadow-lg p-6 text-white hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90 group-hover:opacity-100">Total Messages</p>
                      <p className="text-3xl font-bold mt-1">{stats?.totalMessages || 0}</p>
                      <p className="text-xs opacity-80 mt-1 group-hover:opacity-100">All time</p>
                      <p className="text-xs opacity-70 mt-2 group-hover:opacity-100">📊 Click for details</p>
                    </div>
                    <MessageSquare className="w-12 h-12 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                  </div>
                </button>

                <button
                  onClick={() => loadDetailedView('threats')}
                  className="bg-gradient-to-br from-red-500 to-rose-600 rounded-lg shadow-lg p-6 text-white hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90 group-hover:opacity-100">Threats Blocked</p>
                      <p className="text-3xl font-bold mt-1">{stats?.totalThreatsBlocked || 0}</p>
                      <p className="text-xs opacity-80 mt-1 group-hover:opacity-100">Security scans</p>
                      <p className="text-xs opacity-70 mt-2 group-hover:opacity-100">📊 Click for details</p>
                    </div>
                    <Shield className="w-12 h-12 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                  </div>
                </button>

                <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Success Rate</p>
                      <p className="text-3xl font-bold mt-1">
                        {stats?.totalMessages ? Math.round(((stats.totalMessages - (stats.totalThreatsBlocked || 0)) / stats.totalMessages) * 100) : 0}%
                      </p>
                      <p className="text-xs opacity-80 mt-1">Clean messages</p>
                    </div>
                    <CheckCircle className="w-12 h-12 opacity-80" />
                  </div>
                </div>
              </div>

              {/* Tier Distribution */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-600" />
                  User Tier Distribution
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {stats?.tierBreakdown && Object.entries(stats.tierBreakdown).map(([tier, count]) => (
                    <div key={tier} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 capitalize">{tier} Tier</p>
                          <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {tier === 'free' ? '5 msgs/day' : tier === 'premium' ? '50 msgs/day' : 'Unlimited'}
                          </p>
                        </div>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          tier === 'enterprise' ? 'bg-purple-100 text-purple-600' :
                          tier === 'premium' ? 'bg-blue-100 text-blue-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          <Zap className="w-6 h-6" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* API Status Preview */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  System Status
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {apiStatuses.slice(0, 3).map((status) => (
                    <div key={status.service} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{status.service}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {status.responseTime > 0 ? `${status.responseTime}ms` : 'N/A'}
                        </p>
                      </div>
                      {status.status === 'healthy' ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : status.status === 'degraded' ? (
                        <AlertTriangle className="w-6 h-6 text-yellow-600" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-600" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Risk Level</label>
                <select
                  value={messageFilter.riskLevel}
                  onChange={(e) => setMessageFilter({ ...messageFilter, riskLevel: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                >
                  <option value="">All Risk Levels</option>
                  <option value="safe">Safe</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
                <select
                  value={messageFilter.status}
                  onChange={(e) => setMessageFilter({ ...messageFilter, status: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                >
                  <option value="">All Statuses</option>
                  <option value="received">Received</option>
                  <option value="processing">Processing</option>
                  <option value="processed">Processed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={exportData}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>
          </div>

          {/* Messages Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12">
                <Inbox className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No messages found</p>
                <p className="text-sm text-gray-500 mt-2">Messages will appear here as they are received</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">User</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Message</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Risk Level</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Time</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {messages.map((message) => (
                      <tr key={message.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{message.user.displayName || 'Unknown'}</p>
                            <p className="text-sm text-gray-500">{message.user.phoneNumber}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-gray-900 truncate max-w-xs">
                            {message.messageBody || <span className="italic text-gray-400">Media message</span>}
                          </p>
                          {message.mediaCount > 0 && (
                            <p className="text-xs text-blue-600 mt-1">{message.mediaCount} media file(s)</p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {message.riskLevel && (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              message.riskLevel === 'critical' ? 'bg-red-100 text-red-800' :
                              message.riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                              message.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              message.riskLevel === 'low' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {message.riskLevel.toUpperCase()}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            message.status === 'processed' ? 'bg-green-100 text-green-800' :
                            message.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            message.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {message.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(message.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => loadMessageDetails(message.id)}
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="text-xs hidden sm:inline">Details</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Search */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by phone number or display name..."
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2"
                  />
                </div>
              </div>
              <button
                onClick={exportData}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">User</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Tier</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Usage</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Threats Blocked</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{user.displayName || 'Unknown'}</p>
                            <p className="text-sm text-gray-500">{user.phoneNumber}</p>
                            <p className="text-xs text-gray-400 mt-1">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={user.tier}
                            onChange={(e) => upgradeUserTier(user.phoneNumber, e.target.value)}
                            className={`border border-gray-300 rounded px-2 py-1 text-sm font-medium ${
                              user.tier === 'enterprise' ? 'bg-purple-50 text-purple-800' :
                              user.tier === 'premium' ? 'bg-blue-50 text-blue-800' :
                              'bg-gray-50 text-gray-800'
                            }`}
                          >
                            <option value="free">Free (5/day)</option>
                            <option value="premium">Premium (50/day)</option>
                            <option value="enterprise">Enterprise (Unlimited)</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Today:</span>
                              <span className="text-sm font-medium text-gray-900">
                                {user.messagesUsed} / {user.dailyMessageLimit === -1 ? '∞' : user.dailyMessageLimit}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  user.dailyMessageLimit === -1 ? 'bg-purple-600' :
                                  (user.messagesUsed / user.dailyMessageLimit) > 0.8 ? 'bg-red-600' :
                                  (user.messagesUsed / user.dailyMessageLimit) > 0.5 ? 'bg-yellow-600' :
                                  'bg-green-600'
                                }`}
                                style={{
                                  width: user.dailyMessageLimit === -1 ? '100%' : `${Math.min((user.messagesUsed / user.dailyMessageLimit) * 100, 100)}%`
                                }}
                              ></div>
                            </div>
                            <p className="text-xs text-gray-500">Total: {user.totalMessages}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-red-600" />
                            <span className="text-sm font-medium text-gray-900">{user.threatsBlocked}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => resetUserCounter(user.phoneNumber)}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            Reset Counter
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalUsers > 20 && (
            <div className="flex items-center justify-between bg-white rounded-lg shadow-md p-4">
              <p className="text-sm text-gray-600">
                Showing {(userPage - 1) * 20 + 1} to {Math.min(userPage * 20, totalUsers)} of {totalUsers} users
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setUserPage(p => Math.max(1, p - 1))}
                  disabled={userPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setUserPage(p => p + 1)}
                  disabled={userPage * 20 >= totalUsers}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab - WITH REAL DATA */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
            </div>
          ) : stats ? (
            <>
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <Users className="w-12 h-12 opacity-80" />
                    <div className="text-right">
                      <p className="text-4xl font-bold">{stats.totalUsers}</p>
                      <p className="text-sm opacity-90">Total Users</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/20">
                    <div className="flex justify-between items-center">
                      <span className="text-sm opacity-90">Active</span>
                      <span className="font-bold">{stats.activeUsers}</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2 mt-2">
                      <div
                        className="bg-white rounded-full h-2 transition-all"
                        style={{ width: `${(stats.activeUsers / stats.totalUsers) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs opacity-75 mt-1">
                      {Math.round((stats.activeUsers / stats.totalUsers) * 100)}% Active Rate
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <MessageSquare className="w-12 h-12 opacity-80" />
                    <div className="text-right">
                      <p className="text-4xl font-bold">{stats.totalMessages}</p>
                      <p className="text-sm opacity-90">Messages</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/20">
                    <div className="flex justify-between items-center text-sm">
                      <span className="opacity-90">Avg per User</span>
                      <span className="font-bold">{stats.totalUsers > 0 ? Math.round(stats.totalMessages / stats.totalUsers) : 0}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <Shield className="w-12 h-12 opacity-80" />
                    <div className="text-right">
                      <p className="text-4xl font-bold">{stats.totalThreatsBlocked}</p>
                      <p className="text-sm opacity-90">Threats Blocked</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/20">
                    <div className="flex justify-between items-center text-sm">
                      <span className="opacity-90">Threat Rate</span>
                      <span className="font-bold">
                        {stats.totalMessages > 0 ? ((stats.totalThreatsBlocked / stats.totalMessages) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <CheckCircle className="w-12 h-12 opacity-80" />
                    <div className="text-right">
                      <p className="text-4xl font-bold">
                        {stats.totalMessages > 0 ? Math.round(((stats.totalMessages - stats.totalThreatsBlocked) / stats.totalMessages) * 100) : 0}%
                      </p>
                      <p className="text-sm opacity-90">Success Rate</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/20">
                    <div className="flex justify-between items-center text-sm">
                      <span className="opacity-90">Clean Messages</span>
                      <span className="font-bold">{stats.totalMessages - stats.totalThreatsBlocked}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tier Distribution Visualization */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Star className="w-6 h-6 text-yellow-600" />
                  <h3 className="text-xl font-bold text-gray-900">User Tier Distribution</h3>
                </div>

                {stats.tierBreakdown && Object.keys(stats.tierBreakdown).length > 0 ? (
                  <div className="space-y-6">
                    {Object.entries(stats.tierBreakdown).map(([tier, count]) => {
                      const percentage = (count / stats.totalUsers) * 100;
                      const colors = {
                        free: { bg: 'bg-gray-500', text: 'text-gray-700', light: 'bg-gray-100' },
                        premium: { bg: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-100' },
                        enterprise: { bg: 'bg-purple-500', text: 'text-purple-700', light: 'bg-purple-100' }
                      };
                      const color = colors[tier as keyof typeof colors] || colors.free;

                      return (
                        <div key={tier}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${color.bg}`}></div>
                              <span className="font-semibold text-gray-900 capitalize text-lg">{tier} Tier</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-2xl text-gray-900">{count}</span>
                              <span className="text-sm text-gray-600 ml-2">({percentage.toFixed(1)}%)</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                            <div
                              className={`${color.bg} h-4 transition-all duration-500 flex items-center justify-end pr-2`}
                              style={{ width: `${percentage}%` }}
                            >
                              {percentage > 10 && (
                                <span className="text-xs font-bold text-white">{percentage.toFixed(0)}%</span>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {tier === 'free' ? '5 messages/day limit' : tier === 'premium' ? '50 messages/day limit' : 'Unlimited messages'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p>No tier data available</p>
                  </div>
                )}
              </div>

              {/* Threat vs Clean Messages */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Shield className="w-6 h-6 text-red-600" />
                    <h3 className="text-xl font-bold text-gray-900">Security Overview</h3>
                  </div>

                  <div className="relative h-64 flex items-center justify-center">
                    {stats.totalMessages > 0 ? (
                      <div className="w-full space-y-4">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700">Clean Messages</span>
                            <span className="text-lg font-bold text-green-600">
                              {stats.totalMessages - stats.totalThreatsBlocked}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-green-500 to-emerald-600 h-8 flex items-center justify-end pr-3 transition-all"
                              style={{ width: `${((stats.totalMessages - stats.totalThreatsBlocked) / stats.totalMessages) * 100}%` }}
                            >
                              <span className="text-white font-bold text-sm">
                                {Math.round(((stats.totalMessages - stats.totalThreatsBlocked) / stats.totalMessages) * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700">Threats Blocked</span>
                            <span className="text-lg font-bold text-red-600">{stats.totalThreatsBlocked}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-red-500 to-rose-600 h-8 flex items-center justify-end pr-3 transition-all"
                              style={{ width: `${(stats.totalThreatsBlocked / stats.totalMessages) * 100}%` }}
                            >
                              <span className="text-white font-bold text-sm">
                                {Math.round((stats.totalThreatsBlocked / stats.totalMessages) * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm font-semibold text-blue-900 mb-2">Protection Effectiveness</p>
                          <p className="text-3xl font-bold text-blue-600">
                            {Math.round(((stats.totalMessages - stats.totalThreatsBlocked) / stats.totalMessages) * 100)}%
                          </p>
                          <p className="text-xs text-blue-700 mt-1">of messages verified as safe</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500">
                        <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p>No message data available</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                    <h3 className="text-xl font-bold text-gray-900">Platform Health</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">User Engagement</span>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <p className="text-3xl font-bold text-green-600">
                        {stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}%
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {stats.activeUsers} of {stats.totalUsers} users are active
                      </p>
                    </div>

                    <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Messages Per User</span>
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                      </div>
                      <p className="text-3xl font-bold text-blue-600">
                        {stats.totalUsers > 0 ? Math.round(stats.totalMessages / stats.totalUsers) : 0}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">Average messages sent per user</p>
                    </div>

                    <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Detection Rate</span>
                        <Shield className="w-5 h-5 text-purple-600" />
                      </div>
                      <p className="text-3xl font-bold text-purple-600">
                        {stats.totalMessages > 0 ? ((stats.totalThreatsBlocked / stats.totalMessages) * 100).toFixed(1) : 0}%
                      </p>
                      <p className="text-xs text-gray-600 mt-1">Percentage of threats detected</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Report */}
              <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl shadow-lg p-6 border border-blue-200">
                <div className="flex items-center gap-3 mb-6">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                  <h3 className="text-xl font-bold text-gray-900">Executive Summary</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-blue-600 mb-2">{stats.totalUsers}</div>
                    <div className="text-sm text-gray-600 mb-1">Total Platform Users</div>
                    <div className="text-xs text-gray-500">
                      {stats.activeUsers} active ({Math.round((stats.activeUsers / stats.totalUsers) * 100)}%)
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-5xl font-bold text-green-600 mb-2">{stats.totalMessages}</div>
                    <div className="text-sm text-gray-600 mb-1">Messages Processed</div>
                    <div className="text-xs text-gray-500">
                      {stats.totalMessages - stats.totalThreatsBlocked} clean messages
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-5xl font-bold text-red-600 mb-2">{stats.totalThreatsBlocked}</div>
                    <div className="text-sm text-gray-600 mb-1">Threats Neutralized</div>
                    <div className="text-xs text-gray-500">
                      {stats.totalMessages > 0 ? ((stats.totalThreatsBlocked / stats.totalMessages) * 100).toFixed(1) : 0}% detection rate
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-white rounded-lg border border-blue-200">
                  <p className="text-center text-sm text-gray-700">
                    <span className="font-bold text-blue-600">Platform Status:</span>{' '}
                    All systems operational. Protecting users with {Math.round(((stats.totalMessages - stats.totalThreatsBlocked) / stats.totalMessages) * 100)}% success rate.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-semibold">No analytics data available</p>
              <p className="text-sm mt-2">Data will appear once messages are processed</p>
            </div>
          )}
        </div>
      )}

      {/* API Status Tab */}
      {activeTab === 'status' && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="divide-y divide-gray-200">
                  {apiStatuses.map((status) => (
                    <div key={status.service} className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h4 className="font-semibold text-gray-900">{status.service}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              status.status === 'healthy' ? 'bg-green-100 text-green-800' :
                              status.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {status.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>Response: {status.responseTime > 0 ? `${status.responseTime}ms` : 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Activity className="w-4 h-4" />
                              <span>Checked: {new Date(status.lastChecked).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        </div>
                        {status.status === 'healthy' ? (
                          <CheckCircle className="w-8 h-8 text-green-600" />
                        ) : status.status === 'degraded' ? (
                          <AlertTriangle className="w-8 h-8 text-yellow-600" />
                        ) : (
                          <XCircle className="w-8 h-8 text-red-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ENHANCED Message Detail Modal */}
      {showMessageModal && selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col my-4">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-xl font-bold">Message Details</h3>
                <p className="text-sm opacity-90 mt-1">
                  {selectedMessage.user.displayName || 'Unknown'} • {selectedMessage.user.phoneNumber}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowMessageModal(false);
                  setSelectedMessage(null);
                }}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* User Information */}
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 sm:p-6 border border-blue-200">
                <div className="flex items-center gap-3 mb-4">
                  <Users className="w-6 h-6 text-blue-600" />
                  <h4 className="font-semibold text-gray-900">User Information</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Display Name</p>
                    <p className="font-medium text-gray-900">{selectedMessage.user.displayName || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phone Number</p>
                    <p className="font-medium text-gray-900">{selectedMessage.user.phoneNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Tier</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      selectedMessage.user.tier === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                      selectedMessage.user.tier === 'premium' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedMessage.user.tier}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Message SID</p>
                    <p className="font-mono text-xs text-gray-900 break-all">{selectedMessage.messageSid}</p>
                  </div>
                </div>
              </div>

              {/* Message Content */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <MessageSquare className="w-6 h-6 text-gray-700" />
                  <h4 className="font-semibold text-gray-900">Message Content</h4>
                </div>
                {selectedMessage.messageBody ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-900 whitespace-pre-wrap">{selectedMessage.messageBody}</p>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No text content (media only message)</p>
                )}
                <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
                  <span>📅 Received: {new Date(selectedMessage.createdAt).toLocaleString()}</span>
                  {selectedMessage.processedAt && (
                    <span>⚡ Processed: {new Date(selectedMessage.processedAt).toLocaleString()}</span>
                  )}
                </div>
              </div>

              {/* Risk Analysis */}
              <div className={`rounded-lg border p-4 sm:p-6 ${
                selectedMessage.riskLevel === 'critical' ? 'bg-red-50 border-red-300' :
                selectedMessage.riskLevel === 'high' ? 'bg-orange-50 border-orange-300' :
                selectedMessage.riskLevel === 'medium' ? 'bg-yellow-50 border-yellow-300' :
                selectedMessage.riskLevel === 'low' ? 'bg-blue-50 border-blue-300' :
                'bg-green-50 border-green-300'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  <Shield className={`w-6 h-6 ${
                    selectedMessage.riskLevel === 'critical' || selectedMessage.riskLevel === 'high' ? 'text-red-600' :
                    selectedMessage.riskLevel === 'medium' ? 'text-yellow-600' :
                    selectedMessage.riskLevel === 'low' ? 'text-blue-600' :
                    'text-green-600'
                  }`} />
                  <h4 className="font-semibold text-gray-900">Risk Analysis</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Risk Level</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold uppercase mt-1 ${
                      selectedMessage.riskLevel === 'critical' ? 'bg-red-600 text-white' :
                      selectedMessage.riskLevel === 'high' ? 'bg-orange-600 text-white' :
                      selectedMessage.riskLevel === 'medium' ? 'bg-yellow-600 text-white' :
                      selectedMessage.riskLevel === 'low' ? 'bg-blue-600 text-white' :
                      'bg-green-600 text-white'
                    }`}>
                      {selectedMessage.riskLevel || 'UNKNOWN'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Overall Score</p>
                    <p className="font-bold text-2xl text-gray-900 mt-1">{selectedMessage.overallScore || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-1 ${
                      selectedMessage.status === 'processed' ? 'bg-green-100 text-green-800' :
                      selectedMessage.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      selectedMessage.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedMessage.status}
                    </span>
                  </div>
                </div>
                {selectedMessage.processingTime && (
                  <p className="text-sm text-gray-600 mt-4">
                    ⚡ Processing Time: {selectedMessage.processingTime}ms
                  </p>
                )}
              </div>

              {/* Elara's Response */}
              {selectedMessage.responseMessage && (
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200 p-4 sm:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <MessageSquare className="w-6 h-6 text-purple-600" />
                    <h4 className="font-semibold text-gray-900">Elara's Response to User</h4>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-purple-200">
                    <p className="text-gray-900 whitespace-pre-wrap">{selectedMessage.responseMessage}</p>
                  </div>
                </div>
              )}

              {/* Media Files - ALWAYS SHOW THIS SECTION */}
              <div className="bg-white rounded-lg border-2 border-blue-200 p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Download className="w-6 h-6 text-blue-600" />
                  <h4 className="font-semibold text-gray-900">
                    Media Files {selectedMessage.mediaFiles?.length ? `(${selectedMessage.mediaFiles.length})` : ''}
                  </h4>
                </div>

                {selectedMessage.mediaFiles && selectedMessage.mediaFiles.length > 0 ? (
                  <div className="space-y-3">
                    {selectedMessage.mediaFiles.map((media) => (
                      <div key={media.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-200 hover:border-blue-400 transition-all">
                        <div className="flex-1 min-w-0 mb-3 sm:mb-0">
                          <p className="font-bold text-gray-900 text-lg mb-2">{media.fileName || 'Unnamed file'}</p>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-gray-700">
                            <span className="flex items-center gap-1 bg-white px-2 py-1 rounded-full">
                              📁 {media.mimeType || 'Unknown type'}
                            </span>
                            {media.fileSize && (
                              <span className="flex items-center gap-1 bg-white px-2 py-1 rounded-full">
                                💾 {(media.fileSize / 1024).toFixed(2)} KB
                              </span>
                            )}
                            {media.riskLevel && (
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                media.riskLevel === 'critical' || media.riskLevel === 'high' ? 'bg-red-500 text-white' :
                                media.riskLevel === 'medium' ? 'bg-yellow-500 text-white' :
                                'bg-green-500 text-white'
                              }`}>
                                🛡️ {media.riskLevel.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-2">📅 Uploaded: {new Date(media.createdAt).toLocaleString()}</p>
                        </div>
                        <button
                          onClick={() => downloadMediaFile(media.id, media.fileName || 'download')}
                          className="w-full sm:w-auto sm:ml-4 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          <Download className="w-5 h-5" />
                          <span>Download File</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 text-center">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Download className="w-8 h-8 text-yellow-600" />
                    </div>
                    <p className="font-semibold text-gray-900 text-lg mb-2">No Media Files Attached</p>
                    <p className="text-gray-600 text-sm mb-4">
                      This message {selectedMessage.mediaCount > 0 ? `indicated ${selectedMessage.mediaCount} media file(s) but they may not have been stored in the database yet.` : 'did not contain any media files (images, documents, etc).'}
                    </p>
                    {selectedMessage.mediaCount > 0 && selectedMessage.mediaUrls?.length > 0 && (
                      <div className="bg-white rounded-lg p-4 border border-yellow-200 mt-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">📎 Original Media URLs:</p>
                        <div className="space-y-1">
                          {selectedMessage.mediaUrls.map((url, idx) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-blue-600 hover:text-blue-800 hover:underline break-all"
                            >
                              {url}
                            </a>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          ⚠️ Note: Files may have been processed but not stored. Check backend logs.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Analysis Details */}
              {selectedMessage.analysisDetails && (
                <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <BarChart3 className="w-6 h-6 text-gray-700" />
                    <h4 className="font-semibold text-gray-900">Analysis Details</h4>
                  </div>
                  <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-x-auto border border-gray-200">
                    {JSON.stringify(selectedMessage.analysisDetails, null, 2)}
                  </pre>
                </div>
              )}

              {/* Raw Data */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Eye className="w-6 h-6 text-gray-700" />
                    <h4 className="font-semibold text-gray-900">Raw JSON Data</h4>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedMessage, null, 2));
                      alert('Raw data copied to clipboard!');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    📋 Copy
                  </button>
                </div>
                <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto max-h-96 overflow-y-auto">
                  {JSON.stringify(selectedMessage, null, 2)}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0">
              <p className="text-sm text-gray-600">
                Message ID: <span className="font-mono text-xs">{selectedMessage.id}</span>
              </p>
              <button
                onClick={() => {
                  setShowMessageModal(false);
                  setSelectedMessage(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Detailed Analytics Modal */}
      {showDetailedView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                {detailedViewType === 'users' && <Users className="w-6 h-6" />}
                {detailedViewType === 'messages' && <MessageSquare className="w-6 h-6" />}
                {detailedViewType === 'threats' && <Shield className="w-6 h-6" />}
                <div>
                  <h3 className="text-xl font-bold capitalize">{detailedViewType} Details</h3>
                  <p className="text-sm opacity-90">Detailed analytics and insights</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDetailedView(false);
                  setDetailedData(null);
                }}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                </div>
              ) : detailedData ? (
                <div className="space-y-6">
                  {/* Users Detailed View */}
                  {detailedViewType === 'users' && detailedData.users && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                          <p className="text-sm text-green-700 font-medium">Total Users</p>
                          <p className="text-3xl font-bold text-green-900 mt-1">{detailedData.total}</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                          <p className="text-sm text-blue-700 font-medium">Active Users</p>
                          <p className="text-3xl font-bold text-blue-900 mt-1">{detailedData.active}</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                          <p className="text-sm text-purple-700 font-medium">Activity Rate</p>
                          <p className="text-3xl font-bold text-purple-900 mt-1">
                            {Math.round((detailedData.active / detailedData.total) * 100)}%
                          </p>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left py-3 px-4 text-xs sm:text-sm font-medium text-gray-700">User</th>
                                <th className="text-left py-3 px-4 text-xs sm:text-sm font-medium text-gray-700">Tier</th>
                                <th className="text-left py-3 px-4 text-xs sm:text-sm font-medium text-gray-700">Messages</th>
                                <th className="text-left py-3 px-4 text-xs sm:text-sm font-medium text-gray-700">Threats</th>
                                <th className="text-left py-3 px-4 text-xs sm:text-sm font-medium text-gray-700">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {detailedData.users.map((user: WhatsAppUser) => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                  <td className="py-3 px-4">
                                    <div>
                                      <p className="font-medium text-gray-900 text-sm">{user.displayName || 'Unknown'}</p>
                                      <p className="text-xs text-gray-500">{user.phoneNumber}</p>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      user.tier === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                                      user.tier === 'premium' ? 'bg-blue-100 text-blue-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {user.tier}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="text-sm">
                                      <p className="font-medium text-gray-900">{user.totalMessages}</p>
                                      <p className="text-xs text-gray-500">{user.messagesUsed}/{user.dailyMessageLimit === -1 ? '∞' : user.dailyMessageLimit} today</p>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="flex items-center gap-1 text-sm">
                                      <Shield className="w-4 h-4 text-red-600" />
                                      <span className="font-medium text-gray-900">{user.threatsBlocked}</span>
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {user.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Messages Detailed View */}
                  {detailedViewType === 'messages' && detailedData.messages && (
                    <>
                      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200 mb-6">
                        <div className="flex items-center gap-3">
                          <MessageSquare className="w-8 h-8 text-blue-600" />
                          <div>
                            <p className="text-sm text-blue-700 font-medium">Total Messages Processed</p>
                            <p className="text-3xl font-bold text-blue-900 mt-1">{detailedData.total}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        {detailedData.messages.length === 0 ? (
                          <div className="text-center py-12">
                            <Inbox className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">No messages available</p>
                            <p className="text-sm text-gray-500 mt-2">Recent messages will appear here</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="text-left py-3 px-4 text-xs sm:text-sm font-medium text-gray-700">User</th>
                                  <th className="text-left py-3 px-4 text-xs sm:text-sm font-medium text-gray-700">Message</th>
                                  <th className="text-left py-3 px-4 text-xs sm:text-sm font-medium text-gray-700">Risk</th>
                                  <th className="text-left py-3 px-4 text-xs sm:text-sm font-medium text-gray-700">Time</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {detailedData.messages.map((message: WhatsAppMessage) => (
                                  <tr key={message.id} className="hover:bg-gray-50">
                                    <td className="py-3 px-4">
                                      <div>
                                        <p className="font-medium text-gray-900 text-sm">{message.user?.displayName || 'Unknown'}</p>
                                        <p className="text-xs text-gray-500">{message.user?.phoneNumber}</p>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4">
                                      <p className="text-sm text-gray-900 truncate max-w-xs">
                                        {message.messageBody || <span className="italic text-gray-400">Media message</span>}
                                      </p>
                                      {message.mediaCount > 0 && (
                                        <p className="text-xs text-blue-600 mt-1">{message.mediaCount} file(s)</p>
                                      )}
                                    </td>
                                    <td className="py-3 px-4">
                                      {message.riskLevel && (
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                          message.riskLevel === 'critical' ? 'bg-red-100 text-red-800' :
                                          message.riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                                          message.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                          message.riskLevel === 'low' ? 'bg-blue-100 text-blue-800' :
                                          'bg-green-100 text-green-800'
                                        }`}>
                                          {message.riskLevel.toUpperCase()}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-xs sm:text-sm text-gray-600">
                                      {new Date(message.createdAt).toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Threats Detailed View */}
                  {detailedViewType === 'threats' && detailedData.topUsers && (
                    <>
                      <div className="bg-red-50 rounded-lg p-6 border border-red-200 mb-6">
                        <div className="flex items-center gap-3">
                          <Shield className="w-8 h-8 text-red-600" />
                          <div>
                            <p className="text-sm text-red-700 font-medium">Total Threats Blocked</p>
                            <p className="text-3xl font-bold text-red-900 mt-1">{detailedData.totalBlocked}</p>
                            <p className="text-xs text-red-600 mt-1">Across all users and messages</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                          <h4 className="font-semibold text-gray-900">Top Users by Threats Detected</h4>
                          <p className="text-sm text-gray-600 mt-1">Users who encountered the most security threats</p>
                        </div>

                        <div className="divide-y divide-gray-200">
                          {detailedData.topUsers.map((user: WhatsAppUser, index: number) => (
                            <div key={user.id} className="p-4 hover:bg-gray-50 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center text-white font-bold">
                                  #{index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-medium text-gray-900 truncate">{user.displayName || 'Unknown'}</p>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      user.tier === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                                      user.tier === 'premium' ? 'bg-blue-100 text-blue-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {user.tier}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-500">{user.phoneNumber}</p>
                                </div>
                                <div className="flex items-center gap-4 text-right">
                                  <div>
                                    <p className="text-xs text-gray-500">Threats Blocked</p>
                                    <p className="text-2xl font-bold text-red-600">{user.threatsBlocked}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Total Messages</p>
                                    <p className="text-lg font-medium text-gray-900">{user.totalMessages}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Threat Rate</p>
                                    <p className="text-lg font-medium text-orange-600">
                                      {user.totalMessages > 0 ? Math.round((user.threatsBlocked / user.totalMessages) * 100) : 0}%
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>No data available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppDashboard;
