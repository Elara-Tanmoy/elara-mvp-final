# ==============================================================================
# NETWORKING MODULE - VPC, SUBNETS, FIREWALL, NAT
# ==============================================================================
# Purpose: Create VPC network infrastructure for Elara platform
# ==============================================================================

# ==============================================================================
# VPC NETWORK
# ==============================================================================

resource "google_compute_network" "vpc" {
  name                            = var.vpc_name
  project                         = var.project_id
  auto_create_subnetworks         = false
  routing_mode                    = "REGIONAL"
  delete_default_routes_on_create = false

  description = "VPC network for Elara platform - ${var.environment}"
}

# ==============================================================================
# SUBNETS
# ==============================================================================

# GKE Nodes Subnet
resource "google_compute_subnetwork" "gke_nodes" {
  name          = "gke-nodes-${var.region}"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.vpc.id
  ip_cidr_range = var.subnet_ranges.gke_nodes

  description = "Subnet for GKE node VMs"

  # Secondary IP ranges for GKE pods and services
  secondary_ip_range {
    range_name    = "gke-pods-${var.region}"
    ip_cidr_range = var.subnet_ranges.gke_pods
  }

  secondary_ip_range {
    range_name    = "gke-services-${var.region}"
    ip_cidr_range = var.subnet_ranges.gke_services
  }

  # Enable Private Google Access (access to Google APIs via private IP)
  private_ip_google_access = true

  # Enable VPC Flow Logs for security monitoring
  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# Data Layer Subnet (Cloud SQL, Redis, etc.)
resource "google_compute_subnetwork" "data_layer" {
  name          = "data-layer-${var.region}"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.vpc.id
  ip_cidr_range = var.subnet_ranges.data_layer

  description = "Subnet for data layer (Cloud SQL, Redis)"

  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# Cloud Run Subnet
resource "google_compute_subnetwork" "cloudrun" {
  name          = "cloudrun-${var.region}"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.vpc.id
  ip_cidr_range = var.subnet_ranges.cloudrun

  description = "Subnet for Cloud Run services"

  private_ip_google_access = true
}

# ==============================================================================
# CLOUD ROUTER (for Cloud NAT)
# ==============================================================================

resource "google_compute_router" "router" {
  name    = "${var.vpc_name}-router-${var.region}"
  project = var.project_id
  region  = var.region
  network = google_compute_network.vpc.id

  description = "Cloud Router for NAT gateway"

  bgp {
    asn = 64514
  }
}

# ==============================================================================
# CLOUD NAT (for outbound internet access from private instances)
# ==============================================================================

# Reserve static IPs for NAT
resource "google_compute_address" "nat" {
  count   = 2  # Two static IPs for redundancy
  name    = "${var.vpc_name}-nat-ip-${count.index + 1}"
  project = var.project_id
  region  = var.region

  description = "Static IP for Cloud NAT"
}

# Cloud NAT Gateway
resource "google_compute_router_nat" "nat" {
  name    = "${var.vpc_name}-nat-${var.region}"
  project = var.project_id
  router  = google_compute_router.router.name
  region  = var.region

  nat_ip_allocate_option             = "MANUAL_ONLY"
  nat_ips                            = google_compute_address.nat[*].self_link
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }

  # Port allocation settings
  # Note: Dynamic port allocation is disabled to maintain compatibility with
  # endpoint independent mapping, which provides better NAT behavior.
  min_ports_per_vm = 64
  max_ports_per_vm = 65536

  enable_dynamic_port_allocation = false  # Disabled for compatibility with endpoint_independent_mapping
  enable_endpoint_independent_mapping = true  # Better NAT behavior for GKE
}

# ==============================================================================
# FIREWALL RULES
# ==============================================================================

# Allow internal communication between all subnets
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.vpc_name}-allow-internal"
  project = var.project_id
  network = google_compute_network.vpc.name

  description = "Allow all internal communication within VPC"

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [
    var.subnet_ranges.gke_nodes,
    var.subnet_ranges.gke_pods,
    var.subnet_ranges.gke_services,
    var.subnet_ranges.data_layer,
    var.subnet_ranges.cloudrun
  ]

  priority = 1000
}

