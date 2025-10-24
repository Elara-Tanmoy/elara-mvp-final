import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, TrendingUp, DollarSign, Activity, AlertCircle, CheckCircle, RefreshCw, Download } from 'lucide-react';
import api from '../../lib/api';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [userAnalytics, setUserAnalytics] = useState<any>(null);
  const [usageAnalytics, setUsageAnalytics] = useState<any>(null);
  const [revenueAnalytics, setRevenueAnalytics] = useState<any>(null);
  const [systemAnalytics, setSystemAnalytics] = useState<any>(null);
  const [realtimeMetrics, setRealtimeMetrics] = useState<any>(null);

  useEffect(() => {
    loadAllAnalytics();

    // Refresh realtime metrics every 30 seconds
    const interval = setInterval(() => {
      loadRealtimeMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadAllAnalytics = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUserAnalytics(),
        loadUsageAnalytics(),
        loadRevenueAnalytics(),
        loadSystemAnalytics(),
        loadRealtimeMetrics()
      ]);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserAnalytics = async () => {
    try {
      const response = await api.get('/v2/admin/analytics/users?days=30');
      setUserAnalytics(response.data.data);
    } catch (error) {
      console.error('Error loading user analytics:', error);
    }
  };

  const loadUsageAnalytics = async () => {
    try {
      const response = await api.get('/v2/admin/analytics/usage?days=30');
      setUsageAnalytics(response.data.data);
    } catch (error) {
      console.error('Error loading usage analytics:', error);
    }
  };

  const loadRevenueAnalytics = async () => {
    try {
      const response = await api.get('/v2/admin/analytics/revenue?days=30');
      setRevenueAnalytics(response.data.data);
    } catch (error) {
      console.error('Error loading revenue analytics:', error);
    }
  };

  const loadSystemAnalytics = async () => {
    try {
      const response = await api.get('/v2/admin/analytics/system');
      setSystemAnalytics(response.data.data);
    } catch (error) {
      console.error('Error loading system analytics:', error);
    }
  };

  const loadRealtimeMetrics = async () => {
    try {
      const response = await api.get('/v2/admin/analytics/realtime');
      setRealtimeMetrics(response.data.data);
    } catch (error) {
      console.error('Error loading realtime metrics:', error);
    }
  };

  const exportData = async (type: 'users' | 'usage' | 'revenue' | 'system', format: 'csv' | 'json') => {
    try {
      const response = await api.get(`/v2/admin/analytics/export?type=${type}&format=${format}&days=30`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `elara-${type}-analytics-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data');
    }
  };

  if (loading && !userAnalytics) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Export Analytics Data</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">User Analytics</p>
            <div className="flex gap-2">
              <button
                onClick={() => exportData('users', 'csv')}
                className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={() => exportData('users', 'json')}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Download className="w-4 h-4" />
                JSON
              </button>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Usage Analytics</p>
            <div className="flex gap-2">
              <button
                onClick={() => exportData('usage', 'csv')}
                className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={() => exportData('usage', 'json')}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Download className="w-4 h-4" />
                JSON
              </button>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Revenue Analytics</p>
            <div className="flex gap-2">
              <button
                onClick={() => exportData('revenue', 'csv')}
                className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={() => exportData('revenue', 'json')}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Download className="w-4 h-4" />
                JSON
              </button>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">System Analytics</p>
            <div className="flex gap-2">
              <button
                onClick={() => exportData('system', 'csv')}
                className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={() => exportData('system', 'json')}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Download className="w-4 h-4" />
                JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Metrics */}
      {realtimeMetrics && (
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Live Metrics</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm">Updated {new Date(realtimeMetrics.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-sm opacity-90">Active Users (5 min)</div>
              <div className="text-3xl font-bold">{realtimeMetrics.activeUsers}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-sm opacity-90">Recent Scans (5 min)</div>
              <div className="text-3xl font-bold">{realtimeMetrics.recentScans}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-sm opacity-90">Recent Errors (5 min)</div>
              <div className="text-3xl font-bold">{realtimeMetrics.recentErrors}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-sm opacity-90">System Status</div>
              <div className="text-2xl font-bold flex items-center gap-2">
                {realtimeMetrics.systemStatus === 'healthy' ? (
                  <>
                    <CheckCircle className="w-6 h-6" />
                    Healthy
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-6 h-6" />
                    {realtimeMetrics.systemStatus}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {userAnalytics && (
          <>
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-sm text-green-600 font-medium">
                  +{userAnalytics.newUsersThisMonth} this month
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{userAnalytics.totalUsers.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Total Users</div>
              <div className="mt-2 text-xs text-gray-500">
                {userAnalytics.activeUsers} active • {userAnalytics.retentionRate.toFixed(1)}% retention
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-green-100 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-sm text-green-600 font-medium">
                  {userAnalytics.retentionRate.toFixed(1)}% retention
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{userAnalytics.churnRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Churn Rate</div>
              <div className="mt-2 text-xs text-gray-500">
                {userAnalytics.newUsersToday} new today
              </div>
            </div>
          </>
        )}

        {revenueAnalytics && (
          <>
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
                <span className="text-sm text-green-600 font-medium">
                  ${revenueAnalytics.monthlyRecurringRevenue.toFixed(0)} MRR
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                ${revenueAnalytics.totalRevenue.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Revenue</div>
              <div className="mt-2 text-xs text-gray-500">
                ${revenueAnalytics.averageRevenuePerUser.toFixed(2)} ARPU
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-orange-100 p-3 rounded-lg">
                  <Activity className="w-6 h-6 text-orange-600" />
                </div>
                <span className="text-sm text-green-600 font-medium">
                  {revenueAnalytics.conversionRate.toFixed(1)}% conversion
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                ${revenueAnalytics.lifetimeValue.toFixed(0)}
              </div>
              <div className="text-sm text-gray-600">Lifetime Value</div>
              <div className="mt-2 text-xs text-gray-500">
                12 month average
              </div>
            </div>
          </>
        )}
      </div>

      {/* User Growth Chart */}
      {userAnalytics && userAnalytics.userGrowth && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">User Growth (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={userAnalytics.userGrowth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} name="New Users" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Usage Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scan Trends */}
        {usageAnalytics && usageAnalytics.scanTrends && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Scan Activity (Last 30 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={usageAnalytics.scanTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} name="Scans" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Scans by Type */}
        {usageAnalytics && usageAnalytics.scansByType && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Scans by Type</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={usageAnalytics.scansByType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.type}: ${entry.count}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {usageAnalytics.scansByType.map((_entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Users by Tier and Revenue by Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users by Tier */}
        {userAnalytics && userAnalytics.usersByTier && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Users by Tier</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={userAnalytics.usersByTier}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tier" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8b5cf6" name="Users" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Revenue by Plan */}
        {revenueAnalytics && revenueAnalytics.revenueByPlan && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Revenue by Plan</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={revenueAnalytics.revenueByPlan}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.plan}: $${entry.revenue.toFixed(0)}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {revenueAnalytics.revenueByPlan.map((_entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* System Performance */}
      {systemAnalytics && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">System Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-600 mb-2">API Requests Today</div>
              <div className="text-3xl font-bold text-gray-900">{systemAnalytics.apiRequestsToday.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Total: {systemAnalytics.apiRequests.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-2">Avg Response Time</div>
              <div className="text-3xl font-bold text-gray-900">{systemAnalytics.averageResponseTime}ms</div>
              <div className="text-sm text-gray-500">Error Rate: {systemAnalytics.errorRate.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-2">Database Size</div>
              <div className="text-3xl font-bold text-gray-900">{systemAnalytics.databaseSize}MB</div>
              <div className="text-sm text-gray-500">Uptime: {systemAnalytics.uptime}%</div>
            </div>
          </div>

          {/* Top Endpoints */}
          {systemAnalytics.requestsByEndpoint && systemAnalytics.requestsByEndpoint.length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium mb-3">Top API Endpoints</h4>
              <div className="space-y-2">
                {systemAnalytics.requestsByEndpoint.slice(0, 5).map((endpoint: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{endpoint.endpoint}</div>
                      <div className="text-xs text-gray-500">{endpoint.count} requests • {endpoint.avgTime}ms avg</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{endpoint.count}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={loadAllAnalytics}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
