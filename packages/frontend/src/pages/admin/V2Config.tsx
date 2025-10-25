import React, { useState, useEffect } from 'react';
import { Loader2, Save, AlertCircle, CheckCircle, Zap, Settings as SettingsIcon, Database, Brain, TrendingUp } from 'lucide-react';
import api from '../../lib/api';

interface V2Config {
  enabled: boolean;
  shadowMode: boolean;
  rolloutPercentage: number;
  vertexAiEndpoint: string;
  geminiModel: string;
  maxConcurrentScans: number;
  cacheEnabled: boolean;
  cacheTTL: number;
}

interface V2Stats {
  totalScans: number;
  scansToday: number;
  averageScore: number;
  averageDuration: number;
  successRate: number;
  v1Scans: number;
  v2Scans: number;
  v2Percentage: number;
}

const V2Config: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<V2Config>({
    enabled: true,
    shadowMode: false,
    rolloutPercentage: 100,
    vertexAiEndpoint: '',
    geminiModel: 'gemini-1.5-pro',
    maxConcurrentScans: 10,
    cacheEnabled: true,
    cacheTTL: 3600
  });
  const [stats, setStats] = useState<V2Stats | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
    loadStats();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await api.get('/v2/admin/v2-config');
      setConfig(response.data.data);
    } catch (error: any) {
      console.error('Error loading V2 config:', error);
      setMessage({ type: 'error', text: 'Failed to load V2 configuration' });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/v2/admin/v2-stats');
      setStats(response.data.data);
    } catch (error: any) {
      console.error('Error loading V2 stats:', error);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await api.put('/v2/admin/v2-config', config);
      setMessage({ type: 'success', text: 'V2 configuration saved successfully!' });
      loadStats(); // Reload stats after config change
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to save V2 configuration'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with V2 Badge */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-full p-3">
              <Zap className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">V2 Scanner Configuration</h2>
              <p className="text-purple-100 text-sm">Manage V2 Enhanced Scanner settings and rollout</p>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-full font-bold text-sm ${
            config.enabled ? 'bg-green-400 text-green-900' : 'bg-red-400 text-red-900'
          }`}>
            {config.enabled ? 'V2 ACTIVE' : 'V2 DISABLED'}
          </div>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`flex items-center gap-3 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* V2 Statistics */}
      {stats && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            V2 Scanner Statistics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="text-2xl font-bold text-purple-900">{stats.totalScans}</div>
              <div className="text-sm text-purple-700">Total V2 Scans</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-2xl font-bold text-blue-900">{stats.scansToday}</div>
              <div className="text-sm text-blue-700">Scans Today</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-2xl font-bold text-green-900">{stats.successRate}%</div>
              <div className="text-sm text-green-700">Success Rate</div>
            </div>
            <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
              <div className="text-2xl font-bold text-pink-900">{stats.averageDuration}ms</div>
              <div className="text-sm text-pink-700">Avg Duration</div>
            </div>
          </div>

          {/* V1 vs V2 Comparison */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-3">V1 vs V2 Usage</h4>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>V2 Scans</span>
                  <span className="font-bold text-purple-600">{stats.v2Scans} ({stats.v2Percentage}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all"
                    style={{ width: `${stats.v2Percentage}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>V1 Scans</span>
                  <span className="font-bold text-gray-600">{stats.v1Scans} ({100 - stats.v2Percentage}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gray-600 h-2 rounded-full transition-all"
                    style={{ width: `${100 - stats.v2Percentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-purple-600" />
          Scanner Configuration
        </h3>

        <div className="space-y-6">
          {/* Enable V2 Toggle */}
          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div>
              <label className="font-semibold text-gray-900">Enable V2 Scanner</label>
              <p className="text-sm text-gray-600">Turn V2 enhanced scanner on or off globally</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Shadow Mode Toggle */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div>
              <label className="font-semibold text-gray-900">Shadow Mode</label>
              <p className="text-sm text-gray-600">Run V2 in background for testing (users see V1 results)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.shadowMode}
                onChange={(e) => setConfig({ ...config, shadowMode: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Rollout Percentage */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Rollout Percentage: {config.rolloutPercentage}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={config.rolloutPercentage}
              onChange={(e) => setConfig({ ...config, rolloutPercentage: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <p className="text-sm text-gray-600 mt-2">
              {config.rolloutPercentage}% of users will use V2 scanner
            </p>
          </div>

          {/* Gemini Configuration */}
          <div className="border-t pt-6">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              Gemini AI Configuration
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vertex AI Endpoint
                </label>
                <input
                  type="text"
                  value={config.vertexAiEndpoint}
                  onChange={(e) => setConfig({ ...config, vertexAiEndpoint: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="https://your-region-aiplatform.googleapis.com/v1/..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gemini Model
                </label>
                <select
                  value={config.geminiModel}
                  onChange={(e) => setConfig({ ...config, geminiModel: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  <option value="gemini-pro">Gemini Pro</option>
                </select>
              </div>
            </div>
          </div>

          {/* Performance Configuration */}
          <div className="border-t pt-6">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-600" />
              Performance Settings
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Concurrent Scans
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={config.maxConcurrentScans}
                  onChange={(e) => setConfig({ ...config, maxConcurrentScans: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="font-medium text-gray-900">Enable Caching</label>
                  <p className="text-sm text-gray-600">Cache scan results to improve performance</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.cacheEnabled}
                    onChange={(e) => setConfig({ ...config, cacheEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {config.cacheEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cache TTL (seconds)
                  </label>
                  <input
                    type="number"
                    min="60"
                    max="86400"
                    value={config.cacheTTL}
                    onChange={(e) => setConfig({ ...config, cacheTTL: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={saveConfig}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default V2Config;
