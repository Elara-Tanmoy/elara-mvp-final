import React, { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Database, Search, Download, RefreshCw, Filter, TrendingUp, Activity, AlertTriangle } from 'lucide-react';
import api from '../../lib/api';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

interface IntelligenceEvent {
  id: string;
  eventType: string;
  userId: string;
  organizationId: string | null;
  data: any;
  riskScore: number | null;
  riskLevel: string | null;
  timestamp: string;
  createdAt: string;
}

interface IntelligenceStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  totalScans: number;
  avgRiskScore: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
  topRiskLevels: Array<{ level: string; count: number }>;
}

const DataIntelligence: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<IntelligenceStats | null>(null);
  const [events, setEvents] = useState<IntelligenceEvent[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [riskLevelFilter, setRiskLevelFilter] = useState<string>('');
  const [limit, setLimit] = useState<number>(50);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadEvents(),
        loadAnalytics()
      ]);
    } catch (error) {
      console.error('Error loading intelligence data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/v2/intelligence/stats');
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadEvents = async () => {
    try {
      const params = new URLSearchParams();
      if (eventTypeFilter) params.append('eventType', eventTypeFilter);
      if (riskLevelFilter) params.append('riskLevel', riskLevelFilter);
      params.append('limit', limit.toString());

      const response = await api.get(`/v2/intelligence/events?${params.toString()}`);
      setEvents(response.data.events);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await api.get('/v2/intelligence/analytics?period=7d');
      setAnalytics(response.data.analytics);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadEvents();
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/v2/intelligence/search', {
        query: searchQuery,
        filters: {
          eventType: eventTypeFilter || undefined,
          riskLevel: riskLevelFilter || undefined
        },
        limit: limit
      });
      setEvents(response.data.results);
    } catch (error) {
      console.error('Error searching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportDataset = async (format: 'json' | 'jsonl' | 'csv') => {
    try {
      const params = new URLSearchParams();
      if (eventTypeFilter) params.append('eventType', eventTypeFilter);
      params.append('format', format);
      params.append('limit', '10000');

      const response = await api.get(`/v2/intelligence/export?${params.toString()}`, {
        responseType: format === 'json' ? 'json' : 'blob'
      });

      if (format === 'json') {
        // JSON format returns the data directly
        const jsonData = JSON.stringify(response.data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `elara-intelligence-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // JSONL and CSV return blob
        const blob = new Blob([response.data], {
          type: format === 'jsonl' ? 'application/x-ndjson' : 'text/csv'
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `elara-intelligence-${Date.now()}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting dataset:', error);
      alert('Failed to export dataset');
    }
  };

  const applyFilters = () => {
    loadEvents();
  };

  const clearFilters = () => {
    setEventTypeFilter('');
    setRiskLevelFilter('');
    setSearchQuery('');
    setLimit(50);
    // Reload with no filters
    setTimeout(() => {
      loadEvents();
    }, 100);
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Data Intelligence Platform</h1>
            <p className="text-purple-100">
              Captured data for LLM training, analytics, and research
            </p>
          </div>
          <Database className="w-16 h-16 opacity-50" />
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalEvents.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Events Captured</div>
            <div className="mt-2 text-xs text-gray-500">
              {Object.keys(stats.eventsByType).length} event types
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Search className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalScans.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Scans</div>
            <div className="mt-2 text-xs text-gray-500">
              {stats.eventsByType.search || 0} searches
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-orange-100 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.avgRiskScore.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Avg Risk Score</div>
            <div className="mt-2 text-xs text-gray-500">
              Across all scans
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-red-100 p-3 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.topRiskLevels[0]?.level || 'N/A'}
            </div>
            <div className="text-sm text-gray-600">Most Common Risk Level</div>
            <div className="mt-2 text-xs text-gray-500">
              {stats.topRiskLevels[0]?.count || 0} occurrences
            </div>
          </div>
        </div>
      )}

      {/* Export Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Export Dataset for LLM Training
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Export captured intelligence data in various formats for training Large Language Models,
          analytics, and research purposes.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => exportDataset('json')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Export JSON
          </button>
          <button
            onClick={() => exportDataset('jsonl')}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Download className="w-4 h-4" />
            Export JSONL (LLM Format)
          </button>
          <button
            onClick={() => exportDataset('csv')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filter Events
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Type
            </label>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Types</option>
              <option value="search">Search</option>
              <option value="scan">Scan</option>
              <option value="interaction">Interaction</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Risk Level
            </label>
            <select
              value={riskLevelFilter}
              onChange={(e) => setRiskLevelFilter(e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Limit
            </label>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="10">10</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="500">500</option>
              <option value="1000">1000</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={applyFilters}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Apply Filters
            </button>
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in event data (JSONB search)..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>
      </div>

      {/* Analytics Charts */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Events by Type */}
          {stats && stats.eventsByType && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Events by Type</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(stats.eventsByType).map(([type, count]) => ({
                      name: type,
                      value: count
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {Object.keys(stats.eventsByType).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Risk Distribution */}
          {analytics.riskDistribution && analytics.riskDistribution.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Risk Level Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.riskDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#8b5cf6" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Events Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Events</h3>
          <button
            onClick={loadEvents}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Event Type</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">User ID</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Risk Level</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Risk Score</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Timestamp</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Data Preview</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No events found. Capture will start automatically as users interact with the platform.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {event.eventType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 font-mono">
                      {event.userId.substring(0, 8)}...
                    </td>
                    <td className="py-3 px-4">
                      {event.riskLevel ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          event.riskLevel === 'critical' ? 'bg-red-100 text-red-800' :
                          event.riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                          event.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          event.riskLevel === 'low' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {event.riskLevel}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {event.riskScore !== null ? event.riskScore.toFixed(1) : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500 max-w-xs truncate">
                      {JSON.stringify(event.data).substring(0, 100)}...
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {events.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            Showing {events.length} events
          </div>
        )}
      </div>

      {/* Refresh All Button */}
      <div className="flex justify-end">
        <button
          onClick={loadAllData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh All Data
        </button>
      </div>
    </div>
  );
};

export default DataIntelligence;
