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
import { SubscriptionGate } from './components/SubscriptionGate';
import { Pricing } from './pages/Pricing';
import { AdminDashboard } from './pages/AdminDashboard';
import { OrganizationSettings } from './pages/OrganizationSettings';
import { supabase } from './lib/supabase';
import {
  generateFileHash,
  checkDuplicateFile,
  type DuplicateFileWarning,
  type SimilarItemWarning,
} from './lib/duplicateDetection';
import { fetchSubscriptionStatus, type SubscriptionStatusResponse } from './lib/subscription';
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
  notes?: string | null;
}

interface UserProfile {
  id: string;
  name: string;
  company: string;
  last_login: string;
  created_at: string;
  updated_at: string;
  signup_date: string;
  trial_ends_at?: string | null;
  subscription_status?: string;
  is_superadmin?: boolean;
  organization_id?: string | null;
}

type PageView = 'dashboard' | 'pricing' | 'admin' | 'organization';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatusResponse | null>(null);
  const [currentPage, setCurrentPage] = useState<PageView>('dashboard');

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [pendingQuoteId, setPendingQuoteId] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateFileWarning | undefined>();
  const [similarItemsWarning, setSimilarItemsWarning] = useState<SimilarItemWarning | undefined>();
  const [manualMode, setManualMode] = useState(false);

  const refreshSubscriptionStatus = useCallback(async (profile?: UserProfile | null) => {
    if (!user) {
      setSubscriptionStatus(null);
      setSubscriptionLoading(false);
      return;
    }

    setSubscriptionLoading(true);

    try {
      const status = await fetchSubscriptionStatus();
      setSubscriptionStatus(status);

      if (!status.has_access && !status.is_superadmin) {
        setCurrentPage('pricing');
      }
    } catch (err) {
      console.warn('Unable to fetch subscription status, using local fallback:', err);
      const trialDate = profile?.trial_ends_at || profile?.signup_date;
      const daysLeft = trialDate
        ? Math.max(0, Math.ceil((new Date(trialDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 14;

      const fallback: SubscriptionStatusResponse = {
        has_access: daysLeft > 0,
        access_reason: daysLeft > 0 ? 'local_trial_fallback' : 'no_access',
        is_superadmin: !!profile?.is_superadmin,
        profile: {
          subscription_status: profile?.subscription_status || 'trialing',
          trial_ends_at: profile?.trial_ends_at || null,
          organization_id: profile?.organization_id || null,
        },
        subscription: null,
        permissions: {
          can_use_all_features: daysLeft > 0,
          can_manage_admin_dashboard: !!profile?.is_superadmin,
          can_manage_organization: false,
        },
        trial_days_remaining: daysLeft,
      };

      setSubscriptionStatus(fallback);
      if (!fallback.has_access && !fallback.is_superadmin) {
        setCurrentPage('pricing');
      }
    } finally {
      setSubscriptionLoading(false);
    }
  }, [user]);

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
        }),
      );

      setQuotes(quotesWithLineItems);
      setFilteredQuotes(quotesWithLineItems);
    }
    setIsLoading(false);
  };

  const fetchUserProfile = async (userId: string) => {
    const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle();

    if (profile) {
      setUserProfile(profile);
      await refreshSubscriptionStatus(profile);
    } else {
      const { data: newProfile } = await supabase
        .from('user_profiles')
        .insert([
          {
            id: userId,
            name: '',
            company: '',
            last_login: new Date().toISOString(),
            signup_date: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (newProfile) {
        setUserProfile(newProfile);
        await refreshSubscriptionStatus(newProfile);
      }
    }

    await supabase.from('user_profiles').update({ last_login: new Date().toISOString() }).eq('id', userId);
  };

  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      }
      setAuthLoading(false);
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setSubscriptionStatus(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && subscriptionStatus?.has_access) {
      fetchQuotes();
    }
  }, [user, subscriptionStatus?.has_access]);

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
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
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
        .eq('user_id', currentUser.id)
        .order('quote_date', { ascending: true, nullsFirst: false });

      const sequenceNumber = existingQuotes && existingQuotes.length > 0 ? existingQuotes.length + 1 : 1;
      const generatedPartNumber = `${data.referenceNumber}-${String(sequenceNumber).padStart(2, '0')}`;

      let parsedData: any = null;
      let aiParsingSucceeded = false;

      if (data.fileContent && data.fileContent !== 'Manual entry - no file uploaded') {
        try {
          const { data: parseResult, error: parseError } = await supabase.functions.invoke('parse_quote', {
            body: { text: data.fileContent },
          });

          if (parseError) {
            console.warn('Edge Function parsing failed:', parseError.message);
            setError('AI parsing is currently unavailable. Your quote will be saved in manual mode.');
          } else if (parseResult?.error) {
            console.warn('Edge Function returned parsing error:', parseResult.error);
            setError('AI parsing is currently unavailable. Your quote will be saved in manual mode.');
          } else if (parseResult) {
            parsedData = parseResult;
            aiParsingSucceeded = true;
          }
        } catch (parseErr) {
          console.warn('Edge Function parsing exception:', parseErr);
          setError('AI parsing is currently unavailable. Your quote will be saved in manual mode.');
        }
      }

      const newQuote = {
        user_id: currentUser.id,
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

      const { data: insertedQuote, error: insertError } = await supabase.from('quotes').insert([newQuote]).select().single();

      if (insertError) {
        throw new Error(`Database error: ${insertError.message}`);
      }

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

        const { error: lineItemsError } = await supabase.from('quote_line_items').insert(lineItems);

        if (lineItemsError) {
          console.error('Failed to insert line items:', lineItemsError);
        }
      }

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

  const handleSearch = useCallback(
    (searchTerm: string) => {
      if (!searchTerm.trim()) {
        setFilteredQuotes(quotes);
        return;
      }

      const searchWords = searchTerm.toLowerCase().split(/\s+/).filter((word) => word.length > 0);

      const filtered = quotes.filter((quote) => {
        const searchableText = [
          quote.reference_name,
          quote.reference_number,
          quote.generated_part_number,
          quote.supplier,
          quote.part_description,
          quote.contact_person,
          quote.notes || '',
          ...(quote.line_items?.map((item) => item.description) || []),
        ]
          .join(' ')
          .toLowerCase();

        return searchWords.every((word) => searchableText.includes(word));
      });

      setFilteredQuotes(filtered);
    },
    [quotes],
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setQuotes([]);
    setFilteredQuotes([]);
    setSubscriptionStatus(null);
    setCurrentPage('dashboard');
  };

  const handleDeleteQuote = async (quoteId: string) => {
    try {
      const { error: lineItemsError } = await supabase.from('quote_line_items').delete().eq('quote_id', quoteId);

      if (lineItemsError) {
        throw lineItemsError;
      }

      const { error: quoteError } = await supabase.from('quotes').delete().eq('id', quoteId);

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
      await supabase.from('quotes').update({ notes: notes || null }).eq('id', pendingQuoteId);
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

  const renderDashboard = () => (
    <>
      <UserProfileHeader
        profile={userProfile}
        userEmail={user?.email || ''}
        onProfileUpdate={() => user && fetchUserProfile(user.id)}
      />

      {error && <ErrorMessage message={error} onClose={() => setError(null)} />}

      {manualMode && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
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

      {user && <ExpiredQuotesBanner userId={user.id} onRefresh={fetchQuotes} />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <UploadArea
          onProcessQuote={handleProcessQuote}
          existingReferences={quotes.map((q) => ({
            name: q.reference_name,
            number: q.reference_number,
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
            userEmail={user?.email || ''}
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
    </>
  );

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

  if (currentPage === 'pricing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <Logo />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
          <Pricing onCheckoutStarted={() => setError(null)} />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <SubscriptionGate status={subscriptionStatus} loading={subscriptionLoading} onUpgradeClick={() => setCurrentPage('pricing')}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex flex-col">
        <div className="container mx-auto px-4 py-8 flex-grow">
          <div className="flex items-center justify-between mb-6">
            <Logo />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage('dashboard')}
                className={`px-3 py-2 rounded-lg text-sm ${
                  currentPage === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-white/60'
                }`}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage('pricing')}
                className="px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-white/60"
              >
                Pricing
              </button>
              {subscriptionStatus?.permissions.can_manage_organization && (
                <button
                  type="button"
                  onClick={() => setCurrentPage('organization')}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    currentPage === 'organization' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-white/60'
                  }`}
                >
                  Organization
                </button>
              )}
              {subscriptionStatus?.is_superadmin && (
                <button
                  type="button"
                  onClick={() => setCurrentPage('admin')}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    currentPage === 'admin' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-white/60'
                  }`}
                >
                  Admin
                </button>
              )}
              <SettingsMenu subscriptionStatus={subscriptionStatus} />
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {currentPage === 'dashboard' && renderDashboard()}
          {currentPage === 'organization' && <OrganizationSettings subscriptionStatus={subscriptionStatus} />}
          {currentPage === 'admin' && <AdminDashboard visible={!!subscriptionStatus?.is_superadmin} />}
        </div>
        <Footer />
      </div>
    </SubscriptionGate>
  );
}

export default App;
