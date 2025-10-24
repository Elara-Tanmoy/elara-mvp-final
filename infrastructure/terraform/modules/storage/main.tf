# ==============================================================================
# STORAGE MODULE - CLOUD STORAGE BUCKETS
# ==============================================================================
# Purpose: GCS buckets for scans, reports, screenshots, backups
# ==============================================================================

# Create storage buckets
resource "google_storage_bucket" "buckets" {
  for_each = var.buckets

  project       = var.project_id
  name          = each.value.name
  location      = each.value.location
  storage_class = each.value.storage_class
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = var.storage_versioning_enabled
  }

  # Encryption (only if KMS key is provided)
  dynamic "encryption" {
    for_each = var.encryption_key != null ? [1] : []
    content {
      default_kms_key_name = var.encryption_key
    }
  }

  # Lifecycle rules
  dynamic "lifecycle_rule" {
    for_each = each.value.lifecycle_rules
    content {
      action {
        type          = lifecycle_rule.value.action.type
        storage_class = lookup(lifecycle_rule.value.action, "storage_class", null)
      }
      condition {
        age                   = lookup(lifecycle_rule.value.condition, "age", null)
        created_before        = lookup(lifecycle_rule.value.condition, "created_before", null)
        with_state            = lookup(lifecycle_rule.value.condition, "with_state", null)
        matches_storage_class = lookup(lifecycle_rule.value.condition, "matches_storage_class", null)
      }
    }
  }

  labels = var.labels

  lifecycle {
    prevent_destroy = true
  }
}

# IAM bindings for buckets
resource "google_storage_bucket_iam_member" "iam_bindings" {
  for_each = var.iam_members

  bucket = google_storage_bucket.buckets[each.value.bucket_key].name
  role   = each.value.role
  member = each.value.member
}
