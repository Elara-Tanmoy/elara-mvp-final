# ==============================================================================
# SECURITY MODULE - VARIABLES
# ==============================================================================

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "project_number" {
  description = "GCP Project Number"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "environment" {
  description = "Environment name (production, staging, development)"
  type        = string
}

variable "service_accounts" {
  description = "Service accounts to create"
  type = map(object({
    name                  = string
    description           = string
    roles                 = list(string)
    k8s_namespace         = string
    k8s_service_account   = string
  }))

  default = {}
}

variable "kms_key_ring_name" {
  description = "KMS key ring name"
  type        = string
}

variable "kms_keys" {
  description = "List of KMS encryption keys to create"
  type        = list(string)
  default     = []
}

variable "key_rotation_period" {
  description = "KMS key rotation period"
  type        = string
  default     = "7776000s"  # 90 days
}

variable "secret_names" {
  description = "List of secrets to create in Secret Manager"
  type        = list(string)
  default     = [
    "production-backend-db-password",
    "production-backend-db-connection-string",
    "production-backend-redis-password",
    "production-backend-redis-url",
    "production-backend-jwt-secret",
    "production-backend-anthropic-api-key",
    "production-backend-openai-api-key",
    "production-backend-google-ai-api-key",
    "production-backend-huggingface-api-key",
    "production-backend-grok-api-key",
    "production-backend-virustotal-api-key",
    "production-backend-google-safe-browsing-api-key",
    "production-backend-abuseipdb-api-key",
    "production-backend-abstract-api-key",
    "production-backend-twilio-account-sid",
    "production-backend-twilio-auth-token",
    "production-backend-twilio-whatsapp-number",
    "production-backend-whatsapp-encryption-key",
    "production-backend-elara-bot-email",
    "production-backend-elara-bot-password"
  ]
}

variable "enable_binary_authorization" {
  description = "Enable Binary Authorization for container signing"
  type        = bool
  default     = true
}

variable "enforce_workload_identity_only" {
  description = "Disable service account key creation (enforce Workload Identity)"
  type        = bool
  default     = false  # Set to true after Workload Identity is fully configured
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}
