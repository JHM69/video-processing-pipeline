resource "google_container_cluster" "primary" {
  name                     = var.cluster_name
  location                 = var.region
  remove_default_node_pool = true
  initial_node_count       = 1
  network                  = var.network
  subnetwork              = var.subnetwork

  ip_allocation_policy {
    cluster_secondary_range_name  = "pod-range"
    services_secondary_range_name = "services-range"
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }
}

resource "google_container_node_pool" "primary_nodes" {
  name       = var.node_pool_name
  location   = var.region
  cluster    = google_container_cluster.primary.name

  // Explicitly set the node version for updates
  version = google_container_cluster.primary.master_version

  # Specify initial node count instead of node_count for regional clusters
  initial_node_count = var.min_node_count

  autoscaling {
    min_node_count = var.min_node_count
    max_node_count = var.max_node_count
  }

  node_config {
    machine_type = var.machine_type
    disk_size_gb = 50
    disk_type    = "pd-standard"
    image_type   = "COS_CONTAINERD"  # Added required image_type

    service_account = var.service_account
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      env = "production"
    }

    # Configure workload identity at node level
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Define kubelet_config explicitly
    kubelet_config {
      cpu_manager_policy = "none"
      cpu_cfs_quota      = true
      pod_pids_limit     = 4096 // Changed from -1 to a valid value
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }

  lifecycle {
    ignore_changes = [
      initial_node_count,
      node_config[0].resource_labels,
    ]
  }
}

# Add outputs needed for Kubernetes provider
output "endpoint" {
  value       = google_container_cluster.primary.endpoint
  description = "The IP address of the cluster master"
}

output "cluster_ca_certificate" {
  value       = google_container_cluster.primary.master_auth[0].cluster_ca_certificate
  description = "The cluster CA certificate (base64 encoded)"
}