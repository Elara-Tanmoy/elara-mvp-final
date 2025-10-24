# ==============================================================================
# LOAD BALANCER MODULE - GLOBAL LB + CLOUD ARMOR
# ==============================================================================
# Purpose: Global HTTPS load balancer with Cloud Armor WAF
# ==============================================================================

# ==============================================================================
# GLOBAL EXTERNAL IP ADDRESS
# ==============================================================================

resource "google_compute_global_address" "external_ip" {
  project = var.project_id
  name    = "${var.name}-ip"
}

# ==============================================================================
# SSL CERTIFICATES (Managed)
# ==============================================================================

resource "google_compute_managed_ssl_certificate" "ssl_certs" {
  for_each = var.ssl_certificates

  project = var.project_id
  name    = each.value.name

  managed {
    domains = each.value.domains
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ==============================================================================
# CLOUD ARMOR SECURITY POLICY
# ==============================================================================

resource "google_compute_security_policy" "policy" {
  project = var.project_id
  name    = var.cloud_armor_policy.name

  # Rate limiting rule
  rule {
    action      = "rate_based_ban"
    priority    = 1000
    description = "Rate limit: 100 req/min per IP"

    match {
      expr {
        expression = "true"
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(403)"
      enforce_on_key = "IP"

      rate_limit_threshold {
        count        = 100
        interval_sec = 60
      }

      ban_duration_sec = 600
    }
  }

  # Block SQL injection
  rule {
    action      = "deny(403)"
    priority    = 2000
    description = "Block SQL injection"

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('sqli-v33-stable')"
      }
    }
  }

  # Block XSS
  rule {
    action      = "deny(403)"
    priority    = 3000
    description = "Block XSS"

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('xss-v33-stable')"
      }
    }
  }

  # Default allow rule
  rule {
    action      = "allow"
    priority    = 2147483647
    description = "Default allow"

    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
  }

  # Adaptive Protection (DDoS)
  adaptive_protection_config {
    layer_7_ddos_defense_config {
      enable = true
    }
  }
}

# ==============================================================================
# BACKEND SERVICE (Placeholder - will be configured after K8s deployment)
# ==============================================================================

# Note: Backend services will be created via GKE Ingress after cluster deployment
# This module creates the frontend infrastructure (IP, SSL, Cloud Armor)

# ==============================================================================
# URL MAP (Placeholder)
# ==============================================================================

resource "google_compute_url_map" "url_map" {
  project = var.project_id
  name    = "${var.name}-url-map"

  # Default service (placeholder - will be updated after K8s deployment)
  default_service = google_compute_backend_service.default.id
}

# ==============================================================================
# BACKEND SERVICE (Default/Placeholder)
# ==============================================================================

resource "google_compute_backend_service" "default" {
  project = var.project_id
  name    = "${var.name}-backend-default"

  protocol    = "HTTPS"
  port_name   = "https"
  timeout_sec = 30

  # Health check
  health_checks = [google_compute_health_check.default.id]

  # Security policy
  security_policy = google_compute_security_policy.policy.id

  # CDN configuration
  enable_cdn = var.enable_cdn

  cdn_policy {
    cache_mode                   = "CACHE_ALL_STATIC"
    default_ttl                  = 3600
    client_ttl                   = 3600
    max_ttl                      = 86400
    negative_caching             = true
    serve_while_stale            = 86400

    cache_key_policy {
      include_host           = true
      include_protocol       = true
      include_query_string   = true
    }
  }

  # Connection draining
  connection_draining_timeout_sec = 300

  # Session affinity
  session_affinity = "CLIENT_IP"

  # IAP (Identity-Aware Proxy) - Optional
  dynamic "iap" {
    for_each = var.enable_iap ? [1] : []
    content {
      oauth2_client_id     = var.iap_oauth2_client_id
      oauth2_client_secret = var.iap_oauth2_client_secret
    }
  }
}

# ==============================================================================
# HEALTH CHECK
# ==============================================================================

resource "google_compute_health_check" "default" {
  project = var.project_id
  name    = "${var.name}-health-check"

  timeout_sec         = 5
  check_interval_sec  = 10
  healthy_threshold   = 2
  unhealthy_threshold = 3

  https_health_check {
    port         = 443
    request_path = "/health"
  }
}

# ==============================================================================
# HTTPS PROXY
# ==============================================================================

resource "google_compute_target_https_proxy" "https_proxy" {
  project = var.project_id
  name    = "${var.name}-https-proxy"

  url_map = google_compute_url_map.url_map.id

  ssl_certificates = [
    for cert in google_compute_managed_ssl_certificate.ssl_certs : cert.id
  ]

  ssl_policy = google_compute_ssl_policy.ssl_policy.id
}

# ==============================================================================
# SSL POLICY (Modern TLS 1.2+)
# ==============================================================================

resource "google_compute_ssl_policy" "ssl_policy" {
  project = var.project_id
  name    = "${var.name}-ssl-policy"

  profile         = "MODERN"
  min_tls_version = "TLS_1_2"
}

# ==============================================================================
# GLOBAL FORWARDING RULE (HTTPS)
# ==============================================================================

resource "google_compute_global_forwarding_rule" "https" {
  project = var.project_id
  name    = "${var.name}-https-forwarding-rule"

  target     = google_compute_target_https_proxy.https_proxy.id
  port_range = "443"
  ip_address = google_compute_global_address.external_ip.address
}

# ==============================================================================
# HTTP to HTTPS REDIRECT
# ==============================================================================

resource "google_compute_url_map" "http_redirect" {
  project = var.project_id
  name    = "${var.name}-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "http_proxy" {
  project = var.project_id
  name    = "${var.name}-http-proxy"

  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http" {
  project = var.project_id
  name    = "${var.name}-http-forwarding-rule"

  target     = google_compute_target_http_proxy.http_proxy.id
  port_range = "80"
  ip_address = google_compute_global_address.external_ip.address
}
