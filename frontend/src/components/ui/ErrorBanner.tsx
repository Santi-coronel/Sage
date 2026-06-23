import { AlertCircle } from "lucide-react";

export function ErrorBanner({ message, className = "" }: { message: string; className?: string }) {
  return (
    <div
      role="alert"
      className={`flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm ${className}`}
    >
      <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      {message}
    </div>
  );
}
