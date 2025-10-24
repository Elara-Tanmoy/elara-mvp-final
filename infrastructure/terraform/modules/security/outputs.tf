# ==============================================================================
# SECURITY MODULE - OUTPUTS
# ==============================================================================

output "service_accounts" {
  description = "Service account details"
  value = {
    for key, sa in google_service_account.service_accounts :
    key => {
      email = sa.email
      id    = sa.id
      name  = sa.name
    }
  }
}

output "kms_keyring_id" {
  description = "KMS Key Ring ID"
  value       = google_kms_key_ring.keyring.id
}

output "kms_keyring_name" {
  description = "KMS Key Ring name"
  value       = google_kms_key_ring.keyring.name
}

output "kms_keys" {
  description = "KMS encryption keys"
  value = {
    for key, crypto_key in google_kms_crypto_key.keys :
    key => {
      id        = crypto_key.id
      name      = crypto_key.name
      self_link = crypto_key.id
    }
  }
}

output "secret_manager_project" {
  description = "Secret Manager project ID"
  value       = var.project_id
}

# Disabled - secrets are not managed by Terraform
# output "secret_ids" {
#   description = "Secret Manager secret IDs"
#   value       = [for secret in google_secret_manager_secret.secrets : secret.id]
# }

# Disabled - secrets are not managed by Terraform
# output "secret_names" {
#   description = "Secret Manager secret names"
#   value       = [for secret in google_secret_manager_secret.secrets : secret.secret_id]
# }

output "binary_authorization_policy_name" {
  description = "Binary Authorization policy name"
  value       = google_binary_authorization_policy.policy.id
}

output "attestor_name" {
  description = "Binary Authorization attestor name"
  value       = var.enable_binary_authorization ? google_binary_authorization_attestor.attestor[0].name : null
}

# Disabled - security log sink is not managed by Terraform
# output "security_log_sink_name" {
#   description = "Security log sink name"
#   value       = google_logging_project_sink.security_sink.name
# }

# Disabled - security log bucket is not managed by Terraform
# output "security_log_bucket_name" {
#   description = "Security log bucket name"
#   value       = google_logging_project_bucket_config.security_logs_bucket.bucket_id
# }
