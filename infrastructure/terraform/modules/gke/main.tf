# ==============================================================================
# GKE MODULE - AUTOPILOT CLUSTER
# ==============================================================================
# Purpose: Managed Kubernetes cluster for Elara workloads
# Configuration: Autopilot mode with Workload Identity and Binary Authorization
# ==============================================================================

# ==============================================================================
# GKE AUTOPILOT CLUSTER
# ==============================================================================

resource "google_container_cluster" "primary" {
  project  = var.project_id
  name     = var.cluster_name
  location = var.region

  # Autopilot mode (Google manages nodes)
  enable_autopilot = var.autopilot_enabled

  # Network configuration
  network    = var.network_name
  subnetwork = var.subnet_name

  # IP allocation policy (for pods and services)
  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_range_name
    services_secondary_range_name = var.services_range_name
  }

  # Resource labels
  resource_labels = var.labels

  # Deletion protection
  deletion_protection = false
}

# ==============================================================================
# CLUSTER NODE POOL (only for non-Autopilot mode)
# ==============================================================================

# Autopilot manages node pools automatically, so this is commented out
# Uncomment if using Standard GKE instead of Autopilot

# resource "google_container_node_pool" "primary_nodes" {
#   count      = var.autopilot_enabled ? 0 : 1
#   project    = var.project_id
#   name       = "${var.cluster_name}-node-pool"
#   location   = var.region
#   cluster    = google_container_cluster.primary.name
#   node_count = var.initial_node_count
#
#   node_config {
#     machine_type = var.node_machine_type
#     disk_size_gb = var.node_disk_size_gb
#     disk_type    = "pd-ssd"
#
#     oauth_scopes = [
#       "https://www.googleapis.com/auth/cloud-platform"
#     ]
#
#     service_account = var.node_service_account
#
#     workload_metadata_config {
#       mode = "GKE_METADATA"
#     }
#
#     shielded_instance_config {
#       enable_secure_boot          = true
#       enable_integrity_monitoring = true
#     }
#   }
#
#   autoscaling {
#     min_node_count = var.min_node_count
#     max_node_count = var.max_node_count
#   }
#
#   management {
#     auto_repair  = true
#     auto_upgrade = true
#   }
# }

# ==============================================================================
# MONITORING ALERTS - DISABLED until GKE cluster is created
# ==============================================================================
# Note: Alert policies that reference kubernetes.io metrics will fail until
# the GKE cluster is created and these metrics become available.
#
# To enable alerts after GKE cluster creation:
# 1. First deploy infrastructure with these alerts commented out
# 2. After GKE cluster is created and running, uncomment these alerts
# 3. Run terraform apply again to create the alert policies

# # Cluster node count alert
# resource "google_monitoring_alert_policy" "node_count" {
#   project      = var.project_id
#   display_name = "GKE High Node Count - ${var.cluster_name}"
#   combiner     = "OR"
#
#   conditions {
#     display_name = "Node count > threshold"
#
#     condition_threshold {
#       filter          = "resource.type=\"k8s_cluster\" AND resource.labels.cluster_name=\"${var.cluster_name}\" AND metric.type=\"kubernetes.io/node_count\""
#       duration        = "300s"
#       comparison      = "COMPARISON_GT"
#       threshold_value = 50
#
#       aggregations {
#         alignment_period   = "60s"
#         per_series_aligner = "ALIGN_MEAN"
#       }
#     }
#   }
#
#   notification_channels = var.notification_channels
#
#   alert_strategy {
#     auto_close = "1800s"
#   }
# }
