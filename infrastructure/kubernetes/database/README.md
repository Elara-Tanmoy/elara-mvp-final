# Self-Managed PostgreSQL on GKE

**Cost Savings:** $1,926/month ($23,112/year) compared to Cloud SQL

## Architecture

- **Primary:** 2 vCPU, 8GB RAM, 200GB SSD
- **Replica:** 1 vCPU, 4GB RAM, 200GB SSD
- **Backups:** Every 6 hours to Cloud Storage, 30-day retention

## Deployment Steps

### 1. Generate Passwords

```bash
# Generate strong passwords
DB_PASSWORD=$(openssl rand -base64 32)
REPL_PASSWORD=$(openssl rand -base64 32)

echo "Database Password: $DB_PASSWORD"
echo "Replication Password: $REPL_PASSWORD"
```

### 2. Create Kubernetes Secret

```bash
# Create secret with generated passwords
kubectl create secret generic postgres-secrets \
  --from-literal=POSTGRES_PASSWORD="$DB_PASSWORD" \
  --from-literal=POSTGRES_REPLICATION_PASSWORD="$REPL_PASSWORD" \
  --from-literal=DATABASE_URL="postgresql://elara_app:$DB_PASSWORD@postgres-primary:5432/elara_production?sslmode=require" \
  --from-literal=DATABASE_REPLICA_URL="postgresql://elara_app:$DB_PASSWORD@postgres-replica:5432/elara_production?sslmode=require" \
  --namespace=elara-backend-prod \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 3. Deploy PostgreSQL

```bash
# Apply all manifests in order
kubectl apply -f 01-postgres-configmap.yaml
kubectl apply -f 04-postgres-init-scripts.yaml
kubectl apply -f 03-postgres-primary-statefulset.yaml

# Wait for primary to be ready
kubectl wait --for=condition=ready pod/postgres-primary-0 \
  --namespace=elara-backend-prod \
  --timeout=300s

# Deploy replica
kubectl apply -f 05-postgres-replica-statefulset.yaml

# Wait for replica to be ready
kubectl wait --for=condition=ready pod/postgres-replica-0 \
  --namespace=elara-backend-prod \
  --timeout=300s

# Deploy backup CronJob
kubectl apply -f 06-postgres-backup-cronjob.yaml
```

### 4. Verify Deployment

```bash
# Check pods
kubectl get pods -n elara-backend-prod -l app=postgresql

# Check services
kubectl get svc -n elara-backend-prod -l app=postgresql

# Check replication status
kubectl exec -it postgres-primary-0 -n elara-backend-prod -- \
  psql -U elara_app -d elara_production -c "SELECT * FROM pg_stat_replication;"

# Check replica status
kubectl exec -it postgres-replica-0 -n elara-backend-prod -- \
  psql -U elara_app -d elara_production -c "SELECT pg_is_in_recovery();"
```

## Data Migration from Cloud SQL

### Export from Cloud SQL

```bash
# Create export bucket if needed
gsutil mb gs://elara-migration-temp

# Export database
gcloud sql export sql elara-postgres-primary \
  gs://elara-migration-temp/cloudsql-export-$(date +%Y%m%d).sql \
  --database=elara_production
```

### Import to Self-Managed PostgreSQL

```bash
# Download export file
gsutil cp gs://elara-migration-temp/cloudsql-export-*.sql /tmp/

# Import to PostgreSQL
kubectl exec -i postgres-primary-0 -n elara-backend-prod -- \
  psql -U elara_app -d elara_production < /tmp/cloudsql-export-*.sql

# Verify data
kubectl exec -it postgres-primary-0 -n elara-backend-prod -- \
  psql -U elara_app -d elara_production -c "SELECT COUNT(*) FROM users;"
```

## Monitoring

### Check Database Size

```bash
kubectl exec -it postgres-primary-0 -n elara-backend-prod -- \
  psql -U elara_app -d elara_production -c "
    SELECT
      pg_size_pretty(pg_database_size('elara_production')) AS database_size,
      pg_size_pretty(pg_total_relation_size('users')) AS users_table_size;
  "
```

### Check Connections

```bash
kubectl exec -it postgres-primary-0 -n elara-backend-prod -- \
  psql -U elara_app -d elara_production -c "
    SELECT COUNT(*) as active_connections
    FROM pg_stat_activity
    WHERE state = 'active';
  "
