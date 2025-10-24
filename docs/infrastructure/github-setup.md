# Branch Protection Manual Setup Guide

## Overview

This guide provides step-by-step instructions for manually configuring branch protection rules via the GitHub web interface. This is required because the automated script requires GitHub Pro/Team subscription for private repositories.

## Why Manual Setup?

**Issue**: GitHub API restriction (HTTP 403)
```
"Upgrade to GitHub Pro or make this repository public to enable this feature."
```

**Cause**: Branch protection rules via GitHub API are limited on free tier private repositories.

**Solutions**:
1. ✅ **Manual setup via GitHub web interface** (recommended for free tier)
2. Upgrade to GitHub Pro ($4/user/month)
3. Make repositories public (not recommended for production code)

## Step-by-Step Instructions

### For Repository: `elara-platform`

#### 1. Navigate to Repository Settings
```
https://github.com/Elara-Tanmoy/elara-platform/settings/branches
```

#### 2. Configure `main` Branch (Production)

Click "Add branch protection rule" or edit existing rule.

**Branch name pattern**: `main`

**Required Settings**:

✅ **Protect matching branches**
- [x] Require a pull request before merging
  - [x] Require approvals: **2**
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [x] Require review from Code Owners
  - [x] Require approval of the most recent reviewable push
  - [x] Require conversation resolution before merging

- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Required status checks (add these if they exist):
    - `ci/cloud-build/prod`
    - `tests/unit`
    - `tests/integration`
    - `security/snyk-scan`
    - `security/dependency-scan`

- [x] Require conversation resolution before merging

- [x] Require signed commits

- [x] Require linear history

- [x] Require deployments to succeed before merging (optional)

- [x] Lock branch (prevent any pushes) - ONLY if you want to fully lock

- [x] Do not allow bypassing the above settings
  - [x] Include administrators

**Restrict who can push to matching branches**:
- Add only: DevOps team members
- Everyone else must use Pull Requests

**Rules applied to everyone including administrators**:
- [x] Apply to administrators

Click **"Save changes"**

---

#### 3. Configure `staging` Branch (Pre-production)

Click "Add branch protection rule".

**Branch name pattern**: `staging`

**Required Settings**:

✅ **Protect matching branches**
- [x] Require a pull request before merging
  - [x] Require approvals: **1**
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [x] Require review from Code Owners
  - [x] Require conversation resolution before merging

- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Required status checks:
    - `ci/cloud-build/staging`
    - `tests/unit`
    - `tests/integration`

- [x] Require conversation resolution before merging

- [x] Require linear history

- [ ] Require signed commits (RECOMMENDED, not mandatory)

- [x] Do not allow bypassing the above settings
  - [x] Include administrators

**Allow force pushes**: ❌ NO

Click **"Save changes"**

---

#### 4. Configure `develop` Branch (Development)

Click "Add branch protection rule".

**Branch name pattern**: `develop`

**Required Settings**:

✅ **Protect matching branches**
- [x] Require a pull request before merging
  - [x] Require approvals: **1**
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [x] Require conversation resolution before merging

- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Required status checks:
    - `ci/cloud-build/dev`
    - `tests/unit`

- [x] Require conversation resolution before merging

- [ ] Require signed commits (OPTIONAL)

**Allow force pushes**: ❌ NO

**Allow deletions**: ❌ NO

Click **"Save changes"**

---

### For Repository: `elara-gcp-infrastructure`

Repeat the same steps as above for:
```
https://github.com/Elara-Tanmoy/elara-gcp-infrastructure/settings/branches
```

Apply identical protection rules for:
- `main` branch (2 approvals)
- `staging` branch (1 approval)
- `develop` branch (1 approval)

---

## Code Owners Setup

Branch protection works best with CODEOWNERS file.

### Create CODEOWNERS File

**For `elara-platform` repository**:

Create file: `.github/CODEOWNERS`

