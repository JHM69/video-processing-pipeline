from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from enum import Enum
from google.cloud import storage
from google.cloud.storage.blob import Blob
import os
import time
from datetime import datetime, timedelta
import redis
import json
from multiprocessing import Process
import asyncio
import uuid
import aiofiles

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins during development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Video storage path
UPLOAD_DIR = os.path.abspath("videos")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Maximum number of concurrent jobs
MAX_CONCURRENT_JOBS = 20

# GCS Configuration
BUCKET_NAME = os.getenv('GCS_BUCKET_NAME', 'experiment-456220-videos')
credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', os.path.join(os.path.dirname(__file__), "experiment-456220-328a0f14d44e.json"))

print(f"Using credentials path: {credentials_path}")
print(f"Credentials file exists: {os.path.exists(credentials_path)}")

try:
    # Try to create client from default credentials (works in production with mounted service account)
    print("Attempting to create storage client using default credentials...")
    storage_client = storage.Client()
    print("Successfully created storage client using default credentials")
except Exception as e:
    print(f"Failed to create storage client using default credentials: {str(e)}")
    try:
        # Fallback to explicit credentials file (works in local development)
        print("Attempting to create storage client using service account JSON...")
        storage_client = storage.Client.from_service_account_json(credentials_path)
        print("Successfully created storage client using service account JSON")
    except Exception as e:
        print(f"Error initializing GCS client with service account JSON: {str(e)}")
        raise HTTPException(status_code=500, detail="Storage configuration error")

try:
    print(f"Attempting to access bucket: {BUCKET_NAME}")
    bucket = storage_client.get_bucket(BUCKET_NAME)
    print(f"Successfully accessed bucket: {BUCKET_NAME}")
except Exception as e:
    print(f"Error accessing bucket {BUCKET_NAME}: {str(e)}")
    raise HTTPException(status_code=500, detail="Storage configuration error")

# Temporary storage for upload processing
TEMP_DIR = "/tmp/video-processor"
os.makedirs(TEMP_DIR, exist_ok=True)

