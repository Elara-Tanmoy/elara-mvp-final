# ==============================================================================
# ELARA PLATFORM - GCP INFRASTRUCTURE (MAIN CONFIGURATION)
# ==============================================================================
# Project: ELARA-MVP
# Project ID: elara-mvp-13082025-u1
# Terraform Version: >= 1.9.0
# ==============================================================================

terraform {
  required_version = ">= 1.9.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Terraform state stored in GCS bucket
  backend "gcs" {
    bucket = "elara-terraform-state-elara-mvp-13082025-u1"
    prefix = "terraform/state"
  }
}

# ==============================================================================
# PROVIDER CONFIGURATION
# ==============================================================================

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ==============================================================================
# LOCAL VARIABLES
# ==============================================================================

locals {
  project_id     = var.project_id
  project_number = var.project_number
  region         = var.region
  zone           = var.zone
  environment    = var.environment

  # Resource naming
  name_prefix = "elara"

  # Network
  vpc_name = "${local.name_prefix}-vpc"

  # Labels
  common_labels = {
    project     = "elara"
    environment = var.environment
    managed_by  = "terraform"
    team        = "devops"
  }
}

# ==============================================================================
# MODULE: NETWORKING
# ==============================================================================

module "networking" {
  source = "./modules/networking"

  project_id  = local.project_id
  region      = local.region
  environment = local.environment

  vpc_name = local.vpc_name

  # Subnet CIDR ranges
  subnet_ranges = {
    gke_pods     = "10.1.0.0/16"
    gke_services = "10.2.0.0/20"
    gke_nodes    = "10.10.0.0/24"
    data_layer   = "10.20.0.0/24"
    cloudrun     = "10.30.0.0/28"
  }

  labels = local.common_labels
}

# ==============================================================================
# MODULE: SECURITY (IAM, Secret Manager, Cloud KMS)
# ==============================================================================

module "security" {
  source = "./modules/security"

  project_id     = local.project_id
  project_number = local.project_number
  region         = local.region
  environment    = local.environment

  # Service accounts
  service_accounts = {
    api = {
      name                = "${local.name_prefix}-api"
      description         = "Service account for Elara backend API"
      k8s_namespace       = "elara-backend"
      k8s_service_account = "elara-api-sa"
      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
        "roles/storage.objectViewer",
        "roles/storage.objectCreator",
        "roles/logging.logWriter",
        "roles/monitoring.metricWriter",
        "roles/cloudtrace.agent"
      ]
    }
    worker = {
      name                = "${local.name_prefix}-worker"
      description         = "Service account for BullMQ workers"
      k8s_namespace       = "elara-workers"
      k8s_service_account = "elara-worker-sa"
      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
        "roles/storage.objectAdmin",
        "roles/pubsub.publisher",
        "roles/logging.logWriter"
      ]
    }
    proxy = {
      name                = "${local.name_prefix}-proxy"
      description         = "Service account for proxy service"
      k8s_namespace       = "elara-proxy"
      k8s_service_account = "elara-proxy-sa"
      roles = [
        "roles/storage.objectCreator",
        "roles/logging.logWriter"
      ]
    }
    frontend = {
      name                = "${local.name_prefix}-frontend"
      description         = "Service account for frontend (Cloud Run)"
      k8s_namespace       = "default"
      k8s_service_account = "elara-frontend-sa"
      roles = [
        "roles/logging.logWriter"
      ]
    }
  }

  # KMS key ring for encryption
  kms_key_ring_name = "${local.name_prefix}-keyring"

  # Create encryption keys
  kms_keys = [
    "cloudsql-key",
    "storage-key",
    "redis-key"
  ]

  labels = local.common_labels
}

# ==============================================================================
# MODULE: CLOUD SQL POSTGRESQL (HA)
# ==============================================================================

module "cloudsql" {
  source = "./modules/cloudsql"

  project_id  = local.project_id
  region      = local.region
  environment = local.environment

  # Instance configuration
  instance_name = "${local.name_prefix}-postgres-primary"
  database_version = "POSTGRES_15"

  # Machine type (8 vCPU, 32GB RAM)
  tier = "db-custom-8-32768"

  # Storage
  disk_size = 500  # GB
  disk_type = "PD_SSD"
  disk_autoresize = true
  disk_autoresize_limit = 2000  # 2TB max

  # High Availability
  availability_type = "REGIONAL"  # Creates standby in different zone

  # Networking
  network_id = module.networking.vpc_id
  private_network = module.networking.vpc_self_link

  # Backup configuration
  backup_configuration = {
    enabled                        = true
    start_time                     = "03:00"
    point_in_time_recovery_enabled = true
    transaction_log_retention_days = 7
    retained_backups              = 30
    location                      = "us"
  }

  # Read replicas
  read_replicas = [
    {
      name              = "${local.name_prefix}-postgres-replica-1"
      tier              = "db-custom-4-16384"
      zone              = "${local.region}-c"
      disk_type         = "PD_SSD"
      disk_size         = 500
      replication_type  = "ASYNCHRONOUS"
    },
    {
      name              = "${local.name_prefix}-postgres-replica-2-dr"
      tier              = "db-custom-4-16384"
      region            = "us-east1"
      zone              = "us-east1-a"
      disk_type         = "PD_SSD"
      disk_size         = 500
      replication_type  = "ASYNCHRONOUS"
    }
  ]

