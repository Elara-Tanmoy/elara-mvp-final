# Setup Development & Staging Environments

## Quick Setup (5 minutes)

### Step 1: Create GitHub Branches

```bash
cd /d/Elara_MVP

# Create develop branch
git checkout -b develop
git push origin develop

# Create staging branch
git checkout -b staging
git push origin staging

# Go back to main
git checkout main
```

### Step 2: Connect GitHub to Cloud Build

```bash
# Run the setup script
./setup-cloud-build-triggers.sh

# OR manually:
# 1. Visit: https://console.cloud.google.com/cloud-build/triggers/connect?project=elara-mvp-13082025-u1
# 2. Connect your GitHub account
# 3. Select the Elara_MVP repository
# 4. The script will create triggers automatically
```

This creates:
- **Dev Trigger**: Watches `develop` branch → Runs `cloudbuild-dev.yaml`
- **Staging Trigger**: Watches `staging` branch → Runs `cloudbuild-staging.yaml`
- **Prod Trigger**: Watches `main` branch → Runs `cloudbuild-prod.yaml`

### Step 3: Deploy Dev Environment (Test Auto-Deploy)

```bash
# Make a small change to test
git checkout develop
echo "# Dev environment" >> README.md
git add README.md
git commit -m "Test dev auto-deploy"
git push origin develop

# Watch the build
gcloud builds list --region=us-west1 --limit=1
gcloud builds log $(gcloud builds list --region=us-west1 --limit=1 --format="value(id)") --stream
```

### Step 4: Get Dev Environment IP

After the build completes (~3-5 minutes):

```bash
# Get GKE credentials
gcloud container clusters get-credentials elara-gke-us-west1 --region=us-west1

# Check dev pods
kubectl get pods -n elara-backend-dev
kubectl get pods -n elara-frontend-dev

# Get dev load balancer IP (if using separate IPs)
kubectl get ingress -n elara-backend-dev

# OR use kubectl port-forward for testing
kubectl port-forward -n elara-backend-dev deployment/elara-api 8081:3001
# Access at: http://localhost:8081
```

### Step 5: Deploy Staging Environment

```bash
# Merge develop to staging
git checkout staging
git merge develop
git push origin staging

# Watch build
gcloud builds list --region=us-west1 --limit=1 --format="value(id)"
```

### Step 6: Get Staging Environment IP

```bash
# Check staging pods
kubectl get pods -n elara-backend-staging
kubectl get pods -n elara-frontend-staging

# Get staging IP
kubectl get ingress -n elara-backend-staging

# OR port-forward
kubectl port-forward -n elara-backend-staging deployment/elara-api 8082:3001
```

## Frontend URLs After Setup

### With Port Forwarding (Immediate Testing)
```bash
# Development
kubectl port-forward -n elara-frontend-dev deployment/elara-frontend 8080:80
# Access: http://localhost:8080
# Login:  http://localhost:8080/login

# Staging
kubectl port-forward -n elara-frontend-staging deployment/elara-frontend 8081:80
# Access: http://localhost:8081
# Login:  http://localhost:8081/login

# Production (already has IP)
# Access: http://34.36.48.252
# Login:  http://34.36.48.252/login
```

### With Dedicated IPs (After LoadBalancer Creation)

You'll need to create LoadBalancer services or Ingress for dev/staging.

**Option A: Create LoadBalancer Services**
```bash
# This will give each environment its own external IP
kubectl expose deployment elara-frontend \
  --type=LoadBalancer \
  --port=80 \
  --target-port=80 \
  --name=elara-frontend-lb \
  -n elara-frontend-dev

kubectl expose deployment elara-frontend \
  --type=LoadBalancer \
  --port=80 \
  --target-port=80 \
  --name=elara-frontend-lb \
  -n elara-frontend-staging

# Wait for external IPs (takes ~2 minutes)
kubectl get svc -n elara-frontend-dev -w
kubectl get svc -n elara-frontend-staging -w
```

