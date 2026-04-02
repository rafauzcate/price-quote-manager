import { AlertTriangle, X } from 'lucide-react';
import { DuplicateFileWarning, SimilarItemWarning } from '../lib/duplicateDetection';

interface WarningBannerProps {
  duplicateWarning?: DuplicateFileWarning;
  similarItemsWarning?: SimilarItemWarning;
  onDismiss: () => void;
}

export function WarningBanner({ duplicateWarning, similarItemsWarning, onDismiss }: WarningBannerProps) {
  const hasDuplicate = duplicateWarning?.isDuplicate;
  const hasSimilarItems = similarItemsWarning?.hasSimilarItems;

  if (!hasDuplicate && !hasSimilarItems) {
    return null;
  }

  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-r-lg shadow-sm">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-amber-800">
            Warning: Potential Duplicates Detected
          </h3>

          {hasDuplicate && (
            <div className="mt-2 text-sm text-amber-700">
              <p className="font-semibold">This file has been uploaded before:</p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                {duplicateWarning.existingQuotes.map((quote) => (
                  <li key={quote.id}>
                    {quote.reference_name} - {quote.reference_number} from {quote.supplier}
                    <span className="text-amber-600 ml-2">
                      (uploaded {new Date(quote.created_at).toLocaleDateString()})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasSimilarItems && (
            <div className="mt-3 text-sm text-amber-700">
              <p className="font-semibold">Similar items found in other quotes:</p>
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                {similarItemsWarning.similarItems.map((item, index) => (
                  <div key={index} className="bg-white rounded p-2 border border-amber-200">
                    <p className="font-medium text-amber-900">{item.description}</p>
                    <p className="text-xs text-amber-600 mt-1">
                      Found in: {item.quote_reference_name} - {item.quote_reference_number} ({item.supplier})
                      <span className="ml-2">
                        Qty: {item.quantity} | Price: £{item.unit_price.toFixed(2)}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="ml-3 flex-shrink-0 inline-flex text-amber-400 hover:text-amber-600 focus:outline-none"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
