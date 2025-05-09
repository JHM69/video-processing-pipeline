terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

provider "google" {
  credentials = file(var.credentials_file)
  project     = var.project_id
  region      = var.region
}

# Configure kubernetes provider after cluster creation
provider "kubernetes" {
  host                   = "https://${module.gke_cluster.endpoint}"
  token                  = data.google_client_config.current.access_token
  cluster_ca_certificate = base64decode(module.gke_cluster.cluster_ca_certificate)
}

data "google_client_config" "current" {}

# Create service accounts first
resource "google_service_account" "gke_sa" {
  account_id   = "gke-service-account"
  display_name = "GKE Service Account"
}

resource "google_service_account" "video_processor" {
  account_id   = "video-processor"
  display_name = "Video Processor Service Account"
}

# Grant necessary IAM roles to service accounts
resource "google_project_iam_member" "gke_sa_roles" {
  for_each = toset([
    "roles/container.nodeServiceAccount",
    "roles/storage.objectViewer"
  ])
  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.gke_sa.email}"
}

resource "google_project_iam_member" "video_processor_roles" {
  for_each = toset([
    "roles/storage.objectViewer",
    "roles/storage.objectCreator"
  ])
  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.video_processor.email}"
}

# Create network infrastructure
resource "google_compute_network" "vpc" {
  name                    = "video-processor-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "video-processor-subnet"
  ip_cidr_range = "10.0.0.0/16"
  region        = var.region
  network       = google_compute_network.vpc.name

  secondary_ip_range {
    range_name    = "services-range"
    ip_cidr_range = "192.168.0.0/20"
  }

  secondary_ip_range {
    range_name    = "pod-range"
    ip_cidr_range = "192.168.16.0/20"
  }
}

# Create GCS bucket
resource "google_storage_bucket" "video_storage" {
  name          = "${var.project_id}-video-processor-storage"
  location      = var.region
  storage_class = "STANDARD"

  uniform_bucket_level_access = true
  
  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [
    google_project_iam_member.video_processor_roles
  ]
}

# Create GKE cluster
module "gke_cluster" {
  source = "./modules/gcp-gke"

  project_id       = var.project_id
  region          = var.region
  cluster_name    = var.cluster_name
  node_pool_name  = "video-processor-pool"
  machine_type    = "e2-standard-2"
  min_node_count  = 1
  max_node_count  = 5
  network         = google_compute_network.vpc.name
  subnetwork      = google_compute_subnetwork.subnet.name
  service_account = google_service_account.gke_sa.email

  depends_on = [
    google_project_iam_member.gke_sa_roles
  ]
}

# Configure workload identity
resource "google_service_account_iam_binding" "workload_identity_binding" {
  service_account_id = google_service_account.video_processor.name
  role               = "roles/iam.workloadIdentityUser"
  members = [
    "serviceAccount:${var.project_id}.svc.id.goog[video-processor/video-processor-sa]"
  ]

  depends_on = [
    google_service_account.video_processor,
    module.gke_cluster
  ]
}

# Create Kubernetes namespace
resource "kubernetes_namespace" "video_processor" {
  metadata {
    name = "video-processor"
  }

  depends_on = [
    module.gke_cluster
  ]
}

# Create ConfigMap
resource "kubernetes_config_map" "gcp_config" {
  metadata {
    name      = "gcp-config"
    namespace = "video-processor"
  }

  data = {
    "project-id" = var.project_id
  }

  depends_on = [
    kubernetes_namespace.video_processor
  ]
}