# ==============================================================================
# SECURITY MODULE - IAM, SECRET MANAGER, CLOUD KMS
# ==============================================================================
# Purpose: Manage security resources including service accounts, secrets, and encryption
# ==============================================================================

# ==============================================================================
# SERVICE ACCOUNTS
# ==============================================================================

# Create service accounts for each service
resource "google_service_account" "service_accounts" {
  for_each = var.service_accounts

  project      = var.project_id
  account_id   = each.value.name
  display_name = each.value.description
  description  = each.value.description
}

# Grant IAM roles to service accounts
resource "google_project_iam_member" "service_account_roles" {
  for_each = merge([
    for sa_key, sa in var.service_accounts : {
      for role in sa.roles :
      "${sa_key}-${role}" => {
        service_account = google_service_account.service_accounts[sa_key].email
        role            = role
      }
    }
  ]...)

  project = var.project_id
  role    = each.value.role
  member  = "serviceAccount:${each.value.service_account}"
}

# ==============================================================================
# WORKLOAD IDENTITY (for GKE) - DISABLED until GKE cluster is created
# ==============================================================================
# Note: Workload Identity pool is created when the GKE cluster is created.
# These bindings will fail if applied before the GKE cluster exists.
#
# To enable Workload Identity:
# 1. First deploy infrastructure with these bindings commented out
# 2. After GKE cluster is created, uncomment these bindings
# 3. Run terraform apply again to create the Workload Identity bindings

# # Bind Kubernetes service accounts to Google service accounts
# resource "google_service_account_iam_member" "workload_identity_binding" {
#   for_each = {
#     api    = "elara-backend/elara-api-sa"
#     worker = "elara-workers/elara-worker-sa"
#     proxy  = "elara-proxy/elara-proxy-sa"
#   }
#
#   service_account_id = google_service_account.service_accounts[each.key].name
#   role               = "roles/iam.workloadIdentityUser"
#   member             = "serviceAccount:${var.project_id}.svc.id.goog[${each.value}]"
#
#   depends_on = [
#     # Ensure GKE cluster with Workload Identity is created first
#     # Add: depends_on = [module.gke.cluster_id]
#   ]
# }

# ==============================================================================
# CLOUD KMS - KEY MANAGEMENT SERVICE
# ==============================================================================

# Create KMS Key Ring
resource "google_kms_key_ring" "keyring" {
  project  = var.project_id
  name     = var.kms_key_ring_name
  location = var.region
}

# Create encryption keys
resource "google_kms_crypto_key" "keys" {
  for_each = toset(var.kms_keys)

  name     = each.value
  key_ring = google_kms_key_ring.keyring.id

  # Rotation period (90 days)
  rotation_period = var.key_rotation_period

  # Prevent destruction
  lifecycle {
    prevent_destroy = true
  }

  # Purpose: Encrypt/Decrypt
  purpose = "ENCRYPT_DECRYPT"

  # Version template
  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }

  labels = var.labels
}

# ==============================================================================
# KMS SERVICE ACCOUNT BINDINGS - DISABLED until services are created
# ==============================================================================
# Note: Google-managed service accounts for Cloud SQL, Storage, and Redis
# are created automatically when the first resource of that type is created.
# These bindings will fail if applied before those service accounts exist.
#
# To enable KMS bindings:
# 1. First deploy infrastructure with these bindings commented out
# 2. After Cloud SQL, Storage buckets, and Redis are created, uncomment
# 3. Run terraform apply again to create the KMS bindings

# # Grant Cloud SQL service account access to Cloud SQL key
# resource "google_kms_crypto_key_iam_member" "cloudsql_key_binding" {
#   crypto_key_id = google_kms_crypto_key.keys["cloudsql-key"].id
#   role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
#   member        = "serviceAccount:service-${var.project_number}@gcp-sa-cloud-sql.iam.gserviceaccount.com"
# }
#
# # Grant Cloud Storage service account access to Storage key
# resource "google_kms_crypto_key_iam_member" "storage_key_binding" {
#   crypto_key_id = google_kms_crypto_key.keys["storage-key"].id
#   role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
#   member        = "serviceAccount:service-${var.project_number}@gs-project-accounts.iam.gserviceaccount.com"
# }
#
# # Grant Redis service account access to Redis key
# resource "google_kms_crypto_key_iam_member" "redis_key_binding" {
#   crypto_key_id = google_kms_crypto_key.keys["redis-key"].id
#   role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
#   member        = "serviceAccount:service-${var.project_number}@cloud-redis.iam.gserviceaccount.com"
# }