```bash
cd /d/Elara_MVP/elara-platform
mkdir -p .github
cat > .github/CODEOWNERS << 'EOF'
# Code Owners for Elara Platform
# These owners will be automatically requested for review

# Default owners for everything
* @Elara-Tanmoy

# Backend code
/packages/backend/ @backend-team
/packages/shared/ @backend-team

# Frontend code
/packages/frontend/ @frontend-team
/packages/browser-extension/ @frontend-team

# Security-sensitive files
*.key @security-team
*.pem @security-team
.env* @security-team
/packages/backend/src/config/ @security-team

# Database & Infrastructure
prisma/ @devops-team @backend-team
/packages/backend/src/utils/database* @devops-team

# Documentation
*.md @tech-writers @devops-team
/docs/ @tech-writers
EOF

git add .github/CODEOWNERS
git commit -m "chore: add CODEOWNERS file for code review automation"
git push origin main
```

**For `elara-gcp-infrastructure` repository**:

Create file: `.github/CODEOWNERS`

```bash
cd /d/Elara_MVP/gcp-infrastructure
mkdir -p .github
cat > .github/CODEOWNERS << 'EOF'
# Code Owners for Elara GCP Infrastructure
# These owners will be automatically requested for review

# Default owners for everything
* @Elara-Tanmoy

# Terraform infrastructure
/terraform/ @devops-team
*.tf @devops-team
*.tfvars @devops-team

# Kubernetes manifests
/kubernetes/ @devops-team
*.yaml @devops-team
*.yml @devops-team

# Docker configurations
/docker/ @devops-team
Dockerfile* @devops-team

# CI/CD pipelines
/ci-cd/ @devops-team
cloudbuild*.yaml @devops-team

# Scripts
/scripts/ @devops-team
*.sh @devops-team

# Security configurations
/security/ @security-team @devops-team

# Documentation
/docs/ @tech-writers @devops-team
*.md @tech-writers
EOF

git add .github/CODEOWNERS
git commit -m "chore: add CODEOWNERS file for infrastructure review automation"
git push origin main
```

---

## Verification Checklist

After completing manual setup:

### Test Branch Protection

#### Test 1: Direct Push (Should Fail)
```bash
# Try to push directly to main (should be blocked)
git checkout main
echo "test" > test.txt
git add test.txt
git commit -m "test: direct push to main"
git push origin main
# Expected: ERROR: Push blocked by branch protection rules
```

#### Test 2: Pull Request Workflow (Should Work)
```bash
# Create feature branch
git checkout develop
git pull origin develop
git checkout -b feature/test-branch-protection

# Make change
echo "test" > test.txt
git add test.txt
git commit -m "test: verify branch protection via PR"
git push origin feature/test-branch-protection

# Create PR on GitHub web interface
# Base: develop
# Compare: feature/test-branch-protection

# Verify:
# - PR requires 1 approval
# - Status checks must pass
# - Cannot merge without approval
```

#### Test 3: Check Protection Status
```bash
# Verify protection is active
gh api repos/Elara-Tanmoy/elara-platform/branches/main/protection

# Expected: Returns branch protection configuration (not 404)
```

---

## CI/CD Status Checks Setup

For status checks to work, you need to configure Cloud Build to report status to GitHub.

### Configure Cloud Build GitHub Integration

1. **Connect Cloud Build to GitHub**:
```bash
# Navigate to Cloud Build in GCP Console
https://console.cloud.google.com/cloud-build/triggers?project=elara-mvp-13082025-u1

# Go to: Settings → GitHub integration
# Connect your GitHub account (Elara-Tanmoy)
# Grant access to repositories:
#   - elara-platform
#   - elara-gcp-infrastructure
```

2. **Update Cloud Build Triggers**:

**For Production** (`cloudbuild-prod.yaml`):
```yaml
# Add GitHub status reporting
options:
  machineType: 'N1_HIGHCPU_8'

  # Report status to GitHub
  substitution_option: 'ALLOW_LOOSE'

# Add status check step at the end
- name: 'gcr.io/cloud-builders/git'
  entrypoint: 'bash'
  args:
  - '-c'
  - |
    # Update commit status
    curl -X POST \
      -H "Accept: application/vnd.github.v3+json" \
      -H "Authorization: token $$GITHUB_TOKEN" \
      https://api.github.com/repos/Elara-Tanmoy/elara-platform/statuses/$$COMMIT_SHA \
      -d '{"state":"success","context":"ci/cloud-build/prod","description":"Production build succeeded"}'
  secretEnv: ['GITHUB_TOKEN']
```

