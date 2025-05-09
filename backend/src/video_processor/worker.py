import redis
import json
import time
from concurrent.futures import ProcessPoolExecutor
import signal
import sys
import subprocess
import os
from datetime import datetime, timedelta
from google.cloud import storage

def get_redis_client():
    redis_host = os.getenv('REDIS_HOST', 'localhost')
    redis_port = int(os.getenv('REDIS_PORT', 6379))
    max_retries = 5
    retry_delay = 5  # seconds

    for attempt in range(max_retries):
        try:
            client = redis.Redis(
                host=redis_host,
                port=redis_port,
                decode_responses=True,
                socket_timeout=5
            )
            client.ping()  # Test connection
            print(f"Successfully connected to Redis at {redis_host}:{redis_port}")
            return client
        except redis.ConnectionError as e:
            if attempt < max_retries - 1:
                print(f"Failed to connect to Redis (attempt {attempt + 1}/{max_retries}). Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                raise Exception(f"Could not connect to Redis after {max_retries} attempts: {str(e)}")

redis_client = None
MAX_CONCURRENT_JOBS = 2
process_pool = ProcessPoolExecutor(max_workers=MAX_CONCURRENT_JOBS)

# Initialize GCS client
storage_client = storage.Client()
BUCKET_NAME = os.getenv('GCS_BUCKET_NAME', 'video-processor-storage')
try:
    bucket = storage_client.get_bucket(BUCKET_NAME)
except Exception:
    bucket = storage_client.create_bucket(BUCKET_NAME)

TEMP_DIR = "/tmp/video-processor"
os.makedirs(TEMP_DIR, exist_ok=True)

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
            "480p": Resolution(854, 480),
            "360p": Resolution(640, 360),
            "240p": Resolution(426, 240),
            "144p": Resolution(256, 144)
        }
        return resolutions.get(res, Resolution(854, 480))

def update_job_status(job_id: str, resolution: str, status: dict):
    try:
        job_data = json.loads(redis_client.get(f"job:{job_id}"))
        job_data['conversions'][resolution].update(status)
        
        # Calculate overall progress
        total_progress = sum(conv['progress'] for conv in job_data['conversions'].values())
        job_data['progress'] = total_progress / len(job_data['conversions'])
        
        redis_client.set(f"job:{job_id}", json.dumps(job_data))
        print(f"Updated status for job {job_id}, resolution {resolution}: {status}")
    except Exception as e:
        print(f"Error updating job status: {str(e)}")

def process_video_in_worker(job_id: str, input_url: str, resolution: str) -> dict:
    try:
        print(f"Starting processing for job {job_id}, resolution {resolution}")
        temp_input_path = os.path.join(TEMP_DIR, f"{job_id}_input.mp4")
        temp_output_path = os.path.join(TEMP_DIR, f"{job_id}_{resolution}.mp4")
        
        # Download input file from GCS if it's a GCS URL
        job_data = json.loads(redis_client.get(f"job:{job_id}"))
        if 'gcs_path' in job_data['job_data']:
            input_blob = bucket.blob(job_data['job_data']['gcs_path'])
            input_blob.download_to_filename(temp_input_path)
            input_url = temp_input_path

        target_res = Resolution.from_string(resolution)
        
        # Check if input file exists
        if not os.path.exists(input_url):
            raise FileNotFoundError(f"Input file not found: {input_url}")
        
        # Get video duration
        duration_cmd = [
            'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1', input_url
        ]
        duration = float(subprocess.check_output(duration_cmd).decode().strip())
        
        # Get input resolution
        probe_cmd = [
            'ffprobe', '-v', 'error', '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height',
            '-of', 'csv=p=0', input_url
        ]
        result = subprocess.run(probe_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise Exception(f"Failed to probe video: {result.stderr}")
            
        input_width, input_height = map(int, result.stdout.strip().split(','))
        print(f"Input resolution: {input_width}x{input_height}")
        print(f"Target resolution: {target_res.width}x{target_res.height}")

        # Start conversion
        cmd = [
            'ffmpeg', '-i', input_url,
            '-c:v', 'libx264', '-crf', '23',
            '-preset', 'medium',
            '-vf', f'scale={target_res.width}:{target_res.height}',
            '-c:a', 'aac',
            '-progress', 'pipe:1',
            '-y', temp_output_path
        ]
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True
        )

        # Monitor progress
        time_processed = 0
        while True:
            line = process.stdout.readline()
            if not line and process.poll() is not None:
                break
                
            if line.startswith('out_time='):
                time_str = line.split('=')[1].strip()
                if ':' in time_str:
                    h, m, s = time_str.split(':')
                    time_processed = float(h) * 3600 + float(m) * 60 + float(s)
                    progress = min(98, (time_processed / duration) * 100)
                    update_job_status(job_id, resolution, {
                        "status": "processing",
                        "progress": progress
                    })

        if process.returncode == 0:
            if os.path.exists(temp_output_path):
                # Upload processed file to GCS
                output_blob = bucket.blob(f"processed/{job_id}/{resolution}.mp4")
                output_blob.upload_from_filename(temp_output_path)
                
                # Generate signed URL
                signed_url = output_blob.generate_signed_url(
                    version="v4",
                    expiration=timedelta(days=7),
                    method="GET"
                )
                
                # Clean up temporary files
                os.remove(temp_output_path)
                if os.path.exists(temp_input_path):
                    os.remove(temp_input_path)
                
                result = {
                    "status": "completed",
                    "progress": 100,
                    "output_url": signed_url
                }
                print(f"Successfully processed {resolution} for job {job_id}")
                return result
            else:
                raise Exception("Output file not created")
        else:
            stderr = process.stderr.read()
            raise Exception(f"FFmpeg failed: {stderr}")

    except Exception as e:
        # Clean up temporary files in case of error
        if 'temp_input_path' in locals() and os.path.exists(temp_input_path):
            os.remove(temp_input_path)
        if 'temp_output_path' in locals() and os.path.exists(temp_output_path):
            os.remove(temp_output_path)
            
        print(f"Error processing {resolution} for job {job_id}: {str(e)}")
        return {
            "status": "failed",
            "progress": 0,
            "error": str(e)
        }

