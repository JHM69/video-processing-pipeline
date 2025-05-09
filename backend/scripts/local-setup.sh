#!/bin/bash

# Create necessary directories
mkdir -p /tmp/videos
mkdir -p credentials

# Build and run using docker-compose
docker-compose build
docker-compose up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 10

echo "Services are ready!"
echo "Video Processor API: http://localhost:8080"
echo "NGINX Load Balancer: http://localhost:80"