```

### View Logs

```bash
# Primary logs
kubectl logs -f postgres-primary-0 -n elara-backend-prod

# Replica logs
kubectl logs -f postgres-replica-0 -n elara-backend-prod

# Backup logs
kubectl logs -f $(kubectl get pods -n elara-backend-prod -l component=backup --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1].metadata.name}') -n elara-backend-prod
```

## Backup & Restore

### Manual Backup

```bash
# Trigger backup job manually
kubectl create job --from=cronjob/postgres-backup postgres-backup-manual-$(date +%Y%m%d) -n elara-backend-prod

# Watch backup progress
kubectl logs -f job/postgres-backup-manual-$(date +%Y%m%d) -n elara-backend-prod
```

### Restore from Backup

```bash
# List available backups
gsutil ls gs://elara-backups-elara-mvp-13082025-u1/postgres/

# Download backup
gsutil cp gs://elara-backups-elara-mvp-13082025-u1/postgres/elara-postgres-backup-YYYYMMDD-HHMMSS.sql.gz /tmp/

# Stop all application pods first
kubectl scale deployment elara-api --replicas=0 -n elara-backend-prod

# Restore
kubectl exec -i postgres-primary-0 -n elara-backend-prod -- \
  pg_restore -U elara_app -d elara_production --clean --if-exists < /tmp/elara-postgres-backup-*.sql.gz

# Restart application
kubectl scale deployment elara-api --replicas=2 -n elara-backend-prod
```

## Scaling

### Vertical Scaling (More Resources)

Edit StatefulSet resource requests:

```bash
kubectl edit statefulset postgres-primary -n elara-backend-prod

# Update:
# resources:
#   requests:
#     memory: "16Gi"  # Was 8Gi
#     cpu: "4000m"     # Was 2000m
```

### Horizontal Scaling (More Replicas)

```bash
# Add more read replicas
kubectl scale statefulset postgres-replica --replicas=2 -n elara-backend-prod
```

## Maintenance

### PostgreSQL Upgrade

```bash
# Update image version in StatefulSet
kubectl set image statefulset/postgres-primary postgresql=postgres:17-alpine -n elara-backend-prod
kubectl set image statefulset/postgres-replica postgresql=postgres:17-alpine -n elara-backend-prod

# Rolling restart
kubectl rollout restart statefulset/postgres-primary -n elara-backend-prod
kubectl rollout restart statefulset/postgres-replica -n elara-backend-prod
```

### Vacuum & Analyze

```bash
kubectl exec -it postgres-primary-0 -n elara-backend-prod -- \
  psql -U elara_app -d elara_production -c "VACUUM ANALYZE;"
```

## Troubleshooting

### Replication Lag

```bash
# Check lag
kubectl exec -it postgres-primary-0 -n elara-backend-prod -- \
  psql -U elara_app -d elara_production -c "
    SELECT
      client_addr,
      state,
      pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn) AS lag_bytes
    FROM pg_stat_replication;
  "
```

### Fix Broken Replication

```bash
# Delete replica data and recreate
kubectl delete pod postgres-replica-0 -n elara-backend-prod
kubectl delete pvc postgres-storage-postgres-replica-0 -n elara-backend-prod

# Replica will reinitialize from primary
kubectl get pods -n elara-backend-prod -l role=replica -w
```

## Cost Analysis

| Component | Monthly Cost |
|-----------|-------------|
| Primary (2 vCPU, 8GB RAM, 200GB SSD) | $105 |
| Replica (1 vCPU, 4GB RAM, 200GB SSD) | $68 |
| Backups (Cloud Storage) | $1 |
| **TOTAL** | **$174** |

**Savings vs Cloud SQL:** $1,926/month ($23,112/year)

## Rollback to Cloud SQL

If needed, migration back takes ~4 hours:

```bash
# 1. Create backup
kubectl create job --from=cronjob/postgres-backup postgres-final-backup -n elara-backend-prod

# 2. Create new Cloud SQL instance
gcloud sql instances create elara-postgres-new --tier=db-custom-4-16384

# 3. Import backup
gsutil cp gs://elara-backups-elara-mvp-13082025-u1/postgres/latest.sql.gz gs://elara-migration-temp/
gcloud sql import sql elara-postgres-new gs://elara-migration-temp/latest.sql.gz

# 4. Update application DATABASE_URL
# 5. Delete self-managed PostgreSQL
```
