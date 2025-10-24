# ==============================================================================
# MONITORING MODULE - LOGGING & ALERTS
# ==============================================================================
# Purpose: Centralized logging, monitoring, and alerting
# ==============================================================================

# ==============================================================================
# BIGQUERY DATASET FOR LOGS
# ==============================================================================

resource "google_bigquery_dataset" "logs_dataset" {
  project    = var.project_id
  dataset_id = "elara_logs"
  location   = "US"

  description = "Dataset for Elara platform logs"

  default_table_expiration_ms = 7776000000  # 90 days

  labels = var.labels
}

# ==============================================================================
# LOG SINKS
# ==============================================================================

resource "google_logging_project_sink" "log_sinks" {
  for_each = var.log_sinks

  project = var.project_id
  name    = each.value.name

  destination = each.value.destination
  filter      = each.value.filter

  unique_writer_identity = each.value.unique_writer_identity

  bigquery_options {
    use_partitioned_tables = true
  }
}

# Grant BigQuery Data Editor role to log sink writer
resource "google_bigquery_dataset_iam_member" "log_sink_writer" {
  for_each = var.log_sinks

  project    = var.project_id
  dataset_id = google_bigquery_dataset.logs_dataset.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = google_logging_project_sink.log_sinks[each.key].writer_identity
}

# ==============================================================================
# NOTIFICATION CHANNELS
# ==============================================================================

resource "google_monitoring_notification_channel" "channels" {
  for_each = var.notification_channels

  project      = var.project_id
  display_name = each.value.display_name
  type         = each.value.type

  labels = each.value.labels

  enabled = true
}

# ==============================================================================
# ALERT POLICIES
# ==============================================================================

resource "google_monitoring_alert_policy" "alert_policies" {
  for_each = { for idx, policy in var.alert_policies : idx => policy }

  project      = var.project_id
  display_name = each.value.display_name
  combiner     = "OR"

  conditions {
    display_name = each.value.conditions[0].display_name

    condition_threshold {
      filter          = each.value.conditions[0].condition_threshold.filter
      duration        = each.value.conditions[0].condition_threshold.duration
      comparison      = each.value.conditions[0].condition_threshold.comparison
      threshold_value = each.value.conditions[0].condition_threshold.threshold_value

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = [
    for channel in google_monitoring_notification_channel.channels :
    channel.id
  ]

  alert_strategy {
    auto_close = "1800s"
  }

  enabled = true
}

# ==============================================================================
# UPTIME CHECKS
# ==============================================================================

resource "google_monitoring_uptime_check_config" "frontend_uptime" {
  project      = var.project_id
  display_name = "Elara Frontend Uptime"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.frontend_domain
    }
  }

  selected_regions = [
    "USA",
    "EUROPE",
    "ASIA_PACIFIC"
  ]
}

resource "google_monitoring_uptime_check_config" "api_uptime" {
  project      = var.project_id
  display_name = "Elara API Uptime"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.api_domain
    }
  }

  selected_regions = [
    "USA",
    "EUROPE",
    "ASIA_PACIFIC"
  ]
}

# ==============================================================================
# DASHBOARDS
# ==============================================================================

resource "google_monitoring_dashboard" "main_dashboard" {
  project        = var.project_id
  dashboard_json = jsonencode({
    displayName = "Elara Platform - Main Dashboard"
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          xPos   = 0
          yPos   = 0
          width  = 6
          height = 4
          widget = {
            title = "GKE CPU Utilization"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"k8s_container\" metric.type=\"kubernetes.io/container/cpu/core_usage_time\""
                  }
                }
              }]
            }
          }
        },
        {
          xPos   = 6
          yPos   = 0
          width  = 6
          height = 4
          widget = {
            title = "Cloud SQL Connections"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"cloudsql_database\" metric.type=\"cloudsql.googleapis.com/database/network/connections\""
                  }
                }
              }]
            }
          }
        },
        {
          xPos   = 0
          yPos   = 4
          width  = 6
          height = 4
          widget = {
            title = "Redis Memory Usage"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"redis_instance\" metric.type=\"redis.googleapis.com/stats/memory/usage_ratio\""
                  }
                }
              }]
            }
          }
        },
        {
          xPos   = 6
          yPos   = 4
          width  = 6
          height = 4
          widget = {
            title = "Load Balancer Request Rate"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"https_lb_rule\" metric.type=\"loadbalancing.googleapis.com/https/request_count\""
                  }
                }
              }]
            }
          }
        }
      ]
    }
  })
}