  # Database flags (performance tuning)
  database_flags = [
    { name = "max_connections", value = "5000" },
    { name = "shared_buffers", value = "2516582" },  # 2.4GB (max for 32GB RAM)
    { name = "effective_cache_size", value = "2936012" },  # 2.8GB (max for 32GB RAM)
    { name = "maintenance_work_mem", value = "2097152" },  # 2GB in KB
    { name = "checkpoint_completion_target", value = "0.9" },
    { name = "wal_buffers", value = "2048" },  # 16MB
    { name = "default_statistics_target", value = "100" },
    { name = "random_page_cost", value = "1.1" },
    { name = "effective_io_concurrency", value = "200" },
    { name = "work_mem", value = "10485" },  # 10MB in KB
    { name = "min_wal_size", value = "1024" },  # 1GB in MB
    { name = "max_wal_size", value = "4096" },  # 4GB in MB
    { name = "max_worker_processes", value = "8" },
    { name = "max_parallel_workers_per_gather", value = "4" },
    { name = "max_parallel_workers", value = "8" }
  ]

  # Encryption (DISABLED - KMS service account binding must be created first)
  # encryption_key_name = module.security.kms_keys["cloudsql-key"].id
  encryption_key_name = null

  # Maintenance window
  maintenance_window = {
    day  = 7  # Sunday
    hour = 4  # 4 AM UTC
  }

  # Notification channels (will be created by monitoring module)
  notification_channels = []

  labels = local.common_labels

  depends_on = [
    module.networking,
    module.security
  ]
}

# ==============================================================================
# MODULE: REDIS (Memorystore)
# ==============================================================================

module "redis" {
  source = "./modules/redis"

  project_id  = local.project_id
  region      = local.region
  environment = local.environment

  # Instance configuration
  instance_name    = "${local.name_prefix}-redis-primary"
  memory_size_gb   = 5
  redis_version    = "REDIS_7_0"
  tier             = "STANDARD_HA"  # High availability

  # Networking
  authorized_network = module.networking.vpc_id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  # Persistence
  persistence_config = {
    rdb_snapshot_period       = "SIX_HOURS"
    rdb_snapshot_start_time   = "2025-01-01T02:00:00Z"
  }

  # Maintenance
  maintenance_policy = {
    day        = "SUNDAY"
    start_hour = 5
    duration   = 4
  }

  # Redis configuration
  redis_configs = {
    maxmemory-policy          = "allkeys-lru"
    activedefrag              = "yes"
    "lazyfree-lazy-eviction"  = "yes"
    "lazyfree-lazy-expire"    = "yes"
  }

  # Notification channels
  notification_channels = []

  labels = local.common_labels

  depends_on = [module.networking]
}

# ==============================================================================
# MODULE: CLOUD STORAGE BUCKETS
# ==============================================================================

module "storage" {
  source = "./modules/storage"

  project_id  = local.project_id
  region      = local.region
  environment = local.environment

  # Storage buckets
  buckets = {
    scans = {
      name          = "elara-scans-${local.project_id}"
      location      = "US"
      storage_class = "STANDARD"
      lifecycle_rules = [
        {
          action = { type = "Delete" }
          condition = { age = 30 }
        }
      ]
    }
    reports = {
      name          = "elara-reports-${local.project_id}"
      location      = "US"
      storage_class = "NEARLINE"
      lifecycle_rules = [
        {
          action = { type = "SetStorageClass", storage_class = "ARCHIVE" }
          condition = { age = 90 }
        }
      ]
    }
    screenshots = {
      name          = "elara-screenshots-${local.project_id}"
      location      = "US"
      storage_class = "STANDARD"
      lifecycle_rules = [
        {
          action = { type = "Delete" }
          condition = { age = 7 }
        }
      ]
    }
    backups = {
      name          = "elara-backups-${local.project_id}"
      location      = "US"
      storage_class = "ARCHIVE"
      lifecycle_rules = []  # Keep for 10 years (manual deletion)
    }
  }

  # Encryption (DISABLED - KMS service account binding must be created first)
  # encryption_key = module.security.kms_keys["storage-key"].id
  encryption_key = null

  # IAM bindings (service accounts get access)
  iam_members = {
    api-scans = {
      bucket_key = "scans"
      role       = "roles/storage.objectViewer"
      member     = "serviceAccount:${module.security.service_accounts["api"].email}"
    }
    worker-scans = {
      bucket_key = "scans"
      role       = "roles/storage.objectAdmin"
      member     = "serviceAccount:${module.security.service_accounts["worker"].email}"
    }
    worker-reports = {
      bucket_key = "reports"
      role       = "roles/storage.objectAdmin"
      member     = "serviceAccount:${module.security.service_accounts["worker"].email}"
    }
    worker-screenshots = {
      bucket_key = "screenshots"
      role       = "roles/storage.objectAdmin"
      member     = "serviceAccount:${module.security.service_accounts["worker"].email}"
    }
  }

