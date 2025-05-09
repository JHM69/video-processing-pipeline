import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { CheckCircle2, Upload, RefreshCw, Cloud } from "lucide-react";
import { SUPPORTED_VIDEO_FORMATS, MAX_FILE_SIZE } from "@/lib/config";
import { toast } from "sonner";

interface UploadFormProps {
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  selectedResolutions: string[];
  setSelectedResolutions: (resolutions: string[]) => void;
  cloudProvider: string;
  setCloudProvider: (provider: string) => void;
  isLoading: boolean;
  uploadProgress: number;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isDragging: boolean;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const UploadForm: React.FC<UploadFormProps> = ({
  selectedFile,
  setSelectedFile,
  selectedResolutions,
  setSelectedResolutions,
  cloudProvider,
  setCloudProvider,
  isLoading,
  uploadProgress,
  handleSubmit,
  isDragging,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFileChange,
}) => {
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

  return (
    <Card className="border-2 border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Upload Video</CardTitle>
        <CardDescription className="text-base">
          Upload a video to process it in multiple resolutions across our
          multi-cloud infrastructure
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <Label htmlFor="video" className="text-base">
              Video File
            </Label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ${
                isDragging
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : selectedFile
                  ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                  : "border-gray-300 dark:border-gray-700 hover:border-blue-500"
              }`}
            >
              <Input
                id="video"
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="video"
                className="cursor-pointer flex flex-col items-center gap-4"
              >
                <div
                  className={`p-6 rounded-full ${
                    selectedFile
                      ? "bg-green-100 dark:bg-green-900/30"
                      : "bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  {selectedFile ? (
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                  ) : (
                    <Upload className="h-12 w-12 text-gray-500 dark:text-gray-400" />
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-medium">
                    {selectedFile
                      ? selectedFile.name
                      : "Click to upload or drag and drop"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedFile
                      ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                      : "MP4, MOV, or AVI up to 500MB"}
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <Label htmlFor="resolutions" className="text-base">
              Output Resolutions
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {["4K", "1080p", "720p", "480p", "360p", "240p"].map((res) => (
                <div
                  key={res}
                  className="flex items-center space-x-2"
                >
                  <Checkbox
                    id={res}
                    checked={selectedResolutions.includes(res)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedResolutions([...selectedResolutions, res]);
                      } else {
                        setSelectedResolutions(
                          selectedResolutions.filter((r) => r !== res)
                        );
                      }
                    }}
                  />
                  <Label
                    htmlFor={res}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {res}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Label htmlFor="cloud-provider" className="text-base">
              Cloud Provider
            </Label>
            <Select
              value={cloudProvider}
              onValueChange={setCloudProvider}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a cloud provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Cloud Provider</SelectLabel>
                  <SelectItem value="auto">
                    <div className="flex items-center gap-2">
                      <Cloud className="h-4 w-4" />
                      Auto (Load Balanced)
                    </div>
                  </SelectItem>
                  <SelectItem value="aws">
                    <div className="flex items-center gap-2">
                      <Cloud className="h-4 w-4 text-orange-600" />
                      AWS
                    </div>
                  </SelectItem>
                  <SelectItem value="gcp">
                    <div className="flex items-center gap-2">
                      <Cloud className="h-4 w-4 text-blue-600" />
                      Google Cloud
                    </div>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {isLoading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Uploading...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!selectedFile || selectedResolutions.length === 0 || isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Video
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
