import { useState } from 'react';
import { X, Save } from 'lucide-react';

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (notes: string) => Promise<void>;
  isManualMode?: boolean;
}

export function NotesModal({ isOpen, onClose, onSave, isManualMode = false }: NotesModalProps) {
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(notes);
      setNotes('');
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    setNotes('');
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={handleSkip}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-800">Add Notes (Optional)</h3>
            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            {isManualMode ? (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900 font-medium mb-2">
                  Quote saved! Add important details here:
                </p>
                <p className="text-sm text-blue-800">
                  Since the quote couldn't be automatically parsed, please add key information like supplier name, part numbers, descriptions, prices, and any other important details. This will make it easier to find and reference later.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-600 mb-4">
                Add any missing information or relevant notes about this quote. This will be searchable later.
              </p>
            )}
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={6}
              placeholder="Enter notes about this quote (e.g., brief description of the parts, delivery requirements, special conditions, etc.)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
            >
              {isSaving ? (
                <>Processing...</>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Notes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