def handle_job(job_id: str):
    try:
        print(f"Starting job {job_id}")
        job_data = json.loads(redis_client.get(f"job:{job_id}"))
        job_data['status'] = 'processing'
        redis_client.set(f"job:{job_id}", json.dumps(job_data))
        
        futures = []
        for resolution in job_data['job_data']['resolutions']:
            future = process_pool.submit(
                process_video_in_worker,
                job_id,
                job_data['job_data']['input_url'],
                resolution
            )
            futures.append((resolution, future))
        
        all_completed = True
        for resolution, future in futures:
            try:
                result = future.result(timeout=3600)  # 1 hour timeout
                job_data['conversions'][resolution].update(result)
                if result['status'] != 'completed':
                    all_completed = False
            except Exception as e:
                all_completed = False
                job_data['conversions'][resolution].update({
                    "status": "failed",
                    "progress": 0,
                    "error": str(e)
                })
            
            redis_client.set(f"job:{job_id}", json.dumps(job_data))
        
        # Clean up input file from GCS after processing
        if 'gcs_path' in job_data['job_data']:
            try:
                input_blob = bucket.blob(job_data['job_data']['gcs_path'])
                input_blob.delete()
            except Exception as e:
                print(f"Error deleting input file from GCS: {str(e)}")
        
        job_data['status'] = 'completed' if all_completed else 'failed'
        job_data['completed_at'] = datetime.now().isoformat()
        redis_client.set(f"job:{job_id}", json.dumps(job_data))
        print(f"Completed job {job_id} with status: {job_data['status']}")
        
    except Exception as e:
        print(f"Error handling job {job_id}: {str(e)}")
        try:
            job_data['status'] = 'failed'
            job_data['error'] = str(e)
            redis_client.set(f"job:{job_id}", json.dumps(job_data))
        except:
            pass
    finally:
        redis_client.srem("active_jobs", job_id)

def start_worker():
    global redis_client
    redis_client = get_redis_client()
    
    def handle_exit(signum, frame):
        print("Shutting down worker...")
        process_pool.shutdown()
        sys.exit(0)
    
    signal.signal(signal.SIGTERM, handle_exit)
    signal.signal(signal.SIGINT, handle_exit)
    
    print("Worker started and waiting for jobs...")
    while True:
        try:
            if redis_client.scard("active_jobs") < MAX_CONCURRENT_JOBS:
                job_id = redis_client.rpop("job_queue")
                if job_id:
                    print(f"Found new job: {job_id}")
                    redis_client.sadd("active_jobs", job_id)
                    handle_job(job_id)
            time.sleep(1)
        except Exception as e:
            print(f"Error in worker loop: {str(e)}")
            time.sleep(1)

if __name__ == "__main__":
    start_worker()