**Option B: Use Shared Ingress with Path-Based Routing**
```yaml
# Create single ingress that routes to all environments
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: elara-multi-env-ingress
spec:
  rules:
  - http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: elara-frontend
            port:
              number: 80
        # Production (default)
      - path: /dev
        pathType: Prefix
        backend:
          service:
            name: elara-frontend
            port:
              number: 80
        # Development
      - path: /staging
        pathType: Prefix
        backend:
          service:
            name: elara-frontend
            port:
              number: 80
        # Staging
```

## Testing the Workflow

### Test 1: Development Push
```bash
git checkout develop

# Make a change
echo "console.log('Dev test');" >> elara-platform/packages/backend/src/test.js

git add .
git commit -m "Test dev deploy"
git push origin develop

# Automatically:
# ✅ Cloud Build triggered
# ✅ Builds dev images (dev-{sha})
# ✅ Deploys to *-dev namespaces
# ✅ Updates running pods

# Verify
kubectl get pods -n elara-backend-dev
```

### Test 2: Staging Promotion
```bash
git checkout staging
git merge develop
git push origin staging

# Automatically:
# ✅ Cloud Build triggered
# ✅ Builds staging images (staging-{sha})
# ✅ Deploys to *-staging namespaces
# ✅ Ready for testing
```

### Test 3: Production Release
```bash
git checkout main
git merge staging
git push origin main

# Automatically:
# ✅ Cloud Build triggered
# ✅ Builds production images (latest, v1.0.0)
# ✅ Deploys to production namespaces
# ✅ Runs smoke tests
# ✅ Goes live at http://34.36.48.252
```

## Environment Access Summary

After complete setup:

| Environment | Branch    | Frontend URL                          | API URL                                  | Status  |
|-------------|-----------|---------------------------------------|------------------------------------------|---------|
| Development | `develop` | `http://dev.elara.local:8080`        | `http://dev.elara.local:8080/api`       | Ready   |
| Staging     | `staging` | `http://staging.elara.local:8081`    | `http://staging.elara.local:8081/api`   | Ready   |
| Production  | `main`    | `http://34.36.48.252`                | `http://34.36.48.252/api`               | ✅ LIVE |

## Monitoring Deployments

### Watch Builds
```bash
# All recent builds
gcloud builds list --region=us-west1 --limit=10

# Live build logs
gcloud builds log BUILD_ID --stream --region=us-west1
```

### Check Deployment Status
```bash
# All environments
kubectl get pods -A | grep elara

# Specific environment
kubectl get pods -n elara-backend-dev
kubectl get pods -n elara-backend-staging
kubectl get pods -n elara-backend
```

### View Logs
```bash
# Development
kubectl logs -f deployment/elara-api -n elara-backend-dev

# Staging
kubectl logs -f deployment/elara-api -n elara-backend-staging

# Production
kubectl logs -f deployment/elara-api -n elara-backend
```

## Rollback if Needed

```bash
# Rollback dev deployment
kubectl rollout undo deployment/elara-api -n elara-backend-dev

# Rollback staging deployment
kubectl rollout undo deployment/elara-api -n elara-backend-staging

# Rollback production deployment
kubectl rollout undo deployment/elara-api -n elara-backend

# Check rollout history
kubectl rollout history deployment/elara-api -n elara-backend
```

## Next Steps

1. ✅ **Create branches** (develop, staging)
2. ✅ **Connect GitHub** to Cloud Build
3. ✅ **Push to develop** to test auto-deploy
4. ⏳ **Create load balancers** for dev/staging (optional)
5. ⏳ **Setup custom domains** (optional)
6. ⏳ **Configure SSL certificates** (recommended)

## Pro Tips

1. **Always test in dev first** before staging
2. **Use staging for client demos** and UAT
3. **Only deploy to prod** after staging approval
4. **Monitor builds** in Cloud Build console
5. **Check logs** if deployment fails
6. **Use kubectl describe** to debug pod issues

---

**You're all set!** Just push to any branch and watch the magic happen! 🚀
