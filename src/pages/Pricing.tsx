import { useState } from 'react';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { PLAN_CONFIGS, type PlanType, createCheckoutSession } from '../lib/subscription';
import { Button } from '../components/ui/Button';

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
    <div className="space-y-8">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-gold-500/20 px-3 py-1 text-xs font-semibold text-gold-600">
          <Sparkles size={12} /> 14-day free trial on all plans
        </span>
        <h1 className="mt-4 text-4xl font-extrabold text-navy-950">Choose your premium plan</h1>
        <p className="mt-2 text-slatePremium-600">Scale from solo workflows to enterprise procurement operations.</p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_CONFIGS.map((plan, idx) => (
          <div key={plan.id} className={`rounded-2xl border p-6 shadow-sm ${idx === 1 ? 'border-gold-500 bg-gold-500/10' : 'border-slatePremium-200 bg-white'}`}>
            {idx === 1 && <span className="mb-3 inline-flex rounded-full bg-gold-500 px-2 py-1 text-xs font-semibold text-navy-950">Most popular</span>}
            <h3 className="text-xl font-semibold text-navy-950">{plan.name}</h3>
            <p className="mt-1 min-h-10 text-sm text-slatePremium-500">{plan.description}</p>
            <div className="mt-5">
              <span className="text-3xl font-bold text-navy-950">£{plan.priceGbp}</span>
              <span className="text-slatePremium-500"> /month</span>
            </div>
            <p className="text-xs text-slatePremium-500">{plan.seats} seats included</p>
            <ul className="mt-5 space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-slatePremium-700">
                  <CheckCircle2 size={15} className="mt-0.5 text-success" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button className="mt-6 w-full" onClick={() => handleStartTrial(plan.id)} disabled={loadingPlan === plan.id}>
              {loadingPlan === plan.id ? (
                <>
                  <Loader2 className="animate-spin" size={14} /> Creating checkout...
                </>
              ) : (
                'Start Free Trial'
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
