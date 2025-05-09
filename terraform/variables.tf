variable "credentials_file" {
  description = "Path to the GCP credentials JSON file"
  type        = string
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (e.g., production, staging)"
  type        = string
}

variable "cluster_name" {
  description = "Name of the GKE cluster"
  type        = string
  default     = "video-processor-cluster"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "example.com"
}