variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
}

variable "cluster_name" {
  description = "Name of the GKE cluster"
  type        = string
}

variable "node_pool_name" {
  description = "Name of the node pool"
  type        = string
}

variable "machine_type" {
  description = "Machine type for the nodes"
  type        = string
}

variable "min_node_count" {
  description = "Minimum number of nodes in the pool"
  type        = number
}

variable "max_node_count" {
  description = "Maximum number of nodes in the pool"
  type        = number
}

variable "network" {
  description = "VPC network name"
  type        = string
}

variable "subnetwork" {
  description = "VPC subnetwork name"
  type        = string
}

variable "service_account" {
  description = "Service account email"
  type        = string
}