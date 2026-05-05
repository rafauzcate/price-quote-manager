import { Command } from 'cmdk';
import { FileSearch, FileText, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { quoteStatus } from '../../lib/format';
import { isSuperAdmin } from '../../lib/subscription';
import { supabase } from '../../lib/supabase';
import { useUiState } from '../../hooks/useUiState';

type NavigationRoute = {
  label: string;
  path: string;
};

type PaletteQuote = {
  id: string;
  reference_name: string;
  reference_number: string;
  supplier: string;
  notes: string | null;
  expires_at: string | null;
};

type QuoteSearchResult = {
  quote: PaletteQuote;
  score: number;
  matchedInNotes: boolean;
  noteMatchIndex: number;
};

const baseRoutes: NavigationRoute[] = [
  { label: 'Dashboard', path: '/app/dashboard' },
  { label: 'Quotes', path: '/app/quotes' },
  { label: 'Suppliers', path: '/app/suppliers' },
  { label: 'Analytics', path: '/app/analytics' },
  { label: 'Organization', path: '/app/organization' },
  { label: 'Settings', path: '/app/settings' },
];

const QUOTE_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_DEBOUNCE_MS = 300;

let quoteCache: {
  userId: string;
  fetchedAt: number;
  quotes: PaletteQuote[];
} | null = null;

function normalizeText(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function includesQuery(haystack: string, query: string): boolean {
  if (!query) return true;
  return normalizeText(haystack).includes(normalizeText(query));
}

function highlightMatch(text: string, query: string) {
  if (!query) return text;

  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);
  const index = normalizedText.indexOf(normalizedQuery);

  if (index < 0) return text;

  const matched = text.slice(index, index + query.length);
  const before = text.slice(0, index);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <span className="rounded bg-gold-100 px-0.5 text-navy-950">{matched}</span>
      {after}
    </>
  );
}

