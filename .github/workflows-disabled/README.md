# GitHub Actions Workflows - Disabled

**Status**: Workflows disabled for this repository

## Why Disabled?

This repository (`elara-mvp-final`) is a **documentation and architecture showcase** repository. Active deployments are handled by the main `elara-platform` repository.

### Original Workflow Files

The following workflows have been moved to `workflows-disabled/`:

- `deploy-dev.yml` - Development deployment workflow
- `deploy-prod.yml` - Production deployment workflow
- `deploy-production.yml` - Alternative production deployment

### If You Need to Enable Workflows

1. **Configure GitHub Secrets** in repository settings:
   - `GCP_PROJECT_ID` - Your GCP project ID (e.g., `elara-mvp-13082025-u1`)
   - `GCP_SA_KEY` - GCP service account key JSON (from GCP Console)

2. **Move workflow files back**:
   ```bash
   mv .github/workflows-disabled/*.yml .github/workflows/
   ```

3. **Push to trigger workflows**:
   ```bash
   git add .github/workflows/
   git commit -m "chore: enable GitHub Actions workflows"
   git push origin main
   ```

### Alternative: Use Original Repository

For active deployments, use the main repository:
- **Repository**: `Elara-Tanmoy/elara-platform`
- **Purpose**: Active development and deployment
- **Workflows**: Fully configured with GCP credentials

---

**Note**: This repository focuses on documentation, architecture diagrams, and codebase organization. It does not require active CI/CD deployment.
