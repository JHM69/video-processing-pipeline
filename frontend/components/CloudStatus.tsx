import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Server, Gauge } from "lucide-react";
import { motion } from "framer-motion";

interface CloudStatusProps {
  systemStatus: {
    aws: { status: string; load: number };
    gcp: { status: string; load: number };
  };
}

export const CloudStatus: React.FC<CloudStatusProps> = ({ systemStatus }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="border-2 border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div 
                className={`p-3 rounded-xl ${
                  systemStatus.aws.status === "operational" 
                    ? "bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20" 
                    : "bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-800/20"
                }`}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Server className={`h-6 w-6 ${
                  systemStatus.aws.status === "operational" 
                    ? "text-green-600 dark:text-green-400" 
                    : "text-orange-600 dark:text-orange-400"
                }`} />
              </motion.div>
              <div>
                <p className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  AWS EKS
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                  {systemStatus.aws.status}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Gauge className="h-5 w-5 text-gray-400" />
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold">{systemStatus.aws.load}%</span>
                <span className="text-xs text-gray-500">load</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="border-2 border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div 
                className={`p-3 rounded-xl ${
                  systemStatus.gcp.status === "operational" 
                    ? "bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20" 
                    : "bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-800/20"
                }`}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Server className={`h-6 w-6 ${
                  systemStatus.gcp.status === "operational" 
                    ? "text-green-600 dark:text-green-400" 
                    : "text-orange-600 dark:text-orange-400"
                }`} />
              </motion.div>
              <div>
                <p className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Google GKE
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                  {systemStatus.gcp.status}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Gauge className="h-5 w-5 text-gray-400" />
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold">{systemStatus.gcp.load}%</span>
                <span className="text-xs text-gray-500">load</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  </div>
); 