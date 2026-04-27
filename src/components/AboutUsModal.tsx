import { X } from 'lucide-react';

interface AboutUsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutUsModal({ isOpen, onClose }: AboutUsModalProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h3 className="text-2xl font-bold text-slate-900">The Vantage Story</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6 text-slate-700 leading-relaxed">
            <div>
              <h4 className="text-xl font-semibold text-slate-900 mb-3">
                About VantagePM
              </h4>
              <p className="mb-4">
                Born from the Front Lines of Project Management.
              </p>
              <p className="mb-4">
                VantagePM wasn't designed in a boardroom; it was built on the desk of a frustrated Project Manager. After years of losing countless hours to the "inbox crawl"—digging through endless email threads, messy PDFs, and fragmented spreadsheets just to find a single supplier price—we knew there had to be a better way.
              </p>
              <p>
                We believe that a Project Manager's true value lies in strategic decision-making and leadership, not manual data entry.
              </p>
            </div>

            <div>
              <h4 className="text-xl font-semibold text-blue-600 mb-3">
                Our Mission
              </h4>
              <p className="mb-4">
                To provide a universal "Strategic Compass" for procurement. By leveraging cutting-edge AI, VantagePM transforms chaotic supplier documents into a clean, searchable, and structured index. Whether you are managing high-value infrastructure, complex tech stacks, or multidisciplinary commercial projects, we give you the "vantage point" you need to master your data and reclaim your time.
              </p>
              <p className="font-semibold text-slate-900">
                Precision. Speed. Clarity. That is the Vantage standard.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
