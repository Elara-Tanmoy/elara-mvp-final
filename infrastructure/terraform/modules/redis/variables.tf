# ==============================================================================
# REDIS MODULE - VARIABLES
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
  description = "Redis instance name"
  type        = string
}

variable "memory_size_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 5
}

variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "REDIS_7_0"
}

variable "tier" {
  description = "Redis tier (BASIC or STANDARD_HA)"
  type        = string
  default     = "STANDARD_HA"
}

variable "authorized_network" {
  description = "Authorized VPC network ID"
  type        = string
}

variable "connect_mode" {
  description = "Connection mode (DIRECT_PEERING or PRIVATE_SERVICE_ACCESS)"
  type        = string
  default     = "PRIVATE_SERVICE_ACCESS"
}

variable "persistence_config" {
  description = "Persistence configuration"
  type = object({
    rdb_snapshot_period     = string
    rdb_snapshot_start_time = string
  })

  default = {
    rdb_snapshot_period     = "SIX_HOURS"
    rdb_snapshot_start_time = "02:00"
  }
}

variable "maintenance_policy" {
  description = "Maintenance policy"
  type = object({
    day        = string
    start_hour = number
    duration   = number
  })

  default = {
    day        = "SUNDAY"
    start_hour = 5
    duration   = 4
  }
}

variable "redis_configs" {
  description = "Redis configuration parameters"
  type        = map(string)

  default = {
    maxmemory-policy         = "allkeys-lru"
    activedefrag             = "yes"
    "lazyfree-lazy-eviction" = "yes"
    "lazyfree-lazy-expire"   = "yes"
  }
}

variable "notification_channels" {
  description = "Notification channel IDs for alerts"
  type        = list(string)
  default     = []
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}
