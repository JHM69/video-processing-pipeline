export const RESOLUTIONS = ['4K', '1080p', '720p', '480p', '360p', '240p'] as const;
export const CLOUD_PROVIDERS = ['Auto', 'AWS', 'GCP'] as const;
export const SUPPORTED_VIDEO_FORMATS = ['video/mp4', 'video/quicktime', 'video/x-msvideo'] as const;
export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB in bytes 