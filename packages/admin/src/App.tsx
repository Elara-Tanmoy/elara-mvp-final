import React, { useState, useEffect } from 'react';
import { Shield, BarChart3, Users, Database, Activity, Settings } from 'lucide-react';
import { api, HealthStatus } from './lib/api';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isDbConnected, setIsDbConnected] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const healthStatus = await api.getHealth();
        setHealth(healthStatus);
        setIsDbConnected(healthStatus.database === 'connected');
      } catch (error) {
        console.error('Failed to check health:', error);
        setIsDbConnected(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Elara Admin</h1>
                <p className="text-sm text-gray-500">Enterprise Threat Detection Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">Admin User</div>
                <div className="text-xs text-gray-500">admin@elara.com</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 border-b">
          {[
            { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
            { id: 'organizations', icon: Users, label: 'Organizations' },
            { id: 'users', icon: Users, label: 'Users' },
            { id: 'datasets', icon: Database, label: 'Datasets' },
            { id: 'metrics', icon: Activity, label: 'System Metrics' },
            { id: 'settings', icon: Settings, label: 'Settings' }
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors ${
                activeTab === id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Dashboard Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Scans', value: '12,543', change: '+12.5%', color: 'blue' },
                { label: 'Organizations', value: '127', change: '+5.2%', color: 'green' },
                { label: 'Active Users', value: '1,834', change: '+8.1%', color: 'purple' },
                { label: 'Threats Detected', value: '891', change: '-2.3%', color: 'red' }
              ].map((stat, idx) => (
                <div key={idx} className="bg-white rounded-lg shadow p-6">
                  <div className="text-sm font-medium text-gray-500">{stat.label}</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                    <div className={`text-sm font-medium ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.change}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Recent Scans</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {[
                    { org: 'Acme Corp', type: 'URL', risk: 'High', time: '2 mins ago' },
                    { org: 'TechStart Inc', type: 'Message', risk: 'Low', time: '5 mins ago' },
                    { org: 'Global Finance', type: 'File', risk: 'Critical', time: '8 mins ago' },
                    { org: 'SecureNet', type: 'URL', risk: 'Medium', time: '12 mins ago' }
                  ].map((scan, idx) => (
                    <div key={idx} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div>
                        <div className="font-medium text-gray-900">{scan.org}</div>
                        <div className="text-sm text-gray-500">{scan.type} Scan</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          scan.risk === 'Critical' ? 'bg-red-100 text-red-800' :
                          scan.risk === 'High' ? 'bg-orange-100 text-orange-800' :
                          scan.risk === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {scan.risk}
                        </span>
                        <span className="text-sm text-gray-500">{scan.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Datasets Tab */}
        {activeTab === 'datasets' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Threat Intelligence Datasets</h2>
              <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                Upload Dataset
              </button>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <div className="text-center py-12">
                  <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Datasets Yet</h3>
                  <p className="text-gray-500 mb-4">Upload CSV files containing threat intelligence data</p>
                  <button className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                    Upload Your First Dataset
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other tabs */}
        {activeTab !== 'dashboard' && activeTab !== 'datasets' && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className={`mb-4 ${isDbConnected ? 'text-green-400' : 'text-gray-400'}`}>
              <Activity className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Management
            </h3>
            {isDbConnected ? (
              <div>
                <p className="text-green-600 font-medium mb-2">✓ Database Connected</p>
                <p className="text-gray-500">
                  Admin features are ready to use
                </p>
                {health && (
                  <div className="mt-4 text-sm text-gray-600">
                    <p>Redis: {health.services.redis}</p>
                    <p>ChromaDB: {health.services.chromadb}</p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="text-orange-600 font-medium mb-2">⚠ Database Not Connected</p>
                <p className="text-gray-500">
                  Run database migrations to enable admin features
                </p>
                <code className="mt-2 block text-xs bg-gray-100 p-2 rounded">
                  pnpm db:migrate
                </code>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <Shield className="w-4 h-4" />
            <span>Elara Platform v1.0.0 - Enterprise Threat Detection</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
