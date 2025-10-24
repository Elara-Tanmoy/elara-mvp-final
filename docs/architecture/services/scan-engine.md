# Enterprise Scan Engine - Comprehensive Implementation Plan

**Document Version:** 1.0
**Created:** 2025-10-16
**Status:** Phase 1 Checkpoint - Ready for Implementation
**Purpose:** Detailed roadmap for implementing enterprise-grade scan engine admin features

---

## Executive Summary

This document outlines the complete implementation plan for transforming the Elara Scan Engine Admin dashboard into a fully enterprise-grade management system with granular control over all scanning parameters, AI models, threat intelligence sources, and scoring algorithms.

### Current State (Completed ✅)
- ✅ Basic scan configuration CRUD
- ✅ Score validation (590 max: 535 categories + 55 TI)
- ✅ Edit config functionality with tab switching
- ✅ Preset configuration templates (6 presets)
- ✅ Statistics dashboard with empty state
- ✅ Basic real-time score preview
- ✅ Database schema enhanced with 4 new models:
  - `CheckDefinition` - Dynamic check management
  - `AIModelDefinition` - AI model configuration
  - `AIConsensusConfig` - Consensus strategy settings
  - Enhanced `ThreatIntelSource` - TI source management

### Target State (To Be Implemented 🎯)
- 🎯 Dynamic real-time visual algorithm flow (updates with every slider change)
- 🎯 Full CRUD for URL security check types
- 🎯 Full CRUD for threat intelligence sources with API testing
- 🎯 Full CRUD for AI/LLM models (Claude, GPT, Gemini, Grok, HuggingFace, etc.)
- 🎯 AI consensus configuration with ranking and weighting
- 🎯 Granular points control for individual sub-checks
- 🎯 Custom configuration creation and management
- 🎯 Full scan calibration with custom configs

---

## Implementation Phases

### 🔵 PHASE 1: Backend CRUD Endpoints (Priority: HIGH)

#### 1.1 Check Definition Management

**File:** `packages/backend/src/controllers/scan-config-admin.controller.ts`

**New Methods to Add:**

```typescript
// GET /api/v2/admin/scan-engine/checks
async getCheckDefinitions(req: Request, res: Response) {
  try {
    const { category, enabled, search } = req.query;

    const where: any = {};
    if (category) where.category = category;
    if (enabled !== undefined) where.enabled = enabled === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { checkId: { contains: search, mode: 'insensitive' } }
      ];
    }

    const checks = await prisma.checkDefinition.findMany({
      where,
      orderBy: [{ category: 'asc' }, { executionOrder: 'asc' }]
    });

    res.json({ success: true, data: checks });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error fetching check definitions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch check definitions'
    });
  }
}

// POST /api/v2/admin/scan-engine/checks
async createCheckDefinition(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const checkData = req.body;

    // Validation
    if (!checkData.checkId || !checkData.name || !checkData.category) {
      return res.status(400).json({
        success: false,
        error: 'checkId, name, and category are required'
      });
    }

    // Check for duplicate checkId
    const existing = await prisma.checkDefinition.findUnique({
      where: { checkId: checkData.checkId }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Check with ID '${checkData.checkId}' already exists`
      });
    }

    const newCheck = await prisma.checkDefinition.create({
      data: {
        ...checkData,
        createdBy: userId
      }
    });

    logger.info(`[ScanConfigAdmin] Created check definition: ${newCheck.checkId}`);
    res.status(201).json({ success: true, data: newCheck });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error creating check definition:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create check definition'
    });
  }
}

// PUT /api/v2/admin/scan-engine/checks/:id
async updateCheckDefinition(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const updateData = req.body;

    const updated = await prisma.checkDefinition.update({
      where: { id },
      data: {
        ...updateData,
        lastEditedBy: userId
      }
    });

    logger.info(`[ScanConfigAdmin] Updated check definition: ${updated.checkId}`);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error updating check definition:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update check definition'
    });
  }
}

// DELETE /api/v2/admin/scan-engine/checks/:id
async deleteCheckDefinition(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Prevent deletion of system checks
    const check = await prisma.checkDefinition.findUnique({ where: { id } });
    if (check?.isSystemCheck) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete system checks'
      });
    }

    await prisma.checkDefinition.delete({ where: { id } });

    logger.info(`[ScanConfigAdmin] Deleted check definition: ${id}`);
    res.json({ success: true, message: 'Check deleted successfully' });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error deleting check definition:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete check definition'
    });
  }
}

// POST /api/v2/admin/scan-engine/checks/:id/toggle
async toggleCheckDefinition(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    const updated = await prisma.checkDefinition.update({
      where: { id },
      data: { enabled }
    });

    logger.info(`[ScanConfigAdmin] Toggled check ${updated.checkId}: ${enabled}`);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error toggling check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle check'
    });
  }
}
```

**Routes to Add:**

```typescript
// File: packages/backend/src/routes/admin.routes.ts
router.get('/scan-engine/checks', adminController.getCheckDefinitions.bind(adminController));
router.post('/scan-engine/checks', adminController.createCheckDefinition.bind(adminController));
router.put('/scan-engine/checks/:id', adminController.updateCheckDefinition.bind(adminController));
router.delete('/scan-engine/checks/:id', adminController.deleteCheckDefinition.bind(adminController));
router.post('/scan-engine/checks/:id/toggle', adminController.toggleCheckDefinition.bind(adminController));
```

#### 1.2 AI Model Management

**New Methods to Add:**

```typescript
// GET /api/v2/admin/scan-engine/ai-models
async getAIModels(req: Request, res: Response) {
  try {
    const { provider, enabled } = req.query;

    const where: any = {};
    if (provider) where.provider = provider;
    if (enabled !== undefined) where.enabled = enabled === 'true';

    const models = await prisma.aIModelDefinition.findMany({
      where,
      orderBy: [{ rank: 'asc' }, { name: 'asc' }]
    });

    res.json({ success: true, data: models });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error fetching AI models:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch AI models' });
  }
}

