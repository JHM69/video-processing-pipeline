export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  ENDPOINTS: {
    UPLOAD: '/upload',
    STATUS: '/jobs',
    HEALTH: '/health',
    DOWNLOAD: '/download',
  },
} as const;

export const SUPPORTED_VIDEO_FORMATS = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB 