/**
 * V2 Scanner Configuration Dashboard
 *
 * Admin interface for configuring V2 scanner thresholds, presets, and rules
 */

import React, { useState, useEffect } from 'react';
import {
  Settings, Save, RotateCcw, Zap, Gauge, Shield, AlertCircle,
  CheckCircle, Info
} from 'lucide-react';
import api from '../../lib/api';

interface V2Config {
  stage1Threshold: number;
  stage2Threshold: number;
  policySensitivity: 'low' | 'medium' | 'high' | 'custom';
  branchThresholds: Record<string, {
    safeThreshold: number;
    lowThreshold: number;
    mediumThreshold: number;
    highThreshold: number;
    criticalThreshold: number;
  }>;
  rules: {
    enableDualTier1Block: boolean;
    enableSinkholeBlock: boolean;
    enableBrandInfraCheck: boolean;
    enableFormOriginCheck: boolean;
    enableHomoglyphDetection: boolean;
  };
}

const V2ConfigPage: React.FC = () => {
  const [config, setConfig] = useState<V2Config | null>(null);
  const [presets, setPresets] = useState<any[]>([]);
  const [currentPreset, setCurrentPreset] = useState<string>('balanced');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
    loadPresets();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await api.get('/v2-config');
      setConfig(response.data.config);
      setCurrentPreset(response.data.currentPreset || 'custom');
      setLoading(false);
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to load configuration' });
      setLoading(false);
    }
  };

  const loadPresets = async () => {
    try {
      const response = await api.get('/v2-config/presets');
      setPresets(response.data.presets);
    } catch (error: any) {
      console.error('Failed to load presets:', error);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setMessage(null);

    try {
      await api.put('/v2-config', config);
      setMessage({ type: 'success', text: 'Configuration saved successfully!' });
      setCurrentPreset('custom');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPreset = async (presetName: string) => {
    try {
      const response = await api.post('/v2-config/preset', { preset: presetName });
      setConfig(response.data.config);
      setCurrentPreset(presetName);
      setMessage({ type: 'success', text: `Preset '${presetName}' applied successfully!` });
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to apply preset' });
    }
  };

  const handleReset = () => {
    handleApplyPreset('balanced');
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Settings className="w-10 h-10" />
            <div>
              <h1 className="text-3xl font-bold">V2 Scanner Configuration</h1>
              <p className="text-blue-100 mt-1">Configure detection thresholds and policies</p>
            </div>
          </div>
          <div className="px-4 py-2 bg-white/20 rounded-lg backdrop-blur">
            <div className="text-sm text-blue-100">Current Preset</div>
            <div className="text-lg font-bold">{currentPreset}</div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-lg p-4 flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Presets */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-600" />
          Configuration Presets
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {presets.map(preset => (
            <button
              key={preset.name}
              onClick={() => handleApplyPreset(preset.name)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                currentPreset === preset.name
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="font-bold text-gray-900 mb-1 capitalize">{preset.name}</div>
              <div className="text-sm text-gray-600">{preset.description}</div>
              {currentPreset === preset.name && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded">
                    <CheckCircle className="w-3 h-3" />
                    Active
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Threshold Configuration */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Gauge className="w-5 h-5 text-purple-600" />
          Detection Thresholds
        </h2>

        <div className="space-y-6">
          {/* Stage-1 Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stage-1 Threshold (Skip Stage-2 if confidence above this)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={config.stage1Threshold}
                onChange={(e) => setConfig({
                  ...config,
                  stage1Threshold: parseInt(e.target.value)
                })}
                className="flex-1"
              />
              <div className="w-20 text-center">
                <span className="text-2xl font-bold text-blue-600">{config.stage1Threshold}</span>
                <span className="text-gray-500 text-sm">%</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Higher values = more scans go to Stage-2 (slower but more accurate)
            </p>
          </div>

          {/* Stage-2 Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stage-2 Threshold (Deep analysis trigger)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={config.stage2Threshold}
                onChange={(e) => setConfig({
                  ...config,
                  stage2Threshold: parseInt(e.target.value)
                })}
                className="flex-1"
              />
              <div className="w-20 text-center">
                <span className="text-2xl font-bold text-purple-600">{config.stage2Threshold}</span>
                <span className="text-gray-500 text-sm">%</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Confidence threshold for invoking heavyweight analysis models
            </p>
          </div>

          {/* Policy Sensitivity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Policy Engine Sensitivity
            </label>
            <div className="grid grid-cols-4 gap-3">
              {(['low', 'medium', 'high', 'custom'] as const).map(level => (
                <button
                  key={level}
                  onClick={() => setConfig({
                    ...config,
                    policySensitivity: level
                  })}
                  className={`py-2 px-4 rounded-lg border-2 font-medium capitalize ${
                    config.policySensitivity === level
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-700 hover:border-blue-300'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detection Rules */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-600" />
          Detection Rules
        </h2>

        <div className="space-y-3">
          <RuleToggle
            label="Dual Tier-1 TI Block"
            description="Block immediately if URL appears in 2+ tier-1 threat intelligence sources"
            enabled={config.rules.enableDualTier1Block}
            onChange={(enabled) => setConfig({
              ...config,
              rules: { ...config.rules, enableDualTier1Block: enabled }
            })}
          />

          <RuleToggle
            label="Sinkhole Block"
            description="Block URLs pointing to known sinkholes"
            enabled={config.rules.enableSinkholeBlock}
            onChange={(enabled) => setConfig({
              ...config,
              rules: { ...config.rules, enableSinkholeBlock: enabled }
            })}
          />

          <RuleToggle
            label="Brand Infrastructure Check"
            description="Flag sites with brand logos hosted on non-brand infrastructure"
            enabled={config.rules.enableBrandInfraCheck}
            onChange={(enabled) => setConfig({
              ...config,
              rules: { ...config.rules, enableBrandInfraCheck: enabled }
            })}
          />

          <RuleToggle
            label="Form Origin Check"
            description="Detect forms submitting to external domains"
            enabled={config.rules.enableFormOriginCheck}
            onChange={(enabled) => setConfig({
              ...config,
              rules: { ...config.rules, enableFormOriginCheck: enabled }
            })}
          />

          <RuleToggle
            label="Homoglyph Detection"
            description="Detect Unicode lookalike characters in URLs"
            enabled={config.rules.enableHomoglyphDetection}
            onChange={(enabled) => setConfig({
              ...config,
              rules: { ...config.rules, enableHomoglyphDetection: enabled }
            })}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition-all"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>

        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition-all"
        >
          <RotateCcw className="w-5 h-5" />
          Reset to Balanced
        </button>

        <div className="ml-auto text-sm text-gray-500">
          <Info className="w-4 h-4 inline mr-1" />
          Changes take effect immediately after saving
        </div>
      </div>
    </div>
  );
};

// RuleToggle component
const RuleToggle: React.FC<{
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}> = ({ label, description, enabled, onChange }) => {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-sm text-gray-600 mt-1">{description}</div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-green-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};

export default V2ConfigPage;
