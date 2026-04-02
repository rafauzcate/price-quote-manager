import { useState, useEffect, useCallback } from 'react';
import { UploadArea } from './components/UploadArea';
import { SearchArea } from './components/SearchArea';
import { QuoteSummary } from './components/QuoteSummary';
import { SettingsMenu } from './components/SettingsMenu';
import { ErrorMessage } from './components/ErrorMessage';
import { AuthForm } from './components/AuthForm';
import { Logo } from './components/Logo';
import { UserProfileHeader } from './components/UserProfileHeader';
import { NotesModal } from './components/NotesModal';
import { WarningBanner } from './components/WarningBanner';
import { ExpiredQuotesBanner } from './components/ExpiredQuotesBanner';
import { Footer } from './components/Footer';
import { supabase } from './lib/supabase';
import { generateFileHash, checkDuplicateFile, findSimilarItems, type DuplicateFileWarning, type SimilarItemWarning } from './lib/duplicateDetection';
import { parseQuoteClientSide } from './lib/clientAiParser';
import { calculateTrialStatus, type TrialStatus } from './lib/trialLogic';
import { LogOut } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

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
  expires_at?: string;
  online_price_found?: number;
  online_price_source?: string;
  online_price_checked_at?: string;
}

interface UserProfile {
  id: string;
  name: string;
  company: string;
  last_login: string;
  created_at: string;
  updated_at: string;
  signup_date: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [pendingQuoteId, setPendingQuoteId] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateFileWarning | undefined>();
  const [similarItemsWarning, setSimilarItemsWarning] = useState<SimilarItemWarning | undefined>();
  const [manualMode, setManualMode] = useState(false);

