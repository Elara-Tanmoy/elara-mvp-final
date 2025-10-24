# ==============================================================================
# REDIS MODULE - MEMORYSTORE (High Availability)
# ==============================================================================
# Purpose: Redis cache and BullMQ queue backend
# Configuration: Standard HA tier with persistence
# ==============================================================================

# Generate random auth string for Redis
resource "random_password" "redis_auth" {
  length  = 32
  special = false  # Redis AUTH doesn't support special characters
}

# ==============================================================================
# REDIS INSTANCE (Standard HA)
# ==============================================================================

resource "google_redis_instance" "redis" {
  project        = var.project_id
  name           = var.instance_name
  tier           = var.tier
  memory_size_gb = var.memory_size_gb
  region         = var.region

  # Network
  authorized_network = var.authorized_network
  connect_mode       = var.connect_mode

  # Redis version
  redis_version = var.redis_version

  # Auth - DISABLED temporarily due to lost auth string
  # TODO: Re-enable auth with proper password management
  auth_enabled = false

  # Transit encryption - DISABLED (requires auth)
  # TODO: Re-enable with auth
  transit_encryption_mode = "DISABLED"

  # Persistence (RDB snapshots)
  persistence_config {
    persistence_mode    = "RDB"
    rdb_snapshot_period = var.persistence_config.rdb_snapshot_period
    rdb_snapshot_start_time = var.persistence_config.rdb_snapshot_start_time
  }

  # Maintenance policy
  maintenance_policy {
    weekly_maintenance_window {
      day = var.maintenance_policy.day
      start_time {
        hours   = var.maintenance_policy.start_hour
        minutes = 0
        seconds = 0
        nanos   = 0
      }
      # Note: duration is automatically calculated by GCP
    }
  }

  # Redis configuration
  redis_configs = var.redis_configs

  # Display name
  display_name = "${var.instance_name} - ${var.environment}"

  # Labels
  labels = var.labels

  lifecycle {
    prevent_destroy = false  # Allow recreation to disable auth
    ignore_changes = [
      persistence_config[0].rdb_snapshot_start_time  # Ignore time changes
    ]
  }
}

# ==============================================================================
# MONITORING ALERTS
# ==============================================================================

# High memory usage alert
resource "google_monitoring_alert_policy" "high_memory" {
  project      = var.project_id
  display_name = "Redis High Memory - ${var.instance_name}"
  combiner     = "OR"

  conditions {
    display_name = "Memory utilization > 85%"

    condition_threshold {
      filter          = "resource.type=\"redis_instance\" AND resource.labels.instance_id=\"${google_redis_instance.redis.id}\" AND metric.type=\"redis.googleapis.com/stats/memory/usage_ratio\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.85

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }
}

# High CPU usage alert
resource "google_monitoring_alert_policy" "high_cpu" {
  project      = var.project_id
  display_name = "Redis High CPU - ${var.instance_name}"
  combiner     = "OR"

  conditions {
    display_name = "CPU utilization > 80%"

    condition_threshold {
      filter          = "resource.type=\"redis_instance\" AND resource.labels.instance_id=\"${google_redis_instance.redis.id}\" AND metric.type=\"redis.googleapis.com/stats/cpu_utilization\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }
}

# ==============================================================================
# OUTPUTS FOR SECRET MANAGER (will be created by scripts)
# ==============================================================================

# Redis credentials will be exported via Terraform outputs
# Secrets will be created by deployment scripts using these values
