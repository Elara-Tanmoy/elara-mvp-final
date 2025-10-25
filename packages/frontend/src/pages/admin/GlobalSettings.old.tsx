import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, RefreshCw, Wifi, Database, Eye, EyeOff } from 'lucide-react';
import api from '../../lib/api';

interface GlobalSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  isSensitive: boolean;
  description?: string;
  required: boolean;
  isActive: boolean;
  environment: string;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
}

const GlobalSettings: React.FC = () => {
  const [settings, setSettings] = useState<GlobalSetting[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSetting, setEditingSetting] = useState<GlobalSetting | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    key: '',
    value: '',
    category: 'api_keys',
    isSensitive: false,
    description: '',
    required: false,
    environment: 'all'
  });

  useEffect(() => {
    loadCategories();
    loadSettings();
    loadCacheStats();
  }, [selectedCategory]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/v2/admin/global-settings/categories');
      setCategories(response.data.data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory) {
        params.append('category', selectedCategory);
      }
      params.append('includeValues', 'true');

      const response = await api.get(`/v2/admin/global-settings?${params}`);
      setSettings(response.data.data);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCacheStats = async () => {
    try {
      const response = await api.get('/v2/admin/global-settings/cache/stats');
      setCacheStats(response.data.data);
    } catch (error) {
      console.error('Error loading cache stats:', error);
    }
  };

  const clearCache = async () => {
    try {
      await api.post('/v2/admin/global-settings/cache/clear');
      loadCacheStats();
      alert('Cache cleared successfully!');
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Failed to clear cache');
    }
  };

  const saveSetting = async () => {
    try {
      if (editingSetting) {
        // Update existing setting
        await api.put(`/v2/admin/global-settings/${editingSetting.key}`, formData);
      } else {
        // Create new setting
        await api.post('/v2/admin/global-settings', formData);
      }

      setShowCreateModal(false);
      setEditingSetting(null);
      resetForm();
      loadSettings();
    } catch (error) {
      console.error('Error saving setting:', error);
      alert('Failed to save setting');
    }
  };

  const deleteSetting = async (key: string) => {
    if (!confirm(`Are you sure you want to delete the setting "${key}"?`)) {
      return;
    }

    try {
      await api.delete(`/v2/admin/global-settings/${key}`);
      loadSettings();
    } catch (error) {
      console.error('Error deleting setting:', error);
      alert('Failed to delete setting');
    }
  };

  const testConnection = async (key: string) => {
    try {
      setTestingKey(key);
      const response = await api.post(`/v2/admin/global-settings/${key}/test`);
      setTestResults({ ...testResults, [key]: response.data.data });
    } catch (error: any) {
      console.error('Error testing connection:', error);
      setTestResults({
        ...testResults,
        [key]: {
          success: false,
          message: error.response?.data?.message || 'Test failed'
        }
      });
    } finally {
      setTestingKey(null);
    }
  };

  const openEditModal = (setting: GlobalSetting) => {
    setEditingSetting(setting);
    setFormData({
      key: setting.key,
      value: setting.value || '',
      category: setting.category,
      isSensitive: setting.isSensitive,
      description: setting.description || '',
      required: setting.required,
      environment: setting.environment
    });
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setFormData({
      key: '',
      value: '',
      category: 'api_keys',
      isSensitive: false,
      description: '',
      required: false,
      environment: 'all'
    });
  };

  const toggleValueVisibility = (key: string) => {
    setShowValues({ ...showValues, [key]: !showValues[key] });
  };

  const getCategoryIcon = (iconName: string) => {
    const icons: Record<string, any> = {
      Key: <Settings className="w-5 h-5" />,
      Database: <Database className="w-5 h-5" />,
      Shield: <Settings className="w-5 h-5" />,
      Cloud: <Settings className="w-5 h-5" />,
      Zap: <Settings className="w-5 h-5" />,
      Flag: <Settings className="w-5 h-5" />,
      Settings: <Settings className="w-5 h-5" />
    };
    return icons[iconName] || <Settings className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Global Settings</h2>
          <p className="text-gray-600">Manage all environment variables and configuration</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={clearCache}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-5 h-5" />
            Clear Cache
          </button>
          <button
            onClick={() => {
              resetForm();
              setEditingSetting(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-5 h-5" />
            Add Setting
          </button>
        </div>
      </div>

      {/* Cache Stats */}
      {cacheStats && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-gray-500" />
              <span className="font-medium">Cache Stats:</span>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-gray-500">Size:</span>{' '}
                <span className="font-medium">{cacheStats.size || 0} entries</span>
              </div>
              <div>
                <span className="text-gray-500">Hit Rate:</span>{' '}
                <span className="font-medium">{cacheStats.hitRate || 0}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedCategory === null
                ? 'bg-primary-100 text-primary-700 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Categories
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                selectedCategory === category.id
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={category.description}
            >
              {getCategoryIcon(category.icon)}
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Settings List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading settings...</div>
        ) : settings.length === 0 ? (
          <div className="p-12 text-center">
            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">
              {selectedCategory
                ? `No settings in this category yet.`
                : 'No settings yet. Add one to get started.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {settings.map((setting) => (
              <div key={setting.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{setting.key}</h3>
                      {setting.isSensitive && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                          Sensitive
                        </span>
                      )}
                      {setting.required && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          Required
                        </span>
                      )}
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {setting.category}
                      </span>
                    </div>

                    {setting.description && (
                      <p className="text-sm text-gray-600 mb-3">{setting.description}</p>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      {setting.isSensitive ? (
                        <>
                          <code className="px-3 py-1 bg-gray-100 rounded text-sm font-mono">
                            {showValues[setting.key]
                              ? setting.value || '(empty)'
                              : '••••••••••••••••'}
                          </code>
                          <button
                            onClick={() => toggleValueVisibility(setting.key)}
                            className="text-gray-500 hover:text-gray-700"
                            title={showValues[setting.key] ? 'Hide value' : 'Show value'}
                          >
                            {showValues[setting.key] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </>
                      ) : (
                        <code className="px-3 py-1 bg-gray-100 rounded text-sm font-mono">
                          {setting.value || '(empty)'}
                        </code>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div>Environment: {setting.environment}</div>
                      <div>Updated: {new Date(setting.updatedAt).toLocaleString()}</div>
                    </div>

                    {/* Test Connection for API Keys */}
                    {setting.category === 'api_keys' && setting.value && (
                      <div className="mt-3">
                        <button
                          onClick={() => testConnection(setting.key)}
                          disabled={testingKey === setting.key}
                          className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded ${
                            testResults[setting.key]?.success
                              ? 'bg-green-50 text-green-700 hover:bg-green-100'
                              : testResults[setting.key]?.success === false
                              ? 'bg-red-50 text-red-700 hover:bg-red-100'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          <Wifi className="w-4 h-4" />
                          {testingKey === setting.key
                            ? 'Testing...'
                            : testResults[setting.key]?.success
                            ? 'Connected ✓'
                            : testResults[setting.key]?.success === false
                            ? 'Failed ✗'
                            : 'Test Connection'}
                        </button>
                        {testResults[setting.key]?.message && (
                          <p className="mt-2 text-sm text-gray-600">
                            {testResults[setting.key].message}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => openEditModal(setting)}
                      className="text-blue-600 hover:text-blue-700"
                      title="Edit setting"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteSetting(setting.key)}
                      className="text-red-600 hover:text-red-700"
                      title="Delete setting"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Setting Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">
                {editingSetting ? 'Edit Setting' : 'Add New Setting'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Key (Environment Variable Name)
                  </label>
                  <input
                    type="text"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    disabled={!!editingSetting}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100"
                    placeholder="API_KEY_NAME"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Value
                  </label>
                  <textarea
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[100px] font-mono text-sm"
                    placeholder="Enter value..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="What is this setting for?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Environment
                  </label>
                  <select
                    value={formData.environment}
                    onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="all">All Environments</option>
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isSensitive}
                      onChange={(e) => setFormData({ ...formData, isSensitive: e.target.checked })}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Sensitive (encrypted)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.required}
                      onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Required</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingSetting(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSetting}
                  disabled={!formData.key}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {editingSetting ? 'Update Setting' : 'Create Setting'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalSettings;