def get_redis_client():
    redis_host = os.getenv('REDIS_HOST', 'localhost')
    redis_port = int(os.getenv('REDIS_PORT', 6379))
    max_retries = 5
    retry_delay = 5

    for attempt in range(max_retries):
        try:
            client = redis.Redis(
                host=redis_host,
                port=redis_port,
                decode_responses=True,
                socket_timeout=5
            )
            client.ping()
            print(f"Successfully connected to Redis at {redis_host}:{redis_port}")
            return client
        except redis.ConnectionError as e:
            if attempt < max_retries - 1:
                print(f"Failed to connect to Redis (attempt {attempt + 1}/{max_retries}). Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                raise Exception(f"Could not connect to Redis after {max_retries} attempts: {str(e)}")

redis_client = None

class JobStatus(Enum):
    WAITING = "waiting"
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class ConversionStatus(BaseModel):
    resolution: str
    status: str
    progress: float
    output_url: Optional[str] = None
    error: Optional[str] = None

class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    conversions: Dict[str, ConversionStatus]
    job_data: Optional[dict] = None

class JobsList(BaseModel):
    total: int
    jobs: List[JobStatusResponse]

class VideoJob(BaseModel):
    input_url: str
    resolutions: List[str]
    job_id: str

class Resolution:
    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height

    @staticmethod
    def from_string(res: str) -> 'Resolution':
        resolutions = {
            "4K": Resolution(3840, 2160),
            "1080p": Resolution(1920, 1080),
            "720p": Resolution(1280, 720),
            "480p": Resolution(854, 480)
        }
        return resolutions.get(res, Resolution(854, 480))

# Create a separate process for the worker
def start_worker_process():
    from worker import start_worker
    worker_process = Process(target=start_worker)
    worker_process.start()
    return worker_process

@app.post("/process")
async def process_video(job: VideoJob, background_tasks: BackgroundTasks):
    if redis_client.exists(f"job:{job.job_id}"):
        raise HTTPException(status_code=400, detail="Job ID already exists")
    
    # Initialize conversion status for each resolution
    conversions = {}
    for resolution in job.resolutions:
        conversions[resolution] = {
            "resolution": resolution,
            "status": "waiting",
            "progress": 0
        }
    
    job_status = {
        "job_id": job.job_id,
        "status": JobStatus.WAITING.value,
        "started_at": datetime.now().isoformat(),
        "conversions": conversions,
        "job_data": {
            "input_url": job.input_url,
            "resolutions": job.resolutions,
            "job_id": job.job_id
        }
    }
    
    redis_client.set(f"job:{job.job_id}", json.dumps(job_status))
    redis_client.lpush("job_queue", job.job_id)
    
    return {
        "status": "Job queued",
        "job_id": job.job_id,
        "position": redis_client.llen("job_queue")
    }

@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    try:
        job_data = redis_client.get(f"job:{job_id}")
        if not job_data:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
        
        job_dict = json.loads(job_data)
        
        # Convert string status to enum
        job_dict["status"] = JobStatus(job_dict["status"])
        
        # Parse datetime strings
        job_dict["started_at"] = datetime.fromisoformat(job_dict["started_at"])
        if job_dict.get("completed_at"):
            job_dict["completed_at"] = datetime.fromisoformat(job_dict["completed_at"])
        
        # Ensure conversions are properly formatted
        formatted_conversions = {}
        for res, conv in job_dict.get("conversions", {}).items():
            formatted_conversions[res] = ConversionStatus(
                resolution=res,
                status=conv.get("status", "waiting"),
                progress=float(conv.get("progress", 0)),
                output_url=conv.get("output_url"),
                error=conv.get("error")
            )
        job_dict["conversions"] = formatted_conversions
        
        return JobStatusResponse(**job_dict)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid job data: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving job: {str(e)}")

@app.get("/jobs", response_model=JobsList)
async def list_jobs(skip: int = 0, limit: int = 10):
    try:
        job_keys = redis_client.keys("job:*")
        total_jobs = len(job_keys)
        paginated_keys = job_keys[skip:skip + limit]
        
        jobs_data = []
        for key in paginated_keys:
            try:
                job_data = redis_client.get(key)
                if job_data:
                    job_dict = json.loads(job_data)
                    
                    # Convert string status to enum
                    job_dict["status"] = JobStatus(job_dict["status"])
                    
                    # Parse datetime strings
                    job_dict["started_at"] = datetime.fromisoformat(job_dict["started_at"])
                    if job_dict.get("completed_at"):
                        job_dict["completed_at"] = datetime.fromisoformat(job_dict["completed_at"])
                    
                    # Format conversions
                    formatted_conversions = {}
                    for res, conv in job_dict.get("conversions", {}).items():
                        formatted_conversions[res] = ConversionStatus(
                            resolution=res,
                            status=conv.get("status", "waiting"),
                            progress=float(conv.get("progress", 0)),
                            output_url=conv.get("output_url"),
                            error=conv.get("error")
                        )
                    job_dict["conversions"] = formatted_conversions
                    
                    jobs_data.append(JobStatusResponse(**job_dict))
            except Exception as e:
                print(f"Error processing job {key}: {str(e)}")
                continue
        
        # Sort by started_at in descending order
        jobs_data.sort(key=lambda x: x.started_at, reverse=True)
        
        return JobsList(total=total_jobs, jobs=jobs_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching jobs: {str(e)}")


@app.get("/queue")
async def get_queue_status():
    return {
        "active_jobs": redis_client.scard("active_jobs"),
        "queued_jobs": redis_client.llen("job_queue"),
        "max_concurrent_jobs": MAX_CONCURRENT_JOBS,
        "queue_position": redis_client.lrange("job_queue", 0, -1)
    }

@app.get("/download/{job_id}/{resolution}")
async def download_video(job_id: str, resolution: str):
    job_data = redis_client.get(f"job:{job_id}")
    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_status = json.loads(job_data)
    if resolution not in job_status["conversions"]:
        raise HTTPException(status_code=404, detail="Resolution not found")
    
    if job_status["conversions"][resolution]["status"] != "completed":
        raise HTTPException(status_code=400, detail="Video conversion not completed")
    
    # Generate signed URL for the processed video
    blob_name = f"processed/{job_id}/{resolution}.mp4"
    blob = bucket.blob(blob_name)
    
    if not blob.exists():
        raise HTTPException(status_code=404, detail="Video file not found")
    
    # Generate signed URL with 5-minute expiration
    signed_url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=5),
        method="GET"
    )
    
    # Redirect to the signed URL
    return RedirectResponse(url=signed_url)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/clear-all")
