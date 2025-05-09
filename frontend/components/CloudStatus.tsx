import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Server, Gauge } from "lucide-react";

interface CloudStatusProps {
  systemStatus: {
    aws: { status: string; load: number };
    gcp: { status: string; load: number };
  };
}

export const CloudStatus: React.FC<CloudStatusProps> = ({ systemStatus }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
    <Card className="border-2 border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${systemStatus.aws.status === "operational" ? "bg-green-100 dark:bg-green-900/30" : "bg-orange-100 dark:bg-orange-900/30"}`}>
              <Server className={`h-5 w-5 ${systemStatus.aws.status === "operational" ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}`} />
            </div>
            <div>
              <p className="font-semibold">AWS EKS</p>
              <p className="text-sm text-gray-500 capitalize">{systemStatus.aws.status}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium">{systemStatus.aws.load}% load</span>
          </div>
        </div>
      </CardContent>
    </Card>
    <Card className="border-2 border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${systemStatus.gcp.status === "operational" ? "bg-green-100 dark:bg-green-900/30" : "bg-orange-100 dark:bg-orange-900/30"}`}>
              <Server className={`h-5 w-5 ${systemStatus.gcp.status === "operational" ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}`} />
            </div>
            <div>
              <p className="font-semibold">Google GKE</p>
              <p className="text-sm text-gray-500 capitalize">{systemStatus.gcp.status}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium">{systemStatus.gcp.load}% load</span>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
); 