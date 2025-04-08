variable "cluster_name" {
  type = string
}

variable "location" {
  type = string
}

variable "node_pool_name" {
  type = string
}

variable "machine_type" {
  type = string
}

variable "min_count" {
  type = number
}

variable "max_count" {
  type = number
}

variable "initial_count" {
  type = number
}

variable "labels" {
  type = map(string)
}
