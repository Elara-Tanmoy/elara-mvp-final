# ==============================================================================
# LOAD BALANCER MODULE - VARIABLES
# ==============================================================================

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "name" {
  description = "Load balancer name prefix"
  type        = string
}

variable "ssl_certificates" {
  description = "SSL certificates configuration"
  type = map(object({
    name    = string
    domains = list(string)
  }))
}

variable "cloud_armor_policy" {
  description = "Cloud Armor security policy configuration"
  type = object({
    name = string
    rules = list(object({
      priority    = number
      action      = string
      description = string
      expression  = optional(string)
      rate_limit = optional(object({
        conform_action = string
        exceed_action  = string
        enforce_on_key = string
        rate_limit_threshold = object({
          count        = number
          interval_sec = number
        })
        ban_duration_sec = optional(number)
      }))
    }))
  })
}

variable "enable_cdn" {
  description = "Enable Cloud CDN"
  type        = bool
  default     = true
}

variable "enable_iap" {
  description = "Enable Identity-Aware Proxy"
  type        = bool
  default     = false
}

variable "iap_oauth2_client_id" {
  description = "IAP OAuth2 client ID"
  type        = string
  default     = ""
}

variable "iap_oauth2_client_secret" {
  description = "IAP OAuth2 client secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}
