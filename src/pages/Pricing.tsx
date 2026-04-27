import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { PLAN_CONFIGS, type PlanType, createCheckoutSession } from '../lib/subscription';

interface PricingProps {
  onCheckoutStarted?: () => void;
}

export function Pricing({ onCheckoutStarted }: PricingProps) {
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStartTrial = async (planType: PlanType) => {
    setError(null);
    setLoadingPlan(planType);

    try {
      const session = await createCheckoutSession(planType);
      onCheckoutStarted?.();
      window.location.href = session.checkout_url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start checkout';
      setError(message);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="w-full">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Choose your VantagePM plan</h1>
        <p className="text-gray-600">All plans include a 14-day free trial. Cancel anytime during trial.</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {PLAN_CONFIGS.map((plan) => (
          <div key={plan.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex flex-col">
            <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
            <p className="text-gray-500 text-sm mt-2 min-h-10">{plan.description}</p>
            <div className="mt-4">
              <span className="text-3xl font-bold text-gray-900">£{plan.priceGbp}</span>
              <span className="text-gray-500">/month</span>
            </div>
            <p className="text-xs mt-2 text-gray-500">{plan.seats} account{plan.seats > 1 ? 's' : ''}</p>

            <ul className="mt-5 space-y-2 flex-grow">
              {plan.features.map((feature) => (
                <li key={feature} className="text-sm text-gray-700 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => handleStartTrial(plan.id)}
              disabled={loadingPlan === plan.id}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg py-2.5 font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loadingPlan === plan.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Checkout...
                </>
              ) : (
                'Start Free Trial'
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
