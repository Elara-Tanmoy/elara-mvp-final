import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Settings, Database, Upload, BarChart3, Save, Plus, Search, Trash2,
  FileText, FileJson, FileCode, CheckCircle, XCircle, Loader2, Download,
  TrendingUp, Users, MessageSquare, Star, AlertCircle
} from 'lucide-react';
import api from '../lib/api';

type TabType = 'config' | 'knowledge' | 'training' | 'analytics';

interface Config {
  systemPrompt: string;
  customInstructions: string;
  temperature: number;
  maxTokens: number;
  enableRag: boolean;
  enableConversationMemory: boolean;
  maxConversationHistory: number;
  model: string;
  responseStyle: string;
}

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  source?: string;
  createdAt: string;
}

interface TrainingData {
  id: string;
  dataType: string;
  fileName: string;
  processedEntries: number;
  totalEntries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: string;
}

interface Analytics {
  date: string;
  totalMessages: number;
  totalSessions: number;
  uniqueUsers: number;
  avgResponseTime: number;
  avgRating: number;
  successfulResponses: number;
  failedResponses: number;
}

const ChatbotAdmin: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('config');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Configuration state
  const [config, setConfig] = useState<Config>({
    systemPrompt: '',
    customInstructions: '',
    temperature: 0.7,
    maxTokens: 2000,
    enableRag: true,
    enableConversationMemory: true,
    maxConversationHistory: 10,
    model: 'claude-sonnet-4-20250514',
    responseStyle: 'professional'
  });

  // Knowledge base state
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [showAddKnowledge, setShowAddKnowledge] = useState(false);
  const [newKnowledge, setNewKnowledge] = useState({ title: '', content: '', category: '' });
  const [knowledgeStats, setKnowledgeStats] = useState({ total: 0, categories: [] });

  // Training state
  const [trainingHistory, setTrainingHistory] = useState<TrainingData[]>([]);
  const [uploadType, setUploadType] = useState<'csv' | 'text' | 'json'>('csv');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMetadata, setUploadMetadata] = useState({ title: '', category: '' });

  // Analytics state
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [analyticsDays, setAnalyticsDays] = useState(7);

  // Check admin access
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'config') {
      loadConfig();
    } else if (activeTab === 'knowledge') {
      loadKnowledgeStats();
    } else if (activeTab === 'training') {
      loadTrainingHistory();
    } else if (activeTab === 'analytics') {
      loadAnalytics();
    }
  }, [activeTab]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get('/v2/chatbot/config');
      setConfig(response.data.data);
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      await api.put('/v2/chatbot/config', config);
      alert('Configuration saved successfully!');
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const loadKnowledgeStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/v2/chatbot/knowledge/stats');
      setKnowledgeStats(response.data.data);
    } catch (error) {
      console.error('Error loading knowledge stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchKnowledge = async () => {
    if (!knowledgeSearch.trim()) return;

    try {
      setLoading(true);
      const response = await api.get(`/v2/chatbot/knowledge/search?q=${encodeURIComponent(knowledgeSearch)}&limit=20`);
      setKnowledgeEntries(response.data.data);
    } catch (error) {
      console.error('Error searching knowledge:', error);
    } finally {
      setLoading(false);
    }
  };

  const addKnowledge = async () => {
    try {
      setSaving(true);
      await api.post('/v2/chatbot/knowledge', newKnowledge);
      setNewKnowledge({ title: '', content: '', category: '' });
      setShowAddKnowledge(false);
      loadKnowledgeStats();
      alert('Knowledge added successfully!');
    } catch (error) {
      console.error('Error adding knowledge:', error);
      alert('Failed to add knowledge');
    } finally {
      setSaving(false);
    }
  };

  const deleteKnowledge = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      await api.delete(`/v2/chatbot/knowledge/${id}`);
      setKnowledgeEntries(prev => prev.filter(e => e.id !== id));
      loadKnowledgeStats();
    } catch (error) {
      console.error('Error deleting knowledge:', error);
      alert('Failed to delete knowledge');
    }
  };

  const loadTrainingHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get('/v2/chatbot/training/history?limit=50');
      setTrainingHistory(response.data.data);
    } catch (error) {
      console.error('Error loading training history:', error);
    } finally {
      setLoading(false);
    }
  };

  const uploadTrainingData = async () => {
    if (!uploadFile) return;

    try {
      setSaving(true);
      const reader = new FileReader();

      reader.onload = async (e) => {
        const content = e.target?.result as string;

        try {
          let endpoint = '';
          let payload: any = { content, fileName: uploadFile.name };

          if (uploadType === 'csv') {
            endpoint = '/v2/chatbot/training/csv';
          } else if (uploadType === 'text') {
            endpoint = '/v2/chatbot/training/text';
            payload = { ...payload, ...uploadMetadata };
          } else if (uploadType === 'json') {
            endpoint = '/v2/chatbot/training/json';
          }

          await api.post(endpoint, payload);
          setUploadFile(null);
          setUploadMetadata({ title: '', category: '' });
          loadTrainingHistory();
          alert('Training data uploaded successfully!');
        } catch (error) {
          console.error('Error uploading training data:', error);
          alert('Failed to upload training data');
        } finally {
          setSaving(false);
        }
      };

      reader.readAsText(uploadFile);
    } catch (error) {
      console.error('Error reading file:', error);
      setSaving(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/v2/chatbot/analytics?days=${analyticsDays}`);
      setAnalytics(response.data.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const tabs = [
    { id: 'config' as TabType, label: 'Configuration', icon: Settings },
    { id: 'knowledge' as TabType, label: 'Knowledge Base', icon: Database },
    { id: 'training' as TabType, label: 'Training', icon: Upload },
    { id: 'analytics' as TabType, label: 'Analytics', icon: BarChart3 }
  ];

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Chatbot Administration</h1>
        <p className="text-gray-600 mt-2">Manage Ask Elara chatbot configuration, knowledge base, and training</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Configuration Tab */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">System Prompt</label>
              <textarea
                value={config.systemPrompt}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm"
                rows={6}
                placeholder="Enter the system prompt that defines the chatbot's role..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Custom Instructions</label>
              <textarea
                value={config.customInstructions}
                onChange={(e) => setConfig({ ...config, customInstructions: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm"
                rows={4}
                placeholder="Additional instructions for how the chatbot should respond..."
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperature: {config.temperature.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Controls randomness (0 = focused, 1 = creative)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Tokens</label>
                <input
                  type="number"
                  value={config.maxTokens}
                  onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  min="100"
                  max="4000"
                  step="100"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum response length</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Enable RAG</p>
                  <p className="text-xs text-gray-500">Use knowledge base for responses</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.enableRag}
                  onChange={(e) => setConfig({ ...config, enableRag: e.target.checked })}
                  className="w-5 h-5 text-primary-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Conversation Memory</p>
                  <p className="text-xs text-gray-500">Remember previous messages</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.enableConversationMemory}
                  onChange={(e) => setConfig({ ...config, enableConversationMemory: e.target.checked })}
                  className="w-5 h-5 text-primary-600 rounded"
                />
              </div>
            </div>

            {config.enableConversationMemory && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Conversation History: {config.maxConversationHistory} messages
                </label>
                <input
                  type="range"
                  min="5"
                  max="20"
                  value={config.maxConversationHistory}
                  onChange={(e) => setConfig({ ...config, maxConversationHistory: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={saveConfig}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Knowledge Base Tab */}
      {activeTab === 'knowledge' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Entries</p>
                  <p className="text-2xl font-bold text-gray-900">{knowledgeStats.total}</p>
                </div>
                <Database className="w-8 h-8 text-primary-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Categories</p>
                  <p className="text-2xl font-bold text-gray-900">{knowledgeStats.categories?.length || 0}</p>
                </div>
                <FileText className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <button
                onClick={() => setShowAddKnowledge(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 w-full justify-center"
              >
                <Plus className="w-5 h-5" />
                Add Entry
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={knowledgeSearch}
                onChange={(e) => setKnowledgeSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchKnowledge()}
                placeholder="Search knowledge base..."
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
              />
              <button
                onClick={searchKnowledge}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                Search
              </button>
            </div>

            {/* Results */}
            {knowledgeEntries.length > 0 && (
              <div className="mt-6 space-y-3">
                {knowledgeEntries.map((entry) => (
                  <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{entry.title}</h4>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{entry.content}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                            {entry.category}
                          </span>
                          {entry.source && (
                            <span className="text-xs text-gray-500">Source: {entry.source}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteKnowledge(entry.id)}
                        className="text-red-600 hover:text-red-700 ml-4"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Knowledge Modal */}
          {showAddKnowledge && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
                <h3 className="text-xl font-bold mb-4">Add Knowledge Entry</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input
                      type="text"
                      value={newKnowledge.title}
                      onChange={(e) => setNewKnowledge({ ...newKnowledge, title: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Entry title..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                    <textarea
                      value={newKnowledge.content}
                      onChange={(e) => setNewKnowledge({ ...newKnowledge, content: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3"
                      rows={6}
                      placeholder="Entry content..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <input
                      type="text"
                      value={newKnowledge.category}
                      onChange={(e) => setNewKnowledge({ ...newKnowledge, category: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g., phishing, malware, best-practices"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowAddKnowledge(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addKnowledge}
                    disabled={!newKnowledge.title || !newKnowledge.content || saving}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {saving ? 'Adding...' : 'Add Entry'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Training Tab */}
      {activeTab === 'training' && (
        <div className="space-y-6">
          {/* Upload Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Upload Training Data</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">File Type</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setUploadType('csv')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${
                      uploadType === 'csv' ? 'border-primary-600 bg-primary-50' : 'border-gray-200'
                    }`}
                  >
                    <FileCode className="w-5 h-5" />
                    CSV
                  </button>
                  <button
                    onClick={() => setUploadType('text')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${
                      uploadType === 'text' ? 'border-primary-600 bg-primary-50' : 'border-gray-200'
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                    Text
                  </button>
                  <button
                    onClick={() => setUploadType('json')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${
                      uploadType === 'json' ? 'border-primary-600 bg-primary-50' : 'border-gray-200'
                    }`}
                  >
                    <FileJson className="w-5 h-5" />
                    JSON
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select File</label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  accept={uploadType === 'csv' ? '.csv' : uploadType === 'json' ? '.json' : '.txt'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              {uploadType === 'text' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title (Optional)</label>
                    <input
                      type="text"
                      value={uploadMetadata.title}
                      onChange={(e) => setUploadMetadata({ ...uploadMetadata, title: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Document title..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category (Optional)</label>
                    <input
                      type="text"
                      value={uploadMetadata.category}
                      onChange={(e) => setUploadMetadata({ ...uploadMetadata, category: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g., phishing, malware"
                    />
                  </div>
                </>
              )}

              <button
                onClick={uploadTrainingData}
                disabled={!uploadFile || saving}
                className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                Upload
              </button>
            </div>
          </div>

          {/* Training History */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Training History</h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              </div>
            ) : trainingHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No training data uploaded yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">File</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Progress</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainingHistory.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-3 px-4 text-sm">{item.fileName}</td>
                        <td className="py-3 px-4 text-sm">
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                            {item.dataType.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {item.processedEntries}/{item.totalEntries}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(item.status)}
                            <span className="text-sm capitalize">{item.status}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Time Period:</label>
              <select
                value={analyticsDays}
                onChange={(e) => setAnalyticsDays(parseInt(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <button
                onClick={loadAnalytics}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Download className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Summary Stats */}
          {analytics.length > 0 && (
            <>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Messages</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {analytics.reduce((sum, a) => sum + a.totalMessages, 0)}
                      </p>
                    </div>
                    <MessageSquare className="w-8 h-8 text-blue-600" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Sessions</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {analytics.reduce((sum, a) => sum + a.totalSessions, 0)}
                      </p>
                    </div>
                    <Users className="w-8 h-8 text-green-600" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Avg Rating</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(analytics.reduce((sum, a) => sum + (a.avgRating || 0), 0) / analytics.length).toFixed(1)}
                      </p>
                    </div>
                    <Star className="w-8 h-8 text-yellow-600" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Success Rate</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(
                          (analytics.reduce((sum, a) => sum + a.successfulResponses, 0) /
                            analytics.reduce((sum, a) => sum + a.successfulResponses + a.failedResponses, 0)) *
                          100
                        ).toFixed(1)}
                        %
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-primary-600" />
                  </div>
                </div>
              </div>

              {/* Daily Data Table */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Daily Analytics</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Messages</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Sessions</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Users</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Avg Time (ms)</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.map((day) => (
                        <tr key={day.date} className="border-b border-gray-100">
                          <td className="py-3 px-4 text-sm">{new Date(day.date).toLocaleDateString()}</td>
                          <td className="py-3 px-4 text-sm text-right">{day.totalMessages}</td>
                          <td className="py-3 px-4 text-sm text-right">{day.totalSessions}</td>
                          <td className="py-3 px-4 text-sm text-right">{day.uniqueUsers}</td>
                          <td className="py-3 px-4 text-sm text-right">{day.avgResponseTime?.toFixed(0) || 'N/A'}</td>
                          <td className="py-3 px-4 text-sm text-right">{day.avgRating?.toFixed(1) || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
          )}

          {!loading && analytics.length === 0 && (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No analytics data available for this period</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatbotAdmin;
