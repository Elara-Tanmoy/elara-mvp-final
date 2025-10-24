# ==============================================================================
# MONITORING MODULE - OUTPUTS
# ==============================================================================

output "log_sink_destinations" {
  description = "Log sink destinations"
  value = {
    for key, sink in google_logging_project_sink.log_sinks :
    key => sink.destination
  }
}

output "log_sink_writer_identities" {
  description = "Log sink writer identities"
  value = {
    for key, sink in google_logging_project_sink.log_sinks :
    key => sink.writer_identity
  }
  sensitive = true
}

output "notification_channel_ids" {
  description = "Notification channel IDs"
  value = {
    for key, channel in google_monitoring_notification_channel.channels :
    key => channel.id
  }
}

output "alert_policy_ids" {
  description = "Alert policy IDs"
  value = {
    for key, policy in google_monitoring_alert_policy.alert_policies :
    key => policy.id
  }
}

output "bigquery_dataset_id" {
  description = "BigQuery dataset ID for logs"
  value       = google_bigquery_dataset.logs_dataset.dataset_id
}

output "dashboard_id" {
  description = "Main dashboard ID"
  value       = google_monitoring_dashboard.main_dashboard.id
}

output "uptime_check_ids" {
  description = "Uptime check IDs"
  value = {
    frontend = google_monitoring_uptime_check_config.frontend_uptime.id
    api      = google_monitoring_uptime_check_config.api_uptime.id
  }
}
