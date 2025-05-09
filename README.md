# Multi-Cloud Video Processing Load Balancer

A distributed video processing system deployed across multiple cloud providers (AWS and GCP) with intelligent load balancing.

## Project Structure

```
video-processing-pipeline/
├── frontend/                 # Next.js frontend application
│   ├── src/                 # Source code
│   │   ├── app/            # Next.js app directory
│   │   ├── components/     # React components
│   │   └── services/       # API services
│   ├── public/             # Static files
│   └── package.json        # Frontend dependencies
│
├── backend/                 # Python backend application
│   ├── src/                # Source code
│   │   └── video_processor/ # Video processing service
│   │       ├── main.py     # Main application
│   │       ├── worker.py   # Worker process
│   │       └── Dockerfile  # Container configuration
│   ├── config/             # Configuration files
│   ├── k8s/               # Kubernetes manifests
│   ├── terraform/         # Infrastructure as Code
│   ├── postman/           # API testing collections
│   ├── scripts/           # Utility scripts
│   └── docker-compose.yml # Local development setup
│
└── README.md              # Project documentation
```

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

## Local Testing

### Prerequisites
- Docker and Docker Compose installed
- Postman for API testing
- FFmpeg installed locally (optional)

### Running Locally

1. Start the services:
```bash
chmod +x scripts/local-setup.sh
./scripts/local-setup.sh
```

2. Import Postman Collection:
   - Open Postman
   - Import `postman/video-processor-api.json`
   - The collection includes three endpoints:
     - POST /process: Submit a video processing job
     - GET /jobs/{job_id}: Get job status
     - GET /jobs: List all jobs

### Example API Calls

1. Submit a video processing job:
```json
POST http://localhost:8080/process
{
  "input_url": "https://example.com/sample.mp4",
  "resolutions": ["1080p", "720p", "480p"],
  "job_id": "test-job-1"
}
```

2. Check job status:
```bash
GET http://localhost:8080/jobs/test-job-1
```

3. List all jobs:
```bash
GET http://localhost:8080/jobs
```

### Testing with Sample Videos
For testing, you can use these public domain test videos:
- http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
- http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4

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

## Credentials Management

### AWS Credentials Setup
1. Create AWS IAM user with appropriate permissions
2. Configure AWS credentials:
```bash
aws configure
# Or manually create credentials file:
mkdir -p ~/.aws
cat > ~/.aws/credentials << EOF
[default]
aws_access_key_id = YOUR_ACCESS_KEY
aws_secret_access_key = YOUR_SECRET_KEY
EOF
```

### GCP Credentials Setup
1. Create a Service Account in GCP Console
2. Download the JSON key file
3. Store it securely:
```bash
mkdir -p credentials
mv path/to/downloaded-key.json credentials/gcp-service-account.json
```

### Terraform Variables
1. Copy the template:
```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
```
2. Edit terraform.tfvars with your credentials

### Kubernetes Secrets
1. Create Kubernetes secrets for both clusters:
```bash
kubectl create secret generic cloud-credentials \
  --from-file=aws-credentials=credentials/aws-credentials \
  --from-file=gcp-credentials=credentials/gcp-service-account.json
```

### Security Best Practices
- Never commit credentials to version control
- Rotate credentials regularly
- Use environment-specific credentials
- Enable audit logging for all credential usage
- Use HashiCorp Vault for production environments

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
