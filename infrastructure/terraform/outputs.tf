# ==============================================================================
# ELARA PLATFORM - TERRAFORM OUTPUTS
# ==============================================================================
# Purpose: Output values from infrastructure deployment
# ==============================================================================

# ==============================================================================
# PROJECT INFORMATION
# ==============================================================================

output "project_id" {
  description = "GCP Project ID"
  value       = local.project_id
}

output "project_number" {
  description = "GCP Project Number"
  value       = var.project_number
}

output "region" {
  description = "Primary region"
  value       = local.region
}

output "environment" {
  description = "Environment name"
  value       = local.environment
}

# ==============================================================================
# NETWORKING OUTPUTS
# ==============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "vpc_name" {
  description = "VPC name"
  value       = module.networking.vpc_name
}

output "vpc_self_link" {
  description = "VPC self link"
  value       = module.networking.vpc_self_link
}

output "subnet_gke_nodes" {
  description = "GKE nodes subnet name"
  value       = module.networking.subnet_gke_nodes
}

output "subnet_gke_nodes_id" {
  description = "GKE nodes subnet ID"
  value       = module.networking.subnet_gke_nodes_id
}

output "subnet_data_layer" {
  description = "Data layer subnet name"
  value       = module.networking.subnet_data_layer
}

output "cloud_nat_ips" {
  description = "Cloud NAT external IP addresses"
  value       = module.networking.nat_ips
}

# ==============================================================================
# SECURITY OUTPUTS
# ==============================================================================

output "service_accounts" {
  description = "Service account details"
  value = {
    api = {
      email = module.security.service_accounts["api"].email
      id    = module.security.service_accounts["api"].id
    }
    worker = {
      email = module.security.service_accounts["worker"].email
      id    = module.security.service_accounts["worker"].id
    }
    proxy = {
      email = module.security.service_accounts["proxy"].email
      id    = module.security.service_accounts["proxy"].id
    }
    frontend = {
      email = module.security.service_accounts["frontend"].email
      id    = module.security.service_accounts["frontend"].id
    }
  }
}

output "kms_keyring_id" {
  description = "KMS Key Ring ID"
  value       = module.security.kms_keyring_id
}

output "kms_keys" {
  description = "KMS encryption keys"
  value = {
    cloudsql = module.security.kms_keys["cloudsql-key"].id
    storage  = module.security.kms_keys["storage-key"].id
    redis    = module.security.kms_keys["redis-key"].id
  }
  sensitive = true
}

output "secret_manager_project" {
  description = "Secret Manager project ID"
  value       = module.security.secret_manager_project
}

# ==============================================================================
# DATABASE OUTPUTS (Cloud SQL)
# ==============================================================================

output "cloudsql_instance_name" {
  description = "Cloud SQL instance name"
  value       = module.cloudsql.instance_name
}

output "cloudsql_instance_connection_name" {
  description = "Cloud SQL instance connection name (for Cloud SQL Proxy)"
  value       = module.cloudsql.instance_connection_name
}

output "cloudsql_private_ip" {
  description = "Cloud SQL private IP address"
  value       = module.cloudsql.private_ip_address
  sensitive   = true
}

output "cloudsql_public_ip" {
  description = "Cloud SQL public IP address (if enabled)"
  value       = module.cloudsql.public_ip_address
  sensitive   = true
}

output "cloudsql_database_version" {
  description = "PostgreSQL version"
  value       = module.cloudsql.database_version
}

output "cloudsql_replica_names" {
  description = "Read replica instance names"
  value       = module.cloudsql.replica_names
}

output "cloudsql_replica_ips" {
  description = "Read replica IP addresses"
  value       = module.cloudsql.replica_ips
  sensitive   = true
}

# ==============================================================================
# REDIS OUTPUTS (Memorystore)
# ==============================================================================

output "redis_instance_id" {
  description = "Redis instance ID"
  value       = module.redis.instance_id
}

output "redis_host" {
  description = "Redis host IP address"
  value       = module.redis.host
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = module.redis.port
}

output "redis_memory_size_gb" {
  description = "Redis memory size in GB"
  value       = module.redis.memory_size_gb
}

output "redis_version" {
  description = "Redis version"
  value       = module.redis.current_location_id
}

output "redis_connection_string" {
  description = "Redis connection string"
  value       = "redis://${module.redis.host}:${module.redis.port}"
  sensitive   = true
}

# ==============================================================================
# STORAGE OUTPUTS (GCS)
# ==============================================================================

output "storage_buckets" {
  description = "Cloud Storage bucket details"
  value = {
    scans = {
      name = module.storage.bucket_names["scans"]
      url  = module.storage.bucket_urls["scans"]
    }
    reports = {
      name = module.storage.bucket_names["reports"]
      url  = module.storage.bucket_urls["reports"]
    }
    screenshots = {
      name = module.storage.bucket_names["screenshots"]
      url  = module.storage.bucket_urls["screenshots"]
    }
    backups = {
      name = module.storage.bucket_names["backups"]
      url  = module.storage.bucket_urls["backups"]
    }
  }
}

output "storage_bucket_scans" {
  description = "Scans bucket name"
  value       = module.storage.bucket_names["scans"]
}

