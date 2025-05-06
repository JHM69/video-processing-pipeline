resource "google_container_cluster" "main" {
  name     = var.cluster_name
  location = var.location

  remove_default_node_pool = true
  initial_node_count       = 1

  networking_mode = "VPC_NATIVE"

  ip_allocation_policy {
    cluster_ipv4_cidr_block  = "/16"
    services_ipv4_cidr_block = "/22"
  }
}

resource "google_container_node_pool" "main" {
  name       = var.node_pool_name
  cluster    = google_container_cluster.main.name
  location   = var.location

  node_config {
    machine_type = var.machine_type
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
    labels = var.labels
  }

  autoscaling {
    min_node_count = var.min_count
    max_node_count = var.max_count
  }

  initial_node_count = var.initial_count
}

output "cluster_endpoint" {
  value = google_container_cluster.main.endpoint
}
