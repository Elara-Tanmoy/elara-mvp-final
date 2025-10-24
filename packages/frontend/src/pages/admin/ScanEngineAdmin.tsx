/**
 * Scan Engine Admin Dashboard - FULLY FUNCTIONAL
 *
 * Complete admin interface for managing the scan engine:
 * - Configuration Management with live editing
 * - Category & Check weight adjustment
 * - TI Source configuration
 * - Risk threshold tuning
 * - Real-time score calculation
 * - Scan History Browser
 * - Analytics & Reporting
 */

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Sliders, ChevronDown, ChevronRight, Save, Plus, Trash2, Power, Settings as SettingsIcon, Zap, Play, TrendingUp, CheckCircle, Cpu, Database, GitBranch, Edit2, Wifi, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import ScanConsole from '../../components/ScanConsole';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ============================================================================
// INTERFACES
// ============================================================================

interface CategorySchema {
  id: string;
  name: string;
  description: string;
  defaultWeight: number;
  checks: CheckSchema[];
}

interface CheckSchema {
  id: string;
  name: string;
  defaultPoints: number;
  severity: string;
  enabled?: boolean;
  description?: string;
  apiIntegration?: string;
  apiEndpoint?: string;
  credentialsRequired?: boolean;
  automationCapable?: boolean;
  requiresManualReview?: boolean;
  config?: Record<string, any>;
}

interface TISourceSchema {
  id: string;
  name: string;
  defaultPoints: number;
  requiresAPIKey: boolean;
}

interface Schema {
  categories: CategorySchema[];
  tiSources: TISourceSchema[];
  aiModels: {
    models: Array<{ id: string; name: string; defaultWeight: number }>;
    multiplierRange: { min: number; max: number };
  };
  riskThresholds: Record<string, { min: number; max: number; color: string; description: string }>;
  defaultConfig: any;
}

interface Configuration {
  id: string;
  name: string;
  description?: string;
  version: string;
  isActive: boolean;
  isDefault: boolean;
  maxScore: number;
  categoryWeights: Record<string, number>;
  checkWeights: Record<string, number>;
  algorithmConfig: {
    riskThresholds: Record<string, number>;
  };
  aiModelConfig: {
    models: string[];
    consensusWeights: Record<string, number>;
  };
  tiConfig: {
    maxScore: number;
    sourceWeights: Record<string, number>;
  };
  usageCount?: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ScanEngineAdmin() {
  const [activeTab, setActiveTab] = useState<'editor' | 'active' | 'stats' | 'calibrate' | 'checks' | 'ai-models' | 'ti-sources' | 'consensus'>('editor');

  // Schema & Configuration State
  const [schema, setSchema] = useState<Schema | null>(null);
  const [editingConfig, setEditingConfig] = useState<Configuration | null>(null);
  const [allConfigs, setAllConfigs] = useState<Configuration[]>([]);
  const [activeConfig, setActiveConfig] = useState<Configuration | null>(null);
  const [presets, setPresets] = useState<any[]>([]);

  // UI State
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);

  // Statistics State
  const [statistics, setStatistics] = useState<any>(null);

  // Calibration State
  const [testUrl, setTestUrl] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [calibrationScanId, setCalibrationScanId] = useState<string | null>(null);

  // Enterprise Features State
  const [checks, setChecks] = useState<any[]>([]);
  const [aiModels, setAIModels] = useState<any[]>([]);
  const [tiSources, setTISources] = useState<any[]>([]);
  const [consensusConfigs, setConsensusConfigs] = useState<any[]>([]);
  const [editingCheck, setEditingCheck] = useState<any | null>(null);
  const [editingAIModel, setEditingAIModel] = useState<any | null>(null);
  const [editingTISource, setEditingTISource] = useState<any | null>(null);
  const [editingConsensus, setEditingConsensus] = useState<any | null>(null);
  const [testingAIModel, setTestingAIModel] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [viewingTIConfig, setViewingTIConfig] = useState<any | null>(null);
  const [tiConfigDetails, setTIConfigDetails] = useState<any | null>(null);
  const [loadingTIConfig, setLoadingTIConfig] = useState(false);

  const token = localStorage.getItem('accessToken');
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // ENTERPRISE-GRADE CONSTANTS
  const MAX_TOTAL_SCORE = 590;
  const MAX_CATEGORY_SCORE = 535;
  const MAX_TI_SCORE = 55;

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const calculatedMaxScore = useMemo(() => {
    if (!editingConfig) return 0;

    const categoryTotal = Object.values(editingConfig.categoryWeights || {})
      .reduce((sum, weight) => sum + (weight || 0), 0);
    const tiTotal = editingConfig.tiConfig?.maxScore || 55;

    return categoryTotal + tiTotal;
  }, [editingConfig]);

  const tiMaxScore = useMemo(() => {
    if (!editingConfig) return 0;
    return Object.values(editingConfig.tiConfig?.sourceWeights || {})
      .reduce((sum, weight) => sum + (weight || 0), 0);
  }, [editingConfig?.tiConfig]);

  const categoryTotalScore = useMemo(() => {
    if (!editingConfig) return 0;
    return Object.values(editingConfig.categoryWeights || {})
      .reduce((sum, weight) => sum + (weight || 0), 0);
  }, [editingConfig?.categoryWeights]);

  const remainingCategoryBudget = useMemo(() => {
    return MAX_CATEGORY_SCORE - categoryTotalScore;
  }, [categoryTotalScore]);

  const remainingTIBudget = useMemo(() => {
    return MAX_TI_SCORE - tiMaxScore;
  }, [tiMaxScore]);

  const isScoreValid = useMemo(() => {
    return calculatedMaxScore <= MAX_TOTAL_SCORE &&
           categoryTotalScore <= MAX_CATEGORY_SCORE &&
           tiMaxScore <= MAX_TI_SCORE;
  }, [calculatedMaxScore, categoryTotalScore, tiMaxScore]);

