import { useState, useEffect } from 'react';
import { AlertTriangle, X, RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ExpiredQuote {
  id: string;
  reference_name: string;
  supplier: string;
  expires_at: string;
  days_expired: number;
}

interface ExpiredQuotesBannerProps {
  userId: string;
  onRefresh: () => void;
}

export function ExpiredQuotesBanner({ userId, onRefresh }: ExpiredQuotesBannerProps) {
  const [expiredQuotes, setExpiredQuotes] = useState<ExpiredQuote[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isSearchingPrices, setIsSearchingPrices] = useState<string | null>(null);

  useEffect(() => {
    loadExpiredQuotes();
  }, [userId]);

  const loadExpiredQuotes = async () => {
    try {
      const { data, error } = await supabase.rpc('get_expired_quotes');

      if (error) throw error;

      if (data && data.length > 0) {
        setExpiredQuotes(data);
        setIsVisible(true);
      }
    } catch (error) {
      console.error('Failed to load expired quotes:', error);
    }
  };

  const handleDismiss = async () => {
    try {
      const quoteIds = expiredQuotes.map(q => q.id);
      await supabase
        .from('quotes')
        .update({ is_expired_notified: true })
        .in('id', quoteIds);

      setIsVisible(false);
      setExpiredQuotes([]);
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  const handleSearchPrice = async (quoteId: string) => {
    setIsSearchingPrices(quoteId);

    try {
      const { data: quote } = await supabase
        .from('quotes')
        .select('supplier, part_description, generated_part_number')
        .eq('id', quoteId)
        .single();

      if (!quote) return;

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      const { data: result, error: searchError } = await supabase.functions.invoke('search_online_price', {
        body: {
          quote_id: quoteId,
          supplier: quote.supplier,
          part_description: quote.part_description,
          part_number: quote.generated_part_number
        }
      });

      if (!searchError && result?.price_found) {
        onRefresh();
      }

    } catch (error) {
      console.error('Failed to search for price:', error);
    } finally {
      setIsSearchingPrices(null);
    }
  };

  if (!isVisible || expiredQuotes.length === 0) {
    return null;
  }

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-lg shadow-sm">
      <div className="flex items-start">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-semibold text-amber-800">
            {expiredQuotes.length} {expiredQuotes.length === 1 ? 'Quote' : 'Quotes'} May Be Outdated
          </h3>
          <div className="mt-2 text-sm text-amber-700">
            <p className="mb-3">
              The following quotes are more than 6 months old. Prices and availability may have changed.
            </p>
            <div className="space-y-2">
              {expiredQuotes.map((quote) => (
                <div key={quote.id} className="flex items-center justify-between bg-white p-3 rounded border border-amber-200">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {quote.reference_name}
                    </p>
                    <p className="text-xs text-gray-600">
                      Supplier: {quote.supplier} • Expired {quote.days_expired} days ago
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleSearchPrice(quote.id)}
                      disabled={isSearchingPrices === quote.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                    >
                      {isSearchingPrices === quote.id ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-3 h-3" />
                          Search Online
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs">
              Consider contacting suppliers to get updated quotes with current pricing and lead times.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="ml-4 text-amber-600 hover:text-amber-800 flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
