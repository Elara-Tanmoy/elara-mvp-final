import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, RefreshCw, Database, Eye, EyeOff, Wifi, Check, X } from 'lucide-react';
import api from '../../lib/api';
import { Card, CardContent, Badge, Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, Switch } from '../../components/ui';

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

const GlobalSettingsNew: React.FC = () => {
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
      if (selectedCategory) params.append('category', selectedCategory);
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
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  const saveSetting = async () => {
    try {
      if (editingSetting) {
        await api.put(`/v2/admin/global-settings/${editingSetting.key}`, formData);
      } else {
        await api.post('/v2/admin/global-settings', formData);
      }
      setShowCreateModal(false);
      setEditingSetting(null);
      resetForm();
      loadSettings();
    } catch (error) {
      console.error('Error saving setting:', error);
    }
  };

  const deleteSetting = async (key: string) => {
    if (!confirm(`Delete "${key}"?`)) return;
    try {
      await api.delete(`/v2/admin/global-settings/${key}`);
      loadSettings();
    } catch (error) {
      console.error('Error deleting setting:', error);
    }
  };

  const testConnection = async (key: string) => {
    try {
      setTestingKey(key);
      const response = await api.post(`/v2/admin/global-settings/${key}/test`);
      setTestResults({ ...testResults, [key]: response.data.data });
    } catch (error: any) {
      setTestResults({ ...testResults, [key]: { success: false, message: error.response?.data?.message || 'Test failed' } });
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
    setFormData({ key: '', value: '', category: 'api_keys', isSensitive: false, description: '', required: false, environment: 'all' });
  };

  const toggleValueVisibility = (key: string) => {
    setShowValues({ ...showValues, [key]: !showValues[key] });
  };

  return (
    <div className="min-h-screen bg-surface-base p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-text-primary mb-2">Global Settings</h2>
          <p className="text-text-secondary">Central configuration for all environment variables</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={clearCache} variant="secondary">
            <RefreshCw className="w-4 h-4" />
            Clear Cache
          </Button>
          <Button onClick={() => { resetForm(); setEditingSetting(null); setShowCreateModal(true); }}>
            <Plus className="w-4 h-4" />
            Add Setting
          </Button>
        </div>
      </div>

      {cacheStats && (
        <Card notched className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-primary-500" />
                <span className="font-medium text-text-primary">Cache Stats</span>
              </div>
              <div className="flex gap-6">
                <Badge variant="info">{cacheStats.size || 0} entries</Badge>
                <Badge variant="success">Hit Rate: {cacheStats.hitRate || 0}%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <Button variant={selectedCategory === null ? 'primary' : 'ghost'} size="sm" onClick={() => setSelectedCategory(null)}>
          All Categories
        </Button>
        {categories.map((cat) => (
          <Button key={cat.id} variant={selectedCategory === cat.id ? 'primary' : 'ghost'} size="sm" onClick={() => setSelectedCategory(cat.id)}>
            {cat.name}
          </Button>
        ))}
      </div>

      <div className="grid gap-4">
        {loading ? (
          <Card><CardContent className="p-12 text-center text-text-tertiary">Loading...</CardContent></Card>
        ) : settings.length === 0 ? (
          <Card><CardContent className="p-12 text-center"><Settings className="w-12 h-12 text-text-tertiary mx-auto mb-3" /><p className="text-text-secondary">No settings found</p></CardContent></Card>
        ) : (
          settings.map((setting) => (
            <Card key={setting.id} notched elevated className="hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg text-text-primary">{setting.key}</h3>
                      {setting.isSensitive && <Badge variant="warning">Sensitive</Badge>}
                      {setting.required && <Badge variant="error">Required</Badge>}
                      <Badge variant="default">{setting.category}</Badge>
                    </div>
                    {setting.description && <p className="text-sm text-text-secondary mb-3">{setting.description}</p>}

                    <div className="flex items-center gap-2 mb-3">
                      <code className="px-3 py-2 bg-surface-sunken rounded text-sm font-mono text-text-primary">
                        {setting.isSensitive && !showValues[setting.key] ? '••••••••••••••••' : setting.value || '(empty)'}
                      </code>
                      {setting.isSensitive && (
                        <button onClick={() => toggleValueVisibility(setting.key)} className="text-text-secondary hover:text-text-primary transition-colors">
                          {showValues[setting.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-text-tertiary mb-3">
                      <span>Environment: {setting.environment}</span>
                      <span>Updated: {new Date(setting.updatedAt).toLocaleString()}</span>
                    </div>

                    {setting.category === 'api_keys' && setting.value && (
                      <Button size="sm" variant={testResults[setting.key]?.success ? 'secondary' : 'ghost'} onClick={() => testConnection(setting.key)} loading={testingKey === setting.key}>
                        <Wifi className="w-4 h-4" />
                        {testResults[setting.key]?.success ? <><Check className="w-4 h-4" /> Connected</> : testResults[setting.key]?.success === false ? <><X className="w-4 h-4" /> Failed</> : 'Test Connection'}
                      </Button>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button onClick={() => openEditModal(setting)} className="text-primary-600 hover:text-primary-700 transition-colors">
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button onClick={() => deleteSetting(setting.key)} className="text-red-600 hover:text-red-700 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent notched>
          <DialogHeader>
            <DialogTitle>{editingSetting ? 'Edit Setting' : 'Add New Setting'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input label="Key" value={formData.key} onChange={(e) => setFormData({...formData, key: e.target.value})} disabled={!!editingSetting} placeholder="API_KEY_NAME" required />
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Value</label>
              <textarea value={formData.value} onChange={(e) => setFormData({...formData, value: e.target.value})} className="w-full border border-border-default rounded-md px-3 py-2 min-h-[100px] font-mono text-sm bg-surface-base" placeholder="Enter value..." />
            </div>
            <Input label="Description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="What is this setting for?" />
            <div className="flex gap-4">
              <Switch label="Sensitive" checked={formData.isSensitive} onCheckedChange={(checked) => setFormData({...formData, isSensitive: checked})} />
              <Switch label="Required" checked={formData.required} onCheckedChange={(checked) => setFormData({...formData, required: checked})} />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="secondary" onClick={() => { setShowCreateModal(false); setEditingSetting(null); resetForm(); }} className="flex-1">Cancel</Button>
              <Button onClick={saveSetting} disabled={!formData.key} className="flex-1">{editingSetting ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GlobalSettingsNew;
