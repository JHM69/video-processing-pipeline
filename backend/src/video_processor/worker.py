import redis
import json
import time
import signal
import sys
import subprocess
import os
import requests
from datetime import datetime, timedelta
from google.cloud import storage
from multiprocessing import Pool, cpu_count

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

# Initialize GCS client with service account
credentials_path = os.path.join(os.path.dirname(__file__), "experiment-456220-328a0f14d44e.json")
storage_client = storage.Client()
BUCKET_NAME = os.getenv('GCS_BUCKET_NAME', 'experiment-456220-videos')
try:
    bucket = storage_client.get_bucket(BUCKET_NAME)
except Exception as e:
    print(f"Error accessing bucket {BUCKET_NAME}: {str(e)}")
    raise Exception(f"Storage configuration error: {str(e)}")

# Use proper temp directory for Windows
TEMP_DIR = os.path.join(os.getenv('TEMP') or os.getenv('TMP') or 'C:\\Windows\\Temp', "video-processor")
os.makedirs(TEMP_DIR, exist_ok=True)
print(f"[DEBUG] Using temp directory: {TEMP_DIR}")

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

def process_video_in_worker(job_id: str, input_path: str, resolution: str) -> dict:
    try:
        print(f"[DEBUG] Starting processing for job {job_id}, resolution {resolution}")
        
        temp_output_path = os.path.join(TEMP_DIR, f"{job_id}_{resolution}.mp4")
        print(f"[DEBUG] Output path: {temp_output_path}")

        target_res = Resolution.from_string(resolution)
        
        # Check if input file exists
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")
        
        # Get video duration
        duration_cmd = [
            'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1', input_path
        ]
        try:
            duration = float(subprocess.check_output(duration_cmd, stderr=subprocess.PIPE).decode().strip())
            print(f"[DEBUG] Video duration: {duration} seconds")
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] Failed to get video duration: {e.stderr.decode()}")
            raise Exception("Failed to get video duration")
        
        # Get input resolution
        probe_cmd = [
            'ffprobe', '-v', 'error', '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height',
            '-of', 'csv=p=0', input_path
        ]
        result = subprocess.run(probe_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"[ERROR] Failed to probe video: {result.stderr}")
            raise Exception(f"Failed to probe video: {result.stderr}")
            
        input_width, input_height = map(int, result.stdout.strip().split(','))
        print(f"[DEBUG] Input resolution: {input_width}x{input_height}")
        print(f"[DEBUG] Target resolution: {target_res.width}x{target_res.height}")

        # Start conversion
        cmd = [
            'ffmpeg', '-i', input_path,
            '-c:v', 'libx264', '-crf', '23',
            '-preset', 'medium',
            '-vf', f'scale={target_res.width}:{target_res.height}',
            '-c:a', 'aac',
            '-progress', 'pipe:1',
            '-loglevel', 'warning',
            '-stats',
            '-y', temp_output_path
        ]
        
        print(f"[DEBUG] Running FFmpeg command: {' '.join(cmd)}")
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            bufsize=1
        )
        
        # Monitor progress
        time_processed = 0
        last_progress_time = time.time()
        progress_update_interval = 2  # Update progress every 2 seconds

        while True:
            stdout_line = process.stdout.readline()
            if stdout_line:
                print(f"[FFMPEG] {stdout_line.strip()}")
                if stdout_line.startswith('out_time='):
                    time_str = stdout_line.split('=')[1].strip()
                    if ':' in time_str:
                        h, m, s = time_str.split(':')
                        time_processed = float(h) * 3600 + float(m) * 60 + float(s)
                        current_time = time.time()
                        if current_time - last_progress_time >= progress_update_interval:
                            progress = min(98, (time_processed / duration) * 100)
                            print(f"[DEBUG] Progress: {progress:.2f}%")
                            update_job_status(job_id, resolution, {
                                "status": "processing",
                                "progress": progress
                            })
                            last_progress_time = current_time

            stderr_line = process.stderr.readline()
            if stderr_line:
                print(f"[FFMPEG ERROR] {stderr_line.strip()}")

            if process.poll() is not None:
                for line in process.stdout.readlines():
                    print(f"[FFMPEG] {line.strip()}")
                for line in process.stderr.readlines():
                    print(f"[FFMPEG ERROR] {line.strip()}")
                break

            time.sleep(0.1)

        if process.returncode == 0:
            if os.path.exists(temp_output_path):
                output_blob = bucket.blob(f"processed/{job_id}/{resolution}.mp4")
                output_blob.upload_from_filename(temp_output_path)
                
                output_blob.metadata = {'auto-delete': 'true'}
                output_blob.update()
                
                signed_url = output_blob.generate_signed_url(
                    version="v4",
                    expiration=timedelta(minutes=5),
                    method="GET"
                )
                
                os.remove(temp_output_path)
                
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
        if 'temp_output_path' in locals() and os.path.exists(temp_output_path):
            os.remove(temp_output_path)
            
        print(f"Error processing {resolution} for job {job_id}: {str(e)}")
        return {
            "status": "failed",
            "progress": 0,
            "error": str(e)
        }

