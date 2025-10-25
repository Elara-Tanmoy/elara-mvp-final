/**
 * V2 Scanner Configuration Dashboard
 *
 * Complete admin interface for managing V2 scan engine:
 * - Enable/Disable V2 globally
 * - Rollout percentage control (0-100%)
 * - Shadow mode toggle
 * - Organization-specific enablement
 * - Vertex AI endpoint configuration
 * - Stage thresholds (Stage-1, Stage-2)
 * - Branch-specific thresholds (ONLINE/OFFLINE/WAF/PARKED)
 * - Model weights (lexical, tabular, text, screenshot)
 * - V1 vs V2 comparison testing
 * - Statistics & monitoring
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Settings,
  Power,
  Sliders,
  GitBranch,
  TrendingUp,
  Database,
  Eye,
  EyeOff,
  Users,
  BarChart3,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Save,
  TestTube2,
  Zap
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface V2Config {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  enabledForOrgs: string[];
  rolloutPercentage: number;
  shadowMode: boolean;
  urlLexicalBEndpoint?: string;
  tabularRiskEndpoint?: string;
  textPersuasionEndpoint?: string;
  screenshotCnnEndpoint?: string;
  combinerEndpoint?: string;
  stage2ConfidenceThreshold: number;
  branchThresholds: BranchThresholds;
  stage1Weights: Stage1Weights;
  stage2Weights: Stage2Weights;
  calibrationMethod: string;
  calibrationAlpha: number;
  featureStoreType: string;
  firestoreCollection: string;
  vertexFeatureStore?: string;
  featureCacheTTL: number;
  timeoutReachability: number;
  timeoutEvidence: number;
  timeoutStage1: number;
  timeoutStage2: number;
  timeoutTotal: number;
  createdAt: string;
  updatedAt: string;
}

interface BranchThresholds {
  ONLINE: ThresholdSet;
  OFFLINE: ThresholdSet;
  WAF: ThresholdSet;
  PARKED: ThresholdSet;
  SINKHOLE: ThresholdSet;
}

interface ThresholdSet {
  safe: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
}

interface Stage1Weights {
  lexicalA: number;
  lexicalB: number;
  tabular: number;
}

interface Stage2Weights {
  text: number;
  screenshot: number;
}

interface V2Stats {
  scanner: {
    enabled: boolean;
    shadowMode: boolean;
    rolloutPercentage: number;
    enabledOrgsCount: number;
    totalScansV1: number;
    totalScansV2: number;
  };
  threatIntel: {
    totalIndicators: number;
    tier1Sources: number;
    tier2Sources: number;
    tier3Sources: number;
    lastSyncTime: string | null;
  };
}

export default function V2ScannerConfig() {
  const [activeTab, setActiveTab] = useState<'overview' | 'endpoints' | 'thresholds' | 'weights' | 'testing' | 'stats'>('overview');
  const [config, setConfig] = useState<V2Config | null>(null);
  const [stats, setStats] = useState<V2Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Testing state
  const [testUrl, setTestUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<any>(null);

  // Organization management
  const [newOrgId, setNewOrgId] = useState('');

  const token = localStorage.getItem('accessToken');
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    loadConfig();
    loadStats();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/admin/v2-config`, authHeaders);
      setConfig(response.data.data);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to load V2 configuration');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/admin/v2-config/stats`, authHeaders);
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleToggleEnabled = async () => {
    try {
      setSaving(true);
      await axios.put(
        `${API_BASE}/admin/v2-config/enabled`,
        { enabled: !config?.isActive },
        authHeaders
      );
      await loadConfig();
      showMessage('success', `V2 scanner ${!config?.isActive ? 'enabled' : 'disabled'} successfully`);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to toggle V2 scanner');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleShadowMode = async () => {
    try {
      setSaving(true);
      await axios.put(
        `${API_BASE}/admin/v2-config/shadow-mode`,
        { enabled: !config?.shadowMode },
        authHeaders
      );
      await loadConfig();
      showMessage('success', `Shadow mode ${!config?.shadowMode ? 'enabled' : 'disabled'} successfully`);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to toggle shadow mode');
    } finally {
      setSaving(false);
    }
  };

  const handleRolloutChange = async (percentage: number) => {
    try {
      await axios.put(
        `${API_BASE}/admin/v2-config/rollout`,
        { percentage },
        authHeaders
      );
      await loadConfig();
      showMessage('success', `Rollout percentage set to ${percentage}%`);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to update rollout percentage');
    }
  };

  const handleSaveEndpoints = async () => {
    try {
      setSaving(true);
      await axios.put(
        `${API_BASE}/admin/v2-config/endpoints`,
        {
          urlLexicalBEndpoint: config?.urlLexicalBEndpoint,
          tabularRiskEndpoint: config?.tabularRiskEndpoint,
          textPersuasionEndpoint: config?.textPersuasionEndpoint,
          screenshotCnnEndpoint: config?.screenshotCnnEndpoint,
          combinerEndpoint: config?.combinerEndpoint
        },
        authHeaders
      );
      await loadConfig();
      showMessage('success', 'Vertex AI endpoints updated successfully');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to update endpoints');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveThresholds = async () => {
    try {
      setSaving(true);
      await axios.put(
        `${API_BASE}/admin/v2-config/thresholds`,
        {
          branchThresholds: config?.branchThresholds,
          stage2ConfidenceThreshold: config?.stage2ConfidenceThreshold
        },
        authHeaders
      );
      await loadConfig();
      showMessage('success', 'Thresholds updated successfully');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to update thresholds');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWeights = async () => {
    try {
      setSaving(true);
      await axios.put(
        `${API_BASE}/admin/v2-config/weights`,
        {
          stage1Weights: config?.stage1Weights,
          stage2Weights: config?.stage2Weights
        },
        authHeaders
      );
      await loadConfig();
      showMessage('success', 'Model weights updated successfully');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to update weights');
    } finally {
      setSaving(false);
    }
  };

  const handleEnableForOrg = async () => {
    if (!newOrgId.trim()) return;
    try {
      await axios.post(
        `${API_BASE}/admin/v2-config/organizations/${newOrgId}/enable`,
        {},
        authHeaders
      );
      await loadConfig();
      setNewOrgId('');
      showMessage('success', `V2 enabled for organization ${newOrgId}`);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to enable V2 for organization');
    }
  };

  const handleDisableForOrg = async (orgId: string) => {
    try {
      await axios.post(
        `${API_BASE}/admin/v2-config/organizations/${orgId}/disable`,
        {},
        authHeaders
      );
      await loadConfig();
      showMessage('success', `V2 disabled for organization ${orgId}`);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to disable V2 for organization');
    }
  };

  const handleTestComparison = async () => {
    if (!testUrl.trim()) return;
    try {
      setTesting(true);
      const response = await axios.post(
        `${API_BASE}/admin/v2-config/compare`,
        { url: testUrl },
        authHeaders
      );
      setComparisonResult(response.data.data);
      showMessage('success', 'V1 vs V2 comparison completed');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to run comparison test');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading V2 configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="w-8 h-8 text-blue-600" />
          V2 Scanner Configuration
        </h1>
        <p className="text-gray-600 mt-1">
          Manage the next-generation ML-powered scan engine with conformal prediction
        </p>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <button
          onClick={handleToggleEnabled}
          disabled={saving}
          className={`p-4 rounded-lg border-2 ${
            config?.isActive
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-gray-300 bg-white text-gray-700'
          } hover:shadow-md transition-all`}
        >
          <Power className="w-6 h-6 mx-auto mb-2" />
          <div className="font-semibold">{config?.isActive ? 'V2 Enabled' : 'V2 Disabled'}</div>
          <div className="text-xs mt-1">Click to toggle</div>
        </button>

        <button
          onClick={handleToggleShadowMode}
          disabled={saving}
          className={`p-4 rounded-lg border-2 ${
            config?.shadowMode
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700'
          } hover:shadow-md transition-all`}
        >
          {config?.shadowMode ? <Eye className="w-6 h-6 mx-auto mb-2" /> : <EyeOff className="w-6 h-6 mx-auto mb-2" />}
          <div className="font-semibold">{config?.shadowMode ? 'Shadow Mode ON' : 'Shadow Mode OFF'}</div>
          <div className="text-xs mt-1">Run V2 in background</div>
        </button>

        <div className="p-4 rounded-lg border-2 border-purple-500 bg-purple-50 text-purple-700">
          <TrendingUp className="w-6 h-6 mx-auto mb-2" />
          <div className="font-semibold">{config?.rolloutPercentage}% Rollout</div>
          <div className="text-xs mt-1">{config?.enabledForOrgs.length} orgs enabled</div>
        </div>

        <div className="p-4 rounded-lg border-2 border-orange-500 bg-orange-50 text-orange-700">
          <BarChart3 className="w-6 h-6 mx-auto mb-2" />
          <div className="font-semibold">{stats?.scanner.totalScansV2 || 0} V2 Scans</div>
          <div className="text-xs mt-1">{stats?.scanner.totalScansV1 || 0} V1 scans</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {[
            { id: 'overview', label: 'Overview', icon: Settings },
            { id: 'endpoints', label: 'Vertex AI Endpoints', icon: Database },
            { id: 'thresholds', label: 'Thresholds', icon: Sliders },
            { id: 'weights', label: 'Model Weights', icon: GitBranch },
            { id: 'testing', label: 'V1 vs V2 Testing', icon: TestTube2 },
            { id: 'stats', label: 'Statistics', icon: BarChart3 }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4 inline mr-2" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-4">Rollout Configuration</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rollout Percentage: {config?.rolloutPercentage}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config?.rolloutPercentage || 0}
                    onChange={(e) => setConfig({ ...config!, rolloutPercentage: parseInt(e.target.value) })}
                    onMouseUp={(e) => handleRolloutChange(parseInt((e.target as HTMLInputElement).value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Enabled Organizations</h3>
                  <div className="space-y-2">
                    {config?.enabledForOrgs.map((orgId) => (
                      <div key={orgId} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                        <span className="text-sm font-mono">{orgId}</span>
                        <button
                          onClick={() => handleDisableForOrg(orgId)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <input
                      type="text"
                      value={newOrgId}
                      onChange={(e) => setNewOrgId(e.target.value)}
                      placeholder="Organization ID"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded"
                    />
                    <button
                      onClick={handleEnableForOrg}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'endpoints' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Vertex AI Model Endpoints</h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Lexical B (PhishBERT)</label>
                <input
                  type="text"
                  value={config?.urlLexicalBEndpoint || ''}
                  onChange={(e) => setConfig({ ...config!, urlLexicalBEndpoint: e.target.value })}
                  placeholder="projects/.../locations/.../endpoints/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tabular Risk (XGBoost)</label>
                <input
                  type="text"
                  value={config?.tabularRiskEndpoint || ''}
                  onChange={(e) => setConfig({ ...config!, tabularRiskEndpoint: e.target.value })}
                  placeholder="projects/.../locations/.../endpoints/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Text Persuasion (Gemma)</label>
                <input
                  type="text"
                  value={config?.textPersuasionEndpoint || ''}
                  onChange={(e) => setConfig({ ...config!, textPersuasionEndpoint: e.target.value })}
                  placeholder="projects/.../locations/.../endpoints/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Screenshot CNN (EfficientNet)</label>
                <input
                  type="text"
                  value={config?.screenshotCnnEndpoint || ''}
                  onChange={(e) => setConfig({ ...config!, screenshotCnnEndpoint: e.target.value })}
                  placeholder="projects/.../locations/.../endpoints/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Combiner (Ensemble)</label>
                <input
                  type="text"
                  value={config?.combinerEndpoint || ''}
                  onChange={(e) => setConfig({ ...config!, combinerEndpoint: e.target.value })}
                  placeholder="projects/.../locations/.../endpoints/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
                />
              </div>
            </div>
            <button
              onClick={handleSaveEndpoints}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Endpoints'}
            </button>
          </div>
        )}

        {activeTab === 'thresholds' && config && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Branch Thresholds</h2>
            {Object.entries(config.branchThresholds).map(([branch, thresholds]) => (
              <div key={branch} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3">{branch}</h3>
                <div className="grid grid-cols-5 gap-3">
                  {Object.entries(thresholds).map(([level, value]) => (
                    <div key={level}>
                      <label className="block text-xs font-medium text-gray-600 mb-1 uppercase">{level}</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={value}
                        onChange={(e) => {
                          const newThresholds = { ...config.branchThresholds };
                          newThresholds[branch as keyof BranchThresholds][level as keyof ThresholdSet] = parseFloat(e.target.value);
                          setConfig({ ...config, branchThresholds: newThresholds });
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3">Stage-2 Confidence Threshold</h3>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={config.stage2ConfidenceThreshold}
                onChange={(e) => setConfig({ ...config, stage2ConfidenceThreshold: parseFloat(e.target.value) })}
                className="px-3 py-2 border border-gray-300 rounded"
              />
              <p className="text-sm text-gray-600 mt-2">
                Minimum confidence to trigger Stage-2 analysis (0.0-1.0)
              </p>
            </div>
            <button
              onClick={handleSaveThresholds}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Thresholds'}
            </button>
          </div>
        )}

        {activeTab === 'weights' && config && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-4">Stage-1 Weights</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lexical A (n-grams): {config.stage1Weights.lexicalA}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.stage1Weights.lexicalA}
                    onChange={(e) => {
                      const newWeights = { ...config.stage1Weights, lexicalA: parseFloat(e.target.value) };
                      setConfig({ ...config, stage1Weights: newWeights });
                    }}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lexical B (BERT): {config.stage1Weights.lexicalB}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.stage1Weights.lexicalB}
                    onChange={(e) => {
                      const newWeights = { ...config.stage1Weights, lexicalB: parseFloat(e.target.value) };
                      setConfig({ ...config, stage1Weights: newWeights });
                    }}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tabular (XGBoost): {config.stage1Weights.tabular}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.stage1Weights.tabular}
                    onChange={(e) => {
                      const newWeights = { ...config.stage1Weights, tabular: parseFloat(e.target.value) };
                      setConfig({ ...config, stage1Weights: newWeights });
                    }}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-4">Stage-2 Weights</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Text (Gemma): {config.stage2Weights.text}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.stage2Weights.text}
                    onChange={(e) => {
                      const newWeights = { ...config.stage2Weights, text: parseFloat(e.target.value) };
                      setConfig({ ...config, stage2Weights: newWeights });
                    }}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Screenshot (CNN): {config.stage2Weights.screenshot}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.stage2Weights.screenshot}
                    onChange={(e) => {
                      const newWeights = { ...config.stage2Weights, screenshot: parseFloat(e.target.value) };
                      setConfig({ ...config, stage2Weights: newWeights });
                    }}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveWeights}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Weights'}
            </button>
          </div>
        )}

        {activeTab === 'testing' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">V1 vs V2 Comparison Testing</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Test URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={testUrl}
                    onChange={(e) => setTestUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded"
                  />
                  <button
                    onClick={handleTestComparison}
                    disabled={testing || !testUrl.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <TestTube2 className="w-4 h-4" />
                    {testing ? 'Testing...' : 'Run Comparison'}
                  </button>
                </div>
              </div>

              {comparisonResult && (
                <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold text-lg">Comparison Results</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-semibold text-blue-700 mb-2">V1 Scanner</h4>
                      <div className="space-y-1 text-sm">
                        <div>Risk Score: <span className="font-mono">{comparisonResult.v1.riskScore}</span></div>
                        <div>Risk Level: <span className="font-semibold">{comparisonResult.v1.riskLevel}</span></div>
                        <div>Duration: <span className="font-mono">{comparisonResult.v1.duration}ms</span></div>
                      </div>
                    </div>
                    <div className="border-l-4 border-purple-500 pl-4">
                      <h4 className="font-semibold text-purple-700 mb-2">V2 Scanner</h4>
                      <div className="space-y-1 text-sm">
                        <div>Risk Score: <span className="font-mono">{comparisonResult.v2.riskScore}</span></div>
                        <div>Risk Level: <span className="font-semibold">{comparisonResult.v2.riskLevel}</span></div>
                        <div>Probability: <span className="font-mono">{(comparisonResult.v2.probability * 100).toFixed(2)}%</span></div>
                        <div>Duration: <span className="font-mono">{comparisonResult.v2.duration}ms</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded">
                    <h4 className="font-semibold mb-2">Agreement Analysis</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        {comparisonResult.agreement.riskLevelMatch ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        )}
                        <span>
                          Risk Level: {comparisonResult.agreement.riskLevelMatch ? 'Match' : 'Mismatch'}
                        </span>
                      </div>
                      <div>Score Difference: <span className="font-mono">{comparisonResult.agreement.scoreDifference.toFixed(2)}</span></div>
                      <div>
                        Duration Improvement: <span className="font-mono">{comparisonResult.agreement.durationImprovement}ms</span>
                        {comparisonResult.agreement.durationImprovement > 0 ? ' (V2 faster)' : ' (V1 faster)'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stats' && stats && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">V2 Scanner Statistics</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-3xl font-bold text-blue-700">{stats.scanner.totalScansV2}</div>
                <div className="text-sm text-blue-600">Total V2 Scans</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-3xl font-bold text-gray-700">{stats.scanner.totalScansV1}</div>
                <div className="text-sm text-gray-600">Total V1 Scans</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-3xl font-bold text-purple-700">{stats.scanner.rolloutPercentage}%</div>
                <div className="text-sm text-purple-600">Rollout Percentage</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-3xl font-bold text-green-700">{stats.scanner.enabledOrgsCount}</div>
                <div className="text-sm text-green-600">Organizations Enabled</div>
              </div>
            </div>

            <h3 className="text-lg font-bold mt-8">Threat Intelligence</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-700">{stats.threatIntel.totalIndicators.toLocaleString()}</div>
                <div className="text-xs text-orange-600">Total Indicators</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-700">{stats.threatIntel.tier1Sources}</div>
                <div className="text-xs text-red-600">Tier-1 Sources</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">{stats.threatIntel.tier2Sources}</div>
                <div className="text-xs text-yellow-600">Tier-2 Sources</div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{stats.threatIntel.tier3Sources}</div>
                <div className="text-xs text-blue-600">Tier-3 Sources</div>
              </div>
            </div>
            {stats.threatIntel.lastSyncTime && (
              <div className="text-sm text-gray-600">
                Last TI sync: {new Date(stats.threatIntel.lastSyncTime).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
