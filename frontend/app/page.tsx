"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Video,
  Clock,
  CheckCircle2,
  AlertCircle,
  Cloud,
  ArrowUpCircle,
  BarChart,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadForm } from "@/components/UploadForm";
import { JobList } from "@/components/JobList";
import { CloudStatus } from "@/components/CloudStatus";
import { Job } from "@/lib/types";
import { API_CONFIG } from "@/lib/config";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedResolutions, setSelectedResolutions] = useState<string[]>([
    "1080p",
    "720p",
    "480p",
  ]);
  const [cloudProvider, setCloudProvider] = useState<string>("auto");
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [systemStatus, setSystemStatus] = useState({
    aws: { status: "operational", load: 42 },
    gcp: { status: "operational", load: 65 },
  });
  const [jobs, setJobs] = useState<Job[]>([]);

  // Fetch jobs from backend
  const fetchJobs = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STATUS}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: ${response.statusText}`);
      }
      const data = await response.json();
      // Transform backend job format to frontend format
      const transformedJobs = data.jobs.map((job: any) => ({
        id: job.job_id,
        status: job.status.toLowerCase(),
        name: job.job_data?.input_url?.split('/').pop() || 'Unknown',
        createdAt: job.started_at,
        provider: job.job_data?.cloud_provider || 'auto',
        resolutions: job.job_data?.resolutions || [],
        progress: Object.values(job.conversions).reduce((acc: number, conv: any) => acc + conv.progress, 0) / 
                 Object.keys(job.conversions).length,
        duration: job.completed_at ? 
          new Date(job.completed_at).getTime() - new Date(job.started_at).getTime() : 
          '-',
      }));
      setJobs(transformedJobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to fetch processing jobs');
    }
  };

  useEffect(() => {
    fetchJobs();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsLoading(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('resolutions', JSON.stringify(selectedResolutions));
      formData.append('cloudProvider', cloudProvider);

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPLOAD}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      toast.success("Video processing job submitted successfully!");
      setSelectedFile(null);
      // Fetch updated jobs list
      fetchJobs();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to submit video processing job.");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "processing":
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-orange-500" />;
    }
  };

  const getCloudIcon = (provider?: string) => {
    switch (provider) {
      case "aws":
        return (
          <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
            <Cloud size={14} />
            <span className="text-xs font-semibold">AWS</span>
          </div>
        );
      case "gcp":
        return (
          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
            <Cloud size={14} />
            <span className="text-xs font-semibold">GCP</span>
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "processing":
        return "bg-blue-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-orange-500";
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-l from-gray-200 via-fuchsia-200 to-stone-100">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-8 text-center"
        >
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg mb-4">
            <Video className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Multi-Cloud Video Processing
          </h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-xl">
            Distributed video processing across AWS and GCP with intelligent
            load balancing
          </p>
        </motion.div>

        {/* Cloud Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <CloudStatus systemStatus={systemStatus} />
        </motion.div>

        {/* Main Tabs */}
        <Tabs defaultValue="upload" className="space-y-8">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 p-1 my-4 h-auto bg-gray-100 dark:bg-gray-800 rounded-xl">
            <TabsTrigger
              value="upload"
              className="flex items-center gap-2 py-3 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 rounded-lg"
            >
              <ArrowUpCircle className="h-4 w-4" />
              Upload Video
            </TabsTrigger>
            <TabsTrigger
              value="jobs"
              className="flex items-center gap-2 py-3 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 rounded-lg"
            >
              <BarChart className="h-4 w-4" />
              Processing Jobs
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upload">
            <UploadForm
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              selectedResolutions={selectedResolutions}
              setSelectedResolutions={setSelectedResolutions}
              cloudProvider={cloudProvider}
              setCloudProvider={setCloudProvider}
              isLoading={isLoading}
              uploadProgress={uploadProgress}
              handleSubmit={handleSubmit}
              isDragging={isDragging}
              handleDragOver={handleDragOver}
              handleDragLeave={handleDragLeave}
              handleDrop={handleDrop}
              handleFileChange={handleFileChange}
            />
          </TabsContent>
          <TabsContent value="jobs">
            <JobList
              jobs={jobs}
              getStatusIcon={getStatusIcon}
              getCloudIcon={getCloudIcon}
              getStatusColor={getStatusColor}
            />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
