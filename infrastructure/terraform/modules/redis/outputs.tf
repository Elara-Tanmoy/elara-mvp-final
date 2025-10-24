# ==============================================================================
# REDIS MODULE - OUTPUTS
# ==============================================================================

output "instance_id" {
  description = "Redis instance ID"
  value       = google_redis_instance.redis.id
}

output "instance_name" {
  description = "Redis instance name"
  value       = google_redis_instance.redis.name
}

output "host" {
  description = "Redis host IP address"
  value       = google_redis_instance.redis.host
  sensitive   = true
}

output "port" {
  description = "Redis port"
  value       = google_redis_instance.redis.port
}

output "memory_size_gb" {
  description = "Redis memory size in GB"
  value       = google_redis_instance.redis.memory_size_gb
}

output "current_location_id" {
  description = "Redis current location ID"
  value       = google_redis_instance.redis.current_location_id
}

output "auth_string" {
  description = "Redis AUTH string"
  value       = google_redis_instance.redis.auth_string
  sensitive   = true
}

output "connection_string" {
  description = "Redis connection string"
  value       = "redis://:${google_redis_instance.redis.auth_string}@${google_redis_instance.redis.host}:${google_redis_instance.redis.port}"
  sensitive   = true
}
