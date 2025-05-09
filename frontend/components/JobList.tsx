import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AnimatePresence, motion } from "framer-motion";
import { Job } from "@/lib/types";
import { VideoPreview } from "./VideoPreview";
import { Download, Play } from "lucide-react";
import { API_CONFIG } from "@/lib/config";

interface JobListProps {
  jobs: Job[];
  getStatusIcon: (status: string) => React.ReactNode;
  getCloudIcon: (provider?: string) => React.ReactNode;
  getStatusColor: (status: string) => string;
}

export const JobList: React.FC<JobListProps> = ({ jobs, getStatusIcon, getCloudIcon, getStatusColor }) => {
  const [previewJob, setPreviewJob] = useState<{
    jobId: string;
    resolution: string;
    videoName: string;
  } | null>(null);

  const handleDownload = async (jobId: string, resolution: string, videoName: string) => {
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DOWNLOAD}/${jobId}/${resolution}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'video/mp4',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }
      
      // Get filename from Content-Disposition header if available
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${videoName}_${resolution}.mp4`;
      if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      // You can add a toast notification here if you have one
    }
  };

  return (
    <div className="space-y-4">
      {jobs.length === 0 ? (
        <div className="text-center py-12">
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full w-fit mx-auto mb-4">
            {/* Icon can be passed as a prop if needed */}
          </div>
          <p className="text-gray-500">No jobs found</p>
        </div>
      ) : (
        <AnimatePresence>
          {jobs.map((job) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="group"
            >
              <Card className="border border-gray-100 dark:border-gray-800 hover:border-blue-500 transition-colors overflow-hidden">
                <div className={`h-1 ${getStatusColor(job.status)}`}></div>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${
                        job.status === "completed" ? "bg-green-100 dark:bg-green-900/30" : 
                        job.status === "processing" ? "bg-blue-100 dark:bg-blue-900/30" :
                        "bg-red-100 dark:bg-red-900/30"
                      }`}>
                        {getStatusIcon(job.status)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-base">{job.name}</p>
                          {job.provider && getCloudIcon(job.provider)}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          <span>{new Date(job.createdAt).toLocaleString()}</span>
                          {job.size && <span>• {job.size}</span>}
                          {job.duration && job.duration !== '-' && (
                            <span>• {Math.round(parseInt(job.duration) / 1000)}s</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`px-4 py-2 rounded-full text-sm font-medium capitalize ${
                      job.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : 
                      job.status === "processing" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {job.status}
                    </div>
                  </div>
                  {job.status === "processing" && job.progress !== undefined && (
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Processing...</span>
                        <span>{Math.round(job.progress)}%</span>
                      </div>
                      <Progress value={job.progress} className="h-1" />
                    </div>
                  )}
                  {job.error && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-lg">
                      <p className="text-sm text-red-700 dark:text-red-400">{job.error}</p>
                    </div>
                  )}
                  {job.resolutions && job.resolutions.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-medium text-gray-500 mb-2">Available Resolutions:</div>
                      <div className="flex flex-wrap gap-2">
                        {job.resolutions.map((resolution) => (
                          <div
                            key={resolution}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg"
                          >
                            <span className="text-sm font-medium">{resolution}</span>
                            {job.status === "completed" && (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => setPreviewJob({
                                    jobId: job.id,
                                    resolution,
                                    videoName: job.name,
                                  })}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => handleDownload(job.id, resolution, job.name)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      {previewJob && (
        <VideoPreview
          isOpen={true}
          onClose={() => setPreviewJob(null)}
          jobId={previewJob.jobId}
          resolution={previewJob.resolution}
          videoName={previewJob.videoName}
        />
      )}
    </div>
  );
}; 