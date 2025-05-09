import { API_CONFIG } from './config';

export interface UploadResponse {
  taskId: string;
  message: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ProcessingStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  resolutions: {
    [key: string]: {
      status: 'pending' | 'processing' | 'completed' | 'failed';
      url?: string;
    };
  };
  error?: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = {
  async uploadVideo(
    file: File,
    resolutions: string[],
    cloudProvider: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('resolutions', JSON.stringify(resolutions));
    formData.append('cloudProvider', cloudProvider);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPLOAD}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new ApiError(
          response.status,
          `Upload failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Upload failed: Network error');
    }
  },

  async checkStatus(taskId: string): Promise<ProcessingStatus> {
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STATUS}/${taskId}`
      );

      if (!response.ok) {
        throw new ApiError(
          response.status,
          `Status check failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      
      return {
        job_id: data.job_id,
        status: data.status.toLowerCase(),
        progress: calculateProgress(data.conversions),
        resolutions: data.conversions,
        error: data.error
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Status check failed: Network error');
    }
  },

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HEALTH}`);
      return response.ok;
    } catch (error) {
      return false;
    }
  },
};

function calculateProgress(conversions: Record<string, { status: string; progress: number }>): number {
  if (!conversions || Object.keys(conversions).length === 0) return 0;
  
  const totalProgress = Object.values(conversions).reduce((sum, conv) => sum + (conv.progress || 0), 0);
  return totalProgress / Object.keys(conversions).length;
} 