  // Real-time score preview calculation
  const liveScorePreview = useMemo(() => {
    if (!editingConfig || !schema) return null;

    const preview = {
      stages: [] as any[],
      totalEstimate: 0,
      categoryBreakdown: [] as any[]
    };

    // Category scores
    schema.categories.forEach((category) => {
      const weight = editingConfig.categoryWeights?.[category.id] || 0;
      preview.categoryBreakdown.push({
        name: category.name,
        maxScore: weight,
        estimatedScore: Math.floor(weight * 0.7) // Estimate 70% achievement
      });
      preview.totalEstimate += Math.floor(weight * 0.7);
    });

    // TI sources
    const tiEstimate = Math.floor(tiMaxScore * 0.5); // Estimate 50% TI hits
    preview.totalEstimate += tiEstimate;

    // Stages
    preview.stages = [
      { name: 'Initial Analysis', score: 0, cumulative: 0 },
      { name: 'Category Checks', score: preview.totalEstimate - tiEstimate, cumulative: preview.totalEstimate - tiEstimate },
      { name: 'TI Lookup', score: tiEstimate, cumulative: preview.totalEstimate },
      { name: 'AI Analysis', score: 0, cumulative: preview.totalEstimate, note: 'Applies multiplier' }
    ];

    return preview;
  }, [editingConfig, schema, tiMaxScore]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadSchema = async () => {
    try {
      const response = await axios.get(`${API_BASE}/v2/admin/scan-engine/schema`, authHeaders);
      if (response.data.success) {
        setSchema(response.data.data);
        if (!editingConfig) {
          setEditingConfig(response.data.data.defaultConfig);
        }
      }
    } catch (error) {
      console.error('Error loading schema:', error);
      showMessage('error', 'Failed to load schema');
    }
  };

  const loadConfigurations = async () => {
    try {
      const response = await axios.get(`${API_BASE}/v2/admin/scan-engine/config`, authHeaders);
      if (response.data.success) {
        setAllConfigs(response.data.data);
      }
    } catch (error) {
      console.error('Error loading configurations:', error);
    }
  };

  const loadActiveConfiguration = async () => {
    try {
      const response = await axios.get(`${API_BASE}/v2/admin/scan-engine/config/active`, authHeaders);
      if (response.data.success) {
        setActiveConfig(response.data.data);
      }
    } catch (error) {
      console.error('Error loading active configuration:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await axios.get(`${API_BASE}/v2/admin/scan-engine/stats`, authHeaders);
      if (response.data.success) {
        setStatistics(response.data.data);
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const loadPresets = async () => {
    try {
      const response = await axios.get(`${API_BASE}/v2/admin/scan-engine/presets`, authHeaders);
      if (response.data.success) {
        setPresets(response.data.data);
      }
    } catch (error) {
      console.error('Error loading presets:', error);
      showMessage('error', 'Failed to load preset configurations');
    }
  };

  // ============================================================================
  // ENTERPRISE FEATURES DATA LOADING
  // ============================================================================

  const loadChecks = async () => {
    try {
      const response = await axios.get(`${API_BASE}/v2/admin/scan-engine/checks`, authHeaders);
      if (response.data.success) {
        setChecks(response.data.data);
      }
    } catch (error) {
      console.error('Error loading check definitions:', error);
      showMessage('error', 'Failed to load check definitions');
    }
  };

  const loadAIModels = async () => {
    try {
      const response = await axios.get(`${API_BASE}/v2/admin/scan-engine/ai-models`, authHeaders);
      if (response.data.success) {
        setAIModels(response.data.data);
      }
    } catch (error) {
      console.error('Error loading AI models:', error);
      showMessage('error', 'Failed to load AI models');
    }
  };

  const loadTISources = async () => {
    try {
      const response = await axios.get(`${API_BASE}/v2/admin/scan-engine/ti-sources`, authHeaders);
      if (response.data.success) {
        setTISources(response.data.data);
      }
    } catch (error) {
      console.error('Error loading TI sources:', error);
      showMessage('error', 'Failed to load TI sources');
    }
  };

  const loadConsensusConfigs = async () => {
    try {
      const response = await axios.get(`${API_BASE}/v2/admin/scan-engine/consensus-configs`, authHeaders);
      if (response.data.success) {
        setConsensusConfigs(response.data.data);
      }
    } catch (error) {
      console.error('Error loading consensus configs:', error);
      showMessage('error', 'Failed to load consensus configurations');
    }
  };

  useEffect(() => {
    loadSchema();
    loadConfigurations();
    loadActiveConfiguration();
    loadStatistics();
    loadPresets();
    loadChecks();
    loadAIModels();
    loadTISources();
    loadConsensusConfigs();
  }, []);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const saveConfiguration = async () => {
    if (!editingConfig) return;

    try {
      setSaving(true);

      const payload = {
        name: editingConfig.name,
        description: editingConfig.description,
        categoryWeights: editingConfig.categoryWeights,
        checkWeights: editingConfig.checkWeights,
        algorithmConfig: editingConfig.algorithmConfig,
        aiModelConfig: editingConfig.aiModelConfig,
        tiConfig: editingConfig.tiConfig
      };

      if (editingConfig.id === 'default' || editingConfig.id.startsWith('new-')) {
        // Create new configuration
        const response = await axios.post(`${API_BASE}/v2/admin/scan-engine/config`, payload, authHeaders);
        if (response.data.success) {
          showMessage('success', 'Configuration created successfully');
          setEditingConfig(response.data.data);
          await loadConfigurations();
        }
      } else {
        // Update existing configuration
        const response = await axios.put(`${API_BASE}/v2/admin/scan-engine/config/${editingConfig.id}`, payload, authHeaders);
        if (response.data.success) {
          showMessage('success', 'Configuration updated successfully');
          setEditingConfig(response.data.data);
          await loadConfigurations();
        }
      }
    } catch (error: any) {
      console.error('Error saving configuration:', error);
      showMessage('error', error.response?.data?.error || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const activateConfiguration = async (configId: string) => {
    try {
      const response = await axios.patch(`${API_BASE}/v2/admin/scan-engine/config/${configId}/activate`, {}, authHeaders);
      if (response.data.success) {
        showMessage('success', 'Configuration activated successfully');
        await loadActiveConfiguration();
        await loadConfigurations();
      }
    } catch (error: any) {
      console.error('Error activating configuration:', error);
      showMessage('error', error.response?.data?.error || 'Failed to activate configuration');
    }
  };

  const deleteConfiguration = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) return;

    try {
      await axios.delete(`${API_BASE}/v2/admin/scan-engine/config/${configId}`, authHeaders);
      showMessage('success', 'Configuration deleted successfully');
      await loadConfigurations();
      if (editingConfig?.id === configId && schema) {
        setEditingConfig(schema.defaultConfig);
      }
    } catch (error: any) {
      console.error('Error deleting configuration:', error);
      showMessage('error', error.response?.data?.error || 'Failed to delete configuration');
    }
  };

  const createNewConfiguration = () => {
    if (!schema) return;

    const newConfig: Configuration = {
      ...schema.defaultConfig,
      id: `new-${Date.now()}`,
      name: 'New Configuration',
      description: 'Custom scan configuration',
      isActive: false,
      isDefault: false
    };

    setEditingConfig(newConfig);
  };

  const updateCategoryWeight = (categoryId: string, weight: number) => {
    if (!editingConfig) return;

    // ENTERPRISE-GRADE VALIDATION: Prevent exceeding max scores
    const currentCategoryTotal = Object.entries(editingConfig.categoryWeights || {})
      .reduce((sum, [id, w]) => sum + (id === categoryId ? 0 : (w || 0)), 0);

    const newCategoryTotal = currentCategoryTotal + weight;

    // Check if new total exceeds category limit
    if (newCategoryTotal > MAX_CATEGORY_SCORE) {
      showMessage('error', `Category total cannot exceed ${MAX_CATEGORY_SCORE} points. Current: ${currentCategoryTotal}, Remaining: ${MAX_CATEGORY_SCORE - currentCategoryTotal}`);
      return;
    }

    // Check if total score would exceed overall limit
    const newTotalScore = newCategoryTotal + tiMaxScore;
    if (newTotalScore > MAX_TOTAL_SCORE) {
      showMessage('error', `Total score cannot exceed ${MAX_TOTAL_SCORE} points`);
      return;
    }

    setEditingConfig({
      ...editingConfig,
      categoryWeights: {
        ...editingConfig.categoryWeights,
        [categoryId]: weight
      }
    });
  };

  const updateCheckWeight = (checkId: string, weight: number) => {
    if (!editingConfig) return;

    // Check weights are independent but we still validate they're reasonable
    if (weight > 50) {
      showMessage('error', 'Individual check weight cannot exceed 50 points');
      return;
    }

    setEditingConfig({
      ...editingConfig,
      checkWeights: {
        ...editingConfig.checkWeights,
        [checkId]: weight
      }
    });
  };

  /**
   * Test connection for an individual check
   */
  const testCheckConnection = async (checkId: string, apiIntegration: string) => {
    try {
      showMessage('success', `Testing ${apiIntegration} connection...`);

      const response = await axios.post(`${API_BASE}/v2/admin/scan-engine/checks/${checkId}/test`, {}, authHeaders);

      if (response.data.success) {
        showMessage('success', `✓ ${apiIntegration} connection test passed!`);
        setTestResults({
          ...testResults,
          [checkId]: { success: true, message: response.data.message, timestamp: new Date() }
        });
      } else {
        showMessage('error', `✗ ${apiIntegration} connection test failed: ${response.data.error}`);
        setTestResults({
          ...testResults,
          [checkId]: { success: false, message: response.data.error, timestamp: new Date() }
        });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Connection test failed';
      showMessage('error', `✗ ${apiIntegration} test error: ${errorMsg}`);
      setTestResults({
        ...testResults,
        [checkId]: { success: false, message: errorMsg, timestamp: new Date() }
      });
    }
  };

  /**
   * Toggle check enabled/disabled
   */
  const toggleCheckEnabled = async (checkId: string, enabled: boolean) => {
    try {
      const response = await axios.post(
        `${API_BASE}/v2/admin/scan-engine/checks/${checkId}/toggle`,
        { enabled },
        authHeaders
      );

      if (response.data.success) {
        showMessage('success', `Check ${enabled ? 'enabled' : 'disabled'} successfully`);

        // Update the check in the schema
        if (schema) {
          const updatedCategories = schema.categories.map(cat => ({
            ...cat,
            checks: cat.checks.map(check =>
              check.id === checkId ? { ...check, enabled } : check
            )
          }));
          setSchema({ ...schema, categories: updatedCategories });
        }
      } else {
        showMessage('error', `Failed to ${enabled ? 'enable' : 'disable'} check`);
      }
    } catch (error: any) {
      showMessage('error', `Error: ${error.response?.data?.error || error.message}`);
    }
  };

  const updateTISourceWeight = (sourceId: string, weight: number) => {
    if (!editingConfig) return;

    // ENTERPRISE-GRADE VALIDATION: Check TI source total
    const currentTITotal = Object.entries(editingConfig.tiConfig?.sourceWeights || {})
      .reduce((sum, [id, w]) => sum + (id === sourceId ? 0 : (w || 0)), 0);

    const newTITotal = currentTITotal + weight;

    // Check if new TI total exceeds limit
    if (newTITotal > MAX_TI_SCORE) {
      showMessage('error', `TI Sources total cannot exceed ${MAX_TI_SCORE} points. Current: ${currentTITotal}, Remaining: ${MAX_TI_SCORE - currentTITotal}`);
      return;
    }

    // Check if total score would exceed overall limit
    const newTotalScore = categoryTotalScore + newTITotal;
    if (newTotalScore > MAX_TOTAL_SCORE) {
      showMessage('error', `Total score cannot exceed ${MAX_TOTAL_SCORE} points`);
      return;
    }

    setEditingConfig({
      ...editingConfig,
      tiConfig: {
        ...editingConfig.tiConfig,
        sourceWeights: {
          ...editingConfig.tiConfig.sourceWeights,
          [sourceId]: weight
        }
      }
    });
  };

  const updateRiskThreshold = (level: string, value: number) => {
    if (!editingConfig) return;

    setEditingConfig({
      ...editingConfig,
      algorithmConfig: {
        ...editingConfig.algorithmConfig,
        riskThresholds: {
          ...editingConfig.algorithmConfig.riskThresholds,
          [level]: value
        }
      }
    });
  };

  const toggleCategoryExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const applyPreset = async (presetId: string) => {
    try {
      const response = await axios.post(`${API_BASE}/v2/admin/scan-engine/preset/${presetId}/apply`, {}, authHeaders);
      if (response.data.success) {
        setEditingConfig(response.data.data);
        setShowPresets(false);
        showMessage('success', `Preset "${response.data.data.name}" applied successfully`);
      }
    } catch (error: any) {
      console.error('Error applying preset:', error);
      showMessage('error', error.response?.data?.error || 'Failed to apply preset');
    }
  };

  const runCalibrationScan = async () => {
    if (!testUrl || !testUrl.trim()) {
      showMessage('error', 'Please enter a URL to test');
      return;
    }

    try {
      setScanning(true);
      setScanResult(null);

      // Generate scanId on frontend BEFORE starting scan
      // This allows ScanConsole to connect and receive logs in real-time
      const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Set scanId immediately to open ScanConsole and establish WebSocket connection
      setCalibrationScanId(scanId);

      const payload = {
        url: testUrl.trim(),
        configurationId: selectedConfig || undefined,
        testMode: true,
        scanId // Pass scanId to backend
      };

      const response = await axios.post(`${API_BASE}/v2/admin/scan-engine/calibrate`, payload, authHeaders);

      if (response.data.success) {
        setScanResult(response.data.data);
        showMessage('success', `Scan completed in ${response.data.data.scanResult.performance.totalDuration}ms`);
      }
    } catch (error: any) {
      console.error('Error running calibration scan:', error);
      showMessage('error', error.response?.data?.error || 'Failed to run scan');
    } finally {
      setScanning(false);
    }
  };

  // ============================================================================
  // ENTERPRISE FEATURES CRUD ACTIONS
  // ============================================================================

  const saveCheckDefinition = async () => {
    if (!editingCheck) return;

    try {
      setSaving(true);

      if (editingCheck.id) {
        // Update existing check
        const response = await axios.put(`${API_BASE}/v2/admin/scan-engine/checks/${editingCheck.id}`, editingCheck, authHeaders);
        if (response.data.success) {
          showMessage('success', 'Check definition updated successfully');
          await loadChecks();
          setEditingCheck(null);
        }
      } else {
        // Create new check
        const response = await axios.post(`${API_BASE}/v2/admin/scan-engine/checks`, editingCheck, authHeaders);
        if (response.data.success) {
          showMessage('success', 'Check definition created successfully');
          await loadChecks();
          setEditingCheck(null);
        }
      }
    } catch (error: any) {
      console.error('Error saving check definition:', error);
      showMessage('error', error.response?.data?.error || 'Failed to save check definition');
    } finally {
      setSaving(false);
    }
  };

  const deleteCheckDefinition = async (checkId: string) => {
    if (!confirm('Are you sure you want to delete this check definition?')) return;

    try {
      await axios.delete(`${API_BASE}/v2/admin/scan-engine/checks/${checkId}`, authHeaders);
      showMessage('success', 'Check definition deleted successfully');
      await loadChecks();
    } catch (error: any) {
      console.error('Error deleting check:', error);
      showMessage('error', error.response?.data?.error || 'Failed to delete check definition');
    }
  };

  // AI Model CRUD Actions
  const saveAIModel = async () => {
    if (!editingAIModel) return;
    try {
      setSaving(true);
      if (editingAIModel.id) {
        const response = await axios.put(`${API_BASE}/v2/admin/scan-engine/ai-models/${editingAIModel.id}`, editingAIModel, authHeaders);
        if (response.data.success) {
          showMessage('success', 'AI Model updated successfully');
          await loadAIModels();
          setEditingAIModel(null);
        }
      } else {
        const response = await axios.post(`${API_BASE}/v2/admin/scan-engine/ai-models`, editingAIModel, authHeaders);
        if (response.data.success) {
          showMessage('success', 'AI Model created successfully');
          await loadAIModels();
          setEditingAIModel(null);
        }
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to save AI Model');
    } finally {
      setSaving(false);
    }
  };

  const deleteAIModel = async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this AI model?')) return;
    try {
      await axios.delete(`${API_BASE}/v2/admin/scan-engine/ai-models/${modelId}`, authHeaders);
      showMessage('success', 'AI Model deleted successfully');
      await loadAIModels();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to delete AI Model');
    }
  };

  const testAIModel = async (modelId: string) => {
    try {
      setTestingAIModel(modelId);
      setTestResults({ ...testResults, [modelId]: { testing: true } });

      const response = await axios.post(
        `${API_BASE}/v2/admin/scan-engine/ai-models/${modelId}/test`,
        { testPrompt: 'Hello, test connection' },
        authHeaders
      );

      if (response.data.success) {
        setTestResults({
          ...testResults,
          [modelId]: {
            testing: false,
            success: response.data.data.success,
            responseTime: response.data.data.responseTime,
            error: response.data.data.error,
            sampleResponse: response.data.data.sampleResponse
          }
        });

        if (response.data.data.success) {
          showMessage('success', `Test successful! Response time: ${response.data.data.responseTime}ms`);
        } else {
          showMessage('error', `Test failed: ${response.data.data.error}`);
        }
      }
    } catch (error: any) {
      setTestResults({ ...testResults, [modelId]: { testing: false, success: false, error: error.response?.data?.error || 'Connection failed' } });
      showMessage('error', error.response?.data?.error || 'Failed to test AI Model');
    } finally {
      setTestingAIModel(null);
    }
  };

  // TI Source CRUD Actions
  const saveTISource = async () => {
    if (!editingTISource) return;
    try {
      setSaving(true);
      if (editingTISource.id) {
        const response = await axios.put(`${API_BASE}/v2/admin/scan-engine/ti-sources/${editingTISource.id}`, editingTISource, authHeaders);
        if (response.data.success) {
          showMessage('success', 'TI Source updated successfully');
          await loadTISources();
          setEditingTISource(null);
        }
      } else {
        const response = await axios.post(`${API_BASE}/v2/admin/scan-engine/ti-sources`, editingTISource, authHeaders);
        if (response.data.success) {
          showMessage('success', 'TI Source created successfully');
          await loadTISources();
          setEditingTISource(null);
        }
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to save TI Source');
    } finally {
      setSaving(false);
    }
  };

  const deleteTISource = async (sourceId: string) => {
    if (!confirm('Are you sure you want to delete this TI source?')) return;
    try {
      await axios.delete(`${API_BASE}/v2/admin/scan-engine/ti-sources/${sourceId}`, authHeaders);
      showMessage('success', 'TI Source deleted successfully');
      await loadTISources();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to delete TI Source');
    }
  };

  const viewTISourceConfig = async (source: any) => {
    setViewingTIConfig(source);
    setLoadingTIConfig(true);
    try {
      const response = await axios.get(`${API_BASE}/v2/threat-intel/sources/${source.id}/config`, authHeaders);
      if (response.data.success) {
        setTIConfigDetails(response.data.config);
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to load API configuration');
    } finally {
      setLoadingTIConfig(false);
    }
  };

  // Consensus Config CRUD Actions
  const saveConsensusConfig = async () => {
    if (!editingConsensus) return;
    try {
      setSaving(true);
      if (editingConsensus.id) {
        const response = await axios.put(`${API_BASE}/v2/admin/scan-engine/consensus-configs/${editingConsensus.id}`, editingConsensus, authHeaders);
        if (response.data.success) {
          showMessage('success', 'Consensus Config updated successfully');
          await loadConsensusConfigs();
          setEditingConsensus(null);
        }
      } else {
        const response = await axios.post(`${API_BASE}/v2/admin/scan-engine/consensus-configs`, editingConsensus, authHeaders);
        if (response.data.success) {
          showMessage('success', 'Consensus Config created successfully');
          await loadConsensusConfigs();
          setEditingConsensus(null);
        }
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to save Consensus Config');
    } finally {
      setSaving(false);
    }
  };

  const deleteConsensusConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this consensus configuration?')) return;
    try {
      await axios.delete(`${API_BASE}/v2/admin/scan-engine/consensus-configs/${configId}`, authHeaders);
      showMessage('success', 'Consensus Config deleted successfully');
      await loadConsensusConfigs();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to delete Consensus Config');
    }
  };

  const activateConsensusConfig = async (configId: string) => {
    try {
      await axios.post(`${API_BASE}/v2/admin/scan-engine/consensus-configs/${configId}/activate`, {}, authHeaders);
      showMessage('success', 'Consensus Config activated successfully');
      await loadConsensusConfigs();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to activate Consensus Config');
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!schema || !editingConfig) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading Scan Engine Admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-indigo-600" />
            Scan Engine Configuration
          </h1>
          <p className="text-gray-600 mt-2">
            Configure scoring weights, thresholds, and behavior for the URL scan engine
          </p>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex flex-wrap -mb-px">
              <button
                onClick={() => setActiveTab('editor')}
                className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'editor'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Sliders className="w-4 h-4" />
                Config Editor
              </button>
              <button
                onClick={() => setActiveTab('checks')}
                className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'checks'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                Check Types
              </button>
              <button
                onClick={() => setActiveTab('ai-models')}
                className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'ai-models'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Cpu className="w-4 h-4" />
                AI Models
              </button>
              <button
                onClick={() => setActiveTab('ti-sources')}
                className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'ti-sources'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Database className="w-4 h-4" />
                TI Sources
              </button>
              <button
                onClick={() => setActiveTab('consensus')}
                className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'consensus'
                    ? 'border-pink-500 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <GitBranch className="w-4 h-4" />
                AI Consensus
              </button>
              <button
                onClick={() => setActiveTab('active')}
                className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'active'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Power className="w-4 h-4" />
                Active Config
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'stats'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Stats
              </button>
              <button
                onClick={() => setActiveTab('calibrate')}
                className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'calibrate'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Zap className="w-4 h-4" />
                Test & Calibrate
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* ================================================================ */}
            {/* CONFIGURATION EDITOR TAB */}
            {/* ================================================================ */}
            {activeTab === 'editor' && (
              <div className="space-y-8">
                {/* Configuration Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={editingConfig.name}
                      onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })}
                      className="text-2xl font-bold text-gray-900 border-b-2 border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none px-2 py-1"
                      placeholder="Configuration Name"
                    />
                    <textarea
                      value={editingConfig.description || ''}
                      onChange={(e) => setEditingConfig({ ...editingConfig, description: e.target.value })}
                      className="mt-2 text-gray-600 border border-gray-300 rounded-lg px-3 py-2 w-full focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      placeholder="Description (optional)"
                      rows={2}
                    />
                  </div>

                  <div className="ml-6 flex gap-3">
                    <button
                      onClick={createNewConfiguration}
                      className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      New
                    </button>
                    <button
                      onClick={saveConfiguration}
                      disabled={saving}
                      className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>

                {/* Max Score Display - ENTERPRISE GRADE */}
                <div className={`border-2 rounded-lg p-6 transition-all ${
                  !isScoreValid
                    ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-300'
                    : calculatedMaxScore === MAX_TOTAL_SCORE
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
                    : 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        Total Max Score
                        {!isScoreValid && <span className="text-red-600 text-sm">⚠️ EXCEEDS LIMIT!</span>}
                        {isScoreValid && calculatedMaxScore === MAX_TOTAL_SCORE && <span className="text-green-600 text-sm">✓ Perfect</span>}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Categories ({categoryTotalScore} / {MAX_CATEGORY_SCORE} pts) +
                        TI Sources ({tiMaxScore} / {MAX_TI_SCORE} pts)
                      </p>
                    </div>
                    <div className={`text-5xl font-bold ${!isScoreValid ? 'text-red-600' : 'text-indigo-600'}`}>
                      {calculatedMaxScore}
                      <span className="text-2xl text-gray-500">/{MAX_TOTAL_SCORE}</span>
                    </div>
                  </div>

                  {/* Budget Display */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Category Budget Remaining</p>
                      <p className={`text-2xl font-bold mt-1 ${remainingCategoryBudget < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {remainingCategoryBudget} pts
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">TI Budget Remaining</p>
                      <p className={`text-2xl font-bold mt-1 ${remainingTIBudget < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {remainingTIBudget} pts
                      </p>
                    </div>
                  </div>
                </div>

                {/* Preset Loader */}
                <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Load Preset Configuration</h3>
                      <p className="text-sm text-gray-500">Apply pre-configured templates</p>
                    </div>
                    <button
                      onClick={() => setShowPresets(!showPresets)}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      {showPresets ? 'Hide' : 'Show'} Presets ({presets.length})
                    </button>
                  </div>

                  {showPresets && presets.length > 0 && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {presets.map((preset) => (
                        <div key={preset.id} className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-all">
                          <h4 className="font-semibold text-gray-900">{preset.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">Max Score: {preset.maxScore}</p>
                          {preset.description && (
                            <p className="text-xs text-gray-600 mt-2">{preset.description}</p>
                          )}
                          <button
                            onClick={() => applyPreset(preset.id)}
                            className="mt-3 w-full bg-purple-100 text-purple-700 px-3 py-1 rounded text-sm hover:bg-purple-200 transition-colors"
                          >
                            Apply Preset
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {showPresets && presets.length === 0 && (
                    <div className="mt-4 text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No presets available</p>
                    </div>
                  )}
                </div>

                {/* Live Preview Toggle */}
                <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Real-time Score Preview</h3>
                      <p className="text-sm text-gray-500">See estimated scoring flow with current weights</p>
                    </div>
                    <button
                      onClick={() => setShowLivePreview(!showLivePreview)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      {showLivePreview ? 'Hide' : 'Show'} Live Preview
                    </button>
                  </div>

                  {showLivePreview && liveScorePreview && (
                    <div className="mt-4 space-y-4">
                      {/* Estimated Score Flow */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-indigo-200">
                        <h4 className="font-semibold text-gray-900 mb-3">Estimated Scoring Flow</h4>
                        <div className="space-y-2">
                          {liveScorePreview.stages.map((stage, index) => (
                            <div key={index} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                                  {index + 1}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{stage.name}</p>
                                  {stage.note && <p className="text-xs text-gray-500">{stage.note}</p>}
                                </div>
                              </div>
                              <div className="text-right">
                                {stage.score > 0 && (
                                  <p className="text-lg font-bold text-indigo-600">+{stage.score}</p>
                                )}
                                <p className="text-sm text-gray-500">Total: {stage.cumulative}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Category Breakdown */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-3">Category Score Breakdown (Estimated)</h4>
                        <div className="space-y-2">
                          {liveScorePreview.categoryBreakdown.slice(0, 5).map((cat, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-sm text-gray-700">{cat.name}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-32 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-indigo-600 h-2 rounded-full"
                                    style={{ width: `${(cat.estimatedScore / cat.maxScore) * 100}%` }}
                                  />
                                </div>
                                <span className="text-sm font-semibold text-gray-900 w-16 text-right">
                                  {cat.estimatedScore}/{cat.maxScore}
                                </span>
                              </div>
                            </div>
                          ))}
                          {liveScorePreview.categoryBreakdown.length > 5 && (
                            <p className="text-xs text-gray-500 text-center mt-2">
                              +{liveScorePreview.categoryBreakdown.length - 5} more categories
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Total Estimate */}
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900">Estimated Final Score</h4>
                            <p className="text-xs text-gray-500">Based on 70% category achievement + 50% TI hits</p>
                          </div>
                          <div className="text-4xl font-bold text-purple-600">
                            {liveScorePreview.totalEstimate}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Category Weights */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Sliders className="w-6 h-6 text-indigo-600" />
                    Category Weights ({schema.categories.length} categories)
                  </h3>
                  <div className="space-y-3">
                    {schema.categories.map((category) => {
                      const weight = editingConfig.categoryWeights?.[category.id] || 0;
                      const isExpanded = expandedCategories.has(category.id);

                      return (
                        <div key={category.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                          {/* Category Header */}
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <button
                                onClick={() => toggleCategoryExpanded(category.id)}
                                className="flex items-center gap-2 text-left flex-1 hover:text-indigo-600 transition-colors"
                              >
                                {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                <div>
                                  <h4 className="font-semibold text-gray-900">{category.name}</h4>
                                  <p className="text-xs text-gray-500">{category.description}</p>
                                </div>
                              </button>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-indigo-600">{weight}</div>
                                <div className="text-xs text-gray-500">points</div>
                              </div>
                            </div>

                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={weight}
                              onChange={(e) => updateCategoryWeight(category.id, parseInt(e.target.value))}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                          </div>

                          {/* Category Checks (Expanded) */}
                          {isExpanded && (
                            <div className="border-t border-gray-200 bg-gray-50 p-4">
                              <h5 className="text-sm font-semibold text-gray-700 mb-3">
                                Individual Checks ({category.checks.length})
                              </h5>
                              {category.checks.length > 0 ? (
                                <div className="space-y-2">
                                  {category.checks.map((check) => {
                                    const checkWeight = editingConfig.checkWeights?.[check.id] ?? check.defaultPoints;
                                    return (
                                      <div key={check.id} className="bg-white p-4 rounded border border-gray-200 hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between mb-3">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <div className="font-medium text-sm text-gray-900">{check.name}</div>
                                              {check.enabled ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                  ✓ Enabled
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                                  Disabled
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-xs text-gray-600 mb-2">
                                              <span className={`inline-block px-2 py-0.5 rounded font-medium ${
                                                check.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                                check.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                                check.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-blue-100 text-blue-700'
                                              }`}>
                                                {check.severity}
                                              </span>
                                              {check.apiIntegration && (
                                                <span className="ml-2 inline-block px-2 py-0.5 rounded font-medium bg-purple-100 text-purple-700">
                                                  API: {check.apiIntegration}
                                                </span>
                                              )}
                                            </div>
                                            {check.description && (
                                              <p className="text-xs text-gray-500 mt-1">{check.description}</p>
                                            )}

                                            {/* Expandable Details - Source, What, How */}
                                            <details className="mt-2">
                                              <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-800 font-medium">
                                                📋 View Technical Details
                                              </summary>
                                              <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200 space-y-2">
                                                {/* Source/Integration */}
                                                <div>
                                                  <div className="text-xs font-semibold text-gray-700 mb-1">🔌 Source/Integration:</div>
                                                  {check.apiIntegration ? (
                                                    <div className="text-xs text-gray-600">
                                                      <span className="font-mono bg-purple-50 px-2 py-0.5 rounded">{check.apiIntegration}</span>
                                                      {check.apiEndpoint && (
                                                        <div className="mt-1 text-[10px] text-gray-500 break-all">
                                                          Endpoint: {check.apiEndpoint}
                                                        </div>
                                                      )}
                                                      {check.credentialsRequired && (
                                                        <div className="mt-1 text-[10px] text-orange-600">
                                                          🔑 Requires API credentials
                                                        </div>
                                                      )}
                                                    </div>
                                                  ) : (
                                                    <div className="text-xs text-gray-600">Built-in logic (no external API)</div>
                                                  )}
                                                </div>

                                                {/* What it checks */}
                                                <div>
                                                  <div className="text-xs font-semibold text-gray-700 mb-1">🎯 What it Checks:</div>
                                                  <div className="text-xs text-gray-600">{check.description || 'No description available'}</div>
                                                </div>

                                                {/* How it works */}
                                                <div>
                                                  <div className="text-xs font-semibold text-gray-700 mb-1">⚙️ How it Works:</div>
                                                  <div className="text-xs text-gray-600">
                                                    {check.automationCapable ? (
                                                      <div>
                                                        <span className="text-green-600">✓ Automated</span> - Runs automatically during scans
                                                        {check.requiresManualReview && (
                                                          <div className="mt-1 text-orange-600">⚠️ Results require manual review</div>
                                                        )}
                                                      </div>
                                                    ) : (
                                                      <div className="text-orange-600">⚠️ Manual review required</div>
                                                    )}
                                                  </div>
                                                </div>

                                                {/* Configuration */}
                                                {check.config && Object.keys(check.config).length > 0 && (
                                                  <div>
                                                    <div className="text-xs font-semibold text-gray-700 mb-1">⚙️ Configuration:</div>
                                                    <pre className="text-[10px] text-gray-600 bg-white p-2 rounded border border-gray-200 overflow-x-auto">
{JSON.stringify(check.config, null, 2)}
                                                    </pre>
                                                  </div>
                                                )}

                                                {/* Severity explanation */}
                                                <div>
                                                  <div className="text-xs font-semibold text-gray-700 mb-1">📊 Severity Impact:</div>
                                                  <div className="text-xs text-gray-600">
                                                    <span className={`font-medium ${
                                                      check.severity === 'critical' ? 'text-red-600' :
                                                      check.severity === 'high' ? 'text-orange-600' :
                                                      check.severity === 'medium' ? 'text-yellow-600' :
                                                      'text-blue-600'
                                                    }`}>
                                                      {check.severity.toUpperCase()}
                                                    </span> - Deducts up to {check.defaultPoints} points when triggered
                                                  </div>
                                                </div>
                                              </div>
                                            </details>
                                          </div>
                                          <div className="flex items-center gap-2 ml-4">
                                            <input
                                              type="number"
                                              min="0"
                                              max="50"
                                              value={checkWeight}
                                              onChange={(e) => updateCheckWeight(check.id, parseInt(e.target.value) || 0)}
                                              className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
                                            />
                                            <span className="text-xs text-gray-500">pts</span>
                                          </div>
                                        </div>

                                        {/* Check Actions Row */}
                                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                          <div className="flex items-center gap-3 text-xs text-gray-500">
                                            <span>Default: {check.defaultPoints} pts</span>
                                            <span>•</span>
                                            <span>ID: <code className="bg-gray-100 px-1 rounded text-[10px]">{check.id}</code></span>
                                            {check.automationCapable && (
                                              <>
                                                <span>•</span>
                                                <span className="text-green-600">🤖 Automated</span>
                                              </>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {/* Test Connection Button */}
                                            {check.apiIntegration && (
                                              <button
                                                onClick={() => testCheckConnection(check.id, check.apiIntegration!)}
                                                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors flex items-center gap-1"
                                              >
                                                <Wifi className="w-3 h-3" />
                                                Test
                                              </button>
                                            )}
                                            {/* Enable/Disable Toggle */}
                                            <button
                                              onClick={() => toggleCheckEnabled(check.id, !check.enabled)}
                                              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                                check.enabled
                                                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                  : 'bg-green-600 text-white hover:bg-green-700'
                                              }`}
                                            >
                                              <Power className="w-3 h-3 inline-block mr-1" />
                                              {check.enabled ? 'Disable' : 'Enable'}
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                                  <p className="text-sm text-yellow-800 font-medium mb-1">
                                    ⚠️ No check definitions found for this category
                                  </p>
                                  <p className="text-xs text-yellow-700">
                                    This category is active and will contribute to scan scoring, but individual check definitions
                                    haven't been configured yet. The scanner uses built-in logic for this category.
                                    <br />
                                    <span className="font-semibold mt-1 block">
                                      To add checks: Go to "Check Types" tab → Add Check Type → Select category: {category.name}
                                    </span>
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* TI Sources */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    Threat Intelligence Sources ({schema.tiSources.length} sources, {tiMaxScore} pts total)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {schema.tiSources.map((source) => {
                      const weight = editingConfig.tiConfig?.sourceWeights?.[source.id] ?? source.defaultPoints;
                      return (
                        <div key={source.id} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-gray-900">{source.name}</h4>
                              {source.requiresAPIKey && <span className="text-xs text-amber-600">API Key Required</span>}
                            </div>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={weight}
                              onChange={(e) => updateTISourceWeight(source.id, parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="10"
                            value={weight}
                            onChange={(e) => updateTISourceWeight(source.id, parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Risk Thresholds */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Risk Level Thresholds (%)</h3>
                  <div className="space-y-4">
                    {Object.entries(schema.riskThresholds).map(([level, info]) => {
                      const value = editingConfig.algorithmConfig?.riskThresholds?.[level] ?? info.min;
                      return (
                        <div key={level} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="font-semibold capitalize" style={{ color: info.color }}>{level}</h4>
                              <p className="text-xs text-gray-500">{info.description}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <input
                                type="number"
                                min={info.min}
                                max={info.max}
                                value={value}
                                onChange={(e) => updateRiskThreshold(level, parseInt(e.target.value) || 0)}
                                className="w-20 px-3 py-1 border border-gray-300 rounded text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                              />
                              <span className="text-sm text-gray-500">%</span>
                            </div>
                          </div>
                          <input
                            type="range"
                            min={info.min}
                            max={info.max}
                            value={value}
                            onChange={(e) => updateRiskThreshold(level, parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            style={{ accentColor: info.color }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================ */}
            {/* ACTIVE CONFIGURATION TAB */}
            {/* ================================================================ */}
            {activeTab === 'active' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Currently Active Configuration</h2>
                  <p className="text-gray-600">This configuration is being used for all new scans</p>
                </div>

                {activeConfig && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <Power className="w-6 h-6 text-green-600" />
                          <h3 className="text-2xl font-bold text-gray-900">{activeConfig.name}</h3>
                          <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full font-medium">
                            ACTIVE
                          </span>
                        </div>
                        {activeConfig.description && (
                          <p className="text-gray-600 mt-2">{activeConfig.description}</p>
                        )}
                        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Max Score:</span>
                            <span className="ml-2 font-semibold text-gray-900">{activeConfig.maxScore} points</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Usage Count:</span>
                            <span className="ml-2 font-semibold text-gray-900">{activeConfig.usageCount || 0} scans</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Version:</span>
                            <span className="ml-2 font-semibold text-gray-900">{activeConfig.version}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Last Updated:</span>
                            <span className="ml-2 font-semibold text-gray-900">
                              {new Date(activeConfig.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setEditingConfig(activeConfig);
                          setActiveTab('editor');
                        }}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Edit Configuration
                      </button>
                    </div>
                  </div>
                )}

                {/* All Configurations */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">All Configurations</h3>
                  <div className="space-y-3">
                    {allConfigs.map((config) => (
                      <div
                        key={config.id}
                        className={`bg-white border-2 rounded-lg p-4 transition-all ${
                          config.isActive ? 'border-green-300' : 'border-gray-200 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="font-semibold text-lg text-gray-900">{config.name}</h4>
                              {config.isActive && (
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Active</span>
                              )}
                              {config.isDefault && (
                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Default</span>
                              )}
                            </div>
                            {config.description && (
                              <p className="text-sm text-gray-600 mt-1">{config.description}</p>
                            )}
                            <div className="mt-3 flex gap-6 text-sm text-gray-500">
                              <span>Max Score: <strong>{config.maxScore}</strong> pts</span>
                              <span>Scans: <strong>{config.usageCount || 0}</strong></span>
                              <span>Updated: <strong>{new Date(config.updatedAt).toLocaleDateString()}</strong></span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {!config.isActive && (
                              <button
                                onClick={() => activateConfiguration(config.id)}
                                className="flex items-center gap-1 bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 transition-colors"
                              >
                                <Power className="w-4 h-4" />
                                Activate
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingConfig(config);
                                setActiveTab('editor');
                              }}
                              className="bg-indigo-500 text-white px-3 py-1 rounded text-sm hover:bg-indigo-600 transition-colors"
                            >
                              Edit
                            </button>
                            {!config.isActive && !config.isDefault && (
                              <button
                                onClick={() => deleteConfiguration(config.id)}
                                className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================ */}
            {/* STATISTICS TAB */}
            {/* ================================================================ */}
            {activeTab === 'stats' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Scan Statistics</h2>
                  <p className="text-gray-600">Performance metrics and usage analytics</p>
                </div>

                {/* Check if we have statistics data */}
                {!statistics || statistics.totalScans === 0 ? (
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                    <div className="inline-block p-4 bg-white rounded-full mb-4">
                      <TrendingUp className="w-12 h-12 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">No Scan Data Yet</h3>
                    <p className="text-gray-500 mb-4">
                      Run some URL scans to see statistics and analytics here
                    </p>
                    <button
                      onClick={() => setActiveTab('calibrate')}
                      className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Go to Test & Calibrate
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h3 className="text-gray-500 text-sm font-medium">Total Scans</h3>
                        <p className="text-4xl font-bold text-gray-900 mt-2">{statistics.totalScans}</p>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h3 className="text-gray-500 text-sm font-medium">Average Base Score</h3>
                        <p className="text-4xl font-bold text-indigo-600 mt-2">
                          {statistics.averageScores?._avg?.baseScore?.toFixed(0) || 0}
                        </p>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h3 className="text-gray-500 text-sm font-medium">Average Final Score</h3>
                        <p className="text-4xl font-bold text-purple-600 mt-2">
                          {statistics.averageScores?._avg?.finalScore?.toFixed(0) || 0}
                        </p>
                      </div>
                    </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Distribution</h3>
                  <div className="space-y-3">
                    {Object.entries(statistics.riskDistribution || {}).map(([level, count]: [string, any]) => (
                      <div key={level} className="flex items-center justify-between">
                        <span className="capitalize text-gray-700">{level}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-48 bg-gray-200 rounded-full h-4">
                            <div
                              className={`h-4 rounded-full ${
                                level === 'critical' ? 'bg-red-600' :
                                level === 'high' ? 'bg-orange-500' :
                                level === 'medium' ? 'bg-yellow-500' :
                                level === 'low' ? 'bg-blue-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${(count / statistics.totalScans) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-gray-900 w-12 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {statistics.topConfigurations && statistics.topConfigurations.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Configurations by Usage</h3>
                    <div className="space-y-2">
                      {statistics.topConfigurations.map((config: any) => (
                        <div key={config.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-gray-900">{config.name}</span>
                            {config.isActive && (
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Active</span>
                            )}
                          </div>
                          <span className="text-sm text-gray-600">{config.usageCount} scans</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                  </>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* TEST & CALIBRATE TAB */}
            {/* ================================================================ */}
            {activeTab === 'calibrate' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Zap className="w-7 h-7 text-yellow-500" />
                    Live URL Testing & Visual Calibration
                  </h2>
                  <p className="text-gray-600">
                    Test URLs in real-time and see how each stage of the scoring algorithm works
                  </p>
                </div>

                {/* Test Panel */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">URL Test Panel</h3>

                  <div className="space-y-4">
                    {/* URL Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Test URL
                      </label>
                      <input
                        type="url"
                        value={testUrl}
                        onChange={(e) => setTestUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none text-lg"
                      />
                    </div>

                    {/* Configuration Selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Test Configuration (leave empty for active config)
                      </label>
                      <select
                        value={selectedConfig}
                        onChange={(e) => setSelectedConfig(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                      >
                        <option value="">Active Configuration</option>
                        {allConfigs.map((config) => (
                          <option key={config.id} value={config.id}>
                            {config.name} {config.isActive ? '(Active)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Scan Button */}
                    <button
                      onClick={runCalibrationScan}
                      disabled={scanning}
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 font-semibold text-lg flex items-center justify-center gap-3"
                    >
                      {scanning ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Scanning URL...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          Run Calibration Scan
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Real-time Scan Console */}
                {(scanning || calibrationScanId) && (
                  <ScanConsole
                    scanId={calibrationScanId}
                    className="mt-6"
                  />
                )}

                {/* Scan Results */}
                {scanResult && (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className={`border-2 rounded-lg p-4 ${
                        scanResult.scanResult.riskLevel === 'safe' ? 'bg-green-50 border-green-300' :
                        scanResult.scanResult.riskLevel === 'low' ? 'bg-blue-50 border-blue-300' :
                        scanResult.scanResult.riskLevel === 'medium' ? 'bg-yellow-50 border-yellow-300' :
                        scanResult.scanResult.riskLevel === 'high' ? 'bg-orange-50 border-orange-300' :
                        'bg-red-50 border-red-300'
                      }`}>
                        <h4 className="text-sm font-medium text-gray-600">Risk Level</h4>
                        <p className="text-3xl font-bold mt-2 uppercase">{scanResult.scanResult.riskLevel}</p>
                      </div>

                      <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-600">Final Score</h4>
                        <p className="text-3xl font-bold text-indigo-600 mt-2">
                          {scanResult.scanResult.finalScore}
                        </p>
                        <p className="text-xs text-gray-500">/ {scanResult.scanResult.activeMaxScore}</p>
                      </div>

                      <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-600">AI Multiplier</h4>
                        <p className="text-3xl font-bold text-purple-600 mt-2">
                          {scanResult.scanResult.aiAnalysis.finalMultiplier.toFixed(2)}×
                        </p>
                        <p className="text-xs text-gray-500">
                          {scanResult.scanResult.aiAnalysis.averageConfidence.toFixed(0)}% confidence
                        </p>
                      </div>

                      <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-600">Scan Duration</h4>
                        <p className="text-3xl font-bold text-gray-900 mt-2">
                          {(scanResult.scanResult.performance.totalDuration / 1000).toFixed(1)}s
                        </p>
                        <p className="text-xs text-gray-500">Total time</p>
                      </div>
                    </div>

                    {/* Visual Scoring Flow */}
                    <div className="bg-white border-2 border-indigo-200 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-indigo-600" />
                        Visual Scoring Flow - Step by Step
                      </h3>

                      {scanResult.visualFlow && scanResult.visualFlow.steps && (
                        <div className="space-y-4">
                          {scanResult.visualFlow.steps.map((step: any, index: number) => (
                            <div key={index} className="relative">
                              {/* Connection Line */}
                              {index < scanResult.visualFlow.steps.length - 1 && (
                                <div className="absolute left-6 top-16 w-0.5 h-full bg-indigo-200 z-0"></div>
                              )}

                              {/* Step Card */}
                              <div className="relative z-10 flex gap-4">
                                {/* Step Number Circle */}
                                <div className="flex-shrink-0">
                                  <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
                                    {step.step}
                                  </div>
                                </div>

                                {/* Step Content */}
                                <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-200">
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-100 px-2 py-1 rounded">
                                          {step.stage}
                                        </span>
                                        <h4 className="font-bold text-gray-900">{step.name}</h4>
                                      </div>
                                      <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                                    </div>

                                    <div className="text-right">
                                      {step.score !== 0 && (
                                        <div className={`text-2xl font-bold ${step.score > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                          {step.score > 0 ? '+' : ''}{step.score}
                                        </div>
                                      )}
                                      <div className="text-sm text-gray-500">
                                        Total: {step.cumulativeScore}
                                      </div>
                                      {step.duration > 0 && (
                                        <div className="text-xs text-gray-400 mt-1">
                                          {step.duration}ms
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Step Data */}
                                  {step.data && Object.keys(step.data).length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                        {Object.entries(step.data).slice(0, 6).map(([key, value]: [string, any]) => (
                                          <div key={key} className="bg-white p-2 rounded border border-gray-100">
                                            <span className="text-gray-500">{key}:</span>
                                            <span className="ml-1 font-semibold text-gray-900">
                                              {typeof value === 'object' ? JSON.stringify(value).slice(0, 30) : String(value).slice(0, 30)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Score Progression Chart */}
                    <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Score Progression</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart
                          data={scanResult.visualFlow?.steps?.map((step: any) => ({
                            name: step.name ? step.name.slice(0, 20) : 'Unknown',
                            score: step.cumulativeScore || 0
                          })) || []}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={11} />
                          <YAxis />
                          <Tooltip />
                          <Area type="monotone" dataKey="score" stroke="#4f46e5" fill="#818cf8" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Category Breakdown Chart */}
                    {scanResult.scanResult.categories && scanResult.scanResult.categories.length > 0 && (
                      <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Category Scores</h3>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart
                            data={(scanResult.scanResult.categories || []).map((cat: any) => ({
                              name: cat.name ? cat.name.slice(0, 15) : 'Unknown',
                              score: cat.score || 0,
                              max: cat.maxWeight || 0
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={11} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="score" fill="#4f46e5" name="Score" />
                            <Bar dataKey="max" fill="#e5e7eb" name="Max Weight" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}

                {/* No Results Yet */}
                {!scanResult && !scanning && (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                    <Zap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">No scan results yet</h3>
                    <p className="text-gray-500">
                      Enter a URL above and click "Run Calibration Scan" to see the visual scoring workflow
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* CHECK TYPES MANAGEMENT TAB */}
            {/* ================================================================ */}
            {activeTab === 'checks' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-7 h-7 text-green-600" />
                      Check Types Management
                    </h2>
                    <p className="text-gray-600">Manage individual check definitions and their configurations</p>
                  </div>
                  <button
                    onClick={() => setEditingCheck({ checkId: '', name: '', category: '', description: '', executionOrder: 0, enabled: true })}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Check Type
                  </button>
                </div>

                {/* Checks Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {checks.map((check) => (
                    <div key={check.id} className={`border-2 rounded-lg p-4 transition-all ${check.enabled ? 'border-green-200 bg-white' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{check.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">{check.checkId}</p>
                          {check.description && (
                            <p className="text-sm text-gray-600 mt-2">{check.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => toggleCheckEnabled(check.id, !check.enabled)}
                          className={`ml-2 p-2 rounded transition-colors ${
                            check.enabled
                              ? 'bg-green-100 text-green-600 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Category:</span>
                          <span className="font-medium text-gray-900">{check.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Order:</span>
                          <span className="font-medium text-gray-900">{check.executionOrder}</span>
                        </div>
                        {check.maxPoints !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Max Points:</span>
                            <span className="font-medium text-indigo-600">{check.maxPoints}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => setEditingCheck(check)}
                          className="flex-1 bg-indigo-50 text-indigo-700 px-3 py-2 rounded text-sm hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => deleteCheckDefinition(check.id)}
                          className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Empty State */}
                {checks.length === 0 && (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                    <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">No Check Types Defined</h3>
                    <p className="text-gray-500 mb-4">
                      Start by adding your first check type definition
                    </p>
                    <button
                      onClick={() => setEditingCheck({ checkId: '', name: '', category: '', description: '', executionOrder: 0, enabled: true })}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Add First Check Type
                    </button>
                  </div>
                )}

                {/* Edit Modal */}
                {editingCheck && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="p-6">
                        <h3 className="text-2xl font-bold text-gray-900 mb-4">
                          {editingCheck.id ? 'Edit Check Type' : 'New Check Type'}
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Check ID</label>
                            <input
                              type="text"
                              value={editingCheck.checkId}
                              onChange={(e) => setEditingCheck({ ...editingCheck, checkId: e.target.value })}
                              placeholder="e.g., url_https_check"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                            <input
                              type="text"
                              value={editingCheck.name}
                              onChange={(e) => setEditingCheck({ ...editingCheck, name: e.target.value })}
                              placeholder="e.g., HTTPS Protocol Check"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                            <input
                              type="text"
                              value={editingCheck.category}
                              onChange={(e) => setEditingCheck({ ...editingCheck, category: e.target.value })}
                              placeholder="e.g., url_analysis"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                            <textarea
                              value={editingCheck.description || ''}
                              onChange={(e) => setEditingCheck({ ...editingCheck, description: e.target.value })}
                              placeholder="Describe what this check does..."
                              rows={3}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Execution Order</label>
                              <input
                                type="number"
                                value={editingCheck.executionOrder}
                                onChange={(e) => setEditingCheck({ ...editingCheck, executionOrder: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Max Points (optional)</label>
                              <input
                                type="number"
                                value={editingCheck.maxPoints || ''}
                                onChange={(e) => setEditingCheck({ ...editingCheck, maxPoints: e.target.value ? parseInt(e.target.value) : undefined })}
                                placeholder="Default points"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editingCheck.enabled}
                                onChange={(e) => setEditingCheck({ ...editingCheck, enabled: e.target.checked })}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                              <span className="ml-3 text-sm font-medium text-gray-700">Enabled</span>
                            </label>
                          </div>
                        </div>

                        <div className="mt-6 flex gap-3 justify-end">
                          <button
                            onClick={() => setEditingCheck(null)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveCheckDefinition}
                            disabled={saving}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Check Type'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* AI MODELS MANAGEMENT TAB */}
            {/* ================================================================ */}
            {activeTab === 'ai-models' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Cpu className="w-7 h-7 text-purple-600" />
                      AI Models Management
                    </h2>
                    <p className="text-gray-600">Configure AI models for consensus-based URL analysis</p>
                  </div>
                  <button
                    onClick={() => setEditingAIModel({ modelId: '', name: '', provider: '', endpoint: '', apiKeyRequired: false, rank: 1, weight: 1.0, enabled: true })}
                    className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add AI Model
                  </button>
                </div>

                {/* AI Models Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {aiModels.map((model) => (
                    <div key={model.id} className={`border-2 rounded-lg p-4 transition-all ${model.enabled ? 'border-purple-200 bg-white' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{model.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">{model.modelId}</p>
                          <p className="text-xs text-purple-600 mt-1">{model.provider}</p>
                        </div>
                        <button
                          onClick={() => setEditingAIModel(model)}
                          className="ml-2 p-2 rounded transition-colors bg-blue-100 text-blue-600 hover:bg-blue-200"
                          title="Edit AI Model"
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Rank:</span>
                          <span className="font-medium text-gray-900">{model.rank}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Weight:</span>
                          <span className="font-medium text-gray-900">{model.weight}x</span>
                        </div>
                        {model.endpoint && (
                          <div className="flex flex-col gap-1">
                            <span className="text-gray-500">Endpoint:</span>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700 break-all">
                              {model.endpoint}
                            </code>
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          <span className="text-gray-500">API Key:</span>
                          {model.apiKey ? (
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">
                              ••••••••••••{model.apiKey.slice(-8)}
                            </code>
                          ) : (
                            <span className="text-xs text-red-600 font-semibold">⚠️ Missing API Key</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => testAIModel(model.id)}
                            disabled={testingAIModel === model.id || !model.enabled}
                            className={`flex-1 px-3 py-2 rounded text-sm transition-colors flex items-center justify-center gap-1 ${
                              testingAIModel === model.id
                                ? 'bg-gray-200 text-gray-500 cursor-wait'
                                : !model.enabled
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : testResults[model.id]?.success
                                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                : testResults[model.id]?.success === false
                                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            <Wifi className="w-3 h-3" />
                            {testingAIModel === model.id ? 'Testing...' : 'Test Connection'}
                          </button>
                          <button
                            onClick={() => setEditingAIModel(model)}
                            className="bg-purple-50 text-purple-700 px-3 py-2 rounded text-sm hover:bg-purple-100 transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteAIModel(model.id)}
                            className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Test Result Display */}
                        {testResults[model.id] && !testResults[model.id].testing && (
                          <div className={`text-xs p-2 rounded ${
                            testResults[model.id].success
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {testResults[model.id].success ? (
                              <div>
                                <div className="font-semibold">✓ Connected successfully</div>
                                <div className="mt-1">Response: {testResults[model.id].responseTime}ms</div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-semibold">✗ Connection failed</div>
                                <div className="mt-1">{testResults[model.id].error}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Empty State */}
                {aiModels.length === 0 && (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                    <Cpu className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">No AI Models Configured</h3>
                    <p className="text-gray-500 mb-4">
                      Add AI models to enable multi-model consensus analysis
                    </p>
                    <button
                      onClick={() => setEditingAIModel({ modelId: '', name: '', provider: '', endpoint: '', apiKeyRequired: false, rank: 1, weight: 1.0, enabled: true })}
                      className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Add First AI Model
                    </button>
                  </div>
                )}

                {/* Edit Modal */}
                {editingAIModel && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="p-6">
                        <h3 className="text-2xl font-bold text-gray-900 mb-4">
                          {editingAIModel.id ? 'Edit AI Model' : 'New AI Model'}
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Model ID</label>
                            <input
                              type="text"
                              value={editingAIModel.modelId}
                              onChange={(e) => setEditingAIModel({ ...editingAIModel, modelId: e.target.value })}
                              placeholder="e.g., gpt-4-turbo"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                            <input
                              type="text"
                              value={editingAIModel.name}
                              onChange={(e) => setEditingAIModel({ ...editingAIModel, name: e.target.value })}
                              placeholder="e.g., OpenAI GPT-4 Turbo"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                            <input
                              type="text"
                              value={editingAIModel.provider}
                              onChange={(e) => setEditingAIModel({ ...editingAIModel, provider: e.target.value })}
                              placeholder="e.g., openai"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">API Key (optional)</label>
                            <input
                              type="password"
                              onChange={(e) => setEditingAIModel({ ...editingAIModel, apiKey: e.target.value })}
                              placeholder="Leave blank to use existing key"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="mt-6 flex gap-3 justify-end">
                          <button
                            onClick={() => setEditingAIModel(null)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveAIModel}
                            disabled={saving}
                            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save AI Model'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* TI SOURCES MANAGEMENT TAB */}
            {/* ================================================================ */}
            {activeTab === 'ti-sources' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Database className="w-7 h-7 text-orange-600" />
                      Threat Intelligence Sources
                    </h2>
                    <p className="text-gray-600">Manage threat intelligence data sources and providers</p>
                  </div>
                  <button
                    onClick={() => setEditingTISource({ sourceId: '', name: '', apiEndpoint: '', apiKeyRequired: false, priority: 1, reliability: 0.9, enabled: true })}
                    className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add TI Source
                  </button>
                </div>

                {/* TI Sources Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tiSources.map((source) => (
                    <div key={source.id} className={`border-2 rounded-lg p-4 transition-all ${source.enabled ? 'border-orange-200 bg-white' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{source.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">{source.sourceId}</p>
                          {source.apiEndpoint && (
                            <p className="text-xs text-orange-600 mt-1 truncate">{source.apiEndpoint}</p>
                          )}
                        </div>
                        <button
                          onClick={() => setEditingTISource(source)}
                          className="ml-2 p-2 rounded transition-colors bg-blue-100 text-blue-600 hover:bg-blue-200"
                          title="Edit TI Source"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Priority:</span>
                          <span className="font-medium text-gray-900">{source.priority}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Reliability:</span>
                          <span className="font-medium text-gray-900">{(source.reliability * 100).toFixed(0)}%</span>
                        </div>
                        {source.apiKeyRequired && (
                          <div className="flex justify-between">
                            <span className="text-xs text-amber-600">API Key Required</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => viewTISourceConfig(source)}
                          className="flex-1 bg-blue-50 text-blue-700 px-3 py-2 rounded text-sm hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                          title="View API Configuration Details"
                        >
                          <SettingsIcon className="w-3 h-3" />
                          API Details
                        </button>
                        <button
                          onClick={() => setEditingTISource(source)}
                          className="flex-1 bg-orange-50 text-orange-700 px-3 py-2 rounded text-sm hover:bg-orange-100 transition-colors flex items-center justify-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => deleteTISource(source.id)}
                          className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Empty State */}
                {tiSources.length === 0 && (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                    <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">No TI Sources Configured</h3>
                    <p className="text-gray-500 mb-4">
                      Add threat intelligence sources to enhance URL risk detection
                    </p>
                    <button
                      onClick={() => setEditingTISource({ sourceId: '', name: '', apiEndpoint: '', apiKeyRequired: false, priority: 1, reliability: 0.9, enabled: true })}
                      className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      Add First TI Source
                    </button>
                  </div>
                )}

                {/* Edit Modal */}
                {editingTISource && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="p-6">
                        <h3 className="text-2xl font-bold text-gray-900 mb-4">
                          {editingTISource.id ? 'Edit TI Source' : 'New TI Source'}
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Source ID</label>
                            <input
                              type="text"
                              value={editingTISource.sourceId}
                              onChange={(e) => setEditingTISource({ ...editingTISource, sourceId: e.target.value })}
                              placeholder="e.g., virustotal"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                            <input
                              type="text"
                              value={editingTISource.name}
                              onChange={(e) => setEditingTISource({ ...editingTISource, name: e.target.value })}
                              placeholder="e.g., VirusTotal"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">API Endpoint</label>
                            <input
                              type="url"
                              value={editingTISource.apiEndpoint || ''}
                              onChange={(e) => setEditingTISource({ ...editingTISource, apiEndpoint: e.target.value })}
                              placeholder="https://api.virustotal.com/v3/urls"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 focus:outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                              <input
                                type="number"
                                min="1"
                                value={editingTISource.priority}
                                onChange={(e) => setEditingTISource({ ...editingTISource, priority: parseInt(e.target.value) || 1 })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Reliability (0-1)</label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="1"
                                value={editingTISource.reliability}
                                onChange={(e) => setEditingTISource({ ...editingTISource, reliability: parseFloat(e.target.value) || 0.9 })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editingTISource.apiKeyRequired}
                                onChange={(e) => setEditingTISource({ ...editingTISource, apiKeyRequired: e.target.checked })}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                              <span className="ml-3 text-sm font-medium text-gray-700">Requires API Key</span>
                            </label>
                          </div>

                          <div className="flex items-center gap-3">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editingTISource.enabled}
                                onChange={(e) => setEditingTISource({ ...editingTISource, enabled: e.target.checked })}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                              <span className="ml-3 text-sm font-medium text-gray-700">Enabled</span>
                            </label>
                          </div>
                        </div>

                        <div className="mt-6 flex gap-3 justify-end">
                          <button
                            onClick={() => setEditingTISource(null)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveTISource}
                            disabled={saving}
                            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save TI Source'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* API Configuration Details Modal */}
                {viewingTIConfig && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                              <SettingsIcon className="w-6 h-6 text-blue-600" />
                              API Configuration: {viewingTIConfig.name}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">{viewingTIConfig.description || 'No description available'}</p>
                          </div>
                          <button
                            onClick={() => { setViewingTIConfig(null); setTIConfigDetails(null); }}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <X className="w-5 h-5 text-gray-500" />
                          </button>
                        </div>

                        {loadingTIConfig ? (
                          <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                          </div>
                        ) : tiConfigDetails?.apiConfig ? (
                          <div className="space-y-6">
                            {/* Basic Info */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Endpoint Information</h4>
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <span className="text-xs font-medium text-gray-500 min-w-[100px]">URL:</span>
                                  <span className="text-sm font-mono text-gray-900 break-all">{tiConfigDetails.url || 'Not configured'}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-xs font-medium text-gray-500 min-w-[100px]">Auth Required:</span>
                                  <span className={`text-sm font-medium ${tiConfigDetails.requiresAuth ? 'text-amber-600' : 'text-green-600'}`}>
                                    {tiConfigDetails.requiresAuth ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* API Configuration */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Method & Timeout */}
                              <div className="space-y-3">
                                <div>
                                  <div className="text-xs font-medium text-gray-500 mb-1">HTTP Method</div>
                                  <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm font-mono text-blue-800">
                                    {tiConfigDetails.apiConfig.method}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-xs font-medium text-gray-500 mb-1">Timeout</div>
                                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                                    {tiConfigDetails.apiConfig.timeout}ms ({(tiConfigDetails.apiConfig.timeout / 1000).toFixed(0)}s)
                                  </div>
                                </div>

                                {tiConfigDetails.apiConfig.authHeaderName && (
                                  <div>
                                    <div className="text-xs font-medium text-gray-500 mb-1">Auth Header Name</div>
                                    <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-sm font-mono text-yellow-900">
                                      {tiConfigDetails.apiConfig.authHeaderName}
                                    </div>
                                  </div>
                                )}

                                {tiConfigDetails.apiConfig.envVarName && (
                                  <div>
                                    <div className="text-xs font-medium text-gray-500 mb-1">Environment Variable</div>
                                    <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded text-sm font-mono text-purple-900">
                                      {tiConfigDetails.apiConfig.envVarName}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Headers */}
                              <div>
                                <div className="text-xs font-medium text-gray-500 mb-2">HTTP Headers</div>
                                <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-2 max-h-48 overflow-y-auto">
                                  {Object.entries(tiConfigDetails.apiConfig.headers || {}).map(([key, value]) => (
                                    <div key={key} className="text-xs">
                                      <span className="font-semibold text-gray-700">{key}:</span>
                                      <span className="ml-2 text-gray-600 font-mono break-all">
                                        {String(value).includes('{') && String(value).includes('}')
                                          ? <span className="text-yellow-600">{String(value)}</span>
                                          : String(value)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Query Parameters */}
                            {tiConfigDetails.apiConfig.queryParams && Object.keys(tiConfigDetails.apiConfig.queryParams).length > 0 && (
                              <div>
                                <div className="text-xs font-medium text-gray-500 mb-2">Query Parameters</div>
                                <div className="bg-green-50 border border-green-200 rounded p-3 space-y-2">
                                  {Object.entries(tiConfigDetails.apiConfig.queryParams).map(([key, value]) => (
                                    <div key={key} className="text-xs">
                                      <span className="font-semibold text-green-700">{key}=</span>
                                      <span className="text-green-600 font-mono">{String(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Body Parameters */}
                            {tiConfigDetails.apiConfig.bodyParams && (
                              <div>
                                <div className="text-xs font-medium text-gray-500 mb-2">Request Body</div>
                                <div className="bg-indigo-50 border border-indigo-200 rounded p-3">
                                  <pre className="text-xs text-indigo-900 font-mono whitespace-pre-wrap break-all">
                                    {tiConfigDetails.apiConfig.bodyParams}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                            <p className="text-yellow-800 font-medium">No API configuration available</p>
                            <p className="text-sm text-yellow-600 mt-2">This source may not have detailed API configuration populated yet.</p>
                          </div>
                        )}

                        <div className="mt-6 flex justify-end">
                          <button
                            onClick={() => { setViewingTIConfig(null); setTIConfigDetails(null); }}
                            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* AI CONSENSUS CONFIGURATION TAB */}
            {/* ================================================================ */}
            {activeTab === 'consensus' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <GitBranch className="w-7 h-7 text-pink-600" />
                      AI Consensus Configuration
                    </h2>
                    <p className="text-gray-600">Configure multi-AI consensus strategies and thresholds</p>
                  </div>
                  <button
                    onClick={() => setEditingConsensus({ name: '', strategy: 'majority', modelRankings: [], confidenceThreshold: 0.7, isActive: false })}
                    className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Consensus Config
                  </button>
                </div>

                {/* Consensus Configs List */}
                <div className="space-y-4">
                  {consensusConfigs.map((config) => (
                    <div key={config.id} className={`border-2 rounded-lg p-6 transition-all ${config.isActive ? 'border-pink-300 bg-pink-50' : 'border-gray-200 bg-white'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h4 className="text-xl font-semibold text-gray-900">{config.name}</h4>
                            {config.isActive && (
                              <span className="bg-pink-100 text-pink-800 text-xs px-3 py-1 rounded-full font-medium">
                                ACTIVE
                              </span>
                            )}
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Strategy:</span>
                              <span className="ml-2 font-semibold text-gray-900 capitalize">{config.strategy}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Confidence Threshold:</span>
                              <span className="ml-2 font-semibold text-gray-900">{(config.confidenceThreshold * 100).toFixed(0)}%</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Model Count:</span>
                              <span className="ml-2 font-semibold text-gray-900">{config.modelRankings?.length || 0} models</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {!config.isActive && (
                            <button
                              onClick={() => activateConsensusConfig(config.id)}
                              className="flex items-center gap-1 bg-pink-500 text-white px-3 py-1 rounded text-sm hover:bg-pink-600 transition-colors"
                            >
                              <Power className="w-4 h-4" />
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => setEditingConsensus(config)}
                            className="bg-indigo-50 text-indigo-700 px-3 py-2 rounded text-sm hover:bg-indigo-100 transition-colors flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            Edit
                          </button>
                          {!config.isActive && (
                            <button
                              onClick={() => deleteConsensusConfig(config.id)}
                              className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm hover:bg-red-100 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Empty State */}
                {consensusConfigs.length === 0 && (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                    <GitBranch className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">No Consensus Configurations</h3>
                    <p className="text-gray-500 mb-4">
                      Create a consensus strategy to combine multiple AI model outputs
                    </p>
                    <button
                      onClick={() => setEditingConsensus({ name: '', strategy: 'majority', modelRankings: [], confidenceThreshold: 0.7, isActive: false })}
                      className="bg-pink-600 text-white px-6 py-3 rounded-lg hover:bg-pink-700 transition-colors"
                    >
                      Create First Config
                    </button>
                  </div>
                )}

                {/* Edit Modal */}
                {editingConsensus && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="p-6">
                        <h3 className="text-2xl font-bold text-gray-900 mb-4">
                          {editingConsensus.id ? 'Edit Consensus Config' : 'New Consensus Config'}
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Configuration Name</label>
                            <input
                              type="text"
                              value={editingConsensus.name}
                              onChange={(e) => setEditingConsensus({ ...editingConsensus, name: e.target.value })}
                              placeholder="e.g., Default Consensus Strategy"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Strategy</label>
                            <select
                              value={editingConsensus.strategy}
                              onChange={(e) => setEditingConsensus({ ...editingConsensus, strategy: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 focus:outline-none"
                            >
                              <option value="majority">Majority Vote</option>
                              <option value="weighted">Weighted Average</option>
                              <option value="unanimous">Unanimous Agreement</option>
                              <option value="rank_based">Rank-Based Priority</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Confidence Threshold (0-1)</label>
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              max="1"
                              value={editingConsensus.confidenceThreshold}
                              onChange={(e) => setEditingConsensus({ ...editingConsensus, confidenceThreshold: parseFloat(e.target.value) || 0.7 })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Model Rankings (comma-separated IDs)</label>
                            <input
                              type="text"
                              value={editingConsensus.modelRankings?.join(', ') || ''}
                              onChange={(e) => setEditingConsensus({ ...editingConsensus, modelRankings: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                              placeholder="e.g., gpt-4, claude-3, gemini-pro"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 focus:outline-none"
                            />
                            <p className="text-xs text-gray-500 mt-1">Enter model IDs in priority order</p>
                          </div>
                        </div>

                        <div className="mt-6 flex gap-3 justify-end">
                          <button
                            onClick={() => setEditingConsensus(null)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveConsensusConfig}
                            disabled={saving}
                            className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Config'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
