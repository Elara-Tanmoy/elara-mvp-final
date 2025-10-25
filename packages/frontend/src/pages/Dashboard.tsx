import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui';
import { Activity, Shield, AlertTriangle, CheckCircle, TrendingUp, FileSearch } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const severityData = [
    { level: 'sev0', label: 'Info', count: 1234, variant: 'sev0' as const },
    { level: 'sev1', label: 'Low', count: 891, variant: 'sev1' as const },
    { level: 'sev2', label: 'Medium', count: 456, variant: 'sev2' as const },
    { level: 'sev3', label: 'High', count: 234, variant: 'sev3' as const },
    { level: 'sev4', label: 'Critical', count: 45, variant: 'sev4' as const },
    { level: 'sev5', label: 'Emergency', count: 3, variant: 'sev5' as const },
  ];

  const recentActivity = [
    { id: 1, type: 'scan', message: 'URL scan completed - Malicious detected', severity: 'sev4', time: '2m ago' },
    { id: 2, type: 'alert', message: 'New phishing campaign identified', severity: 'sev3', time: '5m ago' },
    { id: 3, type: 'incident', message: 'Incident #1234 resolved', severity: 'sev1', time: '10m ago' },
    { id: 4, type: 'scan', message: 'File analysis - Clean', severity: 'sev0', time: '15m ago' },
  ];

  return (
    <div className="min-h-screen bg-surface-base p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-text-primary mb-2">Operations Dashboard</h1>
        <p className="text-text-secondary">Real-time threat intelligence and security monitoring</p>
      </div>

      {/* Severity Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {severityData.map((item) => (
          <Card
            key={item.level}
            notched
            className="cursor-pointer hover:shadow-lg transition-all duration-fast"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Badge variant={item.variant}>{item.label}</Badge>
              </div>
              <div className="text-3xl font-bold text-text-primary">{item.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Live Activity Feed */}
        <Card notched elevated className="lg:col-span-2 spectral-thread">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Live Activity Feed
              </CardTitle>
              <Badge variant="info">Live</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 p-3 rounded-md bg-surface-elevated hover:bg-surface-sunken transition-colors"
                >
                  <div className="flex-shrink-0">
                    {activity.type === 'scan' && <FileSearch className="h-5 w-5 text-primary-500" />}
                    {activity.type === 'alert' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                    {activity.type === 'incident' && <Shield className="h-5 w-5 text-green-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{activity.message}</p>
                    <p className="text-xs text-text-tertiary">{activity.time}</p>
                  </div>
                  <Badge variant={activity.severity as any} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="space-y-6">
          <Card notched elevated>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Risk Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-text-secondary">7 Days</span>
                    <span className="text-sm font-semibold text-green-500">-12%</span>
                  </div>
                  <div className="w-full bg-surface-sunken rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '65%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-text-secondary">30 Days</span>
                    <span className="text-sm font-semibold text-red-500">+8%</span>
                  </div>
                  <div className="w-full bg-surface-sunken rounded-full h-2">
                    <div className="bg-red-500 h-2 rounded-full" style={{ width: '82%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-text-secondary">90 Days</span>
                    <span className="text-sm font-semibold text-green-500">-5%</span>
                  </div>
                  <div className="w-full bg-surface-sunken rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '72%' }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card notched elevated>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Threat Feeds</span>
                  <Badge variant="success">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">ML Models</span>
                  <Badge variant="success">Healthy</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">API Status</span>
                  <Badge variant="success">Online</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hint */}
      <div className="mt-6 text-center">
        <p className="text-sm text-text-tertiary">
          Press <kbd className="px-2 py-1 bg-surface-elevated rounded border border-border-default text-xs">⌘K</kbd> or{' '}
          <kbd className="px-2 py-1 bg-surface-elevated rounded border border-border-default text-xs">Ctrl+K</kbd> for command palette
        </p>
      </div>
    </div>
  );
};
