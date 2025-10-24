# ==============================================================================
# CLOUD SQL MODULE - OUTPUTS
# ==============================================================================

output "instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.primary.name
}

output "instance_connection_name" {
  description = "Cloud SQL instance connection name"
  value       = google_sql_database_instance.primary.connection_name
}

output "instance_self_link" {
  description = "Cloud SQL instance self link"
  value       = google_sql_database_instance.primary.self_link
}

output "private_ip_address" {
  description = "Private IP address"
  value       = google_sql_database_instance.primary.private_ip_address
  sensitive   = true
}

output "public_ip_address" {
  description = "Public IP address (if enabled)"
  value       = google_sql_database_instance.primary.public_ip_address
  sensitive   = true
}

output "database_version" {
  description = "PostgreSQL version"
  value       = google_sql_database_instance.primary.database_version
}

output "replica_names" {
  description = "Read replica instance names"
  value       = [for replica in google_sql_database_instance.replicas : replica.name]
}

output "replica_connection_names" {
  description = "Read replica connection names"
  value       = [for replica in google_sql_database_instance.replicas : replica.connection_name]
}

output "replica_ips" {
  description = "Read replica IP addresses"
  value       = [for replica in google_sql_database_instance.replicas : replica.private_ip_address]
  sensitive   = true
}

output "database_names" {
  description = "Created database names"
  value       = [for db in google_sql_database.databases : db.name]
}

output "app_user_name" {
  description = "Application user name"
  value       = google_sql_user.app_user.name
}

output "admin_user_name" {
  description = "Admin user name"
  value       = google_sql_user.admin_user.name
}

output "db_password" {
  description = "Database password"
  value       = random_password.db_password.result
  sensitive   = true
}

output "connection_string" {
  description = "Database connection string"
  value       = "postgresql://${google_sql_user.app_user.name}:${random_password.db_password.result}@${google_sql_database_instance.primary.private_ip_address}:5432/${var.databases[0]}"
  sensitive   = true
}

output "ssl_cert" {
  description = "SSL certificate"
  value = {
    cert        = google_sql_ssl_cert.client_cert.cert
    private_key = google_sql_ssl_cert.client_cert.private_key
    server_ca   = google_sql_ssl_cert.client_cert.server_ca_cert
  }
  sensitive = true
}

output "instance_id" {
  description = "Cloud SQL instance ID"
  value       = google_sql_database_instance.primary.id
}