  const fetchQuotes = async () => {
    setIsLoading(true);
    const { data: quotesData, error: quotesError } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });

    if (quotesError) {
      console.error('Error fetching quotes:', quotesError);
      setIsLoading(false);
      return;
    }

    if (quotesData) {
      const quotesWithLineItems = await Promise.all(
        quotesData.map(async (quote) => {
          const { data: lineItems } = await supabase
            .from('quote_line_items')
            .select('*')
            .eq('quote_id', quote.id)
            .order('created_at', { ascending: true });

          return {
            ...quote,
            line_items: lineItems || [],
          };
        })
      );

      setQuotes(quotesWithLineItems);
      setFilteredQuotes(quotesWithLineItems);
    }
    setIsLoading(false);
  };

  const fetchUserProfile = async (userId: string, userEmail: string) => {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profile) {
      setUserProfile(profile);
      const trial = calculateTrialStatus(userEmail, profile.signup_date);
      setTrialStatus(trial);
    } else {
      const { data: newProfile } = await supabase
        .from('user_profiles')
        .insert([{
          id: userId,
          name: '',
          company: '',
          last_login: new Date().toISOString(),
          signup_date: new Date().toISOString()
        }])
        .select()
        .single();

      if (newProfile) {
        setUserProfile(newProfile);
        const trial = calculateTrialStatus(userEmail, newProfile.signup_date);
        setTrialStatus(trial);
      }
    }

    await supabase
      .from('user_profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userId);
  };

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserProfile(session.user.id, session.user.email || '');
      }
      setAuthLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserProfile(session.user.id, session.user.email || '');
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchQuotes();
    }
  }, [user]);

  const handleProcessQuote = async (data: {
    fileContent: string;
    referenceName: string;
    referenceNumber: string;
    file?: File;
    fileName?: string;
  }) => {
    setError(null);
    setDuplicateWarning(undefined);
    setSimilarItemsWarning(undefined);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('Please log in to process quotes.');
        return;
      }

      let fileHash: string | undefined;
      if (data.file) {
        fileHash = await generateFileHash(data.file);
        const dupWarning = await checkDuplicateFile(fileHash);
        if (dupWarning.isDuplicate) {
          setDuplicateWarning(dupWarning);
        }
      }

      const { data: existingQuotes } = await supabase
        .from('quotes')
        .select('quote_date')
        .eq('reference_number', data.referenceNumber)
        .eq('user_id', user.id)
        .order('quote_date', { ascending: true, nullsFirst: false });

      const sequenceNumber = existingQuotes && existingQuotes.length > 0 ? existingQuotes.length + 1 : 1;
      const generatedPartNumber = `${data.referenceNumber}-${String(sequenceNumber).padStart(2, '0')}`;

      // Try AI parsing — first via Edge Function, then client-side fallback
      let parsedData: any = null;
      let aiParsingSucceeded = false;

      if (data.fileContent && data.fileContent !== 'Manual entry - no file uploaded') {
        // Attempt 1: Try the Supabase Edge Function
        try {
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.access_token) {
            const { data: parseResult, error: parseError } = await supabase.functions.invoke('parse_quote', {
              body: { text: data.fileContent },
            });

            if (parseError) {
              console.warn('Edge Function failed, will try client-side parsing:', parseError.message);
            } else if (parseResult?.error) {
              console.warn('Edge Function returned error, will try client-side parsing:', parseResult.error);
            } else if (parseResult) {
              parsedData = parseResult;
              aiParsingSucceeded = true;
            }
          }
        } catch (parseErr) {
          console.warn('Edge Function exception, will try client-side parsing:', parseErr);
        }

        // Attempt 2: Client-side fallback if Edge Function failed
        if (!aiParsingSucceeded) {
          console.log('Attempting client-side AI parsing as fallback...');
          try {
            const clientResult = await parseQuoteClientSide(data.fileContent, user.id);
            if (clientResult.success && clientResult.data) {
              parsedData = clientResult.data;
              aiParsingSucceeded = true;
              console.log('Client-side AI parsing succeeded');
            } else {
              console.warn('Client-side AI parsing failed:', clientResult.error);
              // Show a helpful message but don't block quote creation
              if (clientResult.error?.includes('No OpenAI API key')) {
                setError('AI parsing unavailable — no OpenAI API key configured. Your quote was saved in manual mode. Go to Settings (⚙) to add your API key for automatic parsing.');
              }
            }
          } catch (clientErr) {
            console.warn('Client-side AI parsing exception:', clientErr);
          }
        }
      }

      const newQuote = {
        user_id: user.id,
        reference_name: data.referenceName,
        reference_number: data.referenceNumber,
        generated_part_number: generatedPartNumber,
        supplier: parsedData?.supplier || 'Not specified',
        part_description: 'Not specified',
        price: parsedData?.order_total || 0,
        lead_time: 'Not specified',
        contact_person: parsedData?.supplier_contact_name || 'Not specified',
        quote_reference: parsedData?.quote_reference || 'Not specified',
        quote_date: parsedData?.quote_date || null,
        total_net_amount: parsedData?.total_net_amount || 0,
        total_vat_amount: parsedData?.total_vat_amount || 0,
        order_total: parsedData?.order_total || 0,
        supplier_contact_name: parsedData?.supplier_contact_name || 'Not specified',
        supplier_email: parsedData?.supplier_email || 'Not specified',
        supplier_phone: parsedData?.supplier_phone || 'Not specified',
        file_content: data.fileContent,
        file_hash: fileHash,
        file_name: data.fileName,
        notes: null,
      };

      const { data: insertedQuote, error: insertError } = await supabase
        .from('quotes')
        .insert([newQuote])
        .select()
        .single();

      if (insertError) {
        throw new Error(`Database error: ${insertError.message}`);
      }

      // If AI parsing succeeded and we have line items, insert them
      if (aiParsingSucceeded && parsedData?.line_items?.length > 0 && insertedQuote) {
        const lineItems = parsedData.line_items.map((item: any) => ({
          quote_id: insertedQuote.id,
          product_code: item.product_code || '',
          description: item.description || 'Not specified',
          quantity: typeof item.quantity === 'number' ? item.quantity : 0,
          unit_price: typeof item.unit_price === 'number' ? item.unit_price : 0,
          discount_percent: typeof item.discount_percent === 'number' ? item.discount_percent : 0,
          net_price: typeof item.net_price === 'number' ? item.net_price : 0,
        }));

        const { error: lineItemsError } = await supabase
          .from('quote_line_items')
          .insert(lineItems);

        if (lineItemsError) {
          console.error('Failed to insert line items:', lineItemsError);
        }
      }

      // Set manual mode only if AI parsing failed
      setManualMode(!aiParsingSucceeded);

      if (insertedQuote) {
        setPendingQuoteId(insertedQuote.id);
        setShowNotesModal(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Error processing quote:', err);
      throw err;
    }
  };

  const handleSearch = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) {
      setFilteredQuotes(quotes);
      return;
    }

    const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(word => word.length > 0);

    const filtered = quotes.filter((quote) => {
      const searchableText = [
        quote.reference_name,
        quote.reference_number,
        quote.generated_part_number,
        quote.supplier,
        quote.part_description,
        quote.contact_person,
        quote.notes || '',
        ...(quote.line_items?.map(item => item.description) || [])
      ].join(' ').toLowerCase();

      return searchWords.every(word => searchableText.includes(word));
    });

    setFilteredQuotes(filtered);
  }, [quotes]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setQuotes([]);
    setFilteredQuotes([]);
  };

  const handleDeleteQuote = async (quoteId: string) => {
    try {
      const { error: lineItemsError } = await supabase
        .from('quote_line_items')
        .delete()
        .eq('quote_id', quoteId);

      if (lineItemsError) {
        throw lineItemsError;
      }

      const { error: quoteError } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);

      if (quoteError) {
        throw quoteError;
      }

      await fetchQuotes();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete quote';
      setError(errorMessage);
      console.error('Error deleting quote:', err);
    }
  };

  const handleSaveNotes = async (notes: string) => {
    if (!pendingQuoteId) return;

    try {
      await supabase
        .from('quotes')
        .update({ notes: notes || null })
        .eq('id', pendingQuoteId);

      setPendingQuoteId(null);
      await fetchQuotes();
    } catch (err) {
      console.error('Error saving notes:', err);
    }
  };

  const handleCloseNotesModal = () => {
    setShowNotesModal(false);
    setPendingQuoteId(null);
    fetchQuotes();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuthSuccess={() => {}} />;
  }

  if (trialStatus && !trialStatus.isActive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="mb-6">
            <Logo />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Trial Period Ended
          </h1>
          <p className="text-lg text-gray-700 mb-8 leading-relaxed">
            Your 30-day evaluation period for VantagePM has ended. To continue using our procurement intelligence tools, please contact support at{' '}
            <a
              href="mailto:rafael.uzcategui@gmail.com"
              className="text-blue-600 hover:text-blue-700 font-medium underline"
            >
              rafael.uzcategui@gmail.com
            </a>
          </p>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-medium"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex flex-col">
      <div className="container mx-auto px-4 py-8 flex-grow">
        <div className="flex items-center justify-between mb-8">
          <Logo />
          <div className="flex items-center gap-2">
            <SettingsMenu
              userId={user?.id}
              onApiKeySaved={() => {}}
            />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        <UserProfileHeader
          profile={userProfile}
          userEmail={user.email || ''}
          onProfileUpdate={() => user && fetchUserProfile(user.id)}
        />

        {error && <ErrorMessage message={error} onClose={() => setError(null)} />}

        {manualMode && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">Quote Uploaded</h3>
                <p className="text-sm text-blue-800">
                  Quote uploaded successfully. Please add line items manually by clicking on the quote in the table below.
                </p>
              </div>
              <button
                onClick={() => setManualMode(false)}
                className="flex-shrink-0 text-blue-600 hover:text-blue-800"
                title="Dismiss"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <WarningBanner
          duplicateWarning={duplicateWarning}
          similarItemsWarning={similarItemsWarning}
          onDismiss={() => {
            setDuplicateWarning(undefined);
            setSimilarItemsWarning(undefined);
          }}
        />

        {user && (
          <ExpiredQuotesBanner
            userId={user.id}
            onRefresh={fetchQuotes}
          />
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          <UploadArea
            onProcessQuote={handleProcessQuote}
            existingReferences={quotes.map(q => ({
              name: q.reference_name,
              number: q.reference_number
            }))}
          />
          {isLoading ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-600">Loading quotes...</p>
            </div>
          ) : (
            <QuoteSummary quotes={filteredQuotes} />
          )}
        </div>

        <div>
          {!isLoading && (
            <SearchArea
              quotes={filteredQuotes}
              onSearch={handleSearch}
              onDeleteQuote={handleDeleteQuote}
              onQuoteUpdated={fetchQuotes}
              userName={userProfile?.name}
              userEmail={user.email || ''}
              userCompany={userProfile?.company}
            />
          )}
        </div>

        <NotesModal
          isOpen={showNotesModal}
          onClose={handleCloseNotesModal}
          onSave={handleSaveNotes}
          isManualMode={manualMode}
        />
      </div>

      <Footer />

      {trialStatus && !trialStatus.isAdmin && (
        <div className="fixed bottom-4 left-4 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-gray-700 font-medium">
              Trial: {trialStatus.daysRemaining} {trialStatus.daysRemaining === 1 ? 'day' : 'days'} remaining
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