# ==============================================================================
# SECRET MANAGER
# ==============================================================================

# Enable Secret Manager API
resource "google_project_service" "secretmanager" {
  project = var.project_id
  service = "secretmanager.googleapis.com"

  disable_on_destroy = false
}

# ==============================================================================
# SECRETS (DISABLED - Secrets are created by deployment script)
# ==============================================================================
# Note: Secrets are created by scripts/01_create_secrets.sh during initial setup.
# Terraform does not manage secret creation to avoid conflicts and allow for
# manual secret value management.
#
# To have Terraform manage secrets, uncomment the resource below and import
# existing secrets into Terraform state using:
#   terraform import module.security.google_secret_manager_secret.secrets[\"secret-name\"] projects/PROJECT_ID/secrets/secret-name

# # Create secrets (without setting values - values will be added via scripts)
# resource "google_secret_manager_secret" "secrets" {
#   for_each = toset(var.secret_names)
#
#   project   = var.project_id
#   secret_id = each.value
#
#   replication {
#     auto {}
#   }
#
#   labels = var.labels
#
#   depends_on = [google_project_service.secretmanager]
# }

# ==============================================================================
# SECRET IAM BINDINGS (DISABLED - Would require secret resources)
# ==============================================================================
# Note: IAM bindings for secrets are also disabled since the secret resources
# are not managed by Terraform. Service accounts have project-level
# secretmanager.secretAccessor role which grants access to all secrets.
#
# To enable granular per-secret IAM, uncomment both the secret resources above
# and this IAM binding resource.

# # Grant service accounts access to secrets
# resource "google_secret_manager_secret_iam_member" "secret_access" {
#   for_each = {
#     for pair in setproduct(var.secret_names, keys(var.service_accounts)) :
#     "${pair[0]}-${pair[1]}" => {
#       secret          = pair[0]
#       service_account = pair[1]
#     }
#   }
#
#   secret_id = google_secret_manager_secret.secrets[each.value.secret].id
#   role      = "roles/secretmanager.secretAccessor"
#   member    = "serviceAccount:${google_service_account.service_accounts[each.value.service_account].email}"
# }

# ==============================================================================
# IAM AUDIT LOGGING
# ==============================================================================

# Enable Data Access audit logs for security monitoring
resource "google_project_iam_audit_config" "audit_config" {
  project = var.project_id
  service = "allServices"

  audit_log_config {
    log_type = "ADMIN_READ"
  }

  audit_log_config {
    log_type = "DATA_READ"
  }

  audit_log_config {
    log_type = "DATA_WRITE"
  }
}

# ==============================================================================
# BINARY AUTHORIZATION (for GKE container signing)
# ==============================================================================

# Create Binary Authorization policy
resource "google_binary_authorization_policy" "policy" {
  project = var.project_id

  # Default rule: Require attestation
  default_admission_rule {
    evaluation_mode  = var.enable_binary_authorization ? "REQUIRE_ATTESTATION" : "ALWAYS_ALLOW"
    enforcement_mode = var.enable_binary_authorization ? "ENFORCED_BLOCK_AND_AUDIT_LOG" : "DRYRUN_AUDIT_LOG_ONLY"

    require_attestations_by = var.enable_binary_authorization ? [
      google_binary_authorization_attestor.attestor[0].name
    ] : []
  }

  # Allow GKE system images
  admission_whitelist_patterns {
    name_pattern = "gcr.io/google_containers/*"
  }

  admission_whitelist_patterns {
    name_pattern = "gcr.io/google-containers/*"
  }

  admission_whitelist_patterns {
    name_pattern = "k8s.gcr.io/*"
  }

  admission_whitelist_patterns {
    name_pattern = "gke.gcr.io/*"
  }

  admission_whitelist_patterns {
    name_pattern = "gcr.io/gke-release/*"
  }
}

# Create attestor (for signed container images)
resource "google_binary_authorization_attestor" "attestor" {
  count = var.enable_binary_authorization ? 1 : 0

  project = var.project_id
  name    = "${var.environment}-attestor"

  attestation_authority_note {
    note_reference = google_container_analysis_note.note[0].name
  }
}

