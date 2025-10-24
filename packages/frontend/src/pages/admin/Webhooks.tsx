import React, { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, Play, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import api from '../../lib/api';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt?: string;
  failureCount: number;
  retryPolicy: {
    maxRetries: number;
    retryDelay: number;
  };
}

const AVAILABLE_EVENTS = [
  'user.created',
  'user.updated',
  'user.deleted',
  'scan.completed',
  'scan.failed',
  'subscription.created',
  'subscription.updated',
  'subscription.cancelled',
  'payment.succeeded',
  'payment.failed'
];

const Webhooks: React.FC = () => {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    maxRetries: 3,
    retryDelay: 5000
  });
  const [testPayload, setTestPayload] = useState('{"test": true}');

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/v2/admin/webhooks');
      setWebhooks(response.data.data);
    } catch (error) {
      console.error('Error loading webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const createWebhook = async () => {
    try {
      await api.post('/v2/admin/webhooks', formData);
      setShowCreateModal(false);
      setFormData({ name: '', url: '', events: [], maxRetries: 3, retryDelay: 5000 });
      loadWebhooks();
    } catch (error) {
      console.error('Error creating webhook:', error);
      alert('Failed to create webhook');
    }
  };

  const deleteWebhook = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) {
      return;
    }

    try {
      await api.delete(`/v2/admin/webhooks/${webhookId}`);
      loadWebhooks();
    } catch (error) {
      console.error('Error deleting webhook:', error);
      alert('Failed to delete webhook');
    }
  };

  const testWebhook = async (webhookId: string) => {
    try {
      const payload = JSON.parse(testPayload);
      await api.post(`/v2/admin/webhooks/${webhookId}/test`, {
        event: 'test.event',
        payload
      });
      setShowTestModal(null);
      alert('Webhook test sent successfully! Check your endpoint.');
    } catch (error) {
      console.error('Error testing webhook:', error);
      alert('Failed to test webhook');
    }
  };

  const toggleEvent = (event: string) => {
    const current = formData.events;
    if (current.includes(event)) {
      setFormData({ ...formData, events: current.filter(e => e !== event) });
    } else {
      setFormData({ ...formData, events: [...current, event] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Webhooks</h2>
          <p className="text-gray-600">Receive real-time event notifications</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-5 h-5" />
          Create Webhook
        </button>
      </div>

      {/* Webhooks List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading webhooks...</div>
        ) : webhooks.length === 0 ? (
          <div className="p-12 text-center">
            <Webhook className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No webhooks configured yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {webhooks.map((webhook) => (
              <div key={webhook.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{webhook.name}</h3>
                      {webhook.isActive ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                      {webhook.failureCount > 0 && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {webhook.failureCount} failures
                        </span>
                      )}
                    </div>

                    <div className="mb-3">
                      <code className="px-3 py-1 bg-gray-100 rounded text-sm font-mono">
                        {webhook.url}
                      </code>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                      <div>
                        <div className="text-gray-500">Events</div>
                        <div className="font-medium">{webhook.events.length} subscribed</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Max Retries</div>
                        <div className="font-medium">{webhook.retryPolicy.maxRetries}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Retry Delay</div>
                        <div className="font-medium">{webhook.retryPolicy.retryDelay}ms</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Last Triggered</div>
                        <div className="font-medium">
                          {webhook.lastTriggeredAt
                            ? new Date(webhook.lastTriggeredAt).toLocaleDateString()
                            : 'Never'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 mb-1">Subscribed Events:</div>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event) => (
                          <span
                            key={event}
                            className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                          >
                            {event}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="ml-4 flex gap-2">
                    <button
                      onClick={() => setShowTestModal(webhook.id)}
                      className="text-blue-600 hover:text-blue-700"
                      title="Test webhook"
                    >
                      <Play className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteWebhook(webhook.id)}
                      className="text-red-600 hover:text-red-700"
                      title="Delete webhook"
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

      {/* Create Webhook Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Create Webhook</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="My Webhook"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endpoint URL
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="https://your-domain.com/webhooks/elara"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Events to Subscribe
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {AVAILABLE_EVENTS.map((event) => (
                      <label
                        key={event}
                        className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={formData.events.includes(event)}
                          onChange={() => toggleEvent(event)}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                        <span className="text-sm">{event}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Retries
                    </label>
                    <input
                      type="number"
                      value={formData.maxRetries}
                      onChange={(e) => setFormData({ ...formData, maxRetries: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      min="0"
                      max="10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Retry Delay (ms)
                    </label>
                    <input
                      type="number"
                      value={formData.retryDelay}
                      onChange={(e) => setFormData({ ...formData, retryDelay: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      min="1000"
                      max="60000"
                      step="1000"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ name: '', url: '', events: [], maxRetries: 3, retryDelay: 5000 });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createWebhook}
                  disabled={!formData.name || !formData.url || formData.events.length === 0}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  Create Webhook
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Webhook Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold mb-4">Test Webhook</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Payload (JSON)
              </label>
              <textarea
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 font-mono text-sm"
                rows={8}
                placeholder='{"event": "test", "data": {}}'
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowTestModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => testWebhook(showTestModal)}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Send Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Webhooks;
