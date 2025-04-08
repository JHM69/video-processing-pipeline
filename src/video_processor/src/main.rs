use tokio;
use warp::Filter;
use serde::{Deserialize, Serialize};
use ffmpeg_next as ffmpeg;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Deserialize, Serialize)]
struct VideoJob {
    input_url: String,
    resolutions: Vec<String>,
    job_id: String,
}

#[derive(Debug)]
struct Resolution {
    width: i32,
    height: i32,
}

impl Resolution {
    fn from_string(res: &str) -> Option<Resolution> {
        match res {
            "4K" => Some(Resolution { width: 3840, height: 2160 }),
            "1080p" => Some(Resolution { width: 1920, height: 1080 }),
            "720p" => Some(Resolution { width: 1280, height: 720 }),
            "480p" => Some(Resolution { width: 854, height: 480 }),
            _ => None,
        }
    }
}

#[derive(Debug, Serialize, Clone)]
struct VideoResult {
    resolution: String,
    download_url: String,
    size_bytes: u64,
}

#[derive(Debug, Serialize, Clone)]
struct JobStatus {
    job_id: String,
    status: String, // "processing", "completed", "failed"
    input_url: String,
    results: Vec<VideoResult>,
    error: Option<String>,
}

type JobStore = Arc<RwLock<HashMap<String, JobStatus>>>;

#[tokio::main]
async fn main() {
    ffmpeg::init().unwrap();

    // Initialize job store
    let jobs: JobStore = Arc::new(RwLock::new(HashMap::new()));
    let jobs_clone = jobs.clone();

    // Job submission endpoint
    let process_video = warp::post()
        .and(warp::path("process"))
        .and(warp::body::json())
        .and(with_jobs(jobs.clone()))
        .map(|job: VideoJob, jobs: JobStore| {
            let jobs_clone = jobs.clone();
            tokio::spawn(async move {
                process_video_job(job, jobs_clone).await;
            });
            warp::reply::json(&"Job accepted")
        });

    // Get job status endpoint
    let get_job = warp::get()
        .and(warp::path("jobs"))
        .and(warp::path::param::<String>())
        .and(with_jobs(jobs.clone()))
        .and_then(get_job_status);

    // Get all jobs endpoint
    let list_jobs = warp::get()
        .and(warp::path("jobs"))
        .and(with_jobs(jobs.clone()))
        .and_then(list_all_jobs);

    let routes = process_video
        .or(get_job)
        .or(list_jobs)
        .with(warp::cors().allow_any_origin());

    warp::serve(routes)
        .run(([0, 0, 0, 0], 8080))
        .await;
}

fn with_jobs(jobs: JobStore) -> impl Filter<Extract = (JobStore,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || jobs.clone())
}

async fn get_job_status(job_id: String, jobs: JobStore) -> Result<impl warp::Reply, warp::Rejection> {
    let jobs = jobs.read().await;
    match jobs.get(&job_id) {
        Some(status) => Ok(warp::reply::json(status)),
        None => Err(warp::reject::not_found()),
    }
}

async fn list_all_jobs(jobs: JobStore) -> Result<impl warp::Reply, warp::Rejection> {
    let jobs = jobs.read().await;
    Ok(warp::reply::json(&*jobs))
}

async fn process_video_job(job: VideoJob, jobs: JobStore) {
    let job_id = job.job_id.clone();
    
    // Initialize job status
    {
        let mut jobs = jobs.write().await;
        jobs.insert(job_id.clone(), JobStatus {
            job_id: job_id.clone(),
            status: "processing".to_string(),
            input_url: job.input_url.clone(),
            results: Vec::new(),
            error: None,
        });
    }

    let mut results = Vec::new();
    
    for resolution in job.resolutions {
        let output_path = format!("/tmp/{}_{}_{}.mp4", job.job_id, resolution, chrono::Utc::now().timestamp());
        match convert_video(&job.input_url, &output_path, &resolution) {
            Ok(()) => {
                // Get file size
                if let Ok(metadata) = std::fs::metadata(&output_path) {
                    results.push(VideoResult {
                        resolution: resolution.clone(),
                        download_url: format!("/videos/{}/{}", job_id, resolution),
                        size_bytes: metadata.len(),
                    });
                }
            }
            Err(e) => {
                let mut jobs = jobs.write().await;
                if let Some(status) = jobs.get_mut(&job_id) {
                    status.status = "failed".to_string();
                    status.error = Some(e.to_string());
                }
                return;
            }
        }
    }

    // Update job status with results
    let mut jobs = jobs.write().await;
    if let Some(status) = jobs.get_mut(&job_id) {
        status.status = "completed".to_string();
        status.results = results;
    }
}

