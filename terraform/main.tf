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

# AWS EKS Cluster
module "aws_eks" {
  source          = "./modules/aws-eks"
  cluster_name    = "video-processing-aws"
  vpc_cidr        = "10.0.0.0/16"
  instance_types  = ["t3.micro"]
  min_size        = 1
  max_size        = 1
  desired_size    = 1
  cluster_version = "1.27"
  
  tags = {
    Environment = "production"
    Service     = "video-processing"
  }
}

# GCP GKE Cluster
module "gcp_gke" {
  source         = "./modules/gcp-gke"
  cluster_name   = "video-processing-gcp"
  location       = var.gcp_region
  project_id     = var.gcp_project_id
  node_pool_name = "video-processing-pool"
  machine_type   = "e2-medium"    # Changed to e2-medium for better compatibility
  min_count      = 1
  max_count      = 1
  initial_count  = 1
  
  labels = {
    environment = "production"
    service     = "video-processing"
  }
}

# ECR Repository
resource "aws_ecr_repository" "video_processor" {
  name                 = "video-processor-app"
  image_tag_mutability = "MUTABLE"
  force_delete         = true  # Allow deleting the repository with images

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Environment = "production"
    Service     = "video-processing"
  }
}

# Add lifecycle policy to manage images
resource "aws_ecr_lifecycle_policy" "video_processor_policy" {
  repository = aws_ecr_repository.video_processor.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_ecr_repository_policy" "video_processor_policy" {
  repository = aws_ecr_repository.video_processor.name
  policy     = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowPull"
        Effect = "Allow"
        Principal = {
          AWS = ["*"]
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
      }
    ]
  })
}

# Output the cluster endpoints
output "aws_eks_endpoint" {
  value = module.aws_eks.cluster_endpoint
}

output "gcp_gke_endpoint" {
  value = module.gcp_gke.cluster_endpoint
}

# Output ECR repository URL
output "ecr_repository_url" {
  value = aws_ecr_repository.video_processor.repository_url
}
