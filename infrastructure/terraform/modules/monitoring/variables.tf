# ==============================================================================
# MONITORING MODULE - VARIABLES
# ==============================================================================

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "log_sinks" {
  description = "Log sinks configuration"
  type = map(object({
    name                   = string
    destination            = string
    filter                 = string
    unique_writer_identity = bool
  }))
  default = {}
}

variable "notification_channels" {
  description = "Notification channels configuration"
  type = map(object({
    type         = string
    display_name = string
    labels       = map(string)
  }))
  default = {}
}

variable "alert_policies" {
  description = "Alert policies configuration"
  type = list(object({
    display_name = string
    conditions = list(object({
      display_name = string
      condition_threshold = object({
        filter          = string
        duration        = string
        comparison      = string
        threshold_value = number
      })
    }))
  }))
  default = []
}

variable "frontend_domain" {
  description = "Frontend domain for uptime checks"
  type        = string
  default     = "elara.com"
}

variable "api_domain" {
  description = "API domain for uptime checks"
  type        = string
  default     = "api.elara.com"
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}
