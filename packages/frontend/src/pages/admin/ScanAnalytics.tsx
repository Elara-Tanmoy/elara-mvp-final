import React, { useState, useEffect } from 'react';
import { Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Shield, TrendingUp, AlertTriangle, Clock, Download, RefreshCw, Eye, Filter, Database, Zap } from 'lucide-react';
import api from '../../lib/api';

const COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#f59e0b',
  low: '#3b82f6',
  safe: '#10b981'
};

const CHART_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

interface ScanOverview {
  totalScans: number;
  completedScans: number;
  pendingScans: number;
  avgRiskScore: number;
  completionRate: number;
}

const ScanAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('30');

  // Overview data
  const [overview, setOverview] = useState<ScanOverview | null>(null);
  const [riskDistribution, setRiskDistribution] = useState<any[]>([]);
  const [scansByType, setScansByType] = useState<any[]>([]);
  const [scanTrends, setScanTrends] = useState<any[]>([]);
  const [topThreats, setTopThreats] = useState<any[]>([]);

  // Realtime metrics
  const [realtimeMetrics, setRealtimeMetrics] = useState<any>(null);

  // Detailed scans
  const [detailedScans, setDetailedScans] = useState<any[]>([]);
  const [selectedScan, setSelectedScan] = useState<any>(null);
  const [showRawData, setShowRawData] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    riskLevel: '',
    scanType: '',
    status: ''
  });

  useEffect(() => {
    loadAllData();

    // Refresh realtime metrics every 30 seconds
    const interval = setInterval(() => {
      loadRealtimeMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, [period]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadOverview(),
        loadRealtimeMetrics(),
        loadDetailedScans()
      ]);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOverview = async () => {
    try {
      const response = await api.get(`/v2/analytics/scans/overview?period=${period}`);
      const data = response.data;

      setOverview(data.overview);
      setRiskDistribution(data.riskDistribution);
      setScansByType(data.scansByType);
      setScanTrends(data.scanTrends);
      setTopThreats(data.topThreats);
    } catch (error) {
      console.error('Error loading overview:', error);
    }
  };

  const loadRealtimeMetrics = async () => {
    try {
      const response = await api.get('/v2/analytics/scans/realtime');
      setRealtimeMetrics(response.data.realtime);
    } catch (error) {
      console.error('Error loading realtime metrics:', error);
    }
  };

  const loadDetailedScans = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.riskLevel) params.append('riskLevel', filters.riskLevel);
      if (filters.scanType) params.append('scanType', filters.scanType);
      if (filters.status) params.append('status', filters.status);
      params.append('limit', '50');

      const response = await api.get(`/v2/analytics/scans/detailed?${params.toString()}`);
      setDetailedScans(response.data.scans);
    } catch (error) {
      console.error('Error loading detailed scans:', error);
    }
  };

  const loadRawScanData = async (scanId: string) => {
    try {
      const response = await api.get(`/v2/analytics/scans/raw/${scanId}`);
      setSelectedScan(response.data.scan);
      setShowRawData(true);
    } catch (error) {
      console.error('Error loading raw scan data:', error);
    }
  };

  const exportData = async (format: 'json' | 'csv') => {
    try {
      const response = await api.get(`/v2/analytics/scans/export?format=${format}&period=${period}`, {
        responseType: format === 'csv' ? 'blob' : 'json'
      });

      if (format === 'csv') {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `scan-analytics-${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        const jsonData = JSON.stringify(response.data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `scan-analytics-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data');
    }
  };

  const applyFilters = () => {
    loadDetailedScans();
  };

  const clearFilters = () => {
    setFilters({ riskLevel: '', scanType: '', status: '' });
    setTimeout(() => loadDetailedScans(), 100);
  };

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <Shield className="w-8 h-8" />
              Scan Analytics Dashboard
            </h1>
            <p className="text-blue-100">
              Enterprise-grade analytics and visualization for URL scan data
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white font-medium"
            >
              <option value="7" className="text-gray-900">Last 7 Days</option>
              <option value="30" className="text-gray-900">Last 30 Days</option>
              <option value="90" className="text-gray-900">Last 90 Days</option>
            </select>
            <button
              onClick={loadAllData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg hover:bg-white/30 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Metrics Banner */}
      {realtimeMetrics && (
        <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-6 h-6" />
              Live Metrics
            </h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm">Last 5 minutes</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-sm opacity-90">Recent Scans</div>
              <div className="text-3xl font-bold">{realtimeMetrics.recentScans}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-sm opacity-90">Critical/High Risk</div>
              <div className="text-3xl font-bold">{realtimeMetrics.criticalScans}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-sm opacity-90">Avg Risk Score</div>
              <div className="text-3xl font-bold">{realtimeMetrics.avgRiskScore.toFixed(1)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Cards */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{overview.totalScans.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Scans</div>
            <div className="mt-2 text-xs text-gray-500">
              {overview.completedScans.toLocaleString()} completed
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{overview.completionRate.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">Completion Rate</div>
            <div className="mt-2 text-xs text-gray-500">
              {overview.pendingScans} pending
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-orange-100 p-3 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{overview.avgRiskScore.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Avg Risk Score</div>
            <div className="mt-2 text-xs text-gray-500">
              Across all completed scans
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{period} days</div>
            <div className="text-sm text-gray-600">Analysis Period</div>
            <div className="mt-2">
              <div className="flex gap-2">
                <button
                  onClick={() => exportData('json')}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                >
                  <Download className="w-3 h-3" />
                  JSON
                </button>
                <button
                  onClick={() => exportData('csv')}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                >
                  <Download className="w-3 h-3" />
                  CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution */}
        {riskDistribution.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Risk Level Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.level}: ${entry.count}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.level as keyof typeof COLORS] || CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Scans by Type */}
        {scansByType.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Scans by Type</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scansByType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8b5cf6" name="Scans" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Scan Trends Over Time */}
      {scanTrends.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Scan Activity Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={scanTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="scan_count"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.6}
                name="Scan Count"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avg_risk"
                stroke="#ef4444"
                strokeWidth={2}
                name="Avg Risk Score"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Threats */}
      {topThreats.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Top Threat Categories</h3>
          <div className="space-y-3">
            {topThreats.slice(0, 10).map((threat: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 font-bold text-sm">{index + 1}</span>
                  </div>
                  <div>
                    <div className="font-medium">{threat.threat_category || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{threat.count} occurrences</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">{threat.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filter Detailed Scans
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Risk Level</label>
            <select
              value={filters.riskLevel}
              onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Levels</option>
              <option value="safe">Safe</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Scan Type</label>
            <select
              value={filters.scanType}
              onChange={(e) => setFilters({ ...filters, scanType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Types</option>
              <option value="url">URL</option>
              <option value="message">Message</option>
              <option value="file">File</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={applyFilters}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Apply
            </button>
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Scans Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Detailed Scan Data</h3>
          <span className="text-sm text-gray-600">{detailedScans.length} scans</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">URL/Content</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Risk Level</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Score</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Duration</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {detailedScans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    No scans found with the selected filters
                  </td>
                </tr>
              ) : (
                detailedScans.map((scan) => (
                  <tr key={scan.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {scan.scanType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                      {scan.url || scan.fileName || scan.content?.substring(0, 50)}
                    </td>
                    <td className="py-3 px-4">
                      {scan.riskLevel ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          scan.riskLevel === 'critical' ? 'bg-red-100 text-red-800' :
                          scan.riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                          scan.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          scan.riskLevel === 'low' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {scan.riskLevel}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {scan.riskScore !== null ? scan.riskScore.toFixed(1) : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        scan.status === 'completed' ? 'bg-green-100 text-green-800' :
                        scan.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {scan.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {scan.scanDuration ? `${(scan.scanDuration / 1000).toFixed(2)}s` : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(scan.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => loadRawScanData(scan.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                      >
                        <Eye className="w-3 h-3" />
                        Raw Data
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Data Modal */}
      {showRawData && selectedScan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold">Raw Scan Data</h3>
              <button
                onClick={() => setShowRawData(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-auto flex-1">
              <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto">
                {JSON.stringify(selectedScan, null, 2)}
              </pre>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(selectedScan, null, 2)], { type: 'application/json' });
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `scan-${selectedScan.id}.json`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="w-4 h-4 inline mr-2" />
                Download JSON
              </button>
              <button
                onClick={() => setShowRawData(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanAnalytics;