function getNoteSnippet(note: string, query: string): { snippet: string; matchIndex: number } {
  const cleanNote = note.replace(/\s+/g, ' ').trim();
  if (!cleanNote) return { snippet: '', matchIndex: -1 };

  const normalizedNote = normalizeText(cleanNote);
  const normalizedQuery = normalizeText(query);
  const matchIndex = normalizedQuery ? normalizedNote.indexOf(normalizedQuery) : -1;

  if (matchIndex < 0) {
    return { snippet: cleanNote.slice(0, 100), matchIndex: -1 };
  }

  const start = Math.max(0, matchIndex - 35);
  const end = Math.min(cleanNote.length, matchIndex + normalizedQuery.length + 55);
  const snippet = `${start > 0 ? '…' : ''}${cleanNote.slice(start, end)}${end < cleanNote.length ? '…' : ''}`;

  return { snippet, matchIndex: matchIndex - start + (start > 0 ? 1 : 0) };
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function getQuoteScore(quote: PaletteQuote, query: string): QuoteSearchResult | null {
  const normalizedQuery = normalizeText(query);
  const referenceName = normalizeText(quote.reference_name || '');
  const referenceNumber = normalizeText(quote.reference_number || '');
  const supplier = normalizeText(quote.supplier || '');
  const status = normalizeText(quoteStatus(quote.expires_at));
  const notes = normalizeText(quote.notes || '');

  if (!normalizedQuery) {
    return { quote, score: 0, matchedInNotes: false, noteMatchIndex: -1 };
  }

  const startsWithReferenceNumber = referenceNumber.startsWith(normalizedQuery);
  const startsWithReferenceName = referenceName.startsWith(normalizedQuery);
  const inReferenceNumber = referenceNumber.includes(normalizedQuery);
  const inReferenceName = referenceName.includes(normalizedQuery);
  const inSupplier = supplier.includes(normalizedQuery);
  const inStatus = status.includes(normalizedQuery);
  const inNotes = notes.includes(normalizedQuery);

  if (!inReferenceName && !inReferenceNumber && !inSupplier && !inStatus && !inNotes) {
    return null;
  }

  let score = 0;
  if (startsWithReferenceNumber) score += 120;
  else if (inReferenceNumber) score += 90;

  if (startsWithReferenceName) score += 110;
  else if (inReferenceName) score += 80;

  if (inSupplier) score += 60;
  if (inStatus) score += 30;
  if (inNotes) score += 70;

  return {
    quote,
    score,
    matchedInNotes: inNotes,
    noteMatchIndex: inNotes ? notes.indexOf(normalizedQuery) : -1,
  };
}

export function CommandPalette() {
  const { commandOpen, setCommandOpen } = useUiState();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  const [quotes, setQuotes] = useState<PaletteQuote[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [quoteLoadError, setQuoteLoadError] = useState<string | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [setCommandOpen]);

  useEffect(() => {
    if (!commandOpen) {
      setSearchQuery('');
      return;
    }

    let cancelled = false;

    const loadQuotes = async () => {
      setQuoteLoadError(null);
      setIsLoadingQuotes(true);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          if (!cancelled) {
            setQuotes([]);
            setIsSuperadmin(false);
          }
          return;
        }

        if (!cancelled) {
          setIsSuperadmin(isSuperAdmin(user.email));
        }

        if (quoteCache && quoteCache.userId === user.id && Date.now() - quoteCache.fetchedAt < QUOTE_CACHE_TTL_MS) {
          if (!cancelled) {
            setQuotes(quoteCache.quotes);
          }
          return;
        }

        const { data, error } = await supabase
          .from('quotes')
          .select('id, reference_name, reference_number, supplier, notes, expires_at')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        const sanitized = (data || []).map((item) => ({
          id: item.id,
          reference_name: item.reference_name || 'Untitled quote',
          reference_number: item.reference_number || '-',
          supplier: item.supplier || 'Unknown supplier',
          notes: item.notes,
          expires_at: item.expires_at,
        })) as PaletteQuote[];

        quoteCache = {
          userId: user.id,
          fetchedAt: Date.now(),
          quotes: sanitized,
        };

        if (!cancelled) {
          setQuotes(sanitized);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unable to load quotes';
          setQuoteLoadError(message);
          setQuotes([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingQuotes(false);
        }
      }
    };

    void loadQuotes();

    return () => {
      cancelled = true;
    };
  }, [commandOpen]);

  const navigationResults = useMemo(() => {
    const routes = isSuperadmin ? [...baseRoutes, { label: 'Admin Dashboard', path: '/app/admin' }] : baseRoutes;
    if (!debouncedQuery) return routes.slice(0, 10);
    return routes.filter((route) => includesQuery(route.label, debouncedQuery)).slice(0, 10);
  }, [debouncedQuery, isSuperadmin]);

  const quoteResults = useMemo(() => {
    const scored = quotes
      .map((quote) => getQuoteScore(quote, debouncedQuery))
      .filter((result): result is QuoteSearchResult => Boolean(result))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return scored;
  }, [debouncedQuery, quotes]);

  const supplierResults = useMemo(() => {
    const normalizedQuery = normalizeText(debouncedQuery);
    const suppliers = Array.from(new Set(quotes.map((quote) => quote.supplier).filter(Boolean))).filter((supplier) =>
      normalizedQuery ? normalizeText(supplier).includes(normalizedQuery) : true,
    );

    return suppliers.slice(0, 10);
  }, [debouncedQuery, quotes]);

  const hasAnyResults = navigationResults.length > 0 || quoteResults.length > 0 || supplierResults.length > 0;

  if (!commandOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-navy-950/70 p-4 backdrop-blur-sm" onClick={() => setCommandOpen(false)}>
      <Command
        shouldFilter={false}
        value={searchQuery}
        onValueChange={setSearchQuery}
        className="mx-auto mt-20 max-w-2xl overflow-hidden rounded-2xl border border-slatePremium-200 bg-white shadow-premium"
        label="Command Palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slatePremium-200">
          <Command.Input
            autoFocus
            className="w-full bg-transparent px-4 py-4 text-sm outline-none"
            placeholder="Search quotes, references, notes..."
          />
        </div>

        <Command.List className="max-h-[28rem] overflow-y-auto p-2">
          {isLoadingQuotes ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-slatePremium-500">
              <Loader2 size={16} className="animate-spin" />
              Loading quotes…
            </div>
          ) : null}

          {quoteLoadError ? <div className="px-3 py-3 text-xs text-red-600">Unable to load quotes: {quoteLoadError}</div> : null}

          <Command.Empty className="px-3 py-6 text-sm text-slatePremium-500">No results found.</Command.Empty>

          {!isLoadingQuotes && hasAnyResults ? (
            <>
              {navigationResults.length > 0 ? (
                <Command.Group heading="Navigation" className="px-2 py-1 text-xs text-slatePremium-500">
                  {navigationResults.map((route) => (
                    <Command.Item
                      key={route.path}
                      value={`nav-${route.label}`}
                      className="cursor-pointer rounded-lg px-3 py-2 text-sm data-[selected=true]:bg-slatePremium-100"
                      onSelect={() => {
                        navigate(route.path);
                        setCommandOpen(false);
                      }}
                    >
                      {highlightMatch(route.label, debouncedQuery)}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}

              {quoteResults.length > 0 ? (
                <Command.Group heading="Quotes" className="px-2 py-1 text-xs text-slatePremium-500">
                  {quoteResults.map(({ quote, matchedInNotes }) => {
                    const status = quoteStatus(quote.expires_at);
                    const noteSnippet = matchedInNotes && quote.notes ? getNoteSnippet(quote.notes, debouncedQuery) : null;

                    return (
                      <Command.Item
                        key={quote.id}
                        value={`quote-${quote.id}`}
                        className="cursor-pointer rounded-lg px-3 py-2 data-[selected=true]:bg-slatePremium-100"
                        onSelect={() => {
                          navigate(`/app/quotes?quoteId=${encodeURIComponent(quote.id)}&focus=1`);
                          setCommandOpen(false);
                        }}
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slatePremium-900">
                            {highlightMatch(quote.reference_name, debouncedQuery)} - {highlightMatch(quote.supplier, debouncedQuery)} - {highlightMatch(status, debouncedQuery)}
                          </p>
                          <p className="text-xs text-slatePremium-500">{highlightMatch(quote.reference_number, debouncedQuery)}</p>
                          {noteSnippet ? (
                            <p className="flex items-start gap-1 text-xs text-slatePremium-600">
                              <FileText size={12} className="mt-0.5 text-navy-700" />
                              <span>
                                <span className="font-medium text-navy-800">Notes match:</span> {highlightMatch(noteSnippet.snippet, debouncedQuery)}
                              </span>
                            </p>
                          ) : null}
                        </div>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ) : null}

              {supplierResults.length > 0 ? (
                <Command.Group heading="Suppliers" className="px-2 py-1 text-xs text-slatePremium-500">
                  {supplierResults.map((supplier) => (
                    <Command.Item
                      key={`supplier-${supplier}`}
                      value={`supplier-${supplier}`}
                      className="cursor-pointer rounded-lg px-3 py-2 text-sm data-[selected=true]:bg-slatePremium-100"
                      onSelect={() => {
                        navigate(`/app/suppliers?search=${encodeURIComponent(supplier)}&supplier=${encodeURIComponent(supplier)}`);
                        setCommandOpen(false);
                      }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <FileSearch size={14} className="text-slatePremium-500" />
                        {highlightMatch(supplier, debouncedQuery)}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
            </>
          ) : null}
        </Command.List>
      </Command>
    </div>
  );
}