  labels = local.common_labels

  depends_on = [module.security]
}

# ==============================================================================
# MODULE: GKE AUTOPILOT CLUSTERS
# ==============================================================================

module "gke" {
  source = "./modules/gke"

  project_id  = local.project_id
  region      = local.region
  environment = local.environment

  # Cluster configuration
  cluster_name = "${local.name_prefix}-gke-${local.region}"

  # Networking
  network_name    = module.networking.vpc_name
  subnet_name     = module.networking.subnet_gke_nodes
  pods_range_name = "gke-pods-${local.region}"
  services_range_name = "gke-services-${local.region}"

  # Autopilot mode (Google manages nodes)
  autopilot_enabled = true

  # Workload Identity
  workload_identity_config = {
    workload_pool = "${local.project_id}.svc.id.goog"
  }

  # Binary Authorization (DISABLED temporarily to diagnose "invalid argument" error)
  binary_authorization_enabled = false

  # Monitoring & Logging
  logging_config = {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config = {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
    managed_prometheus_enabled = true
  }

  # Maintenance window
  maintenance_window = {
    start_time = "2025-01-01T04:00:00Z"
    end_time   = "2025-01-01T08:00:00Z"
    recurrence = "FREQ=WEEKLY;BYDAY=SU"
  }

  # Master authorized networks (optional - for kubectl access)
  master_authorized_networks = []  # Empty = public endpoint (protected by IAM)

  labels = local.common_labels

  depends_on = [module.networking]
}

# ==============================================================================
# MODULE: GLOBAL LOAD BALANCER + CLOUD ARMOR
# ==============================================================================

module "loadbalancer" {
  source = "./modules/loadbalancer"

  project_id  = local.project_id
  environment = local.environment

  # Load balancer name
  name = "${local.name_prefix}-global-lb"

  # SSL certificate (managed)
  ssl_certificates = {
    primary = {
      name    = "${local.name_prefix}-ssl-cert"
      domains = ["elara.com", "api.elara.com", "www.elara.com"]
    }
  }

  # Cloud Armor security policy
  cloud_armor_policy = {
    name = "${local.name_prefix}-security-policy"

    rules = [
      {
        priority    = 1000
        action      = "rate_based_ban"
        description = "Rate limit: 100 req/min per IP"
        expression  = "true"
        rate_limit = {
          conform_action = "allow"
          exceed_action  = "deny(403)"
          enforce_on_key = "IP"
          rate_limit_threshold = {
            count        = 100
            interval_sec = 60
          }
          ban_duration_sec = 600
        }
      },
      {
        priority    = 2000
        action      = "deny(403)"
        description = "Block SQL injection"
        expression  = "evaluatePreconfiguredExpr('sqli-stable')"
      },
      {
        priority    = 3000
        action      = "deny(403)"
        description = "Block XSS"
        expression  = "evaluatePreconfiguredExpr('xss-stable')"
      },
      {
        priority    = 2147483647
        action      = "allow"
        description = "Default allow"
        expression  = "true"
      }
    ]
  }

  # Backend services (will be created after GKE deployment)
  # These are placeholders - actual backends configured after K8s deployment

  labels = local.common_labels
}

# ==============================================================================
# MODULE: MONITORING & LOGGING
# ==============================================================================

module "monitoring" {
  source = "./modules/monitoring"

  project_id  = local.project_id
  environment = local.environment

  # Log sinks
  log_sinks = {
    bigquery = {
      name                   = "${local.name_prefix}-logs-bigquery"
      destination            = "bigquery.googleapis.com/projects/${local.project_id}/datasets/elara_logs"
      filter                 = "resource.type=\"k8s_container\" OR resource.type=\"cloud_run_revision\" OR resource.type=\"cloudsql_database\""
      unique_writer_identity = true
    }
  }

  # Alert policies
  notification_channels = {
    email = {
      type         = "email"
      display_name = "Elara DevOps Email"
      labels = {
        email_address = "devops@elara.com"
      }
    }
  }

  alert_policies = [
    # Note: Custom metric alert disabled - "logging.googleapis.com/user/error_count"
    # metric will be available after application deployment and log-based metric creation.
    # Uncomment after creating the log-based metric in Cloud Logging.
    # {
    #   display_name = "High Error Rate"
    #   conditions = [{
    #     display_name = "Error rate > 5%"
    #     condition_threshold = {
    #       filter          = "resource.type=\"k8s_container\" AND metric.type=\"logging.googleapis.com/user/error_count\""
    #       duration        = "300s"
    #       comparison      = "COMPARISON_GT"
    #       threshold_value = 5
    #     }
    #   }]
    # },
    {
      display_name = "Database High CPU"
      conditions = [{
        display_name = "Cloud SQL CPU > 80%"
        condition_threshold = {
          filter          = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\""
          duration        = "300s"
          comparison      = "COMPARISON_GT"
          threshold_value = 0.8
        }
      }]
    }
  ]

  labels = local.common_labels
}
