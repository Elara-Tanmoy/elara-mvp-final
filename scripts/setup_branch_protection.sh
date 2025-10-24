#!/bin/bash
#
# Setup GitHub Branch Protection Rules
# This script configures branch protection for main, staging, and develop branches
#
# Prerequisites:
# - GitHub CLI (gh) installed: https://cli.github.com/
# - Authenticated: gh auth login
# - Repository access: Owner or Admin permissions
#
# Usage:
#   ./setup_branch_protection.sh elara-platform
#   ./setup_branch_protection.sh elara-gcp-infrastructure

set -e

REPO_NAME=$1

if [ -z "$REPO_NAME" ]; then
  echo "Usage: $0 <repository-name>"
  echo "Example: $0 elara-platform"
  exit 1
fi

GITHUB_ORG="Elara-Tanmoy"  # Change to your GitHub organization/user

echo "==========================================="
echo "Setting up Branch Protection Rules"
echo "Repository: $GITHUB_ORG/$REPO_NAME"
echo "==========================================="

# Function to setup branch protection
setup_branch_protection() {
  local branch=$1
  local required_approvals=$2
  local required_checks=$3

  echo ""
  echo "Setting up protection for branch: $branch"
  echo "Required approvals: $required_approvals"

  # Note: The gh CLI currently has limited support for branch protection
  # For full configuration, you may need to use the GitHub API directly
  # or configure via the GitHub web interface

  # Basic protection using gh CLI
  gh api repos/$GITHUB_ORG/$REPO_NAME/branches/$branch/protection \
    --method PUT \
    --field required_status_checks='{"strict":true,"contexts":'$required_checks'}' \
    --field enforce_admins=true \
    --field required_pull_request_reviews='{"dismissal_restrictions":{},"dismiss_stale_reviews":true,"require_code_owner_reviews":true,"required_approving_review_count":'$required_approvals'}' \
    --field restrictions=null \
    --field allow_force_pushes=false \
    --field allow_deletions=false \
    --field required_linear_history=true

  echo "✓ Branch protection configured for $branch"
}

# MAIN BRANCH PROTECTION (Production)
echo ""
echo "============================================"
echo "1. Configuring 'main' branch (PRODUCTION)"
echo "============================================"

setup_branch_protection "main" 2 '["ci/cloud-build/prod","tests/unit","tests/integration","security/snyk-scan"]'

echo ""
echo "Additional 'main' branch settings (configure via GitHub UI):"
echo "  - Require signed commits: ON"
echo "  - Include administrators: ON"
echo "  - Restrict who can push: DevOps team only"

# STAGING BRANCH PROTECTION (Pre-production)
echo ""
echo "============================================"
echo "2. Configuring 'staging' branch (STAGING)"
echo "============================================"

setup_branch_protection "staging" 1 '["ci/cloud-build/staging","tests/unit","tests/integration"]'

echo ""
echo "Additional 'staging' branch settings (configure via GitHub UI):"
echo "  - Require signed commits: RECOMMENDED"
echo "  - Include administrators: ON"

# DEVELOP BRANCH PROTECTION (Development)
echo ""
echo "============================================"
echo "3. Configuring 'develop' branch (DEVELOPMENT)"
echo "============================================"

setup_branch_protection "develop" 1 '["ci/cloud-build/dev","tests/unit"]'

echo ""
echo "Additional 'develop' branch settings (configure via GitHub UI):"
echo "  - Require signed commits: OPTIONAL"
echo "  - Allow force pushes: NO"

echo ""
echo "==========================================="
echo "✓ Branch protection setup complete!"
echo "==========================================="
echo ""
echo "Next steps:"
echo "1. Verify settings in GitHub web interface:"
echo "   https://github.com/$GITHUB_ORG/$REPO_NAME/settings/branches"
echo ""
echo "2. Test by trying to push directly to protected branches"
echo "   (should be rejected)"
echo ""
echo "3. Create a test PR to verify required checks"
echo ""
echo "4. Configure CODEOWNERS file for code review requirements:"
echo "   echo '* @devops-team' > .github/CODEOWNERS"
echo ""

# Optional: Create CODEOWNERS file template
echo ""
read -p "Create .github/CODEOWNERS file template? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  mkdir -p .github
  cat > .github/CODEOWNERS << 'EOF'
# Code Owners for Elara Platform
# These owners will be automatically requested for review when someone opens a pull request

# Default owners for everything in the repo
* @Elara-Tanmoy

# Infrastructure code (Terraform, Kubernetes)
/terraform/ @devops-team
/kubernetes/ @devops-team
/docker/ @devops-team
*.yaml @devops-team
*.yml @devops-team

# Backend code
/packages/backend/ @backend-team

# Frontend code
/packages/frontend/ @frontend-team

# Security-sensitive files
/security/ @security-team
*.key @security-team
*.pem @security-team
.env* @security-team

# Documentation
/docs/ @tech-writers @devops-team
*.md @tech-writers
EOF

  echo "✓ Created .github/CODEOWNERS"
  echo "  Update team names according to your GitHub organization"
fi

echo ""
echo "Setup complete! 🎉"
