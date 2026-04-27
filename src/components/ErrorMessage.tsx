import { AlertCircle, X } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onClose: () => void;
}

export function ErrorMessage({ message, onClose }: ErrorMessageProps) {
  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg shadow-md">
      <div className="flex items-start">
        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-red-800 font-semibold mb-1">Error</h3>
          <p className="text-red-700 text-sm">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-red-500 hover:text-red-700 ml-3 flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
