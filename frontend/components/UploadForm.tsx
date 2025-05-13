import React, { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { RESOLUTIONS, CLOUD_PROVIDERS, SUPPORTED_VIDEO_FORMATS, MAX_FILE_SIZE } from "@/lib/constants";

interface UploadFormProps {
  selectedFile: File | null;
  selectedResolutions: string[];
  selectedCloudProvider: string;
  isLoading: boolean;
  uploadProgress: number;
  onFileSelect: (file: File) => void;
  onResolutionsChange: (resolutions: string[]) => void;
  onCloudProviderSelect: (provider: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export default function UploadForm({
  selectedFile,
  selectedResolutions,
  selectedCloudProvider,
  isLoading,
  uploadProgress,
  onFileSelect,
  onResolutionsChange,
  onCloudProviderSelect,
  onSubmit,
}: UploadFormProps) {
  const [isDragging, setIsDragging] = useState(false);

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
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  };

  const validateFile = (file: File): boolean => {
    if (!SUPPORTED_VIDEO_FORMATS.includes(file.type as typeof SUPPORTED_VIDEO_FORMATS[number])) {
      toast.error('Unsupported file format. Please upload MP4, MOV, or AVI files.');
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size exceeds 500MB limit.');
      return false;
    }

    return true;
  };

  const toggleResolution = (resolution: typeof RESOLUTIONS[number]) => {
    if (selectedResolutions.includes(resolution)) {
      onResolutionsChange(selectedResolutions.filter(r => r !== resolution));
    } else {
      onResolutionsChange([...selectedResolutions, resolution]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300"
    >
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Upload Video
        </h2>
        
        <form onSubmit={onSubmit} className="space-y-6">
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50'
                : selectedFile
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Upload video file"
              title="Upload video file"
            />
            <div className="space-y-4">
              <div className="flex justify-center">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center"
                >
                  <svg
                    className="w-8 h-8 text-indigo-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </motion.div>
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-900">
                  {selectedFile ? selectedFile.name : 'Drag and drop your video here'}
                </p>
                <p className="text-sm text-gray-500">
                  {selectedFile
                    ? `Size: ${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                    : 'or click to browse (MP4, MOV, AVI up to 500MB)'}
                </p>
              </div>
            </div>
          </div>

          {uploadProgress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Uploading...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                />
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Output Resolutions
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {RESOLUTIONS.map((resolution) => (
                  <motion.button
                    key={resolution}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleResolution(resolution)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      selectedResolutions.includes(resolution)
                        ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-200'
                        : 'bg-gray-50 text-gray-600 border-2 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {resolution}
                  </motion.button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cloud Provider
              </label>
              <div className="grid grid-cols-2 gap-3">
                {CLOUD_PROVIDERS.map((provider) => (
                  <motion.button
                    key={provider}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onCloudProviderSelect(provider)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      selectedCloudProvider === provider
                        ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-200'
                        : 'bg-gray-50 text-gray-600 border-2 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {provider}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={!selectedFile || isLoading || selectedResolutions.length === 0}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-all duration-200 ${
              !selectedFile || isLoading || selectedResolutions.length === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Uploading...</span>
              </div>
            ) : (
              'Start Processing'
            )}
          </motion.button>
        </form>
      </div>
    </motion.div>
  );
}
