import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { API_CONFIG } from "@/lib/config";
import { motion } from "framer-motion";

interface VideoPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  resolution: string;
  videoName: string;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  isOpen,
  onClose,
  jobId,
  resolution,
  videoName,
}) => {
  const videoUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DOWNLOAD}/${jobId}/${resolution}`;

  const handleDownload = async () => {
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${videoName}_${resolution}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-2 border-gray-100 dark:border-gray-800 shadow-2xl">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Video Preview - {resolution}
          </DialogTitle>
          <DialogDescription className="text-lg text-gray-600 dark:text-gray-300">
            {videoName}
          </DialogDescription>
        </DialogHeader>
        <motion.div 
          className="aspect-video relative bg-black rounded-2xl overflow-hidden shadow-xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <video
            src={videoUrl}
            controls
            className="w-full h-full"
            autoPlay
          />
        </motion.div>
        <div className="flex justify-end mt-6">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button 
              onClick={handleDownload} 
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Download className="h-5 w-5" />
              Download
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 