# Allow SSH from IAP (Identity-Aware Proxy)
resource "google_compute_firewall" "allow_iap_ssh" {
  name    = "${var.vpc_name}-allow-iap-ssh"
  project = var.project_id
  network = google_compute_network.vpc.name

  description = "Allow SSH from Identity-Aware Proxy"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  # IAP source IP range
  source_ranges = ["35.235.240.0/20"]

  priority = 1000
}

# Allow GKE master to communicate with nodes
resource "google_compute_firewall" "allow_gke_master" {
  name    = "${var.vpc_name}-allow-gke-master"
  project = var.project_id
  network = google_compute_network.vpc.name

  description = "Allow GKE master to communicate with nodes"

  allow {
    protocol = "tcp"
    ports    = ["443", "10250"]
  }

  # GKE master CIDR (will be set during GKE cluster creation)
  source_ranges = ["172.16.0.0/28"]

  target_tags = ["gke-node"]

  priority = 1000
}

# Allow health checks from Google Cloud Load Balancer
resource "google_compute_firewall" "allow_health_checks" {
  name    = "${var.vpc_name}-allow-health-checks"
  project = var.project_id
  network = google_compute_network.vpc.name

  description = "Allow health checks from Google Cloud Load Balancer"

  allow {
    protocol = "tcp"
  }

  # Google Cloud health check IP ranges
  source_ranges = [
    "35.191.0.0/16",
    "130.211.0.0/22",
    "209.85.152.0/22",
    "209.85.204.0/22"
  ]

  priority = 1000
}

# Deny all external SSH (defense-in-depth)
resource "google_compute_firewall" "deny_external_ssh" {
  name    = "${var.vpc_name}-deny-external-ssh"
  project = var.project_id
  network = google_compute_network.vpc.name

  description = "Deny external SSH access"

  deny {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]

  priority = 2000
}

# Deny all external RDP
resource "google_compute_firewall" "deny_external_rdp" {
  name    = "${var.vpc_name}-deny-external-rdp"
  project = var.project_id
  network = google_compute_network.vpc.name

  description = "Deny external RDP access"

  deny {
    protocol = "tcp"
    ports    = ["3389"]
  }

  source_ranges = ["0.0.0.0/0"]

  priority = 2000
}

# ==============================================================================
# PRIVATE SERVICE CONNECTION (for Cloud SQL, Redis)
# ==============================================================================

# Reserve IP range for private service connection
resource "google_compute_global_address" "private_ip_range" {
  name          = "${var.vpc_name}-private-ip-range"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id

  description = "Reserved IP range for private service connection (Cloud SQL, Redis)"
}

# Create private VPC connection for Google services
resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# ==============================================================================
# VPC PEERING FOR SERVICES
# ==============================================================================

# Export custom routes to peer network (for private services)
resource "google_compute_network_peering_routes_config" "peering_routes" {
  project = var.project_id
  peering = google_service_networking_connection.private_vpc_connection.peering
  network = google_compute_network.vpc.name

  import_custom_routes = true
  export_custom_routes = true
}

# ==============================================================================
# DNS ZONES (Private)
# ==============================================================================

# Private DNS zone for internal services
resource "google_dns_managed_zone" "private_zone" {
  name        = "${var.vpc_name}-private-zone"
  project     = var.project_id
  dns_name    = "elara.internal."
  description = "Private DNS zone for Elara internal services"

  visibility = "private"

  private_visibility_config {
    networks {
      network_url = google_compute_network.vpc.id
    }
  }
}

# DNS record for Cloud SQL
resource "google_dns_record_set" "cloudsql" {
  name         = "postgres.elara.internal."
  project      = var.project_id
  managed_zone = google_dns_managed_zone.private_zone.name
  type         = "A"
  ttl          = 300

  # This will be populated after Cloud SQL is created
  # For now, we'll use a placeholder
  rrdatas = ["10.0.0.1"]

  depends_on = [google_dns_managed_zone.private_zone]
}

# DNS record for Redis
resource "google_dns_record_set" "redis" {
  name         = "redis.elara.internal."
  project      = var.project_id
  managed_zone = google_dns_managed_zone.private_zone.name
  type         = "A"
  ttl          = 300

  # This will be populated after Redis is created
  rrdatas = ["10.0.0.2"]

  depends_on = [google_dns_managed_zone.private_zone]
}