# Create Container Analysis note
resource "google_container_analysis_note" "note" {
  count = var.enable_binary_authorization ? 1 : 0

  project = var.project_id
  name    = "${var.environment}-attestor-note"

  attestation_authority {
    hint {
      human_readable_name = "Elara attestor"
    }
  }
}

# ==============================================================================
# SECURITY COMMAND CENTER (if enabled)
# ==============================================================================

# Note: Security Command Center is enabled at the organization level
# This is a placeholder for future SCC configuration

# ==============================================================================
# VPC SERVICE CONTROLS (Optional - Phase 2)
# ==============================================================================

# VPC Service Controls will be added in Phase 2 for additional security

# ==============================================================================
# ORGANIZATION POLICIES (DISABLED - Requires org-level admin)
# ==============================================================================
# Note: Organization policies require organization-level admin permissions.
# These should be configured manually by the GCP org admin if needed.
#
# Recommended policies:
# - storage.uniformBucketLevelAccess (enforce uniform bucket access)
# - sql.restrictPublicIp (restrict Cloud SQL public IPs)
# - compute.requireOsLogin (require OS Login for VMs)
# - compute.restrictSharedVpcSubnetworks (restrict shared VPC)
# - iam.disableServiceAccountKeyCreation (disable SA key creation)
#
# To enable, uncomment the resources below and ensure terraform-deployer
# has roles/orgpolicy.policyAdmin at the organization level.

# # Enforce uniform bucket-level access
# resource "google_project_organization_policy" "uniform_bucket_level_access" {
#   project    = var.project_id
#   constraint = "storage.uniformBucketLevelAccess"
#
#   boolean_policy {
#     enforced = true
#   }
# }
#
# # Restrict Cloud SQL external IPs
# resource "google_project_organization_policy" "cloudsql_external_ips" {
#   project    = var.project_id
#   constraint = "sql.restrictPublicIp"
#
#   boolean_policy {
#     enforced = true
#   }
# }
#
# # Require OS Login (for VM SSH access)
# resource "google_project_organization_policy" "require_os_login" {
#   project    = var.project_id
#   constraint = "compute.requireOsLogin"
#
#   boolean_policy {
#     enforced = true
#   }
# }
#
# # Restrict shared VPC subnetworks
# resource "google_project_organization_policy" "restrict_shared_vpc_subnetworks" {
#   project    = var.project_id
#   constraint = "compute.restrictSharedVpcSubnetworks"
#
#   list_policy {
#     allow {
#       all = true
#     }
#   }
# }
#
# # Disable service account key creation (use Workload Identity instead)
# resource "google_project_organization_policy" "disable_service_account_key_creation" {
#   project    = var.project_id
#   constraint = "iam.disableServiceAccountKeyCreation"
#
#   boolean_policy {
#     enforced = var.enforce_workload_identity_only
#   }
# }

# ==============================================================================
# SECURITY MONITORING & ALERTING (DISABLED - Requires logging.admin)
# ==============================================================================
# Note: Security log sinks and buckets require logging.admin permissions.
# These can be enabled after granting the terraform-deployer service account
# the roles/logging.admin role, or by having the org admin create them manually.
#
# Recommended configuration:
# - Log sink: Filter for IAM, Cloud SQL, Storage events and errors
# - Log bucket: 10-year retention for compliance
# - Grant log writer identity access to the bucket

# # Create log sink for security events
# resource "google_logging_project_sink" "security_sink" {
#   project = var.project_id
#   name    = "${var.environment}-security-logs"
#
#   destination = "logging.googleapis.com/projects/${var.project_id}/locations/global/buckets/${var.environment}-security-logs"
#
#   # Filter for security-relevant logs
#   filter = <<-EOT
#     protoPayload.methodName=~"^(google.iam|google.cloud.sql|google.storage)"
#     OR severity >= ERROR
#     OR protoPayload.authenticationInfo.principalEmail!=""
#   EOT
#
#   unique_writer_identity = true
# }
#
# # Create log bucket for security logs (10-year retention)
# resource "google_logging_project_bucket_config" "security_logs_bucket" {
#   project        = var.project_id
#   location       = "global"
#   bucket_id      = "${var.environment}-security-logs"
#   retention_days = 3650  # 10 years for compliance
#
#   lifecycle {
#     prevent_destroy = true
#   }
# }
