# ==============================================================================
# CLOUD SQL MODULE - POSTGRESQL HIGH AVAILABILITY
# ==============================================================================
# Purpose: Enterprise-grade PostgreSQL database with HA, replicas, and DR
# Configuration: Regional HA + Read Replicas + Performance Tuning + CMEK Encryption
# ==============================================================================

# Generate random password for database
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# ==============================================================================
# PRIMARY POSTGRESQL INSTANCE (Regional HA)
# ==============================================================================

resource "google_sql_database_instance" "primary" {
  project          = var.project_id
  name             = var.instance_name
  database_version = var.database_version
  region           = var.region

  # Deletion protection (prevent accidental deletion)
  deletion_protection = var.deletion_protection

  # Instance settings
  settings {
    tier              = var.tier
    availability_type = var.availability_type  # REGIONAL = HA with standby
    disk_type         = var.disk_type
    disk_size         = var.disk_size
    disk_autoresize   = var.disk_autoresize

    disk_autoresize_limit = var.disk_autoresize_limit

    # Backup configuration
    backup_configuration {
      enabled                        = var.backup_configuration.enabled
      start_time                     = var.backup_configuration.start_time
      point_in_time_recovery_enabled = var.backup_configuration.point_in_time_recovery_enabled
      transaction_log_retention_days = var.backup_configuration.transaction_log_retention_days
      backup_retention_settings {
        retained_backups = var.backup_configuration.retained_backups
        retention_unit   = "COUNT"
      }
      location = var.backup_configuration.location
    }

    # IP configuration (private IP only)
    ip_configuration {
      ipv4_enabled                                  = false  # No public IP
      private_network                               = var.private_network
      enable_private_path_for_google_cloud_services = true
      ssl_mode                                      = "ENCRYPTED_ONLY"  # Replaces deprecated require_ssl

      # No authorized networks (private only)
    }

    # Maintenance window
    maintenance_window {
      day          = var.maintenance_window.day
      hour         = var.maintenance_window.hour
      update_track = "stable"
    }

    # Insights configuration (query performance)
    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 2048
      record_application_tags = true
      record_client_address   = true
    }

    # Password validation
    password_validation_policy {
      min_length                  = 16
      complexity                  = "COMPLEXITY_DEFAULT"
      reuse_interval              = 5
      disallow_username_substring = true
      enable_password_policy      = true
    }

    # Database flags (Performance tuning for 8 vCPU, 32GB RAM)
    dynamic "database_flags" {
      for_each = var.database_flags
      content {
        name  = database_flags.value.name
        value = database_flags.value.value
      }
    }

    # Activation policy
    activation_policy = "ALWAYS"

    # User labels
    user_labels = var.labels
  }

  # Encryption
  encryption_key_name = var.encryption_key_name

  # Depends on network
  depends_on = [var.network_id]

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [
      settings[0].disk_size  # Ignore size changes (autoresize)
    ]
  }
}

# ==============================================================================
# READ REPLICAS
# ==============================================================================

resource "google_sql_database_instance" "replicas" {
  for_each = { for idx, replica in var.read_replicas : idx => replica }

  project             = var.project_id
  name                = each.value.name
  master_instance_name = google_sql_database_instance.primary.name
  database_version    = var.database_version
  region              = lookup(each.value, "region", var.region)

  # Note: replica_configuration block is omitted for Cloud SQL-to-Cloud SQL replication
  # Configuration is automatic based on the settings block

  settings {
    tier              = each.value.tier
    disk_type         = each.value.disk_type
    disk_size         = each.value.disk_size
    disk_autoresize   = true
    availability_type = lookup(each.value, "availability_type", "ZONAL")

    # IP configuration (private IP only)
    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.private_network
      enable_private_path_for_google_cloud_services = true
      ssl_mode                                      = "ENCRYPTED_ONLY"  # Replaces deprecated require_ssl
    }

    # Insights configuration
    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 2048
      record_application_tags = true
      record_client_address   = true
    }

    # Database flags (adjusted for smaller replica RAM)
    # Replicas are db-custom-4-16384 (16GB RAM) vs primary db-custom-8-32768 (32GB RAM)
    dynamic "database_flags" {
      for_each = var.database_flags
      content {
        name  = database_flags.value.name
        # Scale down memory-related flags for 16GB RAM replicas (half of primary)
        value = database_flags.value.name == "shared_buffers" ? "1258291" : (
                database_flags.value.name == "effective_cache_size" ? "1468006" : (
                database_flags.value.name == "maintenance_work_mem" ? "1048576" :
                database_flags.value.value))
      }
    }

    user_labels = merge(var.labels, {
      replica = "true"
      replica_index = each.key
    })
  }

  # Deletion protection
  deletion_protection = var.deletion_protection

  depends_on = [google_sql_database_instance.primary]

  lifecycle {
    prevent_destroy = true
  }
}

