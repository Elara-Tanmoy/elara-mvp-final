import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield, Users, CreditCard, Settings as SettingsIcon, Zap, Link2, BarChart3,
  Edit2, Trash2, Save, Plus, X, Loader2, CheckCircle, XCircle, Activity, Key, Webhook
} from 'lucide-react';
import api from '../lib/api';
import Dashboard from './admin/Dashboard';
import ApiKeys from './admin/ApiKeys';
import Webhooks from './admin/Webhooks';

type TabType = 'dashboard' | 'users' | 'subscriptions' | 'settings' | 'rate-limits' | 'integrations' | 'analytics' | 'api-keys' | 'webhooks';

interface DashboardStats {
  users: {
    total: number;
    active: number;
    admins: number;
    byTier: { tier: string; count: number }[];
  };
  activity: {
    totalScans: number;
    scansToday: number;
    totalSessions: number;
    sessionsToday: number;
  };
  systemHealth: {
    database: string;
    redis: string;
    anthropic: string;
  };
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tier: string;
  isActive: boolean;
  organizationName?: string;
  createdAt: string;
}

interface Subscription {
  id: string;
  organizationName: string;
  plan: string;
  status: string;
  startDate: string;
  endDate?: string;
  autoRenew: boolean;
  pricePerMonth?: number;
}

interface SystemSetting {
  id: string;
  key: string;
  value: any;
  category: string;
  description?: string;
  isPublic: boolean;
}

interface RateLimitConfig {
  id: string;
  tier: string;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  maxFileSize: number;
  maxScansPerDay: number;
}

interface Integration {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  status: string;
  lastSyncAt?: string;
}

