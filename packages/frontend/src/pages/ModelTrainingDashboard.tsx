import React, { useState, useEffect } from 'react';
import {
  Brain, Database, Zap, TrendingUp, Upload, Play, CheckCircle,
  AlertCircle, Clock, Target, Gauge, Box, Cloud, Activity
} from 'lucide-react';
import api from '../lib/api';

const ModelTrainingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'training' | 'models' | 'features'>('overview');
  const [trainingData, setTrainingData] = useState<any>(null);
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load training data stats, models, etc.
      const response = await api.get('/v2/admin/training/stats');
      setTrainingData(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Model Training Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Vertex AI Model Training Dashboard</h1>
            <p className="text-blue-100">Manage ML models, training pipelines, and feature store</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-lg backdrop-blur">
            <Cloud className="w-5 h-5" />
            <span className="font-semibold">GCP: elara-mvp-13082025-u1</span>
          </div>
        </div>
      </div>

      {/* Infrastructure Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <Database className="w-8 h-8 text-blue-600" />
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded">ACTIVE</span>
          </div>
          <h3 className="font-bold text-gray-900">BigQuery Dataset</h3>
          <p className="text-sm text-gray-600">elara_training_data_v2</p>
          <div className="mt-2 text-xs text-gray-500">5 tables created</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <Box className="w-8 h-8 text-purple-600" />
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded">ACTIVE</span>
          </div>
          <h3 className="font-bold text-gray-900">Cloud Storage</h3>
          <p className="text-sm text-gray-600">Training Data Bucket</p>
          <div className="mt-2 text-xs text-gray-500">gs://elara-mvp-training-data</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <Brain className="w-8 h-8 text-green-600" />
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded">PENDING</span>
          </div>
          <h3 className="font-bold text-gray-900">Vertex AI Models</h3>
          <p className="text-sm text-gray-600">5 models to train</p>
          <div className="mt-2 text-xs text-gray-500">0 deployed endpoints</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-8 h-8 text-orange-600" />
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded">READY</span>
          </div>
          <h3 className="font-bold text-gray-900">Firestore Cache</h3>
          <p className="text-sm text-gray-600">Feature Store</p>
          <div className="mt-2 text-xs text-gray-500">v2_features collection</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {['overview', 'training', 'models', 'features'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-4 px-2 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'training' && <TrainingTab />}
          {activeTab === 'models' && <ModelsTab />}
          {activeTab === 'features' && <FeaturesTab />}
        </div>
      </div>
    </div>
  );
};

const OverviewTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border-2 border-blue-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">V2 ML Pipeline Architecture</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Stage 1: Fast Models</h3>
              <p className="text-sm text-gray-600">URL BERT + Tabular Risk (CPU, low latency)</p>
              <div className="mt-2 flex gap-2">
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">Training Needed</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Not Deployed</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-600 rounded-lg text-white">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Stage 2: Deep Analysis</h3>
              <p className="text-sm text-gray-600">Text Persuasion + Screenshot CNN (GPU, high accuracy)</p>
              <div className="mt-2 flex gap-2">
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">Training Needed</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Not Deployed</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-600 rounded-lg text-white">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Combiner + Calibration</h3>
              <p className="text-sm text-gray-600">Fuses predictions with conformal calibration</p>
              <div className="mt-2 flex gap-2">
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">Training Needed</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Not Deployed</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-2 border-orange-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-6 h-6 text-orange-600" />
          <h2 className="text-lg font-bold text-gray-900">Next Steps to Production</h2>
        </div>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>Upload training data (phishing URLs + benign URLs)</li>
          <li>Trigger model training jobs via Training tab</li>
          <li>Monitor training progress in Vertex AI console</li>
          <li>Deploy trained models to endpoints</li>
          <li>Test V2 scanner with real ML predictions</li>
        </ol>
      </div>
    </div>
  );
};

const TrainingTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white border-2 border-blue-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Training Data Upload</h2>
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">Upload Training Dataset</h3>
            <p className="text-sm text-gray-600 mb-4">CSV or JSON format with labeled URLs (phishing/benign)</p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Select File to Upload
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Required Format:</h4>
            <code className="text-xs bg-gray-800 text-green-400 p-3 rounded block overflow-x-auto">
              {`{
  "url": "https://example.com",
  "label": "phishing" | "benign",
  "features": {
    "domainAge": 15,
    "hasLoginForm": true,
    ...
  }
}`}
            </code>
          </div>
        </div>
      </div>

      <div className="bg-white border-2 border-green-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Start Training Pipeline</h2>
        <div className="grid grid-cols-2 gap-4">
          <button className="flex items-center justify-between p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50">
            <div>
              <h3 className="font-semibold text-gray-900">Train Stage 1 Models</h3>
              <p className="text-sm text-gray-600">URL BERT + Tabular Risk</p>
            </div>
            <Play className="w-6 h-6 text-blue-600" />
          </button>

          <button className="flex items-center justify-between p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50">
            <div>
              <h3 className="font-semibold text-gray-900">Train Stage 2 Models</h3>
              <p className="text-sm text-gray-600">Text + Screenshot</p>
            </div>
            <Play className="w-6 h-6 text-purple-600" />
          </button>

          <button className="flex items-center justify-between p-4 border-2 border-green-200 rounded-lg hover:bg-green-50">
            <div>
              <h3 className="font-semibold text-gray-900">Train Combiner</h3>
              <p className="text-sm text-gray-600">Fusion model</p>
            </div>
            <Play className="w-6 h-6 text-green-600" />
          </button>

          <button className="flex items-center justify-between p-4 border-2 border-orange-200 rounded-lg hover:bg-orange-50">
            <div>
              <h3 className="font-semibold text-gray-900">Calibrate Predictions</h3>
              <p className="text-sm text-gray-600">Conformal calibration</p>
            </div>
            <Play className="w-6 h-6 text-orange-600" />
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Training Job History</h2>
        <div className="text-center py-8 text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No training jobs yet. Upload data and start training above.</p>
        </div>
      </div>
    </div>
  );
};

const ModelsTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Deployed Models & Endpoints</h2>
        </div>
        <div className="divide-y">
          {[
            { name: 'URL BERT Model', status: 'Not Deployed', type: 'Stage 1', endpoint: '-' },
            { name: 'Tabular Risk Model', status: 'Not Deployed', type: 'Stage 1', endpoint: '-' },
            { name: 'Text Persuasion Model', status: 'Not Deployed', type: 'Stage 2', endpoint: '-' },
            { name: 'Screenshot CNN Model', status: 'Not Deployed', type: 'Stage 2', endpoint: '-' },
            { name: 'Combiner Model', status: 'Not Deployed', type: 'Fusion', endpoint: '-' },
          ].map((model, idx) => (
            <div key={idx} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{model.name}</h3>
                  <p className="text-sm text-gray-600">Type: {model.type} | Endpoint: {model.endpoint}</p>
                </div>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded">
                  {model.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const FeaturesTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Feature Store (Firestore)</h2>
        <p className="text-gray-600 mb-4">
          Features are cached in Firestore collection: <code className="bg-gray-100 px-2 py-1 rounded">v2_features</code>
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">URL Features</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Domain age, TLD, path depth</li>
              <li>• Lexical tokens, entropy</li>
              <li>• Suspicious patterns</li>
            </ul>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Content Features</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Form detection, input types</li>
              <li>• Text persuasion signals</li>
              <li>• Screenshot visual features</li>
            </ul>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Network Features</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• TLS certificate validity</li>
              <li>• DNS records, ASN info</li>
              <li>• WHOIS data</li>
            </ul>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">TI Features</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• 18 threat intel sources</li>
              <li>• Tier-1 hit detection</li>
              <li>• Historical reputation</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">BigQuery Tables</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="font-mono text-sm">phishing_urls</span>
            <span className="text-sm text-gray-600">Labeled phishing samples</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="font-mono text-sm">benign_urls</span>
            <span className="text-sm text-gray-600">Labeled benign samples</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="font-mono text-sm">scan_features</span>
            <span className="text-sm text-gray-600">Extracted features from scans</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="font-mono text-sm">ti_hits</span>
            <span className="text-sm text-gray-600">Threat intelligence matches</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="font-mono text-sm">uploaded_training_data</span>
            <span className="text-sm text-gray-600">User-uploaded datasets</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelTrainingDashboard;
