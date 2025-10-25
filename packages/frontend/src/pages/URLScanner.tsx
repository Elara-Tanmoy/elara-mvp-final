import React, { useState } from 'react';
import { Shield, AlertCircle, Loader2, Search, Zap, Sparkles, ChevronDown, ChevronUp, Brain, Target, Gauge } from 'lucide-react';
import api from '../lib/api';
import EnhancedScanResults from '../components/EnhancedScanResults';

const URLScanner: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [scan, setScan] = useState<any>(null);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [v2Options, setV2Options] = useState({
    skipScreenshot: false,
    skipTLS: false,
    skipWHOIS: false,
    skipStage2: false
  });

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
      const payload: any = { url };
      // Add V2 options if any are enabled
      if (Object.values(v2Options).some(v => v)) {
        payload.options = v2Options;
      }

      const response = await api.post('/v2/scan/url', payload, { params: { version: 'v2' } });
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
          New V2 Scan
        </button>
        <EnhancedScanResults scan={scan} />
      </div>
    );
  }

  if (scanId && isScanning) {
    return (
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative mb-6">
            <Loader2 className="w-20 h-20 text-primary-600 animate-spin" />
            <Sparkles className="w-8 h-8 text-yellow-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-4">
            <Zap className="w-5 h-5 text-white" />
            <span className="text-white font-bold">V2 ENHANCED SCANNER ACTIVE</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">AI-Powered Deep Analysis Running...</h2>
          <p className="text-gray-600 text-center max-w-md mb-6">
            Our advanced V2 scanner is analyzing this URL through multiple layers of AI models and threat intelligence.
          </p>

          <div className="w-full max-w-md space-y-3 text-sm">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Target className="w-5 h-5 text-blue-600" />
              <span className="text-gray-700">Two-stage ML pipeline processing</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
              <Brain className="w-5 h-5 text-purple-600" />
              <span className="text-gray-700">Gemini AI generating insights</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <Gauge className="w-5 h-5 text-green-600" />
              <span className="text-gray-700">Conformal prediction calibration</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
              <Shield className="w-5 h-5 text-orange-600" />
              <span className="text-gray-700">18 threat intelligence sources checked</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-8 mb-6 border-2 border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">V2 Enhanced URL Scanner</h1>
              <p className="text-sm text-gray-600 mt-1">Powered by Vertex AI & Gemini</p>
            </div>
          </div>
          <div className="px-4 py-2 bg-green-500 text-white font-bold rounded-full text-sm">
            V2 ACTIVE
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-gray-900">AI-Powered</span>
            </div>
            <p className="text-xs text-gray-600">Gemini AI analysis & insights</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900">2-Stage ML</span>
            </div>
            <p className="text-xs text-gray-600">Advanced threat detection</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-gray-900">Confidence</span>
            </div>
            <p className="text-xs text-gray-600">Calibrated predictions</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-lg rounded-lg p-8">
        <form onSubmit={handleScan} className="space-y-6">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
              Enter URL to scan with V2 Enhanced Scanner
            </label>
            <div className="relative">
              <input
                type="text"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

          {/* Advanced Options */}
          <div className="border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 font-medium"
              disabled={isScanning}
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Advanced V2 Options
            </button>

            {showAdvanced && (
              <div className="mt-4 bg-gray-50 rounded-lg p-4 space-y-3">
                <p className="text-xs text-gray-600 mb-3">Customize V2 scanner behavior for faster scans</p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={v2Options.skipScreenshot}
                    onChange={(e) => setV2Options({...v2Options, skipScreenshot: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    disabled={isScanning}
                  />
                  <span className="text-sm text-gray-700">Skip Screenshot Analysis (faster)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={v2Options.skipTLS}
                    onChange={(e) => setV2Options({...v2Options, skipTLS: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    disabled={isScanning}
                  />
                  <span className="text-sm text-gray-700">Skip TLS Certificate Check</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={v2Options.skipWHOIS}
                    onChange={(e) => setV2Options({...v2Options, skipWHOIS: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    disabled={isScanning}
                  />
                  <span className="text-sm text-gray-700">Skip WHOIS Lookup</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={v2Options.skipStage2}
                    onChange={(e) => setV2Options({...v2Options, skipStage2: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    disabled={isScanning}
                  />
                  <span className="text-sm text-gray-700">Skip Stage-2 Deep Analysis (faster)</span>
                </label>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isScanning || !url}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-lg font-bold hover:from-blue-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all transform hover:scale-105"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                V2 Scanner Running...
              </>
            ) : (
              <>
                <Zap className="w-6 h-6" />
                Scan URL with V2 Enhanced Scanner
              </>
            )}
          </button>
        </form>

        <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            V2 Enhanced Features
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5"></div>
              <span className="text-gray-700">Vertex AI ML Models</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-purple-600 rounded-full mt-1.5"></div>
              <span className="text-gray-700">Gemini AI Insights</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-green-600 rounded-full mt-1.5"></div>
              <span className="text-gray-700">Confidence Intervals</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-orange-600 rounded-full mt-1.5"></div>
              <span className="text-gray-700">18 TI Sources</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-red-600 rounded-full mt-1.5"></div>
              <span className="text-gray-700">Screenshot Analysis</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-indigo-600 rounded-full mt-1.5"></div>
              <span className="text-gray-700">Decision Graph</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default URLScanner;
