FROM rust:1.70 as builder

# Install FFmpeg dependencies
RUN apt-get update && apt-get install -y \
    libavcodec-dev \
    libavformat-dev \
    libavfilter-dev \
    libavdevice-dev \
    pkg-config

WORKDIR /usr/src/app
COPY . .
RUN cargo build --release

FROM debian:bullseye-slim

# Install runtime FFmpeg dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libavcodec58 \
    libavformat58 \
    libavfilter7 \
    libavdevice58 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/target/release/video_processor /usr/local/bin/

EXPOSE 8080
CMD ["video_processor"]
