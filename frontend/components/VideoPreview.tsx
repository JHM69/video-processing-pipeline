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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Video Preview - {resolution}</DialogTitle>
          <DialogDescription>
            {videoName}
          </DialogDescription>
        </DialogHeader>
        <div className="aspect-video relative bg-black rounded-lg overflow-hidden">
          <video
            src={videoUrl}
            controls
            className="w-full h-full"
            autoPlay
          />
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={handleDownload} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 