output "storage_bucket_reports" {
  description = "Reports bucket name"
  value       = module.storage.bucket_names["reports"]
}

output "storage_bucket_screenshots" {
  description = "Screenshots bucket name"
  value       = module.storage.bucket_names["screenshots"]
}

output "storage_bucket_backups" {
  description = "Backups bucket name"
  value       = module.storage.bucket_names["backups"]
}

# ==============================================================================
# GKE OUTPUTS
# ==============================================================================

output "gke_cluster_name" {
  description = "GKE cluster name"
  value       = module.gke.cluster_name
}

output "gke_cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = module.gke.cluster_endpoint
  sensitive   = true
}

output "gke_cluster_ca_certificate" {
  description = "GKE cluster CA certificate"
  value       = module.gke.cluster_ca_certificate
  sensitive   = true
}

output "gke_cluster_location" {
  description = "GKE cluster location"
  value       = module.gke.cluster_location
}

output "gke_cluster_id" {
  description = "GKE cluster ID"
  value       = module.gke.cluster_id
}

output "gke_workload_identity_pool" {
  description = "Workload Identity pool"
  value       = module.gke.workload_identity_pool
}

# ==============================================================================
# LOAD BALANCER OUTPUTS
# ==============================================================================

output "load_balancer_ip" {
  description = "Global load balancer external IP address"
  value       = module.loadbalancer.external_ip
}

output "load_balancer_name" {
  description = "Load balancer name"
  value       = module.loadbalancer.load_balancer_name
}

output "cloud_armor_policy_id" {
  description = "Cloud Armor security policy ID"
  value       = module.loadbalancer.security_policy_id
}

output "ssl_certificate_ids" {
  description = "SSL certificate IDs"
  value       = module.loadbalancer.ssl_certificate_ids
}

# ==============================================================================
# MONITORING OUTPUTS
# ==============================================================================

output "log_sink_bigquery_dataset" {
  description = "BigQuery dataset for log sink"
  value       = module.monitoring.log_sink_destinations
}

output "notification_channel_ids" {
  description = "Notification channel IDs"
  value       = module.monitoring.notification_channel_ids
  sensitive   = true
}

output "alert_policy_ids" {
  description = "Alert policy IDs"
  value       = module.monitoring.alert_policy_ids
}

# ==============================================================================
# CONNECTION STRINGS (for K8s ConfigMaps/Secrets)
# ==============================================================================

output "database_connection_string" {
  description = "PostgreSQL connection string for applications"
  value       = "postgresql://elara_app:PASSWORD_FROM_SECRET_MANAGER@${module.cloudsql.private_ip_address}:5432/elara_production"
  sensitive   = true
}

output "redis_url" {
  description = "Redis URL for applications"
  value       = "redis://${module.redis.host}:${module.redis.port}"
  sensitive   = true
}

output "chromadb_url" {
  description = "ChromaDB URL (internal K8s service)"
  value       = "http://chromadb-service.elara-backend.svc.cluster.local:8000"
}

# ==============================================================================
# KUBECTL CONNECTION COMMAND
# ==============================================================================

output "kubectl_connect_command" {
  description = "Command to connect kubectl to GKE cluster"
  value       = "gcloud container clusters get-credentials ${module.gke.cluster_name} --region ${local.region} --project ${local.project_id}"
}

# ==============================================================================
# DEPLOYMENT SUMMARY
# ==============================================================================

output "deployment_summary" {
  description = "Deployment summary"
  value = {
    project_id        = local.project_id
    environment       = local.environment
    region            = local.region
    vpc_name          = module.networking.vpc_name
    gke_cluster       = module.gke.cluster_name
    database_instance = module.cloudsql.instance_name
    redis_instance    = module.redis.instance_id
    load_balancer_ip  = module.loadbalancer.external_ip
    storage_buckets   = length(module.storage.bucket_names)
    service_accounts  = length(module.security.service_accounts)
  }
}

# ==============================================================================
# NEXT STEPS
# ==============================================================================

output "next_steps" {
  description = "Next steps after infrastructure deployment"
  value = <<-EOT
    ✅ Infrastructure deployment complete!

    📋 Next Steps:

    1. Connect to GKE cluster:
       ${format("gcloud container clusters get-credentials %s --region %s --project %s", module.gke.cluster_name, local.region, local.project_id)}

    2. Create Kubernetes secrets from Secret Manager:
       cd ../scripts
       ./01_create_secrets.sh

    3. Deploy applications to GKE:
       cd ../kubernetes
       kubectl apply -k overlays/production

    4. Configure DNS records:
       - A record: ${var.domain_name} → ${module.loadbalancer.external_ip}
       - A record: ${var.api_domain_name} → ${module.loadbalancer.external_ip}

    5. Monitor deployment:
       kubectl get pods -A --watch

    6. Access Cloud Console:
       https://console.cloud.google.com/home/dashboard?project=${local.project_id}

    📊 Deployed Resources:
    - VPC: ${module.networking.vpc_name}
    - GKE: ${module.gke.cluster_name}
    - Database: ${module.cloudsql.instance_name}
    - Redis: ${module.redis.instance_id}
    - Load Balancer IP: ${module.loadbalancer.external_ip}
  EOT
}
