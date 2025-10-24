# ==============================================================================
# STORAGE MODULE - VARIABLES
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

variable "buckets" {
  description = "Storage buckets configuration"
  type = map(object({
    name          = string
    location      = string
    storage_class = string
    lifecycle_rules = list(object({
      action = object({
        type          = string
        storage_class = optional(string)
      })
      condition = object({
        age                   = optional(number)
        created_before        = optional(string)
        with_state            = optional(string)
        matches_storage_class = optional(list(string))
      })
    }))
  }))
}

variable "encryption_key" {
  description = "KMS encryption key for buckets"
  type        = string
  default     = null
}

variable "storage_versioning_enabled" {
  description = "Enable object versioning"
  type        = bool
  default     = true
}

variable "iam_members" {
  description = "IAM member bindings for buckets"
  type = map(object({
    bucket_key = string
    role       = string
    member     = string
  }))
  default = {}
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}