const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Dashboard state
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState({ role: '', tier: '', isActive: '' });
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  // Settings state
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [showAddSetting, setShowAddSetting] = useState(false);
  const [newSetting, setNewSetting] = useState({ key: '', value: '', category: '', description: '' });

  // Rate Limits state
  const [rateLimits, setRateLimits] = useState<RateLimitConfig[]>([]);
  const [editingRateLimit, setEditingRateLimit] = useState<string | null>(null);

  // Integrations state
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  // Check admin access
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Load data based on active tab
  useEffect(() => {
    loadTabData();
  }, [activeTab, currentPage, userSearch, userFilter]);

  const loadTabData = async () => {
    try {
      setLoading(true);

      switch (activeTab) {
        case 'dashboard':
          await loadDashboard();
          break;
        case 'users':
          await loadUsers();
          break;
        case 'subscriptions':
          await loadSubscriptions();
          break;
        case 'settings':
          await loadSettings();
          break;
        case 'rate-limits':
          await loadRateLimits();
          break;
        case 'integrations':
          await loadIntegrations();
          break;
        case 'analytics':
          // Analytics will be loaded separately
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    const response = await api.get('/v2/admin/dashboard/stats');
    setStats(response.data.data);
  };

  const loadUsers = async () => {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: '20',
      ...(userSearch && { search: userSearch }),
      ...(userFilter.role && { role: userFilter.role }),
      ...(userFilter.tier && { tier: userFilter.tier }),
      ...(userFilter.isActive && { isActive: userFilter.isActive })
    });

    const response = await api.get(`/v2/admin/users?${params}`);
    setUsers(response.data.data.users);
    setTotalUsers(response.data.data.total);
  };

  const loadSubscriptions = async () => {
    const response = await api.get('/v2/admin/subscriptions');
    setSubscriptions(response.data.data);
  };

  const loadSettings = async () => {
    const response = await api.get('/v2/admin/settings');
    setSettings(response.data.data);
  };

  const loadRateLimits = async () => {
    const response = await api.get('/v2/admin/rate-limits');
    setRateLimits(response.data.data);
  };

  const loadIntegrations = async () => {
    const response = await api.get('/v2/admin/integrations');
    setIntegrations(response.data.data);
  };

  const updateUserRole = async (userId: string, role: string) => {
    try {
      await api.patch(`/v2/admin/users/${userId}/role`, { role });
      loadUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Failed to update user role');
    }
  };

  const toggleUserStatus = async (userId: string) => {
    try {
      await api.patch(`/v2/admin/users/${userId}/toggle-status`);
      loadUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      alert('Failed to toggle user status');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await api.delete(`/v2/admin/users/${userId}`);
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  const changeTier = async (userId: string, newTier: string) => {
    try {
      // Update user's organization tier
      await api.patch(`/v2/admin/users/${userId}/tier`, { tier: newTier });
      loadUsers();
    } catch (error) {
      console.error('Error changing user tier:', error);
      alert('Failed to change user tier');
    }
  };

  const createSetting = async () => {
    try {
      setSaving(true);
      let value = newSetting.value;
      try {
        value = JSON.parse(newSetting.value);
      } catch {
        // Keep as string if not valid JSON
      }

      await api.post('/v2/admin/settings', {
        key: newSetting.key,
        value,
        category: newSetting.category,
        description: newSetting.description
      });

      setShowAddSetting(false);
      setNewSetting({ key: '', value: '', category: '', description: '' });
      loadSettings();
    } catch (error) {
      console.error('Error creating setting:', error);
      alert('Failed to create setting');
    } finally {
      setSaving(false);
    }
  };

  const updateRateLimit = async (tier: string, updates: Partial<RateLimitConfig>) => {
    try {
      await api.put(`/v2/admin/rate-limits/${tier}`, updates);
      setEditingRateLimit(null);
      loadRateLimits();
    } catch (error) {
      console.error('Error updating rate limit:', error);
      alert('Failed to update rate limit');
    }
  };

  const toggleIntegration = async (id: string, enabled: boolean) => {
    try {
      await api.patch(`/v2/admin/integrations/${id}`, { enabled });
      loadIntegrations();
    } catch (error) {
      console.error('Error toggling integration:', error);
      alert('Failed to toggle integration');
    }
  };

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: BarChart3 },
    { id: 'analytics' as TabType, label: 'Analytics', icon: Activity },
    { id: 'users' as TabType, label: 'Users', icon: Users },
    { id: 'subscriptions' as TabType, label: 'Subscriptions', icon: CreditCard },
    { id: 'api-keys' as TabType, label: 'API Keys', icon: Key },
    { id: 'webhooks' as TabType, label: 'Webhooks', icon: Webhook },
    { id: 'settings' as TabType, label: 'Settings', icon: SettingsIcon },
    { id: 'rate-limits' as TabType, label: 'Rate Limits', icon: Zap },
    { id: 'integrations' as TabType, label: 'Integrations', icon: Link2 }
  ];

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600 mt-2">Manage all aspects of Elara Platform</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Shield className="w-5 h-5" />
          <span>Administrator</span>
        </div>
      </div>

      {/* Tabs - ENHANCED for Mobile/Tablet Responsiveness */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden relative">
        {/* Scroll indicator gradient for mobile */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none z-10 lg:hidden"></div>

        <nav className="flex gap-1 sm:gap-2 overflow-x-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent scroll-smooth">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all whitespace-nowrap text-xs sm:text-sm md:text-base flex-shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-primary-600 to-purple-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${isActive ? 'animate-pulse' : ''}`} />
                <span className="hidden xs:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
          ) : stats && stats.users && stats.activity && stats.systemHealth && (
            <>
              {/* Stats Grid - RESPONSIVE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-md p-4 sm:p-6 border border-blue-200 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-blue-700 font-medium">Total Users</p>
                      <p className="text-2xl sm:text-3xl font-bold text-blue-900 mt-1">{stats.users?.total || 0}</p>
                      <p className="text-xs text-blue-600 mt-1">{stats.users?.active || 0} active</p>
                    </div>
                    <Users className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-md p-4 sm:p-6 border border-green-200 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-green-700 font-medium">Scans Today</p>
                      <p className="text-2xl sm:text-3xl font-bold text-green-900 mt-1">{stats.activity?.scansToday || 0}</p>
                      <p className="text-xs text-green-600 mt-1">{stats.activity?.totalScans || 0} total</p>
                    </div>
                    <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-md p-4 sm:p-6 border border-purple-200 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-purple-700 font-medium">Sessions Today</p>
                      <p className="text-2xl sm:text-3xl font-bold text-purple-900 mt-1">{stats.activity?.sessionsToday || 0}</p>
                      <p className="text-xs text-purple-600 mt-1">{stats.activity?.totalSessions || 0} total</p>
                    </div>
                    <Activity className="w-8 h-8 sm:w-10 sm:h-10 text-purple-600" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg shadow-md p-4 sm:p-6 border border-red-200 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-red-700 font-medium">Admin Users</p>
                      <p className="text-2xl sm:text-3xl font-bold text-red-900 mt-1">{stats.users?.admins || 0}</p>
                      <p className="text-xs text-red-600 mt-1">With admin access</p>
                    </div>
                    <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" />
                  </div>
                </div>
              </div>

              {/* Users by Tier */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Users by Tier</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {stats.users.byTier && stats.users.byTier.length > 0 ? (
                    stats.users.byTier.map((tier) => (
                      <div key={tier.tier} className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-gray-900">{tier.count}</p>
                        <p className="text-sm text-gray-600 capitalize">{tier.tier}</p>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-4 text-center p-4 text-gray-500">
                      No tier data available
                    </div>
                  )}
                </div>
              </div>

              {/* System Health */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">System Health</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {stats.systemHealth && Object.keys(stats.systemHealth).length > 0 ? (
                    Object.entries(stats.systemHealth).map(([service, status]) => (
                      <div key={service} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-900 capitalize">{service}</span>
                        {status === 'connected' || status === 'healthy' ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-600" />
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-3 text-center p-4 text-gray-500">
                      No system health data available
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Search and Filters */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users by email or name..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
              <select
                value={userFilter.role}
                onChange={(e) => setUserFilter({ ...userFilter, role: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="">All Roles</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
              <select
                value={userFilter.tier}
                onChange={(e) => setUserFilter({ ...userFilter, tier: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="">All Tiers</option>
                <option value="free">Free</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <select
                value={userFilter.isActive}
                onChange={(e) => setUserFilter({ ...userFilter, isActive: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">User</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Organization</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Role</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Tier</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">{user.organizationName || 'N/A'}</td>
                        <td className="py-3 px-4">
                          <select
                            value={user.role}
                            onChange={(e) => updateUserRole(user.id, e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            <option value="owner">Owner</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={user.tier}
                            onChange={(e) => changeTier(user.id, e.target.value)}
                            className={`border border-gray-300 rounded px-2 py-1 text-sm font-medium ${
                              user.tier === 'enterprise' ? 'bg-purple-50 text-purple-800' :
                              user.tier === 'premium' ? 'bg-blue-50 text-blue-800' :
                              'bg-gray-50 text-gray-800'
                            }`}
                          >
                            <option value="free">Free</option>
                            <option value="premium">Premium</option>
                            <option value="enterprise">Enterprise</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => toggleUserStatus(user.id)}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {(currentPage - 1) * 20 + 1} to {Math.min(currentPage * 20, totalUsers)} of {totalUsers} users
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage * 20 >= totalUsers}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Organization</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Plan</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Start Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">End Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Auto-Renew</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Price/Month</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {subscriptions.map((sub) => (
                    <tr key={sub.id}>
                      <td className="py-3 px-4 font-medium text-gray-900">{sub.organizationName}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          sub.plan === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                          sub.plan.includes('premium') ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {sub.plan}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          sub.status === 'active' ? 'bg-green-100 text-green-800' :
                          sub.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(sub.startDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {sub.endDate ? new Date(sub.endDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        {sub.autoRenew ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-400" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {sub.pricePerMonth ? `$${sub.pricePerMonth}` : 'Free'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddSetting(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-5 h-5" />
              Add Setting
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {settings.map((setting) => (
                  <div key={setting.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold text-gray-900">{setting.key}</h4>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            {setting.category}
                          </span>
                          {setting.isPublic && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                              Public
                            </span>
                          )}
                        </div>
                        {setting.description && (
                          <p className="text-sm text-gray-600 mt-1">{setting.description}</p>
                        )}
                        <pre className="mt-2 p-3 bg-gray-50 rounded text-sm overflow-x-auto">
                          {JSON.stringify(setting.value, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Setting Modal */}
          {showAddSetting && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
                <h3 className="text-xl font-bold mb-4">Add System Setting</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Key</label>
                    <input
                      type="text"
                      value={newSetting.key}
                      onChange={(e) => setNewSetting({ ...newSetting, key: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="setting.key.name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Value (JSON)</label>
                    <textarea
                      value={newSetting.value}
                      onChange={(e) => setNewSetting({ ...newSetting, value: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3 font-mono text-sm"
                      rows={4}
                      placeholder='{"example": "value"}'
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <input
                      type="text"
                      value={newSetting.category}
                      onChange={(e) => setNewSetting({ ...newSetting, category: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="general, security, features"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <input
                      type="text"
                      value={newSetting.description}
                      onChange={(e) => setNewSetting({ ...newSetting, description: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="What this setting controls..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowAddSetting(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createSetting}
                    disabled={!newSetting.key || !newSetting.value || saving}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {saving ? 'Adding...' : 'Add Setting'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rate Limits Tab */}
      {activeTab === 'rate-limits' && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
          ) : (
            rateLimits.map((limit) => (
              <div key={limit.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold capitalize">{limit.tier} Tier</h3>
                  {editingRateLimit === limit.tier ? (
                    <button
                      onClick={() => setEditingRateLimit(null)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditingRateLimit(limit.tier)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Requests/Minute
                    </label>
                    <input
                      type="number"
                      value={limit.requestsPerMinute}
                      onChange={(e) => {
                        const newLimits = rateLimits.map(l =>
                          l.tier === limit.tier ? { ...l, requestsPerMinute: parseInt(e.target.value) } : l
                        );
                        setRateLimits(newLimits);
                      }}
                      disabled={editingRateLimit !== limit.tier}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Requests/Hour
                    </label>
                    <input
                      type="number"
                      value={limit.requestsPerHour}
                      onChange={(e) => {
                        const newLimits = rateLimits.map(l =>
                          l.tier === limit.tier ? { ...l, requestsPerHour: parseInt(e.target.value) } : l
                        );
                        setRateLimits(newLimits);
                      }}
                      disabled={editingRateLimit !== limit.tier}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Requests/Day
                    </label>
                    <input
                      type="number"
                      value={limit.requestsPerDay}
                      onChange={(e) => {
                        const newLimits = rateLimits.map(l =>
                          l.tier === limit.tier ? { ...l, requestsPerDay: parseInt(e.target.value) } : l
                        );
                        setRateLimits(newLimits);
                      }}
                      disabled={editingRateLimit !== limit.tier}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max File Size (MB)
                    </label>
                    <input
                      type="number"
                      value={limit.maxFileSize}
                      onChange={(e) => {
                        const newLimits = rateLimits.map(l =>
                          l.tier === limit.tier ? { ...l, maxFileSize: parseInt(e.target.value) } : l
                        );
                        setRateLimits(newLimits);
                      }}
                      disabled={editingRateLimit !== limit.tier}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Scans/Day
                    </label>
                    <input
                      type="number"
                      value={limit.maxScansPerDay}
                      onChange={(e) => {
                        const newLimits = rateLimits.map(l =>
                          l.tier === limit.tier ? { ...l, maxScansPerDay: parseInt(e.target.value) } : l
                        );
                        setRateLimits(newLimits);
                      }}
                      disabled={editingRateLimit !== limit.tier}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50"
                    />
                  </div>
                </div>

                {editingRateLimit === limit.tier && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => updateRateLimit(limit.tier, limit)}
                      className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Save className="w-4 h-4" />
                      Save Changes
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {integrations.map((integration) => (
                <div key={integration.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold text-gray-900">{integration.name}</h4>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {integration.type}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          integration.status === 'active' ? 'bg-green-100 text-green-800' :
                          integration.status === 'error' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {integration.status}
                        </span>
                      </div>
                      {integration.lastSyncAt && (
                        <p className="text-sm text-gray-600 mt-1">
                          Last sync: {new Date(integration.lastSyncAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleIntegration(integration.id, !integration.enabled)}
                      className={`px-4 py-2 rounded-lg font-medium ${
                        integration.enabled
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {integration.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && <Dashboard />}

      {/* API Keys Tab */}
      {activeTab === 'api-keys' && <ApiKeys />}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && <Webhooks />}
    </div>
  );
};

export default AdminPanel;
