# ==============================================================================
# CLOUD SQL MODULE - VARIABLES
# ==============================================================================

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "instance_name" {
  description = "Cloud SQL instance name"
  type        = string
}

variable "database_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "POSTGRES_15"
}

variable "tier" {
  description = "Machine type (db-custom-CPU-RAM)"
  type        = string
  default     = "db-custom-8-32768"  # 8 vCPU, 32GB RAM
}

variable "availability_type" {
  description = "Availability type (REGIONAL for HA, ZONAL for single zone)"
  type        = string
  default     = "REGIONAL"
}

variable "disk_type" {
  description = "Disk type (PD_SSD or PD_HDD)"
  type        = string
  default     = "PD_SSD"
}

variable "disk_size" {
  description = "Disk size in GB"
  type        = number
  default     = 500
}

variable "disk_autoresize" {
  description = "Enable automatic disk resize"
  type        = bool
  default     = true
}

variable "disk_autoresize_limit" {
  description = "Maximum disk size in GB"
  type        = number
  default     = 2000
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "network_id" {
  description = "VPC network ID for dependency"
  type        = string
}

variable "private_network" {
  description = "VPC network self link for private IP"
  type        = string
}

variable "backup_configuration" {
  description = "Backup configuration"
  type = object({
    enabled                        = bool
    start_time                     = string
    point_in_time_recovery_enabled = bool
    transaction_log_retention_days = number
    retained_backups               = number
    location                       = string
  })

  default = {
    enabled                        = true
    start_time                     = "03:00"
    point_in_time_recovery_enabled = true
    transaction_log_retention_days = 7
    retained_backups               = 30
    location                       = "us"
  }
}

variable "maintenance_window" {
  description = "Maintenance window configuration"
  type = object({
    day  = number
    hour = number
  })

  default = {
    day  = 7  # Sunday
    hour = 4  # 4 AM UTC
  }
}

variable "database_flags" {
  description = "PostgreSQL database flags for performance tuning"
  type = list(object({
    name  = string
    value = string
  }))

  default = [
    # Connection settings
    { name = "max_connections", value = "5000" },

    # Memory settings (for 32GB RAM)
    { name = "shared_buffers", value = "8388608" },            # 8GB (8GB * 1024 * 1024 / 8KB)
    { name = "effective_cache_size", value = "25165824" },     # 24GB
    { name = "maintenance_work_mem", value = "2097152" },      # 2GB (in KB)
    { name = "work_mem", value = "10485" },                    # 10MB per query (in KB)

    # WAL settings
    { name = "wal_buffers", value = "2048" },                  # 16MB (in 8KB pages)
    { name = "min_wal_size", value = "1024" },                 # 1GB (in MB)
    { name = "max_wal_size", value = "4096" },                 # 4GB (in MB)
    { name = "checkpoint_completion_target", value = "0.9" },

    # Query planner
    { name = "default_statistics_target", value = "100" },
    { name = "random_page_cost", value = "1.1" },              # SSD optimized
    { name = "effective_io_concurrency", value = "200" },      # SSD optimized

    # Parallel query
    { name = "max_worker_processes", value = "8" },
    { name = "max_parallel_workers_per_gather", value = "4" },
    { name = "max_parallel_workers", value = "8" },
    { name = "max_parallel_maintenance_workers", value = "4" },

    # Logging
    { name = "log_min_duration_statement", value = "1000" },   # Log queries > 1 second
    { name = "log_connections", value = "on" },
    { name = "log_disconnections", value = "on" },
    { name = "log_lock_waits", value = "on" },
    { name = "log_statement", value = "ddl" },

    # Autovacuum (important for performance)
    { name = "autovacuum_max_workers", value = "4" },
    { name = "autovacuum_naptime", value = "15" },             # 15 seconds

    # Performance
    { name = "enable_partitionwise_join", value = "on" },
    { name = "enable_partitionwise_aggregate", value = "on" }
  ]
}

variable "read_replicas" {
  description = "Read replica configurations"
  type = list(object({
    name              = string
    tier              = string
    zone              = optional(string)
    region            = optional(string)
    disk_type         = string
    disk_size         = number
    replication_type  = optional(string)
    availability_type = optional(string)
    failover_target   = optional(bool)
  }))

  default = []
}

variable "encryption_key_name" {
  description = "KMS encryption key name"
  type        = string
  default     = null
}

variable "databases" {
  description = "List of databases to create"
  type        = list(string)
  default     = ["elara_production"]
}

variable "app_user_name" {
  description = "Application database user name"
  type        = string
  default     = "elara_app"
}

variable "admin_user_name" {
  description = "Admin database user name"
  type        = string
  default     = "elara_admin"
}

variable "notification_channels" {
  description = "List of notification channel IDs for alerts"
  type        = list(string)
  default     = []
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}