3. **Create GitHub Token Secret**:
```bash
# Create GitHub personal access token with 'repo:status' scope
# https://github.com/settings/tokens

# Store in Secret Manager
echo -n "ghp_your_github_token" | gcloud secrets create github-status-token \
  --data-file=- \
  --project=elara-mvp-13082025-u1

# Grant Cloud Build access
gcloud secrets add-iam-policy-binding github-status-token \
  --member="serviceAccount:PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=elara-mvp-13082025-u1
```

---

## Monitoring Branch Protection

### Check Current Protection Status

```bash
# For elara-platform
gh api repos/Elara-Tanmoy/elara-platform/branches/main/protection --jq '{
  required_pull_request_reviews: .required_pull_request_reviews.required_approving_review_count,
  required_status_checks: .required_status_checks.contexts,
  enforce_admins: .enforce_admins.enabled,
  required_linear_history: .required_linear_history.enabled
}'

# For elara-gcp-infrastructure
gh api repos/Elara-Tanmoy/elara-gcp-infrastructure/branches/main/protection --jq '{
  required_pull_request_reviews: .required_pull_request_reviews.required_approving_review_count,
  required_status_checks: .required_status_checks.contexts,
  enforce_admins: .enforce_admins.enabled,
  required_linear_history: .required_linear_history.enabled
}'
```

### List Protected Branches

```bash
# List all protected branches
gh api repos/Elara-Tanmoy/elara-platform/branches --jq '.[] | select(.protected == true) | {name: .name, protected: .protected}'
```

---

## Troubleshooting

### Issue: Status checks not appearing

**Cause**: Cloud Build hasn't reported status yet

**Solution**:
1. Trigger a Cloud Build run
2. Verify GitHub integration is configured
3. Check Cloud Build logs for status reporting

### Issue: Cannot add required status checks

**Cause**: Status checks only appear after first run

**Solution**:
1. Create a test PR
2. Trigger CI/CD pipeline
3. Wait for status check to report
4. Then add it to required checks

### Issue: Administrators can still bypass protection

**Cause**: "Include administrators" not checked

**Solution**:
1. Go to branch protection settings
2. Check "Do not allow bypassing the above settings"
3. Check "Include administrators"
4. Save changes

---

## Alternative: GitHub Pro Upgrade

If you want to use the automated script:

### Option 1: Upgrade to GitHub Pro
```
Cost: $4/user/month
Benefits:
- API access to branch protection
- Advanced security features
- Protected branches for private repos
- Repository insights
```

**Upgrade URL**: https://github.com/settings/billing

After upgrading, run the automated script:
```bash
cd /d/Elara_MVP/gcp-infrastructure
./scripts/setup_branch_protection.sh elara-platform
./scripts/setup_branch_protection.sh elara-gcp-infrastructure
```

### Option 2: Make Repositories Public
```
Not recommended for production code with secrets/credentials
```

---

## Summary

✅ **Completed Tasks**:
- Created comprehensive documentation
- Created branch protection automation script
- Identified GitHub API limitation for free tier

⚠️ **Required Manual Steps**:
1. Configure branch protection via GitHub web UI for both repositories
2. Set up CODEOWNERS files
3. Configure Cloud Build GitHub integration for status checks
4. Test branch protection with a PR

**Estimated Time**: 20-30 minutes for both repositories

**Documentation Links**:
- elara-platform: https://github.com/Elara-Tanmoy/elara-platform/settings/branches
- elara-gcp-infrastructure: https://github.com/Elara-Tanmoy/elara-gcp-infrastructure/settings/branches
- GitHub docs: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches

---

**Last Updated**: 2025-10-15
**Status**: MANUAL SETUP REQUIRED
**Priority**: HIGH - Required for production workflow
