import { FileText, TrendingUp, Hash, PoundSterling } from 'lucide-react';

interface Quote {
  reference_name: string;
  reference_number: string;
  order_total?: number;
  price: number;
}

interface QuoteSummaryProps {
  quotes: Quote[];
}

interface ReferenceSummary {
  referenceName: string;
  referenceNumber: string;
  count: number;
  totalValue: number;
}

export function QuoteSummary({ quotes }: QuoteSummaryProps) {
  const summaryMap = new Map<string, ReferenceSummary>();

  quotes.forEach((quote) => {
    const key = `${quote.reference_name}|||${quote.reference_number}`;
    const existing = summaryMap.get(key);
    const value = quote.order_total || quote.price;

    if (existing) {
      existing.count += 1;
      existing.totalValue += value;
    } else {
      summaryMap.set(key, {
        referenceName: quote.reference_name,
        referenceNumber: quote.reference_number,
        count: 1,
        totalValue: value,
      });
    }
  });

  const summaries = Array.from(summaryMap.values()).sort((a, b) =>
    a.referenceName.localeCompare(b.referenceName) || a.referenceNumber.localeCompare(b.referenceNumber)
  );

  const totalQuotes = quotes.length;
  const totalReferences = summaries.length;
  const totalValue = quotes.reduce((sum, quote) => sum + (quote.order_total || quote.price), 0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(price);
  };

  if (quotes.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
        <FileText className="w-6 h-6" />
        Quote Summary
      </h2>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Hash className="w-5 h-5" />
            <span className="text-sm font-medium">Total Quotes</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">{totalQuotes}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">References</span>
          </div>
          <p className="text-2xl font-bold text-green-900">{totalReferences}</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <PoundSterling className="w-5 h-5" />
            <span className="text-sm font-medium">Total Value</span>
          </div>
          <p className="text-xl font-bold text-amber-900">{formatPrice(totalValue)}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Reference Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Reference Number</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Quotes</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total Value</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary, index) => (
              <tr
                key={`${summary.referenceName}-${summary.referenceNumber}`}
                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                  {summary.referenceName}
                </td>
                <td className="px-4 py-3 text-sm text-blue-600 font-medium">
                  {summary.referenceNumber}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 text-center">
                  <span className="inline-flex items-center justify-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
                    {summary.count}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-800 font-semibold text-right">
                  {formatPrice(summary.totalValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
