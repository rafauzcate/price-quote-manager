import type { SubscriptionStatusResponse } from '../../lib/subscription';
import { OrganizationSettings } from '../OrganizationSettings';

export function OrganizationPage({ subscriptionStatus }: { subscriptionStatus: SubscriptionStatusResponse | null }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-navy-950">Organization settings</h2>
      <OrganizationSettings subscriptionStatus={subscriptionStatus} />
    </div>
  );
}
