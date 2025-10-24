# ==============================================================================
# LOAD BALANCER MODULE - OUTPUTS
# ==============================================================================

output "external_ip" {
  description = "External IP address"
  value       = google_compute_global_address.external_ip.address
}

output "load_balancer_name" {
  description = "Load balancer name"
  value       = var.name
}

output "security_policy_id" {
  description = "Cloud Armor security policy ID"
  value       = google_compute_security_policy.policy.id
}

output "ssl_certificate_ids" {
  description = "SSL certificate IDs"
  value = {
    for key, cert in google_compute_managed_ssl_certificate.ssl_certs :
    key => cert.id
  }
}

output "backend_service_id" {
  description = "Backend service ID"
  value       = google_compute_backend_service.default.id
}

output "url_map_id" {
  description = "URL map ID"
  value       = google_compute_url_map.url_map.id
}
