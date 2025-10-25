/**
 * SCAN HISTORY - ESS DESIGN
 * Complete scan audit trail with filtering
 * Mobile-first with Elara Signature System
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { History, Filter, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '../components/ui';
import api from '../lib/api';
import { format } from 'date-fns';

const ScanHistory: React.FC = () => {
  const [scans, setScans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterRisk, setFilterRisk] = useState('');

  useEffect(() => {
    fetchScans();
  }, [page, filterType, filterRisk]);

  const fetchScans = async () => {
    setIsLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (filterType) params.scanType = filterType;
      if (filterRisk) params.riskLevel = filterRisk;

      const response = await api.get('/v2/scans', { params });
      setScans(response.data.scans);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to fetch scans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityVariant = (level: string): 'sev0' | 'sev1' | 'sev2' | 'sev3' | 'sev4' | 'sev5' => {
    switch (level) {
      case 'safe': return 'sev0';
      case 'low': return 'sev1';
      case 'medium': return 'sev2';
      case 'high': return 'sev3';
      case 'critical': return 'sev4';
      default: return 'sev0';
    }
  };

  return (
    <div className="min-h-screen bg-surface-base p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card notched className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <History className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0" />
              <div className="text-center sm:text-left">
                <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                  Scan History
                </h1>
                <p className="text-lg sm:text-xl text-white/90">
                  Complete audit trail of all security scans
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card notched elevated>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2 uppercase tracking-wide">
                  Scan Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                  className="w-full px-4 py-3 border-2 border-border-default rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all bg-surface-base text-text-primary"
                >
                  <option value="">All Types</option>
                  <option value="url">URL</option>
                  <option value="message">Message</option>
                  <option value="file">File</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2 uppercase tracking-wide">
                  Risk Level
                </label>
                <select
                  value={filterRisk}
                  onChange={(e) => { setFilterRisk(e.target.value); setPage(1); }}
                  className="w-full px-4 py-3 border-2 border-border-default rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all bg-surface-base text-text-primary"
                >
                  <option value="">All Risk Levels</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="safe">Safe</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card notched elevated>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" />
                <p className="text-lg text-text-secondary">Loading scans...</p>
              </div>
            ) : scans.length === 0 ? (
              <div className="text-center py-16">
                <History className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
                <p className="text-xl text-text-secondary">No scans found</p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="block md:hidden divide-y divide-border-default">
                  {scans.map((scan) => (
                    <div key={scan.id} className="p-4 hover:bg-surface-sunken transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="info" className="text-xs uppercase">{scan.scanType}</Badge>
                            <Badge variant={getSeverityVariant(scan.riskLevel)}>
                              {scan.riskLevel}
                            </Badge>
                          </div>
                          <p className="text-sm text-text-primary truncate mb-1">
                            {scan.url || scan.fileName || 'Message'}
                          </p>
                          <p className="text-xs text-text-tertiary">
                            {format(new Date(scan.createdAt), 'MMM d, yyyy HH:mm')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-text-primary">{scan.riskScore}</p>
                          <p className="text-xs text-text-tertiary">/ 350</p>
                        </div>
                      </div>
                      <Link to={`/scan/${scan.id}`}>
                        <Button variant="secondary" size="sm" className="w-full">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface-sunken border-b-2 border-border-strong">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wide">Type</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wide">Target</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wide">Risk</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wide">Score</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wide">Date</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {scans.map((scan) => (
                        <tr key={scan.id} className="hover:bg-surface-sunken transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant="info" className="text-xs uppercase">{scan.scanType}</Badge>
                          </td>
                          <td className="px-6 py-4 max-w-xs">
                            <p className="text-sm text-text-primary truncate">
                              {scan.url || scan.fileName || 'Message'}
                            </p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={getSeverityVariant(scan.riskLevel)}>
                              {scan.riskLevel}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-sm font-semibold text-text-primary">
                              {scan.riskScore} <span className="text-text-tertiary font-normal">/ 350</span>
                            </p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-sm text-text-secondary">
                              {format(new Date(scan.createdAt), 'MMM d, yyyy HH:mm')}
                            </p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link to={`/scan/${scan.id}`}>
                              <Button variant="secondary" size="sm">
                                View
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-6 border-t-2 border-border-default">
                    <Button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      variant="secondary"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm font-semibold text-text-primary">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      variant="secondary"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ScanHistory;
