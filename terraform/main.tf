terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# AWS EKS Cluster
module "aws_eks" {
  source          = "./modules/aws-eks"
  cluster_name    = "video-processing-aws"
  vpc_cidr        = "10.0.0.0/16"
  instance_types  = ["t3.large"]
  min_size        = 1
  max_size        = 2
}

# GCP GKE Cluster
module "gcp_gke" {
  source         = "./modules/gcp-gke"
  cluster_name   = "video-processing-gcp"
  location       = var.gcp_region
  node_pool_name = "video-processing-pool"
  machine_type   = "n2-standard-2"
  min_count      = 1
  max_count      = 2
}