fn convert_video(input: &str, output: &str, resolution: &str) -> Result<(), ffmpeg::Error> {
    ffmpeg::init()?;
    
    let mut ictx = ffmpeg::format::input(&input)?;
    let input_stream = ictx.streams().best(ffmpeg::media::Type::Video).unwrap();
    let input_video = input_stream.codec().decoder().video()?;
    
    // Detect input resolution
    let input_width = input_video.width();
    let input_height = input_video.height();
    
    // Get target resolution
    let target_res = Resolution::from_string(resolution)
        .unwrap_or(Resolution { width: 854, height: 480 });
    
    // Skip if target resolution is higher than input
    if target_res.width > input_width || target_res.height > input_height {
        println!("Skipping {} - target resolution higher than source", resolution);
        return Ok(());
    }
    
    let mut octx = ffmpeg::format::output(&output)?;
    
    // Set encoding parameters
    let codec = ffmpeg::encoder::find(ffmpeg::codec::Id::H264).unwrap();
    let mut video_encoder = codec.video()?;
    
    video_encoder.set_width(target_res.width as u32);
    video_encoder.set_height(target_res.height as u32);
    video_encoder.set_format(ffmpeg::format::pixel::Pixel::YUV420P);
    video_encoder.set_time_base((1, 30));
    
    // Set quality parameters
    let mut dict = ffmpeg::Dictionary::new();
    dict.set("crf", "23");  // Constant Rate Factor (18-28 is good range)
    dict.set("preset", "medium");  // Encoding speed preset
    
    let mut output_stream = octx.add_stream()?;
    output_stream.set_parameters(video_encoder.parameters());
    
    octx.write_header()?;
    
    // Setup scaling context
    let mut sws = ffmpeg::software::scaling::Context::get(
        input_video.format(),
        input_width,
        input_height,
        ffmpeg::format::pixel::Pixel::YUV420P,
        target_res.width,
        target_res.height,
        ffmpeg::software::scaling::flag::Flags::BILINEAR,
    )?;
    
    let mut frame_index = 0;
    
    // Process frames
    for (stream, packet) in ictx.packets() {
        if stream.index() == input_stream.index() {
            let mut decoded = ffmpeg::frame::Video::empty();
            if input_video.decode(&packet, &mut decoded).is_ok() {
                let mut scaled_frame = ffmpeg::frame::Video::empty();
                scaled_frame.set_width(target_res.width as u32);
                scaled_frame.set_height(target_res.height as u32);
                scaled_frame.set_format(ffmpeg::format::pixel::Pixel::YUV420P);
                
                sws.run(&decoded, &mut scaled_frame)?;
                scaled_frame.set_pts(Some(frame_index));
                
                let mut encoded = ffmpeg::Packet::empty();
                video_encoder.encode(&scaled_frame, &mut encoded)?;
                if !encoded.is_empty() {
                    encoded.set_stream(0);
                    encoded.write_interleaved(&mut octx)?;
                }
                
                frame_index += 1;
            }
        }
    }
    
    // Flush encoder
    let mut encoded = ffmpeg::Packet::empty();
    video_encoder.send_eof()?;
    while video_encoder.receive_packet(&mut encoded).is_ok() {
        encoded.set_stream(0);
        encoded.write_interleaved(&mut octx)?;
    }
    
    octx.write_trailer()?;
    
    Ok(())
}
