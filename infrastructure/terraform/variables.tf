# ==============================================================================
# ELARA PLATFORM - TERRAFORM VARIABLES
# ==============================================================================
# Purpose: Input variables for GCP infrastructure configuration
# ==============================================================================

variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "elara-mvp-13082025-u1"
}

variable "project_number" {
  description = "GCP Project Number"
  type        = string
  default     = "122460113662"
}

variable "region" {
  description = "Primary GCP region for resources"
  type        = string
  default     = "us-west1"
}

variable "zone" {
  description = "Primary GCP zone for resources"
  type        = string
  default     = "us-west1-a"
}

variable "dr_region" {
  description = "Disaster Recovery region"
  type        = string
  default     = "us-east1"
}

variable "dr_zone" {
  description = "Disaster Recovery zone"
  type        = string
  default     = "us-east1-a"
}

variable "environment" {
  description = "Environment name (production, staging, development)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "Environment must be production, staging, or development."
  }
}

# ==============================================================================
# NETWORKING VARIABLES
# ==============================================================================

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "enable_private_google_access" {
  description = "Enable Private Google Access for subnets"
  type        = bool
  default     = true
}

variable "enable_flow_logs" {
  description = "Enable VPC Flow Logs"
  type        = bool
  default     = true
}

# ==============================================================================
# DATABASE VARIABLES
# ==============================================================================

variable "cloudsql_instance_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-custom-8-32768"  # 8 vCPU, 32GB RAM
}

variable "cloudsql_disk_size" {
  description = "Cloud SQL disk size in GB"
  type        = number
  default     = 500
}

variable "cloudsql_disk_type" {
  description = "Cloud SQL disk type (PD-SSD or PD-HDD)"
  type        = string
  default     = "PD_SSD"
}

variable "cloudsql_availability_type" {
  description = "Cloud SQL availability type (REGIONAL for HA, ZONAL for single zone)"
  type        = string
  default     = "REGIONAL"

  validation {
    condition     = contains(["REGIONAL", "ZONAL"], var.cloudsql_availability_type)
    error_message = "Availability type must be REGIONAL or ZONAL."
  }
}

variable "cloudsql_backup_enabled" {
  description = "Enable automated backups for Cloud SQL"
  type        = bool
  default     = true
}

variable "cloudsql_backup_start_time" {
  description = "Start time for Cloud SQL backups (HH:MM format)"
  type        = string
  default     = "03:00"
}

variable "cloudsql_pitr_enabled" {
  description = "Enable Point-in-Time Recovery"
  type        = bool
  default     = true
}

variable "cloudsql_retained_backups" {
  description = "Number of automated backups to retain"
  type        = number
  default     = 30
}

# ==============================================================================
# REDIS VARIABLES
# ==============================================================================

variable "redis_memory_size_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 5
}

variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "REDIS_7_0"
}

variable "redis_tier" {
  description = "Redis tier (BASIC or STANDARD_HA)"
  type        = string
  default     = "STANDARD_HA"

  validation {
    condition     = contains(["BASIC", "STANDARD_HA"], var.redis_tier)
    error_message = "Redis tier must be BASIC or STANDARD_HA."
  }
}

# ==============================================================================
# GKE VARIABLES
# ==============================================================================

variable "gke_autopilot_enabled" {
  description = "Enable GKE Autopilot mode"
  type        = bool
  default     = true
}

variable "gke_release_channel" {
  description = "GKE release channel (RAPID, REGULAR, STABLE)"
  type        = string
  default     = "REGULAR"
}

variable "gke_enable_private_nodes" {
  description = "Enable private nodes for GKE"
  type        = bool
  default     = true
}

variable "gke_enable_private_endpoint" {
  description = "Enable private endpoint for GKE master"
  type        = bool
  default     = false  # Allow public access for kubectl (protected by IAM)
}

variable "gke_master_ipv4_cidr_block" {
  description = "CIDR block for GKE master"
  type        = string
  default     = "172.16.0.0/28"
}

# ==============================================================================
# STORAGE VARIABLES
# ==============================================================================

variable "storage_location" {
  description = "Default storage location (US, EU, ASIA, or specific region)"
  type        = string
  default     = "US"
}

variable "storage_versioning_enabled" {
  description = "Enable object versioning for storage buckets"
  type        = bool
  default     = true
}

variable "storage_uniform_bucket_level_access" {
  description = "Enable uniform bucket-level access"
  type        = bool
  default     = true
}

# ==============================================================================
# SECURITY VARIABLES
# ==============================================================================

variable "enable_binary_authorization" {
  description = "Enable Binary Authorization for GKE"
  type        = bool
  default     = true
}

variable "enable_shielded_vms" {
  description = "Enable Shielded VMs"
  type        = bool
  default     = true
}

variable "kms_key_rotation_period" {
  description = "KMS key rotation period in seconds (default 90 days)"
  type        = string
  default     = "7776000s"  # 90 days
}

# ==============================================================================
# MONITORING VARIABLES
# ==============================================================================

variable "enable_cloud_logging" {
  description = "Enable Cloud Logging"
  type        = bool
  default     = true
}

variable "enable_cloud_monitoring" {
  description = "Enable Cloud Monitoring"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Log retention period in days"
  type        = number
  default     = 30
}

variable "alert_email" {
  description = "Email address for alerts"
  type        = string
  default     = "devops@elara.com"
}

# ==============================================================================
# LOAD BALANCER VARIABLES
# ==============================================================================

variable "domain_name" {
  description = "Primary domain name"
  type        = string
  default     = "elara.com"
}

variable "api_domain_name" {
  description = "API domain name"
  type        = string
  default     = "api.elara.com"
}

variable "enable_cdn" {
  description = "Enable Cloud CDN"
  type        = bool
  default     = true
}

variable "enable_cloud_armor" {
  description = "Enable Cloud Armor WAF"
  type        = bool
  default     = true
}

variable "rate_limit_threshold" {
  description = "Rate limit threshold (requests per minute)"
  type        = number
  default     = 100
}

# ==============================================================================
# COST OPTIMIZATION VARIABLES
# ==============================================================================

variable "enable_committed_use_discounts" {
  description = "Enable Committed Use Discounts (requires 1 or 3 year commitment)"
  type        = bool
  default     = false
}

variable "enable_preemptible_nodes" {
  description = "Enable preemptible nodes for non-critical workloads"
  type        = bool
  default     = false
}

variable "enable_autoscaling" {
  description = "Enable autoscaling for compute resources"
  type        = bool
  default     = true
}

# ==============================================================================
# LABELS
# ==============================================================================

variable "labels" {
  description = "Common labels to apply to all resources"
  type        = map(string)
  default = {
    project     = "elara"
    managed_by  = "terraform"
    team        = "devops"
  }
}

# ==============================================================================
# FEATURE FLAGS
# ==============================================================================

variable "enable_neo4j" {
  description = "Enable Neo4j deployment (Phase 1 - Trust Graph)"
  type        = bool
  default     = false
}

variable "enable_blockchain" {
  description = "Enable blockchain integration (Phase 3)"
  type        = bool
  default     = false
}

variable "enable_dr_region" {
  description = "Enable Disaster Recovery region deployment"
  type        = bool
  default     = true
}

variable "enable_eu_region" {
  description = "Enable EU region for GDPR compliance"
  type        = bool
  default     = false
}
