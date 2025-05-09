import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { API_CONFIG } from '@/lib/config';

interface Resolution {
  resolution: string;
  status: string;
  progress: number;
  output_url: string | null;
  error: string | null;
}

interface Job {
  job_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  conversions: Record<string, Resolution>;
  job_data: {
    input_url: string;
    resolutions: string[];
    cloud_provider: string;
  };
}

interface JobsListProps {
  onRefresh?: () => void;
}

export const JobsList: React.FC<JobsListProps> = ({ onRefresh }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STATUS}`);
      if (!response.ok) {
        console.error('Failed to fetch jobs:', response.statusText);
        return;
      }
      const data = await response.json();
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-500';
      case 'processing':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handleDownload = (url: string) => {
    window.open(`${API_CONFIG.BASE_URL}${url}`, '_blank');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            No jobs found
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Recent Jobs</h2>
        <Button variant="outline" size="sm" onClick={() => {
          fetchJobs();
          onRefresh?.();
        }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      {jobs.map((job) => (
        <Card key={job.job_id} className="overflow-hidden">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Job #{job.job_id.slice(0, 8)}
                  <Badge className={getStatusColor(job.status)}>
                    {job.status}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Started {formatDistanceToNow(new Date(job.started_at))} ago
                  {job.completed_at && ` • Completed ${formatDistanceToNow(new Date(job.completed_at))} ago`}
                </CardDescription>
              </div>
              <Badge variant="outline">{job.job_data.cloud_provider}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(job.conversions).map(([resolution, data]) => (
                <div key={resolution} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{resolution}</span>
                      <Badge variant="secondary">{data.status}</Badge>
                    </div>
                    {data.output_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(data.output_url!)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    )}
                  </div>
                  <Progress value={data.progress} className="h-2" />
                  {data.error && (
                    <p className="text-sm text-red-500">{data.error}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}; 