#!/bin/bash

#===============================================================================
# Migrate Cloud SQL to Self-Managed PostgreSQL on GKE
# Estimated Time: 2-4 hours
# Savings: $1,926/month ($23,112/year)
#===============================================================================

set -e

PROJECT_ID="elara-mvp-13082025-u1"
CLUSTER_NAME="elara-gke-us-west1"
REGION="us-west1"
BACKUP_BUCKET="gs://elara-backups-${PROJECT_ID}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Cloud SQL → Self-Managed PostgreSQL Migration              ║${NC}"
echo -e "${BLUE}║  COST SAVINGS: \$1,926/month (\$23,112/year)                  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

#===============================================================================
# PHASE 1: PRE-MIGRATION CHECKLIST
#===============================================================================

echo -e "${YELLOW}═══ PHASE 1: Pre-Migration Checklist ═══${NC}"
echo ""

echo "Checklist:"
echo "  [ ] Kubernetes manifests reviewed and secrets generated"
echo "  [ ] GCS backup bucket exists: ${BACKUP_BUCKET}"
echo "  [ ] GKE cluster has sufficient capacity (2 vCPU + 8GB RAM)"
echo "  [ ] Maintenance window scheduled (2-hour window)"
echo "  [ ] Rollback plan documented"
echo ""

read -p "Have you completed the checklist? (yes/no): " CHECKLIST_COMPLETE
if [ "$CHECKLIST_COMPLETE" != "yes" ]; then
    echo -e "${RED}❌ Please complete the checklist before continuing${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Checklist confirmed${NC}"
echo ""

#===============================================================================
# PHASE 2: GENERATE SECRETS
#===============================================================================

echo -e "${YELLOW}═══ PHASE 2: Generate Secrets ═══${NC}"
echo ""

# Generate strong passwords
POSTGRES_PASSWORD=$(openssl rand -base64 32)
REPLICATION_PASSWORD=$(openssl rand -base64 32)

echo "Generated passwords:"
echo "  - POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:8}..."
echo "  - REPLICATION_PASSWORD: ${REPLICATION_PASSWORD:0:8}..."
echo ""

# Create secrets file
cat > /tmp/postgres-secrets.yaml <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secrets
  namespace: elara-database
type: Opaque
data:
  POSTGRES_PASSWORD: $(echo -n "$POSTGRES_PASSWORD" | base64)
  POSTGRES_REPLICATION_PASSWORD: $(echo -n "$REPLICATION_PASSWORD" | base64)
EOF

# Create DATABASE_URL for backend
DATABASE_URL="postgresql://elara_app:${POSTGRES_PASSWORD}@postgres-primary.elara-database.svc.cluster.local:5432/elara_production"

cat > /tmp/elara-database-credentials.yaml <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: elara-database-credentials
  namespace: elara-backend-prod
type: Opaque
data:
  DATABASE_URL: $(echo -n "$DATABASE_URL" | base64)
EOF

echo -e "${GREEN}✅ Secrets generated${NC}"
echo ""

#===============================================================================
# PHASE 3: EXPORT FROM CLOUD SQL
#===============================================================================

echo -e "${YELLOW}═══ PHASE 3: Export from Cloud SQL ═══${NC}"
echo ""

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
EXPORT_FILE="migration-cloudsql-${TIMESTAMP}.sql"
EXPORT_GCS_PATH="${BACKUP_BUCKET}/migration/${EXPORT_FILE}"

echo "Exporting Cloud SQL database..."
echo "  Instance: elara-postgres-primary"
echo "  Database: elara_production"
echo "  Destination: ${EXPORT_GCS_PATH}"
echo ""

gcloud sql export sql elara-postgres-primary \
  "${EXPORT_GCS_PATH}" \
  --database=elara_production \
  --project="${PROJECT_ID}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Cloud SQL export complete${NC}"

    # Download to local
    gsutil cp "${EXPORT_GCS_PATH}" "/tmp/${EXPORT_FILE}"

    EXPORT_SIZE=$(du -h "/tmp/${EXPORT_FILE}" | cut -f1)
    echo "  Export size: ${EXPORT_SIZE}"
else
    echo -e "${RED}❌ Cloud SQL export failed${NC}"
    exit 1
fi

echo ""

#===============================================================================
# PHASE 4: DEPLOY SELF-MANAGED POSTGRESQL
#===============================================================================

echo -e "${YELLOW}═══ PHASE 4: Deploy Self-Managed PostgreSQL ═══${NC}"
echo ""

# Get GKE credentials
gcloud container clusters get-credentials "${CLUSTER_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}"

# Apply Kubernetes manifests
echo "Applying Kubernetes manifests..."

kubectl apply -f ../kubernetes/postgresql/00-namespace.yaml
kubectl apply -f /tmp/postgres-secrets.yaml
kubectl apply -f ../kubernetes/postgresql/01-configmap.yaml
kubectl apply -f ../kubernetes/postgresql/03-storage.yaml
kubectl apply -f ../kubernetes/postgresql/04-primary-statefulset.yaml

echo "Waiting for PostgreSQL pod to be ready..."
kubectl wait --for=condition=ready pod \
  -l app=postgres,role=primary \
  -n elara-database \
  --timeout=300s

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ PostgreSQL deployed successfully${NC}"
else
    echo -e "${RED}❌ PostgreSQL deployment failed${NC}"
    exit 1
fi

echo ""

#===============================================================================
# PHASE 5: IMPORT DATA
#===============================================================================

echo -e "${YELLOW}═══ PHASE 5: Import Data ═══${NC}"
echo ""

POD_NAME=$(kubectl get pods -n elara-database -l app=postgres,role=primary -o jsonpath='{.items[0].metadata.name}')

echo "Importing data to pod: ${POD_NAME}"
echo "This may take several minutes..."

