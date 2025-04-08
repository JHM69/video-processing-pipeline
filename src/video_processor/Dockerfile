FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m appuser

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create video storage directory
RUN mkdir -p /tmp/videos && \
    chown -R appuser:appuser /app /tmp/videos

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Run the application
CMD ["python", "main.py"]
