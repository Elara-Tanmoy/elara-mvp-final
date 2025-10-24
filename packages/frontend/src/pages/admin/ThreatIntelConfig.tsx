import React, { useState, useEffect } from 'react';
import { Settings, Key, Link, CheckCircle, XCircle, AlertCircle, RefreshCw, Save, Eye, EyeOff } from 'lucide-react';
import api from '../../lib/api';

interface SourceConfig {
  id: string;
  name: string;
  type: string;
  url: string | null;
  apiKey: string | null;
  apiKeySet: boolean;
  enabled: boolean;
  requiresAuth: boolean;
  description: string | null;
  syncFrequency: number;
  lastSyncAt: string | null;
  lastError: string | null;
  apiConfig?: {
    method: string;
    timeout: number;
    headers: Record<string, string>;
    queryParams: Record<string, string>;
    bodyParams: string | null;
    authHeaderName: string | null;
    envVarName: string | null;
  };
}

const ThreatIntelConfig: React.FC = () => {
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    setLoading(true);
    try {
      const response = await api.get('/v2/threat-intel/sources');
      const sourcesData = response.data.sources;

      // Load detailed config for each source
      const configs = await Promise.all(
        sourcesData.map(async (source: any) => {
          try {
            const configResponse = await api.get(`/v2/threat-intel/sources/${source.id}/config`);
            return configResponse.data.config;
          } catch (error) {
            console.error(`Error loading config for ${source.name}:`, error);
            return source;
          }
        })
      );

      setSources(configs);
    } catch (error) {
      console.error('Error loading sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (sourceId: string, source: SourceConfig) => {
    setEditingSource(sourceId);
    setFormData({
      [sourceId]: {
        url: source.url || '',
        apiKey: '',
        enabled: source.enabled,
        requiresAuth: source.requiresAuth,
        description: source.description || '',
        syncFrequency: source.syncFrequency
      }
    });
  };

  const handleCancel = (sourceId: string) => {
    setEditingSource(null);
    setFormData({});
    setShowApiKeys({ ...showApiKeys, [sourceId]: false });
  };

  const handleSave = async (sourceId: string) => {
    setSaving(sourceId);
    try {
      const data = formData[sourceId];
      await api.patch(`/v2/threat-intel/sources/${sourceId}/config`, data);
      alert('Configuration saved successfully!');
      setEditingSource(null);
      setFormData({});
      setShowApiKeys({ ...showApiKeys, [sourceId]: false });
      await loadSources();
    } catch (error: any) {
      console.error('Error saving config:', error);
      alert(`Failed to save configuration: ${error.response?.data?.details || error.message}`);
    } finally {
      setSaving(null);
    }
  };

  const handleTestConnection = async (sourceId: string) => {
    setTesting(sourceId);
    try {
      const response = await api.post(`/v2/threat-intel/sources/${sourceId}/test`);
      setTestResults({
        ...testResults,
        [sourceId]: {
          success: response.data.success,
          message: response.data.message || (response.data.success ? 'Connection successful!' : 'Connection failed')
        }
      });

      // Auto-clear test result after 5 seconds
      setTimeout(() => {
        setTestResults((prev) => {
          const newResults = { ...prev };
          delete newResults[sourceId];
          return newResults;
        });
      }, 5000);
    } catch (error: any) {
      console.error('Error testing connection:', error);
      setTestResults({
        ...testResults,
        [sourceId]: {
          success: false,
          message: error.response?.data?.error || 'Test failed'
        }
      });
    } finally {
      setTesting(null);
    }
  };

  const toggleApiKeyVisibility = (sourceId: string) => {
    setShowApiKeys({ ...showApiKeys, [sourceId]: !showApiKeys[sourceId] });
  };

  const updateFormField = (sourceId: string, field: string, value: any) => {
    setFormData({
      ...formData,
      [sourceId]: {
        ...(formData[sourceId] || {}),
        [field]: value
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <Settings className="w-8 h-8" />
              Threat Intelligence Configuration
            </h1>
            <p className="text-purple-100">
              Centralized configuration for all threat intelligence sources - API keys, endpoints, and connection settings
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Cards */}
      <div className="space-y-4">
        {sources.map((source) => {
          const isEditing = editingSource === source.id;
          const isSaving = saving === source.id;
          const isTesting = testing === source.id;
          const testResult = testResults[source.id];
          const formValues = formData[source.id] || {};

          return (
            <div key={source.id} className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-200 hover:border-purple-300 transition-colors">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${source.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <h3 className="text-lg font-bold text-gray-900">{source.name}</h3>
                  <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                    {source.type}
                  </span>
                  {source.requiresAuth && (
                    <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1">
                      <Key className="w-3 h-3" />
                      Requires Auth
                    </span>
                  )}
                </div>

                {!isEditing ? (
                  <button
                    onClick={() => handleEdit(source.id, source)}
                    className="px-4 py-2 text-sm font-medium text-purple-600 border border-purple-600 rounded hover:bg-purple-50"
                  >
                    Edit Configuration
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCancel(source.id)}
                      disabled={isSaving}
                      className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSave(source.id)}
                      disabled={isSaving}
                      className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>

              {/* Configuration Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  {/* API Endpoint */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Link className="w-4 h-4" />
                      API Endpoint
                    </label>
                    {isEditing ? (
                      <input
                        type="url"
                        value={formValues.url || ''}
                        onChange={(e) => updateFormField(source.id, 'url', e.target.value)}
                        placeholder="https://api.example.com/v1/feed"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    ) : (
                      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 font-mono truncate">
                        {source.url || 'Not configured'}
                      </div>
                    )}
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      API Key
                      {source.apiKeySet && !isEditing && (
                        <span className="text-xs text-green-600">(Configured)</span>
                      )}
                    </label>
                    {isEditing ? (
                      <div className="relative">
                        <input
                          type={showApiKeys[source.id] ? 'text' : 'password'}
                          value={formValues.apiKey || ''}
                          onChange={(e) => updateFormField(source.id, 'apiKey', e.target.value)}
                          placeholder="Enter new API key (leave blank to keep current)"
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          type="button"
                          onClick={() => toggleApiKeyVisibility(source.id)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showApiKeys[source.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    ) : (
                      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono">
                        {source.apiKey || 'Not configured'}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    {isEditing ? (
                      <textarea
                        value={formValues.description || ''}
                        onChange={(e) => updateFormField(source.id, 'description', e.target.value)}
                        placeholder="Optional description"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    ) : (
                      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                        {source.description || 'No description'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <div className="flex items-center gap-4">
                      {isEditing ? (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formValues.enabled}
                            onChange={(e) => updateFormField(source.id, 'enabled', e.target.checked)}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-700">Enabled</span>
                        </label>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          source.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {source.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sync Frequency */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sync Frequency (seconds)
                    </label>
                    {isEditing ? (
                      <input
                        type="number"
                        value={formValues.syncFrequency || 3600}
                        onChange={(e) => updateFormField(source.id, 'syncFrequency', parseInt(e.target.value))}
                        min="60"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    ) : (
                      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                        {source.syncFrequency} seconds ({Math.floor(source.syncFrequency / 60)} minutes)
                      </div>
                    )}
                  </div>

                  {/* Last Sync Info */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Sync
                    </label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                      {source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleString() : 'Never'}
                    </div>
                  </div>

                  {/* Test Connection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Connection Test
                    </label>
                    <button
                      onClick={() => handleTestConnection(source.id)}
                      disabled={isTesting || !source.enabled}
                      className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      {isTesting ? 'Testing...' : 'Test Connection'}
                    </button>

                    {testResult && (
                      <div className={`mt-2 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                        testResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                      }`}>
                        {testResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {testResult.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* API Configuration Details */}
              {source.apiConfig && !isEditing && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Current API Configuration
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Method & Timeout */}
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1">HTTP Method</div>
                        <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm font-mono text-blue-800">
                          {source.apiConfig.method}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1">Timeout</div>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                          {source.apiConfig.timeout}ms ({(source.apiConfig.timeout / 1000).toFixed(0)}s)
                        </div>
                      </div>

                      {source.apiConfig.authHeaderName && (
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-1">Auth Header Name</div>
                          <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-sm font-mono text-yellow-900">
                            {source.apiConfig.authHeaderName}
                          </div>
                        </div>
                      )}

                      {source.apiConfig.envVarName && (
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-1">Environment Variable</div>
                          <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded text-sm font-mono text-purple-900">
                            {source.apiConfig.envVarName}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Headers */}
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-2">HTTP Headers</div>
                      <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-2 max-h-48 overflow-y-auto">
                        {Object.entries(source.apiConfig.headers).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="font-semibold text-gray-700">{key}:</span>
                            <span className="ml-2 text-gray-600 font-mono break-all">
                              {value.includes('{') && value.includes('}')
                                ? <span className="text-yellow-600">{value}</span>
                                : value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Query Parameters */}
                  {source.apiConfig.queryParams && Object.keys(source.apiConfig.queryParams).length > 0 && (
                    <div className="mt-4">
                      <div className="text-xs font-medium text-gray-500 mb-2">Query Parameters</div>
                      <div className="bg-green-50 border border-green-200 rounded p-3 space-y-2">
                        {Object.entries(source.apiConfig.queryParams).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="font-semibold text-green-700">{key}=</span>
                            <span className="text-green-600 font-mono">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Body Parameters */}
                  {source.apiConfig.bodyParams && (
                    <div className="mt-4">
                      <div className="text-xs font-medium text-gray-500 mb-2">Request Body</div>
                      <div className="bg-indigo-50 border border-indigo-200 rounded p-3">
                        <pre className="text-xs text-indigo-900 font-mono whitespace-pre-wrap break-all">
                          {source.apiConfig.bodyParams}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Last Error */}
              {source.lastError && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-red-800">Last Error:</div>
                        <div className="text-sm text-red-600 mt-1">{source.lastError}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Refresh All Button */}
      <div className="flex justify-end">
        <button
          onClick={loadSources}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh All
        </button>
      </div>
    </div>
  );
};

export default ThreatIntelConfig;