async def clear_all():
    """Stop all jobs and clear storage"""
    try:
        # First stop the worker process
        if hasattr(app.state, 'worker_process'):
            app.state.worker_process.terminate()
            app.state.worker_process.join()
        
        # Clear Redis data
        active_jobs = redis_client.smembers("active_jobs")
        job_keys = redis_client.keys("job:*")
        
        pipe = redis_client.pipeline()
        pipe.delete("job_queue")
        pipe.delete("active_jobs")
        if job_keys:
            pipe.delete(*job_keys)
        pipe.execute()
        
        # Clear video storage safely
        if os.path.exists("/tmp/videos"):
            for file in os.listdir("/tmp/videos"):
                try:
                    file_path = os.path.join("/tmp/videos", file)
                    if os.path.isfile(file_path):
                        os.unlink(file_path)
                except Exception as e:
                    print(f"Error deleting file {file}: {str(e)}")
        
        # Restart worker process
        app.state.worker_process = start_worker_process()
        
        return {
            "status": "success",
            "message": f"Cleared {len(job_keys)} jobs and all associated files",
            "active_jobs_stopped": len(active_jobs),
            "worker_restarted": True
        }
    except Exception as e:
        # Ensure worker is running even if cleanup fails
        if not hasattr(app.state, 'worker_process') or not app.state.worker_process.is_alive():
            app.state.worker_process = start_worker_process()
        raise HTTPException(
            status_code=500,
            detail=f"Error clearing system: {str(e)}"
        )

async def process_next_job():
    """Process jobs from the Redis queue"""
    while True:
        try:
            # Check for active jobs
            active_count = redis_client.scard("active_jobs")
            if active_count >= MAX_CONCURRENT_JOBS:
                await asyncio.sleep(1)
                continue

            # Try to get next job from queue
            job_id = redis_client.rpop("job_queue")
            if not job_id:
                await asyncio.sleep(1)
                continue

            # Update job status
            job_data = redis_client.get(f"job:{job_id}")
            if job_data:
                job_status = json.loads(job_data)
                job_status["status"] = JobStatus.PENDING.value
                redis_client.set(f"job:{job_id}", json.dumps(job_status))
                redis_client.sadd("active_jobs", job_id)

        except Exception as e:
            print(f"Error in process_next_job: {str(e)}")
            await asyncio.sleep(1)
        
        await asyncio.sleep(0.1)  # Prevent CPU overload

@app.on_event("startup")
async def startup_event():
    global redis_client
    redis_client = get_redis_client()
    
    # Ensure temp directory exists
    os.makedirs(TEMP_DIR, exist_ok=True)
    
    # Start worker process
    app.state.worker_process = start_worker_process()
    
    # Start background task for job queue monitoring
    app.state.background_tasks = set()
    task = asyncio.create_task(process_next_job())
    app.state.background_tasks.add(task)
    task.add_done_callback(app.state.background_tasks.discard)
    
    print("Backend startup complete: Redis connected, GCS configured, worker started")

@app.on_event("shutdown")
async def shutdown_event():
    # Clean up background tasks
    if hasattr(app.state, 'background_tasks'):
        for task in app.state.background_tasks:
            task.cancel()
        await asyncio.gather(*app.state.background_tasks, return_exceptions=True)
    # Terminate worker process
    if hasattr(app.state, 'worker_process'):
        app.state.worker_process.terminate()
        app.state.worker_process.join()

@app.post("/upload")
async def upload_video(
    video: UploadFile = File(...),
    resolutions: str = Form(...),
    cloudProvider: str = Form(...)
):
    try:
        # Generate unique filename with original extension
        file_extension = os.path.splitext(video.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        temp_path = os.path.join(TEMP_DIR, unique_filename)

        # Save temporarily
        async with aiofiles.open(temp_path, 'wb') as out_file:
            content = await video.read()
            await out_file.write(content)

        # Upload to GCS
        blob = bucket.blob(f"uploads/{unique_filename}")
        blob.upload_from_filename(temp_path)
        
        # Clean up temp file
        os.remove(temp_path)

        # Generate signed URL for processing
        gcs_url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(hours=24),
            method="GET"
        )

        # Parse resolutions
        resolution_list = json.loads(resolutions)

        # Create job
        job_id = str(uuid.uuid4())
        job_status = {
            "job_id": job_id,
            "status": JobStatus.PENDING.value,
            "started_at": datetime.now().isoformat(),
            "conversions": {
                res: {
                    "resolution": res,
                    "status": "pending",
                    "progress": 0
                } for res in resolution_list
            },
            "job_data": {
                "input_url": gcs_url,
                "gcs_path": f"uploads/{unique_filename}",
                "resolutions": resolution_list,
                "cloud_provider": cloudProvider
            }
        }

        # Store job status in Redis
        redis_client.set(f"job:{job_id}", json.dumps(job_status))
        redis_client.lpush("job_queue", job_id)

        return {
            "taskId": job_id,
            "message": "Video uploaded successfully",
            "status": "pending"
        }

    except Exception as e:
        # Clean up temp file if it exists
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