// POST /api/v2/admin/scan-engine/ai-models
async createAIModel(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const modelData = req.body;

    // Validation
    if (!modelData.modelId || !modelData.name || !modelData.provider) {
      return res.status(400).json({
        success: false,
        error: 'modelId, name, and provider are required'
      });
    }

    // Check for duplicate
    const existing = await prisma.aIModelDefinition.findUnique({
      where: { modelId: modelData.modelId }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Model '${modelData.modelId}' already exists`
      });
    }

    const newModel = await prisma.aIModelDefinition.create({
      data: {
        ...modelData,
        createdBy: userId
      }
    });

    logger.info(`[ScanConfigAdmin] Created AI model: ${newModel.modelId}`);
    res.status(201).json({ success: true, data: newModel });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error creating AI model:', error);
    res.status(500).json({ success: false, error: 'Failed to create AI model' });
  }
}

// PUT /api/v2/admin/scan-engine/ai-models/:id
async updateAIModel(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const updated = await prisma.aIModelDefinition.update({
      where: { id },
      data: {
        ...req.body,
        lastEditedBy: userId
      }
    });

    logger.info(`[ScanConfigAdmin] Updated AI model: ${updated.modelId}`);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error updating AI model:', error);
    res.status(500).json({ success: false, error: 'Failed to update AI model' });
  }
}

// DELETE /api/v2/admin/scan-engine/ai-models/:id
async deleteAIModel(req: Request, res: Response) {
  try {
    const { id } = req.params;

    await prisma.aIModelDefinition.delete({ where: { id } });

    logger.info(`[ScanConfigAdmin] Deleted AI model: ${id}`);
    res.json({ success: true, message: 'AI model deleted successfully' });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error deleting AI model:', error);
    res.status(500).json({ success: false, error: 'Failed to delete AI model' });
  }
}

// POST /api/v2/admin/scan-engine/ai-models/:id/test
async testAIModel(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { testPrompt = "Hello, test connection" } = req.body;

    const model = await prisma.aIModelDefinition.findUnique({ where: { id } });
    if (!model) {
      return res.status(404).json({ success: false, error: 'Model not found' });
    }

    // TODO: Implement actual API test based on provider
    const startTime = Date.now();
    let testResult = {
      success: false,
      responseTime: 0,
      error: null as string | null
    };

    try {
      // Placeholder for actual API call
      // const response = await callAIProvider(model, testPrompt);
      testResult.success = true;
      testResult.responseTime = Date.now() - startTime;
    } catch (error) {
      testResult.error = error instanceof Error ? error.message : 'Connection failed';
    }

    res.json({ success: true, data: testResult });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error testing AI model:', error);
    res.status(500).json({ success: false, error: 'Failed to test AI model' });
  }
}
```

**Routes to Add:**

```typescript
router.get('/scan-engine/ai-models', adminController.getAIModels.bind(adminController));
router.post('/scan-engine/ai-models', adminController.createAIModel.bind(adminController));
router.put('/scan-engine/ai-models/:id', adminController.updateAIModel.bind(adminController));
router.delete('/scan-engine/ai-models/:id', adminController.deleteAIModel.bind(adminController));
router.post('/scan-engine/ai-models/:id/test', adminController.testAIModel.bind(adminController));
```

#### 1.3 Threat Intelligence Source Management

**New Methods to Add:**

```typescript
// GET /api/v2/admin/scan-engine/ti-sources
async getTISources(req: Request, res: Response) {
  try {
    const { category, enabled } = req.query;

    const where: any = {};
    if (category) where.category = category;
    if (enabled !== undefined) where.enabled = enabled === 'true';

    const sources = await prisma.threatIntelSource.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { name: 'asc' }]
    });

    res.json({ success: true, data: sources });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error fetching TI sources:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch TI sources' });
  }
}

// POST /api/v2/admin/scan-engine/ti-sources
async createTISource(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const sourceData = req.body;

    if (!sourceData.sourceId || !sourceData.name) {
      return res.status(400).json({
        success: false,
        error: 'sourceId and name are required'
      });
    }

    const newSource = await prisma.threatIntelSource.create({
      data: {
        ...sourceData,
        createdBy: userId
      }
    });

    logger.info(`[ScanConfigAdmin] Created TI source: ${newSource.sourceId}`);
    res.status(201).json({ success: true, data: newSource });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error creating TI source:', error);
    res.status(500).json({ success: false, error: 'Failed to create TI source' });
  }
}

// PUT /api/v2/admin/scan-engine/ti-sources/:id
async updateTISource(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const updated = await prisma.threatIntelSource.update({
      where: { id },
      data: {
        ...req.body,
        lastEditedBy: userId
      }
    });

    logger.info(`[ScanConfigAdmin] Updated TI source: ${updated.sourceId}`);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error updating TI source:', error);
    res.status(500).json({ success: false, error: 'Failed to update TI source' });
  }
}

// DELETE /api/v2/admin/scan-engine/ti-sources/:id
async deleteTISource(req: Request, res: Response) {
  try {
    const { id } = req.params;

    await prisma.threatIntelSource.delete({ where: { id } });

    logger.info(`[ScanConfigAdmin] Deleted TI source: ${id}`);
    res.json({ success: true, message: 'TI source deleted successfully' });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error deleting TI source:', error);
    res.status(500).json({ success: false, error: 'Failed to delete TI source' });
  }
}

// POST /api/v2/admin/scan-engine/ti-sources/:id/test
async testTISource(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { testUrl = "example.com" } = req.body;

    const source = await prisma.threatIntelSource.findUnique({ where: { id } });
    if (!source) {
      return res.status(404).json({ success: false, error: 'Source not found' });
    }

    const startTime = Date.now();
    let testResult = {
      success: false,
      responseTime: 0,
      authenticated: false,
      error: null as string | null,
      sampleData: null as any
    };

    try {
      // TODO: Implement actual API connectivity test
      // const response = await queryTISource(source, testUrl);
      testResult.success = true;
      testResult.responseTime = Date.now() - startTime;
      testResult.authenticated = !source.requiresAuth || !!source.apiEndpoint;
    } catch (error) {
      testResult.error = error instanceof Error ? error.message : 'Connection failed';
    }

    res.json({ success: true, data: testResult });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error testing TI source:', error);
    res.status(500).json({ success: false, error: 'Failed to test TI source' });
  }
}
```

**Routes to Add:**

```typescript
router.get('/scan-engine/ti-sources', adminController.getTISources.bind(adminController));
router.post('/scan-engine/ti-sources', adminController.createTISource.bind(adminController));
router.put('/scan-engine/ti-sources/:id', adminController.updateTISource.bind(adminController));
router.delete('/scan-engine/ti-sources/:id', adminController.deleteTISource.bind(adminController));
router.post('/scan-engine/ti-sources/:id/test', adminController.testTISource.bind(adminController));
```

#### 1.4 AI Consensus Configuration

**New Methods to Add:**

```typescript
// GET /api/v2/admin/scan-engine/consensus-configs
async getConsensusConfigs(req: Request, res: Response) {
  try {
    const configs = await prisma.aIConsensusConfig.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: configs });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error fetching consensus configs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch configs' });
  }
}

// POST /api/v2/admin/scan-engine/consensus-configs
async createConsensusConfig(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const configData = req.body;

    if (!configData.name) {
      return res.status(400).json({
        success: false,
        error: 'name is required'
      });
    }

    const newConfig = await prisma.aIConsensusConfig.create({
      data: {
        ...configData,
        createdBy: userId
      }
    });

    logger.info(`[ScanConfigAdmin] Created consensus config: ${newConfig.name}`);
    res.status(201).json({ success: true, data: newConfig });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error creating consensus config:', error);
    res.status(500).json({ success: false, error: 'Failed to create config' });
  }
}

// PUT /api/v2/admin/scan-engine/consensus-configs/:id
async updateConsensusConfig(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const updated = await prisma.aIConsensusConfig.update({
      where: { id },
      data: req.body
    });

    logger.info(`[ScanConfigAdmin] Updated consensus config: ${updated.name}`);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error updating consensus config:', error);
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
}

// DELETE /api/v2/admin/scan-engine/consensus-configs/:id
async deleteConsensusConfig(req: Request, res: Response) {
  try {
    const { id } = req.params;

    await prisma.aIConsensusConfig.delete({ where: { id } });

    logger.info(`[ScanConfigAdmin] Deleted consensus config: ${id}`);
    res.json({ success: true, message: 'Config deleted successfully' });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error deleting consensus config:', error);
    res.status(500).json({ success: false, error: 'Failed to delete config' });
  }
}

// POST /api/v2/admin/scan-engine/consensus-configs/:id/activate
async activateConsensusConfig(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Deactivate all others
    await prisma.aIConsensusConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    // Activate this one
    const activated = await prisma.aIConsensusConfig.update({
      where: { id },
      data: { isActive: true }
    });

    logger.info(`[ScanConfigAdmin] Activated consensus config: ${activated.name}`);
    res.json({ success: true, data: activated });
  } catch (error) {
    logger.error('[ScanConfigAdmin] Error activating consensus config:', error);
    res.status(500).json({ success: false, error: 'Failed to activate config' });
  }
}
```

**Routes to Add:**

```typescript
router.get('/scan-engine/consensus-configs', adminController.getConsensusConfigs.bind(adminController));
router.post('/scan-engine/consensus-configs', adminController.createConsensusConfig.bind(adminController));
router.put('/scan-engine/consensus-configs/:id', adminController.updateConsensusConfig.bind(adminController));
router.delete('/scan-engine/consensus-configs/:id', adminController.deleteConsensusConfig.bind(adminController));
router.post('/scan-engine/consensus-configs/:id/activate', adminController.activateConsensusConfig.bind(adminController));
```

---

### 🟢 PHASE 2: Frontend UI Components (Priority: HIGH)

#### 2.1 New Dashboard Tabs

**File:** `packages/frontend/src/pages/admin/ScanEngineAdmin.tsx`

**Tab Structure Enhancement:**

```typescript
type TabType = 'overview' | 'editor' | 'checks' | 'ai-models' | 'ti-sources' | 'consensus' | 'calibrate' | 'history';

const tabs: { id: TabType; name: string; icon: any }[] = [
  { id: 'overview', name: 'Overview', icon: BarChart2 },
  { id: 'editor', name: 'Config Editor', icon: Sliders },
  { id: 'checks', name: 'Check Types', icon: CheckCircle },
  { id: 'ai-models', name: 'AI Models', icon: Cpu },
  { id: 'ti-sources', name: 'TI Sources', icon: Database },
  { id: 'consensus', name: 'AI Consensus', icon: GitBranch },
  { id: 'calibrate', name: 'Test & Calibrate', icon: TestTube },
  { id: 'history', name: 'Scan History', icon: History }
];
```

#### 2.2 Check Types Management Tab

**New Component to Create:**

```typescript
// Component structure
const CheckTypesTab = () => {
  const [checks, setChecks] = useState<CheckDefinition[]>([]);
  const [selectedCheck, setSelectedCheck] = useState<CheckDefinition | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // CRUD operations
  const loadChecks = async () => { /* ... */ };
  const createCheck = async (checkData: Partial<CheckDefinition>) => { /* ... */ };
  const updateCheck = async (id: string, checkData: Partial<CheckDefinition>) => { /* ... */ };
  const deleteCheck = async (id: string) => { /* ... */ };
  const toggleCheck = async (id: string, enabled: boolean) => { /* ... */ };

  // UI sections:
  // 1. Search & Filter bar
  // 2. Checks grid/list with categories
  // 3. Quick actions (enable/disable, edit, delete)
  // 4. Check editor modal (for create/edit)
  // 5. Configuration details panel

  return (
    <div className="space-y-6">
      {/* Search & Filter */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search checks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border rounded"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2 border rounded"
        >
          <option value="all">All Categories</option>
          <option value="ssl">SSL/TLS</option>
          <option value="dns">DNS</option>
          <option value="content">Content Analysis</option>
          <option value="reputation">Reputation</option>
        </select>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          + Add Check
        </button>
      </div>

      {/* Checks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {checks.map(check => (
          <div key={check.id} className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold text-lg">{check.name}</h3>
                <p className="text-sm text-gray-500">{check.checkId}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${
                check.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {check.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>

            <p className="text-sm text-gray-600 mb-3">{check.description}</p>

            <div className="flex gap-2 text-xs text-gray-500 mb-3">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {check.category}
              </span>
              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                {check.checkType}
              </span>
              <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                {check.defaultPoints} pts
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCheck(check)}
                className="flex-1 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                Edit
              </button>
              <button
                onClick={() => toggleCheck(check.id, !check.enabled)}
                className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
              >
                {check.enabled ? 'Disable' : 'Enable'}
              </button>
              {!check.isSystemCheck && (
                <button
                  onClick={() => deleteCheck(check.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Check Editor Modal */}
      {(isCreating || selectedCheck) && (
        <CheckEditorModal
          check={selectedCheck}
          onSave={(data) => {
            if (selectedCheck) {
              updateCheck(selectedCheck.id, data);
            } else {
              createCheck(data);
            }
            setIsCreating(false);
            setSelectedCheck(null);
          }}
          onCancel={() => {
            setIsCreating(false);
            setSelectedCheck(null);
          }}
        />
      )}
    </div>
  );
};
```

#### 2.3 AI Models Management Tab

**New Component to Create:**

```typescript
const AIModelsTab = () => {
  const [models, setModels] = useState<AIModelDefinition[]>([]);
  const [selectedModel, setSelectedModel] = useState<AIModelDefinition | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  const loadModels = async () => { /* ... */ };
  const createModel = async (modelData: Partial<AIModelDefinition>) => { /* ... */ };
  const updateModel = async (id: string, modelData: Partial<AIModelDefinition>) => { /* ... */ };
  const deleteModel = async (id: string) => { /* ... */ };
  const testModel = async (id: string) => { /* ... */ };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">AI Model Management</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          + Add AI Model
        </button>
      </div>

      {/* Models List */}
      <div className="space-y-4">
        {models.map(model => (
          <div key={model.id} className="border rounded-lg p-6 bg-white shadow-sm">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-xl">{model.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs ${
                    model.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {model.enabled ? 'Active' : 'Disabled'}
                  </span>
                  {model.useInConsensus && (
                    <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                      Consensus
                    </span>
                  )}
                  {model.tieBreaker && (
                    <span className="px-2 py-1 rounded text-xs bg-orange-100 text-orange-800">
                      Tie Breaker
                    </span>
                  )}
                </div>

                <div className="flex gap-4 text-sm text-gray-600 mb-3">
                  <span>Provider: <strong>{model.provider}</strong></span>
                  <span>Model: <strong>{model.modelId}</strong></span>
                  <span>Rank: <strong>#{model.rank}</strong></span>
                  <span>Weight: <strong>{model.weight.toFixed(2)}</strong></span>
                </div>

                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Context Window</p>
                    <p className="font-semibold">{model.contextWindow.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Avg Response</p>
                    <p className="font-semibold">{model.avgResponseTime}ms</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Reliability</p>
                    <p className="font-semibold">{(model.reliability * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Cost/1K</p>
                    <p className="font-semibold">${model.costPer1kTokens?.toFixed(4)}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 ml-4">
                <button
                  onClick={() => testModel(model.id)}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Test Connection
                </button>
                <button
                  onClick={() => setSelectedModel(model)}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteModel(model.id)}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Test Results */}
            {testResults[model.id] && (
              <div className={`mt-4 p-3 rounded ${
                testResults[model.id].success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <p className="font-semibold mb-1">
                  {testResults[model.id].success ? '✓ Connection Successful' : '✗ Connection Failed'}
                </p>
                <p className="text-sm">Response Time: {testResults[model.id].responseTime}ms</p>
                {testResults[model.id].error && (
                  <p className="text-sm text-red-600">Error: {testResults[model.id].error}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Model Editor Modal */}
      {(isCreating || selectedModel) && (
        <AIModelEditorModal
          model={selectedModel}
          onSave={(data) => {
            if (selectedModel) {
              updateModel(selectedModel.id, data);
            } else {
              createModel(data);
            }
            setIsCreating(false);
            setSelectedModel(null);
          }}
          onCancel={() => {
            setIsCreating(false);
            setSelectedModel(null);
          }}
        />
      )}
    </div>
  );
};
```

#### 2.4 TI Sources Management Tab

**New Component Structure:**

```typescript
const TISourcesTab = () => {
  const [sources, setSources] = useState<ThreatIntelSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<ThreatIntelSource | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  // Similar structure to AI Models tab but with TI-specific fields:
  // - API endpoint configuration
  // - Authentication testing
  // - Rate limit monitoring
  // - Category-based filtering
  // - Priority and reliability indicators

  return (
    <div className="space-y-6">
      {/* Implementation similar to AIModelsTab with TI-specific fields */}
    </div>
  );
};
```

#### 2.5 AI Consensus Configuration Tab

**New Component Structure:**

```typescript
const ConsensusConfigTab = () => {
  const [configs, setConfigs] = useState<AIConsensusConfig[]>([]);
  const [activeConfig, setActiveConfig] = useState<AIConsensusConfig | null>(null);
  const [models, setModels] = useState<AIModelDefinition[]>([]);

  // Features:
  // - Strategy selection (weighted_vote, majority, unanimous, etc.)
  // - Model selection and ranking
  // - Confidence thresholds
  // - Multiplier calculation settings
  // - Disagreement penalty configuration
  // - Visual preview of consensus behavior

  return (
    <div className="space-y-6">
      {/* Active Config Display */}
      {activeConfig && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-2">Active Configuration: {activeConfig.name}</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Strategy</p>
              <p className="font-semibold">{activeConfig.strategy}</p>
            </div>
            <div>
              <p className="text-gray-600">Min Models</p>
              <p className="font-semibold">{activeConfig.minimumModels}</p>
            </div>
            <div>
              <p className="text-gray-600">Confidence Threshold</p>
              <p className="font-semibold">{(activeConfig.confidenceThreshold * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Config List */}
      <div className="space-y-3">
        {configs.map(config => (
          <div key={config.id} className={`border rounded-lg p-4 ${
            config.isActive ? 'border-blue-500 bg-blue-50' : 'bg-white'
          }`}>
            {/* Config details and controls */}
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

### 🟡 PHASE 3: Enhanced Real-time Visual Flow (Priority: MEDIUM)

#### 3.1 Dynamic Visual Algorithm Flow Component

**Purpose:** Real-time visualization that updates with EVERY slider adjustment

**Implementation Approach:**

```typescript
// New component: VisualAlgorithmFlow.tsx
const VisualAlgorithmFlow = ({ config, schema }: {
  config: ScanConfiguration;
  schema: any;
}) => {
  // Compute flow in real-time using useMemo
  const algorithmFlow = useMemo(() => {
    const flow = {
      stages: [] as any[],
      connections: [] as any[],
      scoreBreakdown: {} as any,
      finalScore: 0
    };

    // Stage 1: Initial Setup (0 points)
    flow.stages.push({
      id: 'init',
      name: 'Initialization',
      score: 0,
      cumulative: 0,
      color: 'gray',
      details: ['URL parsing', 'Domain extraction', 'Initial validation']
    });

    // Stage 2: Category Checks (dynamic based on sliders)
    let categoryScore = 0;
    schema.categories.forEach((category: any) => {
      const weight = config.categoryWeights?.[category.id] || 0;
      const estimatedScore = Math.floor(weight * 0.7); // Simulate 70% success rate

      categoryScore += estimatedScore;

      flow.stages.push({
        id: `category_${category.id}`,
        name: category.name,
        maxScore: weight,
        estimatedScore,
        cumulative: categoryScore,
        color: 'blue',
        checks: category.checks || []
      });
    });

    flow.scoreBreakdown.categories = categoryScore;

    // Stage 3: Threat Intelligence (dynamic based on TI sliders)
    let tiScore = 0;
    const tiSources = schema.tiSources || [];
    tiSources.forEach((source: any) => {
      const weight = config.tiSourceWeights?.[source.id] || 0;
      const estimatedScore = Math.floor(weight * 0.5); // 50% hit rate
      tiScore += estimatedScore;
    });

    flow.stages.push({
      id: 'ti',
      name: 'Threat Intelligence',
      maxScore: tiScore * 2, // Max possible
      estimatedScore: tiScore,
      cumulative: categoryScore + tiScore,
      color: 'orange',
      sources: tiSources.length
    });

    flow.scoreBreakdown.threatIntel = tiScore;

    // Stage 4: AI Analysis (multiplier effect)
    const aiMultiplier = 1.2; // Example: 20% boost
    const preAIScore = categoryScore + tiScore;
    const finalScore = Math.floor(preAIScore * aiMultiplier);

    flow.stages.push({
      id: 'ai',
      name: 'AI Consensus Analysis',
      multiplier: aiMultiplier,
      preMultiplierScore: preAIScore,
      finalScore,
      color: 'purple',
      models: 3 // From consensus config
    });

    flow.finalScore = finalScore;
    flow.scoreBreakdown.ai = finalScore - preAIScore;

    // Generate connections between stages
    for (let i = 0; i < flow.stages.length - 1; i++) {
      flow.connections.push({
        from: flow.stages[i].id,
        to: flow.stages[i + 1].id,
        score: flow.stages[i + 1].estimatedScore || 0
      });
    }

    return flow;
  }, [config, schema]); // Recomputes on ANY config change

  return (
    <div className="bg-white border rounded-lg p-6">
      <h3 className="text-xl font-bold mb-4">Real-time Algorithm Flow Preview</h3>

      {/* Visual Flow Diagram */}
      <div className="relative">
        {/* Stages */}
        <div className="space-y-4">
          {algorithmFlow.stages.map((stage, index) => (
            <div key={stage.id} className="relative">
              {/* Stage Card */}
              <div className={`border-2 rounded-lg p-4 bg-${stage.color}-50 border-${stage.color}-300`}>
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-lg">{stage.name}</h4>
                    {stage.details && (
                      <p className="text-sm text-gray-600">{stage.details.join(', ')}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {stage.estimatedScore !== undefined && (
                      <p className="text-2xl font-bold">+{stage.estimatedScore}</p>
                    )}
                    {stage.multiplier && (
                      <p className="text-xl font-bold">×{stage.multiplier.toFixed(2)}</p>
                    )}
                    <p className="text-sm text-gray-600">
                      Cumulative: {stage.finalScore || stage.cumulative}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                {stage.maxScore && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`bg-${stage.color}-500 h-2 rounded-full transition-all duration-300`}
                        style={{ width: `${(stage.estimatedScore / stage.maxScore) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {stage.estimatedScore} / {stage.maxScore} points
                    </p>
                  </div>
                )}
              </div>

              {/* Connection Arrow */}
              {index < algorithmFlow.stages.length - 1 && (
                <div className="flex justify-center my-2">
                  <div className="text-gray-400">↓</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Final Score Summary */}
        <div className="mt-6 p-6 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg">
          <h4 className="text-2xl font-bold mb-4">Final Score Estimate</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600">Categories</p>
              <p className="text-3xl font-bold">{algorithmFlow.scoreBreakdown.categories}</p>
            </div>
            <div>
              <p className="text-gray-600">Threat Intel</p>
              <p className="text-3xl font-bold">{algorithmFlow.scoreBreakdown.threatIntel}</p>
            </div>
            <div>
              <p className="text-gray-600">AI Boost</p>
              <p className="text-3xl font-bold text-purple-600">+{algorithmFlow.scoreBreakdown.ai}</p>
            </div>
            <div>
              <p className="text-gray-600">Total</p>
              <p className="text-4xl font-bold text-green-600">{algorithmFlow.finalScore}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

**Integration into ScanEngineAdmin.tsx:**

```typescript
// Add to Config Editor tab
{activeTab === 'editor' && (
  <div className="space-y-6">
    {/* Existing sliders */}

    {/* NEW: Real-time Visual Flow */}
    {editingConfig && schema && (
      <VisualAlgorithmFlow
        config={editingConfig}
        schema={schema}
      />
    )}
  </div>
)}
```

---

### 🟣 PHASE 4: Database Seeding & Initialization (Priority: MEDIUM)

#### 4.1 Seed Initial Check Definitions

**File:** `packages/backend/prisma/seed.ts`

```typescript
// Add to seed script
async function seedCheckDefinitions() {
  const systemChecks: Prisma.CheckDefinitionCreateInput[] = [
    {
      checkId: 'ssl_certificate_valid',
      name: 'SSL Certificate Validation',
      description: 'Verifies SSL/TLS certificate validity, expiry, and trust chain',
      category: 'ssl',
      checkType: 'active',
      defaultPoints: 50,
      severity: 'high',
      timeout: 5000,
      executionOrder: 10,
      isSystemCheck: true,
      handlerFunction: 'checkSSLCertificate',
      validationRules: {
        checkExpiry: true,
        checkTrustChain: true,
        minValidDays: 30
      }
    },
    {
      checkId: 'domain_age_check',
      name: 'Domain Age Verification',
      description: 'Checks domain registration age and history',
      category: 'reputation',
      checkType: 'external_api',
      defaultPoints: 30,
      severity: 'medium',
      timeout: 3000,
      executionOrder: 20,
      isSystemCheck: true,
      handlerFunction: 'checkDomainAge',
      validationRules: {
        minAgeDays: 180,
        checkWhois: true
      }
    },
    {
      checkId: 'malicious_content_scan',
      name: 'Malicious Content Detection',
      description: 'Scans page content for malicious scripts, iframes, and payloads',
      category: 'content',
      checkType: 'active',
      defaultPoints: 80,
      severity: 'critical',
      timeout: 10000,
      executionOrder: 50,
      isSystemCheck: true,
      handlerFunction: 'scanMaliciousContent',
      validationRules: {
        checkScripts: true,
        checkIframes: true,
        checkRedirects: true
      }
    },
    {
      checkId: 'dns_security_check',
      name: 'DNS Security Validation',
      description: 'Validates DNSSEC, DNS records, and suspicious patterns',
      category: 'dns',
      checkType: 'active',
      defaultPoints: 40,
      severity: 'high',
      timeout: 5000,
      executionOrder: 15,
      isSystemCheck: true,
      handlerFunction: 'checkDNSSecurity'
    },
    {
      checkId: 'phishing_indicators',
      name: 'Phishing Indicator Detection',
      description: 'Detects common phishing patterns and techniques',
      category: 'content',
      checkType: 'passive',
      defaultPoints: 70,
      severity: 'critical',
      timeout: 2000,
      executionOrder: 30,
      isSystemCheck: true,
      handlerFunction: 'detectPhishing'
    }
  ];

  for (const check of systemChecks) {
    await prisma.checkDefinition.upsert({
      where: { checkId: check.checkId },
      update: check,
      create: check
    });
  }

  console.log(`✅ Seeded ${systemChecks.length} check definitions`);
}
```

#### 4.2 Seed AI Model Definitions

```typescript
async function seedAIModels() {
  const aiModels: Prisma.AIModelDefinitionCreateInput[] = [
    {
      modelId: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      description: 'High-performance model with excellent reasoning',
      modelVersion: '3.5',
      contextWindow: 200000,
      avgResponseTime: 2000,
      reliability: 0.98,
      costPer1kTokens: 0.003,
      enabled: true,
      weight: 1.5,
      rank: 1,
      minConfidence: 0.7,
      useInConsensus: true,
      tieBreaker: true,
      maxRequestsPerMin: 50,
      capabilities: ['analysis', 'reasoning', 'json_mode'],
      supportsJsonMode: true
    },
    {
      modelId: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      description: 'OpenAI\'s flagship model',
      modelVersion: '4-turbo',
      contextWindow: 128000,
      avgResponseTime: 2500,
      reliability: 0.96,
      costPer1kTokens: 0.01,
      enabled: true,
      weight: 1.3,
      rank: 2,
      minConfidence: 0.65,
      useInConsensus: true,
      maxRequestsPerMin: 40,
      capabilities: ['analysis', 'vision', 'json_mode'],
      supportsJsonMode: true
    },
    {
      modelId: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'google',
      description: 'Google\'s advanced multimodal model',
      modelVersion: '1.5-pro',
      contextWindow: 1000000,
      avgResponseTime: 3000,
      reliability: 0.94,
      costPer1kTokens: 0.00125,
      enabled: true,
      weight: 1.2,
      rank: 3,
      minConfidence: 0.6,
      useInConsensus: true,
      maxRequestsPerMin: 60,
      capabilities: ['analysis', 'vision', 'long_context'],
      supportsJsonMode: false
    },
    {
      modelId: 'grok-2',
      name: 'Grok 2',
      provider: 'xai',
      description: 'xAI\'s Grok model',
      modelVersion: '2',
      contextWindow: 131072,
      avgResponseTime: 2200,
      reliability: 0.90,
      costPer1kTokens: 0.002,
      enabled: false,
      weight: 1.0,
      rank: 4,
      minConfidence: 0.55,
      useInConsensus: false,
      maxRequestsPerMin: 30,
      capabilities: ['analysis'],
      supportsJsonMode: true
    }
  ];

  for (const model of aiModels) {
    await prisma.aIModelDefinition.upsert({
      where: { modelId: model.modelId },
      update: model,
      create: model
    });
  }

  console.log(`✅ Seeded ${aiModels.length} AI model definitions`);
}
```

#### 4.3 Seed Consensus Configurations

```typescript
async function seedConsensusConfigs() {
  const configs: Prisma.AIConsensusConfigCreateInput[] = [
    {
      name: 'Standard Consensus',
      description: 'Balanced consensus with top 3 models',
      isActive: true,
      strategy: 'weighted_vote',
      minimumModels: 2,
      confidenceThreshold: 0.7,
      multiplierMethod: 'average_confidence',
      multiplierRange: { min: 0.5, max: 1.5 },
      penalizeDisagreement: true,
      disagreementPenalty: 0.1,
      enabledModels: ['claude-3-5-sonnet-20241022', 'gpt-4-turbo', 'gemini-1.5-pro'],
      allowPartialConsensus: true,
      timeoutMs: 30000,
      retryFailedModels: true
    },
    {
      name: 'High Accuracy',
      description: 'Requires unanimous agreement for critical decisions',
      isActive: false,
      strategy: 'unanimous',
      minimumModels: 3,
      confidenceThreshold: 0.85,
      multiplierMethod: 'minimum_confidence',
      multiplierRange: { min: 0.7, max: 1.3 },
      penalizeDisagreement: true,
      disagreementPenalty: 0.2,
      enabledModels: ['claude-3-5-sonnet-20241022', 'gpt-4-turbo', 'gemini-1.5-pro'],
      allowPartialConsensus: false,
      timeoutMs: 45000,
      retryFailedModels: true
    },
    {
      name: 'Fast Consensus',
      description: 'Quick decisions with single model fallback',
      isActive: false,
      strategy: 'majority',
      minimumModels: 1,
      confidenceThreshold: 0.6,
      multiplierMethod: 'average_confidence',
      multiplierRange: { min: 0.8, max: 1.2 },
      penalizeDisagreement: false,
      disagreementPenalty: 0,
      enabledModels: ['claude-3-5-sonnet-20241022'],
      allowPartialConsensus: true,
      timeoutMs: 15000,
      retryFailedModels: false
    }
  ];

  for (const config of configs) {
    await prisma.aIConsensusConfig.upsert({
      where: { name: config.name },
      update: config,
      create: config
    });
  }

  console.log(`✅ Seeded ${configs.length} consensus configurations`);
}
```

---

### 🔴 PHASE 5: Integration & Testing (Priority: LOW - After Implementation)

#### 5.1 Backend Integration Checklist

- [ ] Run Prisma migration: `npx prisma migrate dev --name enterprise_scan_features`
- [ ] Run seed script: `npx prisma db seed`
- [ ] Test all CRUD endpoints with Postman/Thunder Client
- [ ] Verify authentication on all endpoints
- [ ] Test error handling (invalid data, missing fields, etc.)
- [ ] Verify cascade deletes work correctly
- [ ] Check rate limiting on test endpoints

#### 5.2 Frontend Integration Checklist

- [ ] Install any new dependencies (if needed)
- [ ] Add new tab components to ScanEngineAdmin.tsx
- [ ] Wire up API calls to new backend endpoints
- [ ] Test create/edit/delete flows for each entity
- [ ] Verify real-time updates work correctly
- [ ] Test search and filtering
- [ ] Verify validation messages display properly
- [ ] Check responsive design on mobile

#### 5.3 End-to-End Testing

- [ ] Create new check definition via UI
- [ ] Enable/disable check and verify in scans
- [ ] Add new AI model and test connectivity
- [ ] Create new TI source with API details
- [ ] Configure consensus strategy and activate
- [ ] Create custom scan configuration with all features
- [ ] Run calibration scan with custom config
- [ ] Verify visual flow updates in real-time
- [ ] Test granular points control
- [ ] Verify 590-point max enforcement across all features

---

## Implementation Order & Dependencies

### Week 1: Backend Foundation
**Day 1-2:**
- Implement Check Definition CRUD endpoints
- Implement AI Model CRUD endpoints

**Day 3-4:**
- Implement TI Source CRUD endpoints
- Implement Consensus Config CRUD endpoints

**Day 5:**
- Create seed scripts
- Run migrations
- Test all endpoints

### Week 2: Frontend Components
**Day 1-2:**
- Create Check Types Management tab
- Create AI Models Management tab

**Day 3-4:**
- Create TI Sources Management tab
- Create Consensus Config tab

**Day 5:**
- Integrate all tabs into main dashboard
- Test navigation and state management

### Week 3: Enhanced Features
**Day 1-3:**
- Implement real-time visual algorithm flow
- Add granular points control
- Enhance calibration UI

**Day 4-5:**
- Integration testing
- Bug fixes
- Performance optimization

### Week 4: Polish & Deploy
**Day 1-2:**
- UI/UX improvements
- Error handling enhancements
- Documentation

**Day 3-4:**
- Comprehensive testing
- Security review
- Performance testing

**Day 5:**
- Deploy to dev environment
- Monitor and stabilize
- User acceptance testing

---

## Technical Considerations

### Security
- All endpoints require admin authentication
- Validate all user inputs
- Sanitize API credentials before storage
- Rate limit test endpoints
- Log all configuration changes with user attribution

### Performance
- Index database queries appropriately
- Cache frequently accessed configs
- Debounce real-time visual updates
- Lazy load large lists
- Paginate results for large datasets

### Error Handling
- Graceful degradation for failed API tests
- Clear error messages for users
- Detailed logging for debugging
- Retry logic for transient failures
- Validation before database operations

### Scalability
- Support for adding unlimited checks/models/sources
- Efficient query patterns
- Optimistic UI updates
- Background jobs for expensive operations
- Modular architecture for future extensions

---

## Success Criteria

✅ **Feature Completeness**
- All 8 new features fully implemented
- 100% CRUD functionality working
- No placeholders or dummy data

✅ **Data Integrity**
- 590-point maximum enforced everywhere
- Score calculations accurate
- Configuration changes persist correctly
- Relationships maintained properly

✅ **User Experience**
- Intuitive UI for all features
- Real-time updates responsive
- Clear error messages
- Helpful validation
- Professional polish

✅ **System Integration**
- All endpoints connected
- Database properly seeded
- Migrations run successfully
- Calibration uses real scanner
- All features work together

✅ **Enterprise Quality**
- No errors in console
- No TypeScript compilation errors
- All pods healthy
- Deployments successful
- Production-ready code

---

## Next Steps After This Checkpoint

1. **Review this plan** with stakeholders
2. **Get approval** for approach and timeline
3. **Create GitHub issues** for each phase
4. **Start Phase 1** implementation
5. **Regular commits** with descriptive messages
6. **Incremental testing** as features are built
7. **Documentation** as you go
8. **Deploy and validate** each phase

---

## Questions for Consideration

- Should we implement webhook notifications for configuration changes?
- Do we need audit logs for all admin actions?
- Should we add role-based permissions (super admin vs regular admin)?
- Do we want to export/import configurations as JSON?
- Should we add A/B testing capability for configurations?
- Do we need scheduled scans with specific configurations?

---

## Notes for Next Session

This document serves as a **comprehensive checkpoint** for implementation. A new Claude session can pick up from here by:

1. Reading this document
2. Identifying which phase to work on
3. Following the detailed implementation specs
4. Making incremental progress
5. Committing frequently with clear messages
6. Updating this document with progress

**Document Status:** ✅ Complete and ready for implementation

**Recommended Next Action:** Begin Phase 1 - Backend CRUD Endpoints (Check Definitions)
