import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import api from '../lib/api';

interface ScanResultsProps {
  scanId: string;
  onNewScan: () => void;
}

const ScanResults: React.FC<ScanResultsProps> = ({ scanId, onNewScan }) => {
  const [scan, setScan] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchScan = async () => {
      try {
        const response = await api.get(`/v2/scans/${scanId}`);
        setScan(response.data);

        if (response.data.status !== 'completed' && response.data.status !== 'failed') {
          setTimeout(fetchScan, 2000);
        } else {
          setIsLoading(false);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch scan results');
        setIsLoading(false);
      }
    };

    fetchScan();
  }, [scanId]);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-green-600 bg-green-100';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'critical':
      case 'high':
        return <XCircle className="w-6 h-6" />;
      case 'medium':
        return <AlertTriangle className="w-6 h-6" />;
      default:
        return <CheckCircle className="w-6 h-6" />;
    }
  };

  if (isLoading || !scan || scan.status === 'processing' || scan.status === 'pending') {
    return (
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Scanning in Progress</h2>
          <p className="text-gray-600">Analyzing threat patterns across 13 categories...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8">
        <div className="text-center text-red-600">
          <XCircle className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Error</h2>
          <p>{error}</p>
          <button onClick={onNewScan} className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button
        onClick={onNewScan}
        className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
      >
        <ArrowLeft className="w-5 h-5" />
        New Scan
      </button>

      {/* Risk Score Card */}
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Scan Results</h2>
            <p className="text-gray-600">
              {scan.scanType === 'url' && scan.url}
              {scan.scanType === 'message' && 'Message Analysis'}
              {scan.scanType === 'file' && scan.fileName}
            </p>
          </div>
          <div className={`px-6 py-3 rounded-lg font-bold text-lg ${getRiskColor(scan.riskLevel)} flex items-center gap-2`}>
            {getRiskIcon(scan.riskLevel)}
            <span className="uppercase">{scan.riskLevel}</span>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-700 font-medium">Risk Score</span>
            <span className="text-2xl font-bold text-gray-900">{scan.riskScore} / 350</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className={`h-4 rounded-full ${scan.riskScore >= 200 ? 'bg-red-600' : scan.riskScore >= 120 ? 'bg-orange-500' : scan.riskScore >= 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${(scan.riskScore / 350) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Risk Categories */}
      {scan.riskCategories && scan.riskCategories.length > 0 && (
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Threat Categories</h3>
          <div className="space-y-4">
            {scan.riskCategories.map((category: any, idx: number) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">{category.category}</span>
                  <span className="text-gray-600">
                    {category.score} / {category.maxWeight}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${category.score / category.maxWeight > 0.7 ? 'bg-red-600' : category.score / category.maxWeight > 0.4 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${(category.score / category.maxWeight) * 100}%` }}
                  />
                </div>
                {category.findings && category.findings.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {category.findings.map((finding: any, fidx: number) => (
                      <div key={fidx} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        <span>{finding.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Analysis */}
      {scan.aiAnalysis && (
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">AI Analysis</h3>
          <div className="prose max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-lg">
              {typeof scan.aiAnalysis === 'string' ? scan.aiAnalysis : JSON.stringify(scan.aiAnalysis, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Findings */}
      {scan.findings && scan.findings.length > 0 && (
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">All Findings ({scan.findings.length})</h3>
          <div className="space-y-3">
            {scan.findings.map((finding: any, idx: number) => (
              <div key={idx} className="flex items-start gap-3 border-l-4 border-gray-300 pl-4 py-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      finding.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      finding.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                      finding.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {finding.severity}
                    </span>
                    <span className="text-xs text-gray-500">{finding.type}</span>
                  </div>
                  <p className="text-sm text-gray-700">{finding.message}</p>
                </div>
                <span className="text-sm font-medium text-gray-600">+{finding.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanResults;
