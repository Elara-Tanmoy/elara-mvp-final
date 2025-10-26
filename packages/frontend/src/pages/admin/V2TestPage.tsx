/**
 * V2 Scanner Test & Calibration Interface
 *
 * Test URLs with different configurations and compare results
 */

import React, { useState } from 'react';
import {
  TestTube, Play, RotateCcw, Loader2, Search, ArrowRight,
  CheckCircle, XCircle, AlertCircle, Info, Target, Gauge
} from 'lucide-react';
import api from '../../lib/api';
import V2ScanResults from '../../components/ScanResults/V2ScanResults';

const V2TestPage: React.FC = () => {
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [compareResults, setCompareResults] = useState<any[]>([]);

  // Test configuration override
  const [customConfig, setCustomConfig] = useState({
    stage1Threshold: 85,
    stage2Threshold: 85,
    enabled: false
  });

  // Preset test URLs
  const testURLs = [
    {
      category: 'Phishing Examples',
      urls: [
        {
          url: 'https://ingresa-inicio-usermua.vercel.app/aumento',
          description: 'Phishing with free hosting + suspicious subdomain + social engineering'
        },
        {
          url: 'https://secure-login-paypal-verify.tk/account',
          description: 'High-risk TLD + brand impersonation + suspicious keywords'
        }
      ]
    },
    {
      category: 'Legitimate Examples',
      urls: [
        {
          url: 'https://www.google.com',
          description: 'Well-known legitimate site'
        },
        {
          url: 'https://github.com',
          description: 'Popular development platform'
        }
      ]
    }
  ];

  const handleTest = async () => {
    if (!url) {
      setError('Please enter a URL');
      return;
    }

    setTesting(true);
    setError('');
    setResult(null);

    try {
      const payload: any = { url };
      if (customConfig.enabled) {
        payload.config = customConfig;
      }

      const response = await api.post('/api/v2-config/test', payload);
      setResult(response.data.result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleCompareTest = async () => {
    if (!url) {
      setError('Please enter a URL');
      return;
    }

    setTesting(true);
    setError('');
    setCompareResults([]);

    try {
      // Test with all three presets
      const presets = ['balanced', 'aggressive', 'conservative'];
      const results = [];

      for (const preset of presets) {
        const response = await api.post('/api/v2-config/test', {
          url,
          config: { preset }
        });
        results.push({
          preset,
          result: response.data.result
        });
      }

      setCompareResults(results);
      setCompareMode(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Comparison test failed');
    } finally {
      setTesting(false);
    }
  };

  const loadTestURL = (testUrl: string) => {
    setUrl(testUrl);
    setResult(null);
    setCompareMode(false);
    setCompareResults([]);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-4">
          <TestTube className="w-10 h-10" />
          <div>
            <h1 className="text-3xl font-bold">V2 Scanner Test Lab</h1>
            <p className="text-purple-100 mt-1">Test URLs and calibrate detection thresholds</p>
          </div>
        </div>
      </div>

      {/* Test Input */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-600" />
          Test URL
        </h2>

        <div className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={testing}
            />
            <Search className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Custom Config Override */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                id="customConfigToggle"
                checked={customConfig.enabled}
                onChange={(e) => setCustomConfig({
                  ...customConfig,
                  enabled: e.target.checked
                })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="customConfigToggle" className="text-sm font-medium text-gray-700">
                Override Configuration for This Test
              </label>
            </div>

            {customConfig.enabled && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stage-1 Threshold: {customConfig.stage1Threshold}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={customConfig.stage1Threshold}
                    onChange={(e) => setCustomConfig({
                      ...customConfig,
                      stage1Threshold: parseInt(e.target.value)
                    })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stage-2 Threshold: {customConfig.stage2Threshold}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={customConfig.stage2Threshold}
                    onChange={(e) => setCustomConfig({
                      ...customConfig,
                      stage2Threshold: parseInt(e.target.value)
                    })}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleTest}
              disabled={testing || !url}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition-all"
            >
              {testing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Run Test
                </>
              )}
            </button>

            <button
              onClick={handleCompareTest}
              disabled={testing || !url}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:bg-gray-400 transition-all"
            >
              <ArrowRight className="w-5 h-5" />
              Compare Presets
            </button>

            <button
              onClick={() => {
                setUrl('');
                setResult(null);
                setCompareMode(false);
                setCompareResults([]);
                setError('');
              }}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition-all"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Preset Test URLs */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-green-600" />
          Preset Test URLs
        </h2>

        <div className="space-y-4">
          {testURLs.map(category => (
            <div key={category.category}>
              <h3 className="font-semibold text-gray-900 mb-2">{category.category}</h3>
              <div className="space-y-2">
                {category.urls.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadTestURL(item.url)}
                    className="w-full text-left p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-mono text-blue-600">{item.url}</div>
                        <div className="text-xs text-gray-600 mt-1">{item.description}</div>
                      </div>
                      <Play className="w-4 h-4 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {!compareMode && result && (
        <div>
          <V2ScanResults scan={result} />
        </div>
      )}

      {/* Compare Results */}
      {compareMode && compareResults.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Preset Comparison</h2>

          <div className="grid grid-cols-3 gap-4">
            {compareResults.map(({ preset, result }) => (
              <div key={preset} className="bg-white rounded-lg shadow-lg p-4 border-2 border-gray-200">
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900 capitalize mb-2">{preset}</h3>
                  <div className="text-5xl font-bold text-blue-600 mb-2">{result.riskScore}</div>
                  <div className="text-sm text-gray-600">Risk Score</div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Verdict:</span>
                    <span className="font-semibold">{result.verdict}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Risk Level:</span>
                    <span className="font-semibold">{result.riskLevel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Confidence:</span>
                    <span className="font-semibold">{result.confidence}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Scan Time:</span>
                    <span className="font-semibold">{result.latency?.total}ms</span>
                  </div>
                </div>

                {result.policyOverride && (
                  <div className="mt-3 p-2 bg-red-50 rounded text-xs">
                    <div className="font-semibold text-red-800">Policy Override</div>
                    <div className="text-red-700">{result.policyOverride.reason}</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Analysis</h4>
            <div className="text-sm text-blue-800">
              Comparing results across presets helps calibrate sensitivity and understand
              detection behavior. Use this to find the right balance for your use case.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default V2TestPage;
