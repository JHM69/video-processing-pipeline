export interface Job {
  id: string;
  status: string;
  name: string;
  createdAt: string;
  provider?: string;
  duration?: string;
  size?: string;
  resolutions?: string[];
  progress?: number;
  error?: string;
} 