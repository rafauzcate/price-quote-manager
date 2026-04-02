import { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Trash2, CreditCard as Edit, Printer, CheckSquare, Square } from 'lucide-react';
import { PriceComparison } from './PriceComparison';
import { QuoteEditModal } from './QuoteEditModal';
import { printQuotes } from '../lib/printQuotes';

interface LineItem {
  id: string;
  product_code: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  net_price: number;
}

interface Quote {
  id: string;
  reference_name: string;
  reference_number: string;
  generated_part_number: string;
  supplier: string;
  part_description: string;
  price: number;
  created_at: string;
  lead_time: string;
  contact_person: string;
  quote_reference?: string;
  quote_date?: string;
  total_net_amount?: number;
  total_vat_amount?: number;
  order_total?: number;
  supplier_contact_name?: string;
  supplier_email?: string;
  supplier_phone?: string;
  line_items?: LineItem[];
  online_price_found?: number;
  online_price_source?: string;
  online_price_checked_at?: string;
}

interface SearchAreaProps {
  quotes: Quote[];
  onSearch: (searchTerm: string) => void;
  onDeleteQuote: (quoteId: string) => void;
  onQuoteUpdated?: () => void;
  userName?: string;
  userEmail?: string;
  userCompany?: string;
}

export function SearchArea({ quotes, onSearch, onDeleteQuote, onQuoteUpdated, userName, userEmail, userCompany }: SearchAreaProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set());
  const [deletingQuoteId, setDeletingQuoteId] = useState<string | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [selectedQuotes, setSelectedQuotes] = useState<Set<string>>(new Set());

  const allSelected = quotes.length > 0 && quotes.every((q) => selectedQuotes.has(q.id));
  const someSelected = quotes.some((q) => selectedQuotes.has(q.id));

  const toggleSelectQuote = (id: string) => {
    setSelectedQuotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedQuotes(new Set());
    } else {
      setSelectedQuotes(new Set(quotes.map((q) => q.id)));
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, onSearch]);

  const toggleExpand = (quoteId: string) => {
    setExpandedQuotes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(quoteId)) {
        newSet.delete(quoteId);
      } else {
        newSet.add(quoteId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(price);
  };

  const handleDelete = async (quoteId: string) => {
    if (!confirm('Are you sure you want to delete this quote? This action cannot be undone.')) {
      return;
    }
    setDeletingQuoteId(quoteId);
    try {
      await onDeleteQuote(quoteId);
    } finally {
      setDeletingQuoteId(null);
    }
  };

  const handleExport = () => {
    const quotesToPrint = quotes.filter((q) => selectedQuotes.has(q.id));
    printQuotes({
      quotes: quotesToPrint,
      userName: userName || '',
      userEmail: userEmail || '',
      userCompany,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Search Quotes</h2>
        {someSelected && (
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-[#003366] hover:bg-[#002244] text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Export {selectedQuotes.size} Quote{selectedQuotes.size !== 1 ? 's' : ''} to PDF
          </button>
        )}
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Search by reference number, supplier, or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {quotes.length > 0 && (
        <div className="flex items-center gap-3 mb-3 px-1">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-[#003366]" />
            ) : (
              <Square className="w-4 h-4 text-gray-400" />
            )}
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          {someSelected && (
            <span className="text-xs text-gray-400">
              {selectedQuotes.size} of {quotes.length} selected
            </span>
          )}
        </div>
      )}

      <div className="space-y-4">
        {quotes.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No Quotes Yet</h3>
              <p className="text-gray-600 mb-6">
                Upload your first quote document (PDF or Excel) using the upload area above.
                Our AI will automatically extract supplier details, pricing, and line items.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                <p className="text-sm font-medium text-blue-900 mb-2">What happens after upload:</p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Automatic extraction of supplier and pricing data</li>
                  <li>• Organized quote comparison and search</li>
                  <li>• Online price checking for better deals</li>
                  <li>• Expiry tracking to keep quotes current</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          quotes.map((quote) => (
            <div
              key={quote.id}
              className={`border rounded-lg overflow-hidden transition-colors ${
                selectedQuotes.has(quote.id)
                  ? 'border-[#003366] ring-1 ring-[#003366]/30'
                  : 'border-gray-200'
              }`}
            >
              <div className="bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => toggleSelectQuote(quote.id)}
                    className="mr-3 flex-shrink-0 focus:outline-none"
                    title={selectedQuotes.has(quote.id) ? 'Deselect quote' : 'Select quote for export'}
                  >
                    {selectedQuotes.has(quote.id) ? (
                      <CheckSquare className="w-5 h-5 text-[#003366]" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-300 hover:text-gray-500 transition-colors" />
                    )}
                  </button>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Reference Name</p>
                      <p className="text-sm font-semibold text-gray-800">{quote.reference_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Reference Number</p>
                      <p className="text-sm font-semibold text-blue-600">{quote.generated_part_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Supplier</p>
                      <p className="text-sm text-gray-800">{quote.supplier}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Contact</p>
                      <p className="text-sm text-gray-800">{quote.supplier_contact_name || quote.contact_person || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Email/Phone</p>
                      <p className="text-sm text-gray-800 truncate">{quote.supplier_email || quote.supplier_phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Quote Date</p>
                      <p className="text-sm text-gray-800">{quote.quote_date ? formatDate(quote.quote_date) : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Total</p>
                      <p className="text-sm font-medium text-gray-900">{formatPrice(quote.order_total || quote.price)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setEditingQuote(quote)}
                      className="p-2 hover:bg-blue-100 rounded-lg transition-colors group"
                      title="Edit quote"
                    >
                      <Edit className="w-5 h-5 text-blue-600 group-hover:text-blue-700" />
                    </button>
                    <button
                      onClick={() => handleDelete(quote.id)}
                      disabled={deletingQuoteId === quote.id}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                      title="Delete quote"
                    >
                      <Trash2 className="w-5 h-5 text-red-600 group-hover:text-red-700" />
                    </button>
                    <button
                      onClick={() => toggleExpand(quote.id)}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      title={quote.line_items && quote.line_items.length > 0 ? "Show/hide line items" : "No line items available"}
                    >
                      {expandedQuotes.has(quote.id) ? (
                        <ChevronUp className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {expandedQuotes.has(quote.id) && (
                <div className="p-4 bg-white">
                  {quote.line_items && quote.line_items.length > 0 ? (
                    <>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Line Items</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Product Code</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Description</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Quantity</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Unit Price</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Discount %</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Net Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quote.line_items.map((item) => (
                          <tr key={item.id} className="border-b border-gray-100">
                            <td className="px-3 py-2 text-gray-800">{item.product_code || 'N/A'}</td>
                            <td className="px-3 py-2 text-gray-800">{item.description}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{formatPrice(item.unit_price)}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{item.discount_percent}%</td>
                            <td className="px-3 py-2 text-right font-medium text-gray-900">{formatPrice(item.net_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {quote.total_net_amount !== undefined && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-end space-y-1">
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between gap-8">
                            <span className="text-gray-600">Net Amount:</span>
                            <span className="font-medium">{formatPrice(quote.total_net_amount)}</span>
                          </div>
                          <div className="flex justify-between gap-8 pt-1 border-t border-gray-200">
                            <span className="text-gray-800 font-semibold">Total:</span>
                            <span className="font-bold text-blue-600">{formatPrice(quote.order_total || 0)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                      {quote.online_price_found && (
                        <PriceComparison
                          originalPrice={quote.order_total || quote.price}
                          onlinePrice={quote.online_price_found}
                          onlineSource={quote.online_price_source}
                          checkedAt={quote.online_price_checked_at}
                        />
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-2">No line items available for this quote</p>
                      <p className="text-sm text-gray-400">Line items were not extracted when this quote was uploaded. Please delete and re-upload the quote to extract line items.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <QuoteEditModal
        quote={editingQuote}
        isOpen={!!editingQuote}
        onClose={() => setEditingQuote(null)}
        onSave={() => {
          setEditingQuote(null);
          if (onQuoteUpdated) {
            onQuoteUpdated();
          }
        }}
      />
    </div>
  );
}
