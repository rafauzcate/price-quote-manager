import { TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';

interface PriceComparisonProps {
  originalPrice: number;
  onlinePrice: number;
  onlineSource?: string;
  checkedAt?: string;
}

export function PriceComparison({
  originalPrice,
  onlinePrice,
  onlineSource,
  checkedAt
}: PriceComparisonProps) {
  const priceDiff = onlinePrice - originalPrice;
  const percentageDiff = ((priceDiff / originalPrice) * 100).toFixed(1);
  const isHigher = priceDiff > 0;
  const isLower = priceDiff < 0;
  const isSimilar = Math.abs(priceDiff) < (originalPrice * 0.05);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-blue-900">
              Online Price Found
            </span>
            {isLower && <TrendingDown className="w-4 h-4 text-green-600" />}
            {isHigher && <TrendingUp className="w-4 h-4 text-red-600" />}
            {isSimilar && <Minus className="w-4 h-4 text-gray-600" />}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-xs text-gray-600">Original Quote</p>
              <p className="text-lg font-bold text-gray-900">
                {formatPrice(originalPrice)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Current Online</p>
              <p className="text-lg font-bold text-blue-900">
                {formatPrice(onlinePrice)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className={`font-semibold ${
              isLower ? 'text-green-600' :
              isHigher ? 'text-red-600' :
              'text-gray-600'
            }`}>
              {priceDiff > 0 ? '+' : ''}{formatPrice(Math.abs(priceDiff))}
              {' '}({priceDiff > 0 ? '+' : ''}{percentageDiff}%)
            </div>
            {checkedAt && (
              <span className="text-xs text-gray-500">
                Checked: {formatDate(checkedAt)}
              </span>
            )}
          </div>

          {onlineSource && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <a
                href={onlineSource}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                View Source
              </a>
            </div>
          )}

          {isLower && (
            <p className="mt-2 text-xs text-green-700 bg-green-50 p-2 rounded">
              Good news! The current online price is lower than your original quote.
            </p>
          )}
          {isHigher && (
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">
              Note: The current online price is higher than your original quote.
            </p>
          )}
          {isSimilar && (
            <p className="mt-2 text-xs text-gray-700 bg-gray-50 p-2 rounded">
              The current online price is similar to your original quote.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
