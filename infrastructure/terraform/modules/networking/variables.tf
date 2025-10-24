# ==============================================================================
# NETWORKING MODULE - VARIABLES
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
  description = "Environment name (production, staging, development)"
  type        = string
}

variable "vpc_name" {
  description = "VPC network name"
  type        = string
}

variable "subnet_ranges" {
  description = "CIDR ranges for subnets"
  type = object({
    gke_nodes    = string
    gke_pods     = string
    gke_services = string
    data_layer   = string
    cloudrun     = string
  })

  default = {
    gke_nodes    = "10.10.0.0/24"
    gke_pods     = "10.1.0.0/16"
    gke_services = "10.2.0.0/20"
    data_layer   = "10.20.0.0/24"
    cloudrun     = "10.30.0.0/28"
  }
}

variable "enable_flow_logs" {
  description = "Enable VPC Flow Logs"
  type        = bool
  default     = true
}

variable "enable_private_google_access" {
  description = "Enable Private Google Access"
  type        = bool
  default     = true
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}
