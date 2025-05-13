import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Info } from "lucide-react";

export function DevelopedByModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="fixed bottom-4 right-4 p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 text-white">
          <Info className="h-6 w-6" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-white/95 backdrop-blur-lg dark:bg-gray-900/95">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Developed By
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">
              Infinite Video Processing
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Cloud Computing Lab Project
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                {[
                  { name: "Jahangir Hossain", id: "B190305009" },
                  { name: "Farhan Masud Shohag", id: "B190305043" },
                  { name: "Mashiat Tabassum Khan", id: "B190305046" },
                ].map((student) => (
                  <div
                    key={student.id}
                    className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-lg"
                  >
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      {student.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      ID: {student.id}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
                Supervised by
              </h4>
              <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-700 rounded-lg">
                <p className="font-semibold text-gray-800 dark:text-gray-200">
                  Dr. Md. Abu Layek
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Professor
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Dept. of Computer Science & Engineering
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Jagannath University, Dhaka
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
