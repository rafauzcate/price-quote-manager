import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { Toaster, toast } from 'sonner';
import { supabase } from './lib/supabase';
import { fetchSubscriptionStatus, isSuperAdmin, type SubscriptionStatusResponse } from './lib/subscription';
import { generateFileHash, checkDuplicateFile } from './lib/duplicateDetection';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { Pricing } from './pages/Pricing';
import { AppSidebar } from './components/layout/AppSidebar';
import { TopNav } from './components/layout/TopNav';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { UiStateProvider } from './hooks/useUiState';
import { CommandPalette } from './components/ui/CommandPalette';
import { NotesModal } from './components/NotesModal';
import { ExpiredQuotesBanner } from './components/ExpiredQuotesBanner';
import type { Quote, UserProfile } from './types/app';

const DashboardOverviewPage = lazy(() => import('./pages/app/DashboardOverviewPage').then((m) => ({ default: m.DashboardOverviewPage })));
const QuotesPage = lazy(() => import('./pages/app/QuotesPage').then((m) => ({ default: m.QuotesPage })));
const SuppliersPage = lazy(() => import('./pages/app/SuppliersPage').then((m) => ({ default: m.SuppliersPage })));
const AnalyticsPage = lazy(() => import('./pages/app/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const OrganizationPage = lazy(() => import('./pages/app/OrganizationPage').then((m) => ({ default: m.OrganizationPage })));
const AdminPage = lazy(() => import('./pages/app/AdminPage').then((m) => ({ default: m.AdminPage })));
const SettingsPage = lazy(() => import('./pages/app/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function LoadingState({ message }: { message: string }) {
  return <div className="rounded-xl border border-slatePremium-200 bg-white p-6 text-sm text-slatePremium-500">{message}</div>;
}

function AppRouter() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatusResponse | null>(null);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [pendingQuoteId, setPendingQuoteId] = useState<string | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const subscriptionDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionRequestIdRef = useRef(0);
  const quotesRequestIdRef = useRef(0);
  const userProfileRef = useRef<UserProfile | null>(null);

  const refreshSubscriptionStatus = useCallback(
    async (profile?: UserProfile | null) => {
      const activeUser = user ?? (await supabase.auth.getUser()).data.user;

      if (!activeUser) {
        setSubscriptionStatus(null);
        setSubscriptionLoading(false);
        return;
      }

      if (subscriptionDebounceTimerRef.current) {
        clearTimeout(subscriptionDebounceTimerRef.current);
      }

      setSubscriptionLoading(true);
      const requestId = ++subscriptionRequestIdRef.current;

      await new Promise<void>((resolve) => {
        subscriptionDebounceTimerRef.current = setTimeout(() => resolve(), 250);
      });

      if (requestId !== subscriptionRequestIdRef.current) {
        return;
      }

      const emailIsSuperadmin = isSuperAdmin(activeUser.email);
      const profileIsSuperadmin = Boolean(profile?.is_superadmin);
      const resolvedIsSuperadmin = emailIsSuperadmin || profileIsSuperadmin;

      if (resolvedIsSuperadmin) {
        const superadminStatus: SubscriptionStatusResponse = {
          has_access: true,
          access_reason: 'superadmin',
          is_superadmin: true,
          profile: {
            subscription_status: profile?.subscription_status || 'active',
            trial_ends_at: profile?.trial_ends_at || null,
            organization_id: profile?.organization_id || null,
          },
          subscription: null,
          permissions: {
            can_use_all_features: true,
            can_manage_admin_dashboard: true,
            can_manage_organization: true,
          },
          trial_days_remaining: 0,
        };

        if (requestId === subscriptionRequestIdRef.current) {
          setSubscriptionStatus(superadminStatus);
          setSubscriptionLoading(false);
        }
        return;
      }

      try {
        const status = await fetchSubscriptionStatus();

        if (requestId !== subscriptionRequestIdRef.current) {
          return;
        }

        setSubscriptionStatus(status);
      } catch (err) {
        console.warn('Unable to fetch subscription status, using fallback', err);
        const trialDate = profile?.trial_ends_at;
        const daysLeft = trialDate
          ? Math.max(0, Math.ceil((new Date(trialDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : 14;

        const fallback: SubscriptionStatusResponse = {
          has_access: daysLeft > 0,
          access_reason: daysLeft > 0 ? 'local_trial_fallback' : 'no_access',
          is_superadmin: false,
          profile: {
            subscription_status: profile?.subscription_status || 'trialing',
            trial_ends_at: profile?.trial_ends_at || null,
            organization_id: profile?.organization_id || null,
          },
          subscription: null,
          permissions: {
            can_use_all_features: daysLeft > 0,
            can_manage_admin_dashboard: false,
            can_manage_organization: false,
          },
          trial_days_remaining: daysLeft,
        };

        if (requestId === subscriptionRequestIdRef.current) {
          setSubscriptionStatus(fallback);
          toast.error('Subscription check failed temporarily. Using local access fallback.');
        }
      } finally {
        if (requestId === subscriptionRequestIdRef.current) {
          setSubscriptionLoading(false);
        }
      }
    },
    [user],
  );

  const fetchQuotes = useCallback(async () => {
    if (!user) return;

    const requestId = ++quotesRequestIdRef.current;
    setQuotesLoading(true);

    try {
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (quotesError) {
        throw quotesError;
      }

      const quoteIds = (quotesData || []).map((quote) => quote.id);
      let lineItemsByQuoteId = new Map<string, any[]>();

      if (quoteIds.length > 0) {
        const { data: allLineItems, error: lineItemsError } = await supabase
          .from('quote_line_items')
          .select('*')
          .in('quote_id', quoteIds)
          .order('created_at', { ascending: true });

        if (lineItemsError) {
          throw lineItemsError;
        }

        lineItemsByQuoteId = (allLineItems || []).reduce((acc, item) => {
          const existing = acc.get(item.quote_id) || [];
          existing.push(item);
          acc.set(item.quote_id, existing);
          return acc;
        }, new Map<string, any[]>());
      }

      const merged = (quotesData || []).map((quote) => ({
        ...quote,
        line_items: lineItemsByQuoteId.get(quote.id) || [],
      }));

      if (requestId === quotesRequestIdRef.current) {
        setQuotes(merged as Quote[]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to load quotes: ${message}`);
      console.error('Failed to load quotes', error);
    } finally {
      if (requestId === quotesRequestIdRef.current) {
        setQuotesLoading(false);
      }
    }
  }, [user]);

  const fetchUserProfile = useCallback(
    async (userId: string) => {
      try {
        const { data: profile, error: profileError } = await supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (profile) {
          setUserProfile(profile);
          await refreshSubscriptionStatus(profile);
        } else {
          const { data: newProfile, error: createProfileError } = await supabase
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

          if (createProfileError) {
            throw createProfileError;
          }

          if (newProfile) {
            setUserProfile(newProfile);
            await refreshSubscriptionStatus(newProfile);
          }
        }

        const { error: updateLoginError } = await supabase.from('user_profiles').update({ last_login: new Date().toISOString() }).eq('id', userId);
        if (updateLoginError) {
          console.warn('Unable to update last_login timestamp', updateLoginError);
        }
      } catch (error) {
        console.error('Failed to load user profile', error);
        toast.error('Unable to load your profile. Please refresh the page.');
      }
    },
    [refreshSubscriptionStatus],
  );

  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      }
      setAuthLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setUser(session?.user ?? null);

        if (session?.user) {
          if (event === 'TOKEN_REFRESHED') {
            await refreshSubscriptionStatus(userProfileRef.current);
          } else {
            await fetchUserProfile(session.user.id);
          }
        } else {
          setSubscriptionStatus(null);
          setUserProfile(null);
          setQuotes([]);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile, refreshSubscriptionStatus]);

  useEffect(() => {
    if (user && subscriptionStatus?.has_access) fetchQuotes();
  }, [fetchQuotes, subscriptionStatus?.has_access, user]);

  useEffect(() => {
    return () => {
      if (subscriptionDebounceTimerRef.current) {
        clearTimeout(subscriptionDebounceTimerRef.current);
      }
    };
  }, []);

  const isCurrentUserSuperadmin = isSuperAdmin(user?.email) || Boolean(subscriptionStatus?.is_superadmin);

  useEffect(() => {
    if (!user || subscriptionLoading) return;

    if (location.pathname === '/pricing' && isCurrentUserSuperadmin) {
      navigate('/app/dashboard', { replace: true });
      return;
    }

    if (location.pathname.startsWith('/app') && !subscriptionStatus?.has_access && !isCurrentUserSuperadmin) {
      navigate('/pricing', { replace: true });
    }
  }, [isCurrentUserSuperadmin, location.pathname, navigate, subscriptionLoading, subscriptionStatus?.has_access, user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out successfully');
    navigate('/');
  };

  const handleDeleteQuote = async (quoteId: string) => {
    const { error: lineItemsError } = await supabase.from('quote_line_items').delete().eq('quote_id', quoteId);
    if (lineItemsError) {
      toast.error(`Failed to delete line items: ${lineItemsError.message}`);
      return;
    }

    const { error: quoteError } = await supabase.from('quotes').delete().eq('id', quoteId);
    if (quoteError) {
      toast.error(`Failed to delete quote: ${quoteError.message}`);
      return;
    }

    toast.success('Quote deleted');
    await fetchQuotes();
  };

  const handleCreateQuote = async (data: {
    fileContent: string;
    referenceName: string;
    referenceNumber: string;
    file?: File;
    fileName?: string;
  }) => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      toast.error('Please sign in to create quotes');
      return;
    }

    let fileHash: string | undefined;
    if (data.file) {
      fileHash = await generateFileHash(data.file);
      const duplicate = await checkDuplicateFile(fileHash);
      if (duplicate.isDuplicate) {
        toast.warning('Potential duplicate file detected. Processing anyway.');
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

    let parsedData: Record<string, any> | null = null;
    if (data.fileContent && data.fileContent !== 'Manual entry - no file uploaded') {
      const { data: parseResult, error: parseError } = await supabase.functions.invoke('parse_quote', {
        body: { text: data.fileContent },
      });

      if (parseError || parseResult?.error) {
        toast.warning('AI parsing unavailable. Quote saved in manual mode.');
      } else {
        parsedData = parseResult;
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

    const { data: insertedQuote, error } = await supabase.from('quotes').insert([newQuote]).select().single();
    if (error) {
      toast.error(`Failed to save quote: ${error.message}`);
      return;
    }

    if (parsedData?.line_items?.length && insertedQuote) {
      const items = parsedData.line_items.map((item: any) => ({
        quote_id: insertedQuote.id,
        product_code: item.product_code || '',
        description: item.description || 'Not specified',
        quantity: typeof item.quantity === 'number' ? item.quantity : 0,
        unit_price: typeof item.unit_price === 'number' ? item.unit_price : 0,
        discount_percent: typeof item.discount_percent === 'number' ? item.discount_percent : 0,
        net_price: typeof item.net_price === 'number' ? item.net_price : 0,
      }));
      await supabase.from('quote_line_items').insert(items);
    }

    setPendingQuoteId(insertedQuote.id);
    setShowNotesModal(true);
    toast.success('Quote created successfully');
    await fetchQuotes();
  };

  const handleSaveNotes = async (notes: string) => {
    if (!pendingQuoteId) return;
    await supabase.from('quotes').update({ notes: notes || null }).eq('id', pendingQuoteId);
    setPendingQuoteId(null);
    setShowNotesModal(false);
    await fetchQuotes();
  };

  const canEnterApp = !!user && (isCurrentUserSuperadmin || !!subscriptionStatus?.has_access);
  const isAuthRoute = ['/login', '/signup', '/reset-password'].includes(location.pathname);

  if (authLoading) {
    return <div className="min-h-screen bg-slatePremium-50 p-8">Loading authentication...</div>;
  }

  if (!user && location.pathname.startsWith('/app')) {
    return <Navigate to="/login" replace />;
  }

  if (user && isAuthRoute) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <>
      <Toaster richColors position="top-right" />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/reset-password" element={<AuthPage mode="reset" />} />
        <Route
          path="/pricing"
          element={
            user ? (
              <div className="min-h-screen bg-slatePremium-50 px-6 py-10">
                <div className="mx-auto max-w-7xl">
                  <Pricing />
                </div>
              </div>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/app/*"
          element={
            canEnterApp ? (
              <div className="flex min-h-screen bg-slatePremium-50">
                <UiStateProvider>
                  <AppSidebar
                    canManageOrg={subscriptionStatus?.permissions.can_manage_organization}
                    isSuperadmin={subscriptionStatus?.is_superadmin}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <TopNav userProfile={userProfile} userEmail={user?.email} onSignOut={handleSignOut} />
                    {subscriptionStatus?.trial_days_remaining ? (
                      <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-700">
                        Trial active: {subscriptionStatus.trial_days_remaining} day(s) remaining.
                      </div>
                    ) : null}
                    <main className="flex-1 px-4 py-5 pb-20 md:px-6 md:pb-6">
                      <Suspense fallback={<LoadingState message="Loading workspace..." />}>
                        <Routes>
                          <Route
                            path="dashboard"
                            element={
                              <div className="space-y-5">
                                {user?.id ? <ExpiredQuotesBanner userId={user.id} onRefresh={fetchQuotes} /> : null}
                                <DashboardOverviewPage quotes={quotes} loading={quotesLoading} />
                              </div>
                            }
                          />
                          <Route
                            path="quotes"
                            element={
                              <QuotesPage
                                quotes={quotes}
                                loading={quotesLoading}
                                onDeleteQuote={handleDeleteQuote}
                                onCreateQuote={handleCreateQuote}
                                userName={userProfile?.name}
                                userEmail={user?.email}
                                userCompany={userProfile?.company}
                              />
                            }
                          />
                          <Route path="suppliers" element={<SuppliersPage quotes={quotes} />} />
                          <Route path="analytics" element={<AnalyticsPage quotes={quotes} />} />
                          <Route path="organization" element={<OrganizationPage subscriptionStatus={subscriptionStatus} />} />
                          <Route path="settings" element={<SettingsPage subscriptionStatus={subscriptionStatus} userEmail={user?.email} userName={userProfile?.name} />} />
                          <Route path="admin" element={<AdminPage visible={!!subscriptionStatus?.is_superadmin} />} />
                          <Route path="*" element={<Navigate to="dashboard" replace />} />
                        </Routes>
                      </Suspense>
                    </main>
                  </div>
                  <CommandPalette />
                  <MobileBottomNav />
                </UiStateProvider>
              </div>
            ) : subscriptionLoading ? (
              <div className="min-h-screen bg-slatePremium-50 p-8">Checking subscription...</div>
            ) : (
              <Navigate to="/pricing" replace />
            )
          }
        />
      </Routes>

      <NotesModal
        isOpen={showNotesModal}
        onClose={() => {
          setShowNotesModal(false);
          setPendingQuoteId(null);
        }}
        onSave={handleSaveNotes}
        isManualMode={false}
      />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}

export default App;
