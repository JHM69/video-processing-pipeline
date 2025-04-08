import redis
import json
import time
from concurrent.futures import ProcessPoolExecutor
import signal
import sys
import subprocess
import os

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

def process_video_in_worker(job_id: str, input_url: str, resolution: str) -> dict:
    try:
        output_path = f"/tmp/videos/{job_id}_{resolution}.mp4"
        os.makedirs("/tmp/videos", exist_ok=True)
        target_res = Resolution.from_string(resolution)
        
        probe_cmd = [
            'ffprobe', '-v', 'error', '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height',
            '-of', 'csv=p=0', input_url
        ]
        result = subprocess.run(probe_cmd, capture_output=True, text=True)
        input_width, input_height = map(int, result.stdout.strip().split(','))

        if target_res.width > input_width or target_res.height > input_height:
            return {
                "status": "skipped",
                "progress": 100,
                "error": "Target resolution higher than source"
            }

        cmd = [
            'ffmpeg', '-i', input_url,
            '-c:v', 'libx264', '-crf', '23',
            '-preset', 'medium',
            '-vf', f'scale={target_res.width}:{target_res.height}',
            '-c:a', 'aac',
            '-progress', 'pipe:1',
            '-y', output_path
        ]
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True
        )

        progress = 0
        while True:
            line = process.stdout.readline()
            if not line and process.poll() is not None:
                break
            if line.startswith('out_time_ms='):
                progress += 2
                if progress > 98:
                    progress = 98

        if process.returncode == 0:
            return {
                "status": "completed",
                "progress": 100,
                "output_url": f"/download/{job_id}/{resolution}"
            }
        else:
            raise Exception(f"FFmpeg failed with return code {process.returncode}")

    except Exception as e:
        return {
            "status": "failed",
            "progress": 0,
            "error": str(e)
        }

def handle_job(job_id: str):
    try:
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
        
        for resolution, future in futures:
            result = future.result()
            job_data['conversions'][resolution] = result
            redis_client.set(f"job:{job_id}", json.dumps(job_data))
        
        job_data['status'] = 'completed'
        job_data['completed_at'] = time.strftime('%Y-%m-%d %H:%M:%S')
        redis_client.set(f"job:{job_id}", json.dumps(job_data))
        
    except Exception as e:
        job_data['status'] = 'failed'
        job_data['error'] = str(e)
        redis_client.set(f"job:{job_id}", json.dumps(job_data))
    finally:
        redis_client.srem("active_jobs", job_id)

def start_worker():
    global redis_client
    redis_client = get_redis_client()
    
    def handle_exit(signum, frame):
        process_pool.shutdown()
        sys.exit(0)
    
    signal.signal(signal.SIGTERM, handle_exit)
    signal.signal(signal.SIGINT, handle_exit)
    
    while True:
        if redis_client.scard("active_jobs") < MAX_CONCURRENT_JOBS:
            job_id = redis_client.rpop("job_queue")
            if job_id:
                redis_client.sadd("active_jobs", job_id)
                handle_job(job_id)
        time.sleep(1)

if __name__ == "__main__":
    start_worker()
