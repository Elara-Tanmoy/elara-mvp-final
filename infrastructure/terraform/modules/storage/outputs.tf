# ==============================================================================
# STORAGE MODULE - OUTPUTS
# ==============================================================================

output "bucket_names" {
  description = "Storage bucket names"
  value = {
    for key, bucket in google_storage_bucket.buckets :
    key => bucket.name
  }
}

output "bucket_urls" {
  description = "Storage bucket URLs"
  value = {
    for key, bucket in google_storage_bucket.buckets :
    key => bucket.url
  }
}

output "bucket_self_links" {
  description = "Storage bucket self links"
  value = {
    for key, bucket in google_storage_bucket.buckets :
    key => bucket.self_link
  }
}
