import { useMemo, useState } from 'react';
import { Clock3, CreditCard, Settings, Shield, Sparkles, X } from 'lucide-react';
import type { SubscriptionStatusResponse } from '../lib/subscription';

interface SettingsMenuProps {
  subscriptionStatus: SubscriptionStatusResponse | null;
}

export function SettingsMenu({ subscriptionStatus }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'security' | 'subscription'>('subscription');

  const nextBillingDate = useMemo(() => {
    const date = subscriptionStatus?.subscription?.current_period_end;
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  }, [subscriptionStatus]);

  const plan = subscriptionStatus?.subscription?.plan_type || 'No plan';
  const trialDays = subscriptionStatus?.trial_days_remaining ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-colors"
        title="Settings"
      >
        <Settings className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-[480px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[80vh] overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-800">Settings</h3>
                  <Shield className="w-4 h-4 text-blue-600" />
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {trialDays > 0 && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-center gap-2">
                  <Clock3 className="w-4 h-4" />
                  Trial active: {trialDays} day{trialDays === 1 ? '' : 's'} remaining
                </div>
              )}

              <div className="flex border-b border-gray-200 mb-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('subscription')}
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${
                    activeTab === 'subscription' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'
                  }`}
                >
                  Subscription
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('security')}
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${
                    activeTab === 'security' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'
                  }`}
                >
                  Security
                </button>
              </div>

              {activeTab === 'subscription' ? (
                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      <h4 className="text-sm font-semibold text-gray-900">Current subscription</h4>
                    </div>
                    <p className="text-sm text-gray-700">Plan: <span className="font-medium">{plan}</span></p>
                    <p className="text-sm text-gray-700">Status: <span className="font-medium">{subscriptionStatus?.profile.subscription_status || 'N/A'}</span></p>
                    <p className="text-sm text-gray-700">Next billing date: <span className="font-medium">{nextBillingDate}</span></p>
                  </div>

                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <h4 className="text-sm font-semibold text-gray-900">Coming Soon</h4>
                    </div>
                    <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                      <li>Self-service plan upgrade and downgrade</li>
                      <li>Card and billing profile management</li>
                      <li>Invoice history and downloadable receipts</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">AI Parsing Security</h4>
                  <p className="text-sm text-gray-700">
                    OpenAI API key management has been moved to a secure server-side Supabase Edge Function.
                    API keys are no longer accepted, stored, or read from the browser.
                  </p>
                  <p className="text-xs text-gray-500 mt-3">
                    To update the key, configure the <code>OPENAI_API_KEY</code> secret in Supabase Edge Functions.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