# Copy SQL file to pod
kubectl cp "/tmp/${EXPORT_FILE}" \
  "elara-database/${POD_NAME}:/tmp/${EXPORT_FILE}"

# Import data
kubectl exec -it "${POD_NAME}" -n elara-database -- \
  bash -c "PGPASSWORD='${POSTGRES_PASSWORD}' psql -U elara_app -d elara_production < /tmp/${EXPORT_FILE}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Data import complete${NC}"
else
    echo -e "${RED}❌ Data import failed${NC}"
    exit 1
fi

echo ""

#===============================================================================
# PHASE 6: VERIFY DATA INTEGRITY
#===============================================================================

echo -e "${YELLOW}═══ PHASE 6: Verify Data Integrity ═══${NC}"
echo ""

echo "Verifying table counts..."

# Count tables
kubectl exec "${POD_NAME}" -n elara-database -- \
  bash -c "PGPASSWORD='${POSTGRES_PASSWORD}' psql -U elara_app -d elara_production -c '
    SELECT
      schemaname,
      tablename,
      n_live_tup as row_count
    FROM pg_stat_user_tables
    ORDER BY n_live_tup DESC;
  '"

echo ""
read -p "Does the data look correct? (yes/no): " DATA_VERIFIED
if [ "$DATA_VERIFIED" != "yes" ]; then
    echo -e "${RED}❌ Data verification failed. Stopping migration.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Data verified${NC}"
echo ""

#===============================================================================
# PHASE 7: UPDATE APPLICATION CONFIGURATION
#===============================================================================

echo -e "${YELLOW}═══ PHASE 7: Update Application Configuration ═══${NC}"
echo ""

# Apply database credentials secret
kubectl apply -f /tmp/elara-database-credentials.yaml

# Restart backend pods to pick up new DATABASE_URL
echo "Restarting backend pods..."
kubectl rollout restart deployment/elara-api -n elara-backend-prod
kubectl rollout status deployment/elara-api -n elara-backend-prod --timeout=300s

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend pods restarted${NC}"
else
    echo -e "${RED}❌ Backend restart failed${NC}"
    echo "Rollback: kubectl rollout undo deployment/elara-api -n elara-backend-prod"
    exit 1
fi

echo ""

#===============================================================================
# PHASE 8: SMOKE TESTS
#===============================================================================

echo -e "${YELLOW}═══ PHASE 8: Smoke Tests ═══${NC}"
echo ""

echo "Running smoke tests..."

# Test database connectivity from backend pod
BACKEND_POD=$(kubectl get pods -n elara-backend-prod -l app=elara-api -o jsonpath='{.items[0].metadata.name}')

kubectl exec "${BACKEND_POD}" -n elara-backend-prod -- \
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.\$connect()
      .then(() => { console.log('✅ Database connection successful'); process.exit(0); })
      .catch((err) => { console.error('❌ Database connection failed:', err); process.exit(1); });
  "

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Smoke tests passed${NC}"
else
    echo -e "${RED}❌ Smoke tests failed${NC}"
    exit 1
fi

echo ""

#===============================================================================
# PHASE 9: DEPLOY BACKUPS
#===============================================================================

echo -e "${YELLOW}═══ PHASE 9: Deploy Backup System ═══${NC}"
echo ""

# Create GCP service account for backups
gcloud iam service-accounts create elara-postgres-backup \
  --display-name="Elara PostgreSQL Backup Service Account" \
  --project="${PROJECT_ID}" || true

# Grant storage admin role
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:elara-postgres-backup@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Bind to Kubernetes service account
gcloud iam service-accounts add-iam-policy-binding \
  "elara-postgres-backup@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="serviceAccount:${PROJECT_ID}.svc.id.goog[elara-database/postgres-backup-sa]"

# Apply backup CronJob
kubectl apply -f ../kubernetes/postgresql/05-backup-cronjob.yaml

echo -e "${GREEN}✅ Backup system deployed${NC}"
echo ""

#===============================================================================
# PHASE 10: MONITORING & CLEANUP
#===============================================================================

echo -e "${YELLOW}═══ PHASE 10: Monitoring & Cleanup ═══${NC}"
echo ""

# Deploy monitoring
kubectl apply -f ../kubernetes/postgresql/06-monitoring.yaml

echo "Migration complete!"
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           MIGRATION SUCCESSFUL                               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo "Next Steps:"
echo "  1. Monitor application for 24 hours"
echo "  2. Verify all features working correctly"
echo "  3. Check PostgreSQL metrics in monitoring"
echo "  4. Verify backups are running (check in 6 hours)"
echo "  5. After 7 days of stability, delete Cloud SQL instances"
echo ""

echo "Cloud SQL Cleanup (AFTER 7 DAYS):"
echo "  gcloud sql instances delete elara-postgres-primary --project=${PROJECT_ID}"
echo "  gcloud sql instances delete elara-postgres-replica-1 --project=${PROJECT_ID}"
echo "  gcloud sql instances delete elara-postgres-dr --project=${PROJECT_ID}"
echo ""

echo "Cost Savings:"
echo "  Monthly: \$1,926 saved"
echo "  Annual: \$23,112 saved"
echo ""

echo "Rollback Plan (if needed):"
echo "  1. Update DATABASE_URL to point back to Cloud SQL"
echo "  2. Restart backend pods"
echo "  3. Delete self-managed PostgreSQL: kubectl delete namespace elara-database"
echo ""

# Save passwords to secure location
echo "IMPORTANT: Save these credentials securely!"
echo "  POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
echo "  REPLICATION_PASSWORD=${REPLICATION_PASSWORD}"
echo "  DATABASE_URL=${DATABASE_URL}"
echo ""

echo -e "${GREEN}✅ All done!${NC}"
