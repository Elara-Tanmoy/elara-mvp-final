# ==============================================================================
# NETWORKING MODULE - OUTPUTS
# ==============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = google_compute_network.vpc.id
}

output "vpc_name" {
  description = "VPC name"
  value       = google_compute_network.vpc.name
}

output "vpc_self_link" {
  description = "VPC self link"
  value       = google_compute_network.vpc.self_link
}

output "subnet_gke_nodes" {
  description = "GKE nodes subnet name"
  value       = google_compute_subnetwork.gke_nodes.name
}

output "subnet_gke_nodes_id" {
  description = "GKE nodes subnet ID"
  value       = google_compute_subnetwork.gke_nodes.id
}

output "subnet_gke_nodes_self_link" {
  description = "GKE nodes subnet self link"
  value       = google_compute_subnetwork.gke_nodes.self_link
}

output "subnet_data_layer" {
  description = "Data layer subnet name"
  value       = google_compute_subnetwork.data_layer.name
}

output "subnet_data_layer_id" {
  description = "Data layer subnet ID"
  value       = google_compute_subnetwork.data_layer.id
}

output "subnet_cloudrun" {
  description = "Cloud Run subnet name"
  value       = google_compute_subnetwork.cloudrun.name
}

output "subnet_cloudrun_id" {
  description = "Cloud Run subnet ID"
  value       = google_compute_subnetwork.cloudrun.id
}

output "gke_pods_range_name" {
  description = "GKE pods secondary IP range name"
  value       = google_compute_subnetwork.gke_nodes.secondary_ip_range[0].range_name
}

output "gke_services_range_name" {
  description = "GKE services secondary IP range name"
  value       = google_compute_subnetwork.gke_nodes.secondary_ip_range[1].range_name
}

output "nat_ips" {
  description = "Cloud NAT external IP addresses"
  value       = google_compute_address.nat[*].address
}

output "router_name" {
  description = "Cloud Router name"
  value       = google_compute_router.router.name
}

output "private_ip_range_name" {
  description = "Private IP range name for VPC peering"
  value       = google_compute_global_address.private_ip_range.name
}

output "private_vpc_connection_peering" {
  description = "Private VPC connection peering name"
  value       = google_service_networking_connection.private_vpc_connection.peering
}

output "private_dns_zone_name" {
  description = "Private DNS zone name"
  value       = google_dns_managed_zone.private_zone.name
}

output "private_dns_zone_dns_name" {
  description = "Private DNS zone DNS name"
  value       = google_dns_managed_zone.private_zone.dns_name
}
