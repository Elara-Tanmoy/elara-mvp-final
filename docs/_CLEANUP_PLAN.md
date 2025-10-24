# Documentation Cleanup Plan

**Generated:** 2025-10-24
**Total Root Docs:** 66 files

---

## 📁 KEEP & MOVE to Proper Structure

### Architecture Folder (`architecture/`)
- ✅ HIGH_LEVEL_DESIGN.md → architecture/system-design.md
- ✅ LOW_LEVEL_DESIGN.md → architecture/detailed-design.md
- ✅ IAM_RBAC_DESIGN.md → architecture/security/rbac.md
- ✅ COMPREHENSIVE_SCORING_SYSTEM.md → architecture/scoring-algorithm.md
- ✅ CURRENT_PLATFORM_MAPPING.md → architecture/platform-mapping.md

### Deployment Folder (`deployment/`)
- ✅ GETTING_STARTED.md → deployment/getting-started.md
- ✅ QUICK_START.md → deployment/quick-start.md
- ✅ DEPLOY_NOW.md → deployment/manual-deployment.md
- ✅ SETUP_DEV_STAGING.md → deployment/dev-staging-setup.md
- ✅ GCP_SEED_INSTRUCTIONS.md → deployment/gcp-database-seeding.md
- ✅ TROUBLESHOOTING.md → deployment/troubleshooting.md
- ✅ DISASTER_RECOVERY.md → deployment/disaster-recovery.md
- ✅ COMPLETE_BACKUP_STRATEGY.md → deployment/backup-strategy.md

### Development Folder (`development/`)
- ✅ DEBUG_LOGGING_GUIDE.md → development/debugging.md
- ✅ API-KEYS-SETUP.md → development/api-keys.md
- ✅ FOR_CLAUDE_SESSIONS.md → development/ai-assistant-guide.md
- ✅ REPOSITORY_STRUCTURE.md → development/repository-structure.md

### Infrastructure Folder (`infrastructure/`)
- ✅ DATABASE_ALTERNATIVES_COST_ANALYSIS.md → infrastructure/cost-analysis.md
- ✅ IMMEDIATE_COST_REDUCTION_PLAN.md → infrastructure/cost-optimization.md
- ✅ COMPLIANCE_GOVERNANCE.md → infrastructure/compliance.md
- ✅ BRANCH_PROTECTION_MANUAL_SETUP.md → infrastructure/github-setup.md

### Features Folder
- ✅ PROXY_SETUP_GUIDE.md → features/proxy-service/setup.md
- ✅ SECURE_BROWSER_ENHANCEMENT_PLAN.md → features/browser-extension/enhancement-plan.md
- ✅ SERVICES_SETUP_GUIDE.md → features/services-setup.md
- ✅ WEBVPN_PROMPT.md → features/vpn/prompt.md

### Project Management (`project/` - NEW)
- ✅ PROJECT_DOCUMENTATION.md → project/overview.md
- ✅ PROJECT_SUMMARY.md → project/summary.md
- ✅ COMPREHENSIVE_PROJECT_DOCUMENTATION.md → project/comprehensive.md
- ✅ MVP_TO_20K_USERS_STRATEGY.md → project/scaling-strategy.md
- ✅ CURRENT_STATUS_AND_PHASES.md → project/status.md
- ✅ CHANGELOG.md → CHANGELOG.md (KEEP AT ROOT)

---

## 🗑️ DELETE (Obsolete/Junk) - REVIEW BEFORE DELETING

### Checkpoint/Status Files (Historical - NOT NEEDED)
```bash
# These are old session checkpoints, not relevant for production repo
❌ ACTIVATION_CHECKLIST.md
❌ COMPLETE_BACKEND_RESTART.md
❌ SETUP_COMPLETE_SUCCESS.md
❌ STATUS-UPDATE.md
❌ READY_TO_TEST.md
❌ SESSION_CONTEXT.md
❌ SESSION_HANDOFF_OCT18_2025.md
❌ IMMEDIATE_ACTION_REQUIRED.md
❌ NEXT_STEPS_USER_ACTION_REQUIRED.md
❌ VERIFY_DATABASE.md
```

### Fix/Changes Files (Historical - NOT NEEDED)
```bash
# These documented past bugs/fixes, not relevant going forward
❌ FIX_0_SCORE_ISSUE.md
❌ FIX_ANTHROPIC_API.md
❌ FIX_UUID_GENERATION.md
❌ FIXES_APPLIED.md
❌ FIXES_APPLIED_OCT7.md
❌ CHANGES_SUMMARY.md
❌ ANALYSIS_IMPROVEMENTS.md
❌ IMPROVEMENTS_SUMMARY.md
```

### Phase/Planning Files (Historical - NOT NEEDED)
```bash
# Old planning docs, phases already completed
❌ PHASE_1_ENHANCEMENTS.md
❌ PHASE_2_ENHANCEMENTS.md
❌ PHASE_3_ENHANCEMENTS.md
❌ NEXT_PHASES_FINALIZED.md
❌ PENDING_FEATURES.md
❌ ENHANCED_FEATURES_GUIDE.md
```

### Duplicate Quick Start Files (CONSOLIDATE)
```bash
# Too many quickstart files, keep ONE
❌ QUICKSTART.md (delete)
❌ QUICK-START.md (delete)
❌ QUICK_DEPLOY.md (delete)
❌ QUICK_DIAGNOSTIC.md (delete)
❌ QUICK_SETUP.md (delete)
✅ QUICK_START.md → deployment/quick-start.md (KEEP)
```

### Duplicate README Files (CONSOLIDATE)
```bash
# Multiple READMEs, keep main one
❌ README_IMPLEMENTATION.md (delete)
❌ README-STARTUP.md (delete)
✅ README.md (KEEP AT ROOT)
```

### Internal/Prompt Files (NOT FOR PUBLIC REPO)
```bash
# Internal prompts/orchestrators, not for MVP repo
❌ elara_enhancement_prompt.md
❌ ORCHESTRATOR_README.md
```

---

## ✅ KEEP AT ROOT (Main Documentation)

```bash
✅ README.md (main repository README)
✅ SETUP.md (setup guide - already created)
✅ CHANGELOG.md (version history)
✅ DOCUMENTATION_INDEX.md (master documentation index)
```

---

## 📊 Summary

**Total Files:** 66
- **Move to Structure:** 28 files
- **Delete (Obsolete):** 32 files
- **Keep at Root:** 4 files
- **Already in Subfolders:** 2 files (architecture/, deployment/, features/)

---

## 🚀 Execution Plan

1. **Review this file** - Confirm deletions
2. **Move files** - Reorganize into proper structure
3. **Delete obsolete** - Remove junk files
4. **Update links** - Fix cross-references
5. **Commit changes** - Clean repository

---

## ⚠️ Files to MANUALLY REVIEW Before Deletion

**Location:** `/d/elara-mvp-final/docs/`

Please review these categories:
1. **Checkpoint files** (10 files) - Old session state
2. **Fix files** (9 files) - Historical bug fixes
3. **Phase files** (6 files) - Completed planning docs
4. **Duplicate quickstarts** (5 files) - Keep only one
5. **Internal prompts** (2 files) - Not for public repo

**Command to review:**
```bash
cd /d/elara-mvp-final/docs
ls -lh ACTIVATION_CHECKLIST.md COMPLETE_BACKEND_RESTART.md STATUS-UPDATE.md
```

**Safe to delete if:** These files don't contain unique production-critical information not found elsewhere.
