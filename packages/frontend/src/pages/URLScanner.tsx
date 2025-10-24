import React, { useState } from 'react';
import { Shield, AlertCircle, CheckCircle, Loader2, Search } from 'lucide-react';
import api from '../lib/api';
import EnhancedScanResults from '../components/EnhancedScanResults';

const URLScanner: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [scan, setScan] = useState<any>(null);
  const [error, setError] = useState('');

  const validateURL = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateURL(url)) {
      setError('Please enter a valid URL');
      return;
    }

    setIsScanning(true);

    try {
      const response = await api.post('/v2/scan/url', { url });
      setScanId(response.data.scanId);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initiate scan');
      setIsScanning(false);
    }
  };

  const handleNewScan = () => {
    setScanId(null);
    setScan(null);
    setUrl('');
    setIsScanning(false);
  };

  React.useEffect(() => {
    if (!scanId) return;

    const fetchScan = async () => {
      try {
        const response = await api.get(`/v2/scans/${scanId}`);
        setScan(response.data);

        if (response.data.status !== 'completed' && response.data.status !== 'failed') {
          setTimeout(fetchScan, 2000);
        } else {
          setIsScanning(false);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch scan results');
        setIsScanning(false);
      }
    };

    fetchScan();
  }, [scanId]);

  if (scanId && scan?.status === 'completed') {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          onClick={handleNewScan}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          New Scan
        </button>
        <EnhancedScanResults scan={scan} />
      </div>
    );
  }

  if (scanId && isScanning) {
    return (
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Scanning in Progress</h2>
          <p className="text-gray-600">Running RYAN RAG Enhanced Scanner across 9 categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900">URL Threat Scanner</h1>
        </div>

        <p className="text-gray-600 mb-8">
          Scan any URL for threats across 9 comprehensive categories with RYAN RAG Enhanced Scanner.
          Our 350-point analysis system identifies phishing, malware, brand impersonation, and more.
        </p>

        <form onSubmit={handleScan} className="space-y-6">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
              Enter URL to scan
            </label>
            <div className="relative">
              <input
                type="text"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={isScanning}
              />
              <Search className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" />
            </div>
            {error && (
              <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isScanning || !url}
            className="w-full bg-primary-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Scanning URL...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                Scan URL
              </>
            )}
          </button>
        </form>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">9 RYAN RAG Analysis Categories (350 points)</h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Domain Analysis (40 pts)
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Network Security (45 pts)
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Content Analysis (60 pts)
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Privacy Analysis (50 pts)
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Email Security (25 pts)
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Legal Compliance (35 pts)
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Brand Protection (30 pts)
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Threat Intelligence (40 pts)
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Security Headers (25 pts)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default URLScanner;
