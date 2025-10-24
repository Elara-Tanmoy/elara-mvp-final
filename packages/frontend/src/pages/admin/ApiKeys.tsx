import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../../lib/api';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  rateLimit: number;
  expiresAt?: string;
  lastUsedAt?: string;
  isActive: boolean;
  createdAt: string;
}

const ApiKeys: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    permissions: ['read'],
    rateLimit: 1000,
    expiresInDays: 0
  });

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      const response = await api.get('/v2/admin/api-keys');
      setApiKeys(response.data.data);
    } catch (error) {
      console.error('Error loading API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = async () => {
    try {
      const response = await api.post('/v2/admin/api-keys', formData);
      setNewApiKey(response.data.data);
      setFormData({ name: '', permissions: ['read'], rateLimit: 1000, expiresInDays: 0 });
      loadApiKeys();
    } catch (error) {
      console.error('Error generating API key:', error);
      alert('Failed to generate API key');
    }
  };

  const revokeApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/v2/admin/api-keys/${keyId}`);
      loadApiKeys();
    } catch (error) {
      console.error('Error revoking API key:', error);
      alert('Failed to revoke API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const togglePermission = (permission: string) => {
    const current = formData.permissions;
    if (current.includes(permission)) {
      setFormData({ ...formData, permissions: current.filter(p => p !== permission) });
    } else {
      setFormData({ ...formData, permissions: [...current, permission] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">API Keys</h2>
          <p className="text-gray-600">Manage API keys for third-party integrations</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-5 h-5" />
          Generate New Key
        </button>
      </div>

      {/* API Keys List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading API keys...</div>
        ) : apiKeys.length === 0 ? (
          <div className="p-12 text-center">
            <Key className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No API keys yet. Generate one to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {apiKeys.map((key) => (
              <div key={key.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{key.name}</h3>
                      {key.isActive ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          Revoked
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <code className="px-3 py-1 bg-gray-100 rounded text-sm font-mono">
                        {key.keyPrefix}••••••••••••••••
                      </code>
                      <button
                        onClick={() => copyToClipboard(key.keyPrefix)}
                        className="text-gray-500 hover:text-gray-700"
                        title="Copy key prefix"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Permissions</div>
                        <div className="font-medium">{key.permissions.join(', ')}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Rate Limit</div>
                        <div className="font-medium">{key.rateLimit}/hour</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Last Used</div>
                        <div className="font-medium">
                          {key.lastUsedAt
                            ? new Date(key.lastUsedAt).toLocaleDateString()
                            : 'Never'}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Expires</div>
                        <div className="font-medium">
                          {key.expiresAt
                            ? new Date(key.expiresAt).toLocaleDateString()
                            : 'Never'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => revokeApiKey(key.id)}
                    disabled={!key.isActive}
                    className="ml-4 text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Revoke key"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create API Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Generate New API Key</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Production API Key"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Permissions
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['read', 'write', 'delete', 'admin'].map((perm) => (
                      <label key={perm} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(perm)}
                          onChange={() => togglePermission(perm)}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                        <span className="capitalize">{perm}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rate Limit (requests per hour)
                  </label>
                  <input
                    type="number"
                    value={formData.rateLimit}
                    onChange={(e) => setFormData({ ...formData, rateLimit: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    min="100"
                    max="10000"
                    step="100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expires In (days, 0 = never)
                  </label>
                  <input
                    type="number"
                    value={formData.expiresInDays}
                    onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    min="0"
                    max="365"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ name: '', permissions: ['read'], rateLimit: 1000, expiresInDays: 0 });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={generateApiKey}
                  disabled={!formData.name || formData.permissions.length === 0}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  Generate Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New API Key Display Modal */}
      {newApiKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <h3 className="text-xl font-bold">API Key Generated!</h3>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Important: Save this key now!</p>
                  <p>This is the only time you'll see the full key. Store it securely.</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-4 py-3 bg-gray-100 rounded-lg text-sm font-mono break-all">
                  {newApiKey.plainKey}
                </code>
                <button
                  onClick={() => copyToClipboard(newApiKey.plainKey)}
                  className="flex items-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <div className="text-gray-500">Key Name</div>
                <div className="font-medium">{newApiKey.apiKey.name}</div>
              </div>
              <div>
                <div className="text-gray-500">Permissions</div>
                <div className="font-medium">{newApiKey.apiKey.permissions.join(', ')}</div>
              </div>
              <div>
                <div className="text-gray-500">Rate Limit</div>
                <div className="font-medium">{newApiKey.apiKey.rateLimit}/hour</div>
              </div>
              <div>
                <div className="text-gray-500">Expires</div>
                <div className="font-medium">
                  {newApiKey.apiKey.expiresAt
                    ? new Date(newApiKey.apiKey.expiresAt).toLocaleDateString()
                    : 'Never'}
                </div>
              </div>
            </div>

            <button
              onClick={() => setNewApiKey(null)}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeys;
