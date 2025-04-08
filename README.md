# Multi-Cloud Video Processing Load Balancer

A distributed video processing system deployed across multiple cloud providers (AWS and GCP) with intelligent load balancing.

## Architecture Overview

This system implements a scalable video processing service that runs across AWS EKS and Google GKE clusters, with NGINX handling load balancing between clouds.

### Components

- **Video Processor Service**: Rust-based service for video transcoding
- **NGINX Load Balancer**: Distributes traffic between cloud providers
- **Kubernetes Deployments**: Running on both AWS EKS and GCP GKE
- **Infrastructure as Code**: Using Terraform for multi-cloud provisioning

## Infrastructure Setup

### Terraform Configuration

The infrastructure is managed using Terraform with separate modules for AWS EKS and GCP GKE:

```hcl
terraform/
├── main.tf         # Main configuration for both clouds
├── modules/
    ├── aws-eks/    # AWS EKS cluster configuration
    └── gcp-gke/    # GCP GKE cluster configuration
```

To deploy the infrastructure:
```bash
terraform init
terraform plan
terraform apply
```

### Docker Containers

The project uses two main containers:

1. **Video Processor**:
   - Rust-based video processing service
   - FFmpeg integration for transcoding
   - Resource-optimized container with multi-stage build

2. **NGINX Load Balancer**:
   - Handles traffic distribution
   - Implements health checks
   - Provides failover capability

### Kubernetes Deployment

Key Kubernetes resources:

1. **Video Processor Deployment**:
   - 3 replicas for high availability
   - Resource limits and requests defined
   - Horizontal scaling capabilities

2. **NGINX Load Balancer**:
   - ConfigMap for NGINX configuration
   - 2 replicas for redundancy
   - Automatic upstream server detection

## Local Development

Use Docker Compose for local development:

```bash
docker-compose up --build
```

## Deployment

1. Deploy infrastructure:
```bash
cd terraform
terraform apply
```

2. Configure kubectl contexts:
```bash
aws eks update-kubeconfig --name video-processing-aws
gcloud container clusters get-credentials video-processing-gcp
```

3. Deploy Kubernetes resources:
```bash
kubectl apply -f k8s/
```

## Monitoring and Scaling

- Kubernetes metrics available through metrics-server
- Horizontal Pod Autoscaling based on CPU/Memory
- Cloud-native monitoring tools integration

## Architecture Benefits

- **High Availability**: Multi-cloud deployment prevents single cloud failure
- **Geographic Distribution**: Lower latency for global users
- **Cost Optimization**: Ability to leverage spot instances and preemptible VMs
- **Scalability**: Independent scaling in each cloud
- **Load Distribution**: Intelligent traffic routing based on load and health

## Security Considerations

- Network isolation using VPC/VNet
- RBAC enabled on Kubernetes clusters
- TLS encryption for inter-service communication
- Container security best practices implemented
