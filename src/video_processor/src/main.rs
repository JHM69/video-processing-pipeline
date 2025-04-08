use tokio;
use warp::Filter;
use serde::{Deserialize, Serialize};
use ffmpeg_next as ffmpeg;

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

#[tokio::main]
async fn main() {
    ffmpeg::init().unwrap();
 
    let process_video = warp::post()
        .and(warp::path("process"))
        .and(warp::body::json())
        .map(|job: VideoJob| {
            tokio::spawn(async move {
                process_video_job(job).await;
            });
            warp::reply::json(&"Job accepted")
        });

    warp::serve(process_video)
        .run(([0, 0, 0, 0], 8080))
        .await;
}

async fn process_video_job(job: VideoJob) {
    for resolution in job.resolutions {
        let output_path = format!("/tmp/{}_{}_{}.mp4", job.job_id, resolution);
        convert_video(&job.input_url, &output_path, &resolution).unwrap();
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
