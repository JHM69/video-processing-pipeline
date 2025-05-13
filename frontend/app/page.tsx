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
import UploadForm from "@/components/UploadForm";
import { JobList } from "@/components/JobList";
import { CloudStatus } from "@/components/CloudStatus";
import { DevelopedByModal } from "@/components/DevelopedByModal";
import { Job } from "@/lib/types";
import { API_CONFIG } from "@/lib/config";

const SUPPORTED_VIDEO_FORMATS = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB in bytes

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
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      } else {
        e.target.value = ''; // Reset the input
      }
    }
  };

  const validateFile = (file: File): boolean => {
    if (!SUPPORTED_VIDEO_FORMATS.includes(file.type)) {
      toast.error('Unsupported file format. Please upload MP4, MOV, or AVI files.');
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size exceeds 500MB limit.');
      return false;
    }

    return true;
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

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPLOAD}`, true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          setUploadProgress(progress);
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          const result = JSON.parse(xhr.responseText);
          toast.success("Video processing job submitted successfully!");
          setSelectedFile(null);
          setUploadProgress(0);
          // Fetch updated jobs list
          fetchJobs();
        } else {
          throw new Error(`Upload failed: ${xhr.statusText}`);
        }
      };

      xhr.onerror = () => {
        throw new Error('Network error occurred during upload');
      };

      xhr.send(formData);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to submit video processing job.");
      setUploadProgress(0);
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
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-12 text-center"
        >
          <motion.div 
            className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl shadow-2xl mb-6 transform hover:scale-105 transition-transform duration-300"
            whileHover={{ rotate: 5 }}
          >
            <Video className="h-12 w-12 text-white" />
          </motion.div>
          <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight">
            Infinite Video Processing
          </h1>
          <p className="text-gray-600 dark:text-gray-300 max-w-xl text-lg leading-relaxed">
            Distributed video processing across AWS and GCP with intelligent
            load balancing and real-time optimization
          </p>
        </motion.div>

        {/* Cloud Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          {/* <CloudStatus systemStatus={systemStatus} /> */}
        </motion.div>

        {/* Main Tabs */}
        <Tabs defaultValue="upload" className="space-y-8">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 p-1.5 my-8 h-auto bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
            <TabsTrigger
              value="upload"
              className="flex items-center gap-2 py-3.5 px-6 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-xl transition-all duration-300 ease-in-out hover:bg-gray-50 dark:hover:bg-gray-700/50 data-[state=active]:shadow-lg data-[state=active]:transform data-[state=active]:scale-105"
            >
              <ArrowUpCircle className="h-5 w-5" />
              <span className="font-medium">Upload Video</span>
            </TabsTrigger>
            <TabsTrigger
              value="jobs"
              className="flex items-center gap-2 py-3.5 px-6 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-xl transition-all duration-300 ease-in-out hover:bg-gray-50 dark:hover:bg-gray-700/50 data-[state=active]:shadow-lg data-[state=active]:transform data-[state=active]:scale-105"
            >
              <BarChart className="h-5 w-5" />
              <span className="font-medium">Processing Jobs</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="mt-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <UploadForm
                selectedFile={selectedFile}
                selectedResolutions={selectedResolutions}
                selectedCloudProvider={cloudProvider}
                isLoading={isLoading}
                uploadProgress={uploadProgress}
                onFileSelect={setSelectedFile}
                onResolutionsChange={setSelectedResolutions}
                onCloudProviderSelect={setCloudProvider}
                onSubmit={handleSubmit}
              />
            </motion.div>
          </TabsContent>
          <TabsContent value="jobs" className="mt-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <JobList
                jobs={jobs}
                getStatusIcon={getStatusIcon}
                getCloudIcon={getCloudIcon}
                getStatusColor={getStatusColor}
              />
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
      <DevelopedByModal />
    </main>
  );
}
