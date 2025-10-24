import React, { useState, useEffect } from 'react';
import { Shield, Database, RefreshCw, AlertTriangle, CheckCircle, Clock, TrendingUp, Globe } from 'lucide-react';
import api from '../../lib/api';

interface ThreatSource {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  totalIndicators: number;
  syncFrequency: number;
  lastSyncStatus: string;
  lastSyncDelta: {
    added: number;
    updated: number;
    removed: number;
  };
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  nextSyncAt: string;
  syncIntervalMinutes: number;
}

interface ThreatIndicator {
  id: string;
  type: string;
  value: string;
  threatType: string;
  severity: string;
  confidence: number;
  description: string | null;
  firstSeen: string;
  lastSeen: string;
  source: {
    name: string;
    type: string;
  };
}

interface ThreatStats {
  totalSources: number;
  activeSources: number;
  totalIndicators: number;
  indicatorsByType: Record<string, number>;
  indicatorsBySeverity: Record<string, number>;
  lastSyncTime: string | null;
}

const ThreatIntelligence: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ThreatStats | null>(null);
  const [sources, setSources] = useState<ThreatSource[]>([]);
  const [indicators, setIndicators] = useState<ThreatIndicator[]>([]);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadSources(),
        loadIndicators(),
        loadSyncHistory()
      ]);
    } catch (error) {
      console.error('Error loading threat intelligence data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/v2/threat-intel/stats');
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadSources = async () => {
    try {
      const response = await api.get('/v2/threat-intel/sources');
      setSources(response.data.sources);
    } catch (error) {
      console.error('Error loading sources:', error);
    }
  };

  const loadIndicators = async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.append('type', typeFilter);
      if (severityFilter) params.append('severity', severityFilter);
      if (sourceFilter) params.append('sourceId', sourceFilter);
      params.append('limit', '50');

      const response = await api.get(`/v2/threat-intel/indicators?${params.toString()}`);
      setIndicators(response.data.indicators);
    } catch (error) {
      console.error('Error loading indicators:', error);
    }
  };

  const loadSyncHistory = async () => {
    try {
      const response = await api.get('/v2/threat-intel/sync-history?limit=10');
      setSyncHistory(response.data.syncs);
    } catch (error) {
      console.error('Error loading sync history:', error);
    }
  };

  const triggerSync = async (sourceId?: string) => {
    setSyncing(true);
    try {
      await api.post('/v2/threat-intel/sync', { sourceId });
      alert(sourceId ? 'Source sync initiated!' : 'All sources sync initiated!');
      // Wait a bit then reload
      setTimeout(() => {
        loadAllData();
      }, 2000);
    } catch (error) {
      console.error('Error triggering sync:', error);
      alert('Failed to trigger sync');
    } finally {
      setSyncing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
      <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Threat Intelligence Platform</h1>
            <p className="text-red-100">
              Real-time threat data from PhishTank, URLhaus, OpenPhish, MalwareBazaar, and ThreatFox
            </p>
          </div>
          <Shield className="w-16 h-16 opacity-50" />
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-red-100 p-3 rounded-lg">
                <Database className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalIndicators.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Threat Indicators</div>
            <div className="mt-2 text-xs text-gray-500">
              From {stats.totalSources} sources
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.activeSources}
            </div>
            <div className="text-sm text-gray-600">Active Sources</div>
            <div className="mt-2 text-xs text-gray-500">
              Out of {stats.totalSources} total
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-orange-100 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {Object.keys(stats.indicatorsByType).length}
            </div>
            <div className="text-sm text-gray-600">Indicator Types</div>
            <div className="mt-2 text-xs text-gray-500">
              URL, Domain, IP, Hash, Email
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="text-lg font-bold text-gray-900">
              {stats.lastSyncTime ? new Date(stats.lastSyncTime).toLocaleTimeString() : 'N/A'}
            </div>
            <div className="text-sm text-gray-600">Last Sync</div>
            <div className="mt-2 text-xs text-gray-500">
              {stats.lastSyncTime ? new Date(stats.lastSyncTime).toLocaleDateString() : 'Never'}
            </div>
          </div>
        </div>
      )}

      {/* Threat Sources */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Threat Feed Sources
          </h3>
          <button
            onClick={() => triggerSync()}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync All Sources
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((source) => (
            <div key={source.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">{source.name}</h4>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  source.lastSyncStatus === 'success' ? 'bg-green-100 text-green-800' :
                  source.lastSyncStatus === 'failed' ? 'bg-red-100 text-red-800' :
                  source.lastSyncStatus === 'running' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {source.lastSyncStatus === 'success' ? '✓ Success' :
                   source.lastSyncStatus === 'failed' ? '✗ Failed' :
                   source.lastSyncStatus === 'running' ? '⟳ Running' :
                   '○ Never'}
                </span>
              </div>

              {/* Indicators Count */}
              <div className="mb-3 pb-3 border-b border-gray-200">
                <div className="text-2xl font-bold text-gray-900">{source.totalIndicators.toLocaleString()}</div>
                <div className="text-xs text-gray-600">Total Indicators</div>
              </div>

              {/* Last Sync Delta */}
              {source.lastSyncDelta && (source.lastSyncDelta.added > 0 || source.lastSyncDelta.updated > 0) && (
                <div className="mb-3 pb-3 border-b border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Last Sync Changes:</div>
                  <div className="flex gap-3 text-xs">
                    {source.lastSyncDelta.added > 0 && (
                      <span className="text-green-600">+{source.lastSyncDelta.added} added</span>
                    )}
                    {source.lastSyncDelta.updated > 0 && (
                      <span className="text-blue-600">{source.lastSyncDelta.updated} updated</span>
                    )}
                    {source.lastSyncDelta.removed > 0 && (
                      <span className="text-red-600">-{source.lastSyncDelta.removed} removed</span>
                    )}
                  </div>
                </div>
              )}

              {/* Severity Breakdown */}
              {source.severityCounts && (
                <div className="mb-3 pb-3 border-b border-gray-200">
                  <div className="text-xs text-gray-600 mb-2">Severity Distribution:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {source.severityCounts.critical > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-red-600">Critical</span>
                        <span className="font-medium">{source.severityCounts.critical}</span>
                      </div>
                    )}
                    {source.severityCounts.high > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-orange-600">High</span>
                        <span className="font-medium">{source.severityCounts.high}</span>
                      </div>
                    )}
                    {source.severityCounts.medium > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-yellow-600">Medium</span>
                        <span className="font-medium">{source.severityCounts.medium}</span>
                      </div>
                    )}
                    {source.severityCounts.low > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-blue-600">Low</span>
                        <span className="font-medium">{source.severityCounts.low}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sync Schedule */}
              <div className="space-y-1 text-xs text-gray-600 mb-3">
                <div className="flex items-center justify-between">
                  <span>Sync Interval:</span>
                  <span className="font-medium">
                    {source.syncIntervalMinutes >= 1440
                      ? `${Math.floor(source.syncIntervalMinutes / 1440)} day(s)`
                      : source.syncIntervalMinutes >= 60
                      ? `${Math.floor(source.syncIntervalMinutes / 60)} hour(s)`
                      : `${source.syncIntervalMinutes} min`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last Sync:</span>
                  <span className="font-medium">
                    {source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleTimeString() : 'Never'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Next Sync:</span>
                  <span className="font-medium text-blue-600">
                    {new Date(source.nextSyncAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Error Display */}
              {source.lastError && (
                <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
                  <div className="text-red-800 text-xs font-medium mb-1">Error:</div>
                  <div className="text-red-600 text-xs">{source.lastError}</div>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={() => triggerSync(source.id)}
                disabled={syncing || !source.enabled}
                className="mt-2 w-full px-3 py-2 text-sm font-medium bg-gradient-to-r from-red-600 to-orange-600 text-white rounded hover:from-red-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Filter Indicators</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Types</option>
              <option value="url">URL</option>
              <option value="domain">Domain</option>
              <option value="ip">IP Address</option>
              <option value="hash">File Hash</option>
              <option value="email">Email</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Sources</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>{source.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={loadIndicators}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Threat Indicators Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Threat Indicators
          </h3>
          <button
            onClick={loadIndicators}
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
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Value</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Threat Type</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Severity</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Source</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {indicators.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    {loading ? 'Loading indicators...' : 'No threat indicators found. Sync sources to populate data.'}
                  </td>
                </tr>
              ) : (
                indicators.map((indicator) => (
                  <tr key={indicator.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {indicator.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 font-mono max-w-xs truncate">
                      {indicator.value}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {indicator.threatType}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        getSeverityColor(indicator.severity)
                      }`}>
                        {indicator.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {indicator.source.name}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(indicator.lastSeen).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {indicators.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            Showing {indicators.length} indicators
          </div>
        )}
      </div>

      {/* Sync History */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Recent Sync History
        </h3>

        <div className="space-y-3">
          {syncHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No sync history available
            </div>
          ) : (
            syncHistory.map((sync) => (
              <div key={sync.id} className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{sync.source.name}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      sync.status === 'success' ? 'bg-green-100 text-green-800' :
                      sync.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {sync.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Added: {sync.indicatorsAdded} | Updated: {sync.indicatorsUpdated} | Removed: {sync.indicatorsRemoved}
                  </div>
                  {sync.errorMessage && (
                    <div className="text-sm text-red-600 mt-1">Error: {sync.errorMessage}</div>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(sync.startedAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
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

export default ThreatIntelligence;