def handle_job(job_id: str):
    print(f"Handling job {job_id}")
    temp_input_path = None
    try:
        job_data = json.loads(redis_client.get(f"job:{job_id}"))
        if not job_data:
            raise Exception(f"No data found for job {job_id}")

        print(f"Starting job {job_id} with data: {json.dumps(job_data, indent=2)}")
        
        job_data['status'] = 'processing'
        redis_client.set(f"job:{job_id}", json.dumps(job_data))
        
        input_url = job_data['job_data']['input_url']
        temp_input_path = os.path.join(TEMP_DIR, f"{job_id}_input.mp4")
        
        if input_url.startswith('http'):
            print(f"[DEBUG] Downloading file from URL: {input_url}")
            try:
                response = requests.get(input_url, stream=True)
                response.raise_for_status()
                with open(temp_input_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                print(f"[DEBUG] Successfully downloaded file to: {temp_input_path}")
                
                if 'gcs_path' in job_data['job_data']:
                    try:
                        source_blob = bucket.blob(job_data['job_data']['gcs_path'])
                        source_blob.delete()
                        print(f"[DEBUG] Deleted source file from GCS: {job_data['job_data']['gcs_path']}")
                    except Exception as e:
                        print(f"[WARNING] Failed to delete source file from GCS: {str(e)}")
            except Exception as e:
                print(f"[ERROR] Failed to download file: {str(e)}")
                raise
        else:
            temp_input_path = input_url
        
        resolutions = job_data['job_data']['resolutions']
        process_params = [(job_id, temp_input_path, resolution) for resolution in resolutions]
        
        n_processes = min(len(resolutions), max(cpu_count() // 2, 1))
        print(f"Processing {len(resolutions)} resolutions using {n_processes} processes")
        
        with Pool(processes=n_processes) as pool:
            results = pool.starmap(process_video_in_worker, process_params)
        
        all_completed = True
        for resolution, result in zip(resolutions, results):
            job_data['conversions'][resolution].update(result)
            if result['status'] != 'completed':
                all_completed = False
            
            redis_client.set(f"job:{job_id}", json.dumps(job_data))
            print(f"Updated status for resolution {resolution}")
        
        job_data['status'] = 'completed' if all_completed else 'failed'
        job_data['completed_at'] = datetime.now().isoformat()
        redis_client.set(f"job:{job_id}", json.dumps(job_data))
        print(f"Completed job {job_id} with status: {job_data['status']}")
        
    except Exception as e:
        print(f"Error handling job {job_id}: {str(e)}")
        try:
            job_data = redis_client.get(f"job:{job_id}")
            if job_data:
                job_info = json.loads(job_data)
                job_info['status'] = 'failed'
                job_info['error'] = str(e)
                redis_client.set(f"job:{job_id}", json.dumps(job_info))
        except Exception as update_error:
            print(f"Error updating failed job status: {str(update_error)}")
    finally:
        if temp_input_path and os.path.exists(temp_input_path):
            try:
                os.remove(temp_input_path)
                print(f"[DEBUG] Cleaned up input file: {temp_input_path}")
            except Exception as e:
                print(f"[WARNING] Failed to clean up input file: {str(e)}")
        
        redis_client.srem("active_jobs", job_id)
        print(f"Removed job {job_id} from active jobs")

def start_worker():
    global redis_client
    redis_client = get_redis_client()
    
    def handle_exit(signum, frame):
        print("Shutting down worker...")
        sys.exit(0)
    
    signal.signal(signal.SIGTERM, handle_exit)
    signal.signal(signal.SIGINT, handle_exit)
    
    print("Worker started and waiting for jobs...")
    
    while True:
        try:
            active_jobs = redis_client.smembers("active_jobs")
            print(f"Checking active jobs: {active_jobs}")
            
            for job_id in active_jobs:
                try:
                    job_data = redis_client.get(f"job:{job_id}")
                    if job_data:
                        job_info = json.loads(job_data)
                        if job_info['status'] == 'pending':
                            print(f"Found pending job in active jobs: {job_id}")
                            handle_job(job_id)
                    else:
                        print(f"Removing stale job {job_id} from active jobs")
                        redis_client.srem("active_jobs", job_id)
                except Exception as e:
                    print(f"Error checking job {job_id}: {str(e)}")
                    redis_client.srem("active_jobs", job_id)
            
            active_count = redis_client.scard("active_jobs")
            queue_length = redis_client.llen("job_queue")
            print(f"Active jobs: {active_count}, Queued jobs: {queue_length}")
            
            if active_count < MAX_CONCURRENT_JOBS:
                job_id = redis_client.rpop("job_queue")
                if job_id:
                    print(f"Starting to process new job: {job_id}")
                    redis_client.sadd("active_jobs", job_id)
                    
                    try:
                        handle_job(job_id)
                        
                        job_data = redis_client.get(f"job:{job_id}")
                        if job_data:
                            job_info = json.loads(job_data)
                            print(f"Job completed. Final status: {json.dumps(job_info, indent=2)}")
                        else:
                            print(f"Warning: No data found for completed job {job_id}")
                    except Exception as e:
                        print(f"Error processing job {job_id}: {str(e)}")
                        redis_client.srem("active_jobs", job_id)
                        
                        try:
                            job_data = redis_client.get(f"job:{job_id}")
                            if job_data:
                                job_info = json.loads(job_data)
                                job_info['status'] = 'failed'
                                job_info['error'] = str(e)
                                redis_client.set(f"job:{job_id}", json.dumps(job_info))
                        except Exception as update_error:
                            print(f"Error updating failed job status: {str(update_error)}")
                else:
                    time.sleep(1)
            else:
                print(f"Maximum concurrent jobs ({MAX_CONCURRENT_JOBS}) reached")
                time.sleep(1)
                
        except Exception as e:
            print(f"Error in worker loop: {str(e)}")
            print(f"Error details: {str(sys.exc_info())}")
            time.sleep(1)

if __name__ == "__main__":
    start_worker()