# ==============================================================================
# DATABASES
# ==============================================================================

resource "google_sql_database" "databases" {
  for_each = toset(var.databases)

  project  = var.project_id
  name     = each.value
  instance = google_sql_database_instance.primary.name
  charset  = "UTF8"
  collation = "en_US.UTF8"
}

# ==============================================================================
# USERS
# ==============================================================================

# Application user
resource "google_sql_user" "app_user" {
  project  = var.project_id
  name     = var.app_user_name
  instance = google_sql_database_instance.primary.name
  password = random_password.db_password.result
}

# Admin user (for migrations)
resource "google_sql_user" "admin_user" {
  project  = var.project_id
  name     = var.admin_user_name
  instance = google_sql_database_instance.primary.name
  password = random_password.db_password.result
}

# ==============================================================================
# SSL CERTIFICATES
# ==============================================================================

# Server certificate
resource "google_sql_ssl_cert" "client_cert" {
  project     = var.project_id
  common_name = "elara-client-cert"
  instance    = google_sql_database_instance.primary.name
}

# ==============================================================================
# MONITORING ALERTS
# ==============================================================================

# High CPU alert
resource "google_monitoring_alert_policy" "high_cpu" {
  project      = var.project_id
  display_name = "Cloud SQL High CPU - ${var.instance_name}"
  combiner     = "OR"

  conditions {
    display_name = "CPU utilization > 80%"

    condition_threshold {
      filter          = "resource.type=\"cloudsql_database\" AND resource.labels.database_id=\"${var.project_id}:${var.instance_name}\" AND metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\""
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

# High memory alert
resource "google_monitoring_alert_policy" "high_memory" {
  project      = var.project_id
  display_name = "Cloud SQL High Memory - ${var.instance_name}"
  combiner     = "OR"

  conditions {
    display_name = "Memory utilization > 85%"

    condition_threshold {
      filter          = "resource.type=\"cloudsql_database\" AND resource.labels.database_id=\"${var.project_id}:${var.instance_name}\" AND metric.type=\"cloudsql.googleapis.com/database/memory/utilization\""
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

# Disk utilization alert
resource "google_monitoring_alert_policy" "high_disk" {
  project      = var.project_id
  display_name = "Cloud SQL High Disk - ${var.instance_name}"
  combiner     = "OR"

  conditions {
    display_name = "Disk utilization > 80%"

    condition_threshold {
      filter          = "resource.type=\"cloudsql_database\" AND resource.labels.database_id=\"${var.project_id}:${var.instance_name}\" AND metric.type=\"cloudsql.googleapis.com/database/disk/utilization\""
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

# Replica lag alert
resource "google_monitoring_alert_policy" "replica_lag" {
  project      = var.project_id
  display_name = "Cloud SQL Replica Lag - ${var.instance_name}"
  combiner     = "OR"

  conditions {
    display_name = "Replica lag > 60 seconds"

    condition_threshold {
      filter          = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/replication/replica_lag\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 60

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

# Database credentials will be exported via Terraform outputs
# Secrets will be created by deployment scripts using these values
