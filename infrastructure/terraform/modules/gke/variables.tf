# ==============================================================================
# GKE MODULE - VARIABLES
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

variable "cluster_name" {
  description = "GKE cluster name"
  type        = string
}

variable "network_name" {
  description = "VPC network name"
  type        = string
}

variable "subnet_name" {
  description = "Subnet name for nodes"
  type        = string
}

variable "pods_range_name" {
  description = "Secondary IP range name for pods"
  type        = string
}

variable "services_range_name" {
  description = "Secondary IP range name for services"
  type        = string
}

variable "autopilot_enabled" {
  description = "Enable Autopilot mode"
  type        = bool
  default     = true
}

variable "gke_enable_private_nodes" {
  description = "Enable private nodes"
  type        = bool
  default     = true
}

variable "gke_enable_private_endpoint" {
  description = "Enable private endpoint"
  type        = bool
  default     = false
}

variable "gke_master_ipv4_cidr_block" {
  description = "Master CIDR block"
  type        = string
  default     = "172.16.0.0/28"
}

variable "master_authorized_networks" {
  description = "Master authorized networks for kubectl access"
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = []
}

variable "workload_identity_config" {
  description = "Workload Identity configuration"
  type = object({
    workload_pool = string
  })
}

variable "binary_authorization_enabled" {
  description = "Enable Binary Authorization"
  type        = bool
  default     = true
}

variable "gke_release_channel" {
  description = "GKE release channel"
  type        = string
  default     = "REGULAR"
}

variable "logging_config" {
  description = "Logging configuration"
  type = object({
    enable_components = list(string)
  })
  default = {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }
}

variable "monitoring_config" {
  description = "Monitoring configuration"
  type = object({
    enable_components          = list(string)
    managed_prometheus_enabled = bool
  })
  default = {
    enable_components          = ["SYSTEM_COMPONENTS", "WORKLOADS"]
    managed_prometheus_enabled = true
  }
}

variable "maintenance_window" {
  description = "Maintenance window configuration"
  type = object({
    start_time = string
    end_time   = string
    recurrence = string
  })
  default = {
    start_time = "2025-01-01T04:00:00Z"
    end_time   = "2025-01-01T08:00:00Z"
    recurrence = "FREQ=WEEKLY;BYDAY=SU"
  }
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
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
