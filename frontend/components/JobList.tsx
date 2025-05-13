import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AnimatePresence, motion } from "framer-motion";
import { Job } from "@/lib/types";
import { VideoPreview } from "./VideoPreview";
import { Download, Play, Video } from "lucide-react";
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
    <div className="space-y-6">
      {jobs.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit mx-auto mb-6">
            <Video className="h-12 w-12 text-gray-400" />
          </div>
          <p className="text-lg text-gray-500 dark:text-gray-400">No jobs found</p>
        </motion.div>
      ) : (
        <AnimatePresence>
          {jobs.map((job) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="group"
            >
              <Card className="border-2 border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className={`h-1.5 ${getStatusColor(job.status)}`}></div>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <motion.div 
                        className={`p-3 rounded-xl ${
                          job.status === "completed" ? "bg-green-100 dark:bg-green-900/30" : 
                          job.status === "processing" ? "bg-blue-100 dark:bg-blue-900/30" :
                          "bg-red-100 dark:bg-red-900/30"
                        }`}
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                      >
                        {getStatusIcon(job.status)}
                      </motion.div>
                      <div>
                        <div className="flex items-center gap-3">
                          <p className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            {job.id}
                          </p>
                          {job.provider && getCloudIcon(job.provider)}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
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

                  {job.status === "processing" && (
                    <div className="mt-6 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-600 dark:text-gray-300">Processing...</span>
                        <span className="font-semibold">{Math.round(job.progress || 0)}%</span>
                      </div>
                      <Progress value={job.progress || 0} className="h-2" />
                    </div>
                  )}

                  {job.error && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl"
                    >
                      <p className="text-sm text-red-700 dark:text-red-400">{job.error}</p>
                    </motion.div>
                  )}

                  {job.status === "completed" && job.resolutions && job.resolutions.length > 0 && (
                    <div className="mt-6">
                      <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">
                        Available Resolutions:
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {job.resolutions.map((resolution) => (
                          <motion.div
                            key={resolution}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl"
                            whileHover={{ scale: 1.02 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                          >
                            <span className="text-sm font-medium">{resolution}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 hover:bg-gray-200 dark:hover:bg-gray-700"
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
                                className="h-7 w-7 hover:bg-gray-200 dark:hover:bg-gray-700"
                                onClick={() => handleDownload(job.id, resolution, job.name)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </motion.div>
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
          videoName={previewJob.jobId}
        />
      )}
    </div>
  );
}; 