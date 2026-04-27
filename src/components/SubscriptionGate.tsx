import { type ReactNode } from 'react';
import { AlertTriangle, Clock3 } from 'lucide-react';
import type { SubscriptionStatusResponse } from '../lib/subscription';

interface SubscriptionGateProps {
  status: SubscriptionStatusResponse | null;
  loading: boolean;
  onUpgradeClick: () => void;
  children: ReactNode;
}

export function SubscriptionGate({ status, loading, onUpgradeClick, children }: SubscriptionGateProps) {
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center">
        <div className="text-center text-gray-600">Checking subscription status...</div>
      </div>
    );
  }

  if (!status?.has_access) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Subscription Required</h2>
          <p className="text-gray-600 mt-3">
            Your free trial has ended or no active subscription was found. Please choose a plan to continue.
          </p>
          <button
            type="button"
            onClick={onUpgradeClick}
            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium"
          >
            View Pricing Plans
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {status.trial_days_remaining > 0 && !status.is_superadmin && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-800 flex items-center justify-center gap-2">
          <Clock3 className="w-4 h-4" />
          Trial active: {status.trial_days_remaining} day{status.trial_days_remaining === 1 ? '' : 's'} remaining
        </div>
      )}
      {children}
    </>
  );
}
