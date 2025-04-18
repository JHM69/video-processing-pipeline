variable "cluster_name" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "instance_types" {
  type = list(string)
}

variable "min_size" {
  type = number
}

variable "max_size" {
  type = number
}

variable "desired_size" {
  type = number
}

variable "cluster_version" {
  type = string
}

variable "tags" {
  type = map(string)
}
