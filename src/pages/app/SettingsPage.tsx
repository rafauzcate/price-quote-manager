import { useState } from 'react';
import type { SubscriptionStatusResponse } from '../../lib/subscription';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

const tabs = ['Profile', 'Security', 'Notifications', 'Subscription', 'Billing'] as const;

interface SettingsPageProps {
  subscriptionStatus: SubscriptionStatusResponse | null;
  userEmail?: string;
  userName?: string;
}

export function SettingsPage({ subscriptionStatus, userEmail, userName }: SettingsPageProps) {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Profile');

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center gap-2">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`rounded-xl px-3 py-2 text-sm ${tab === item ? 'bg-navy-900 text-white' : 'bg-slatePremium-100 text-slatePremium-700'}`}
          >
            {item}
          </button>
        ))}
      </CardHeader>
      <CardBody>
        {tab === 'Profile' && (
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Full name" defaultValue={userName} />
            <Input label="Email" defaultValue={userEmail} />
            <label className="md:col-span-2 space-y-1.5 text-sm">
              <span className="font-medium text-slatePremium-700">Bio</span>
              <textarea rows={4} className="w-full rounded-xl border border-slatePremium-300 px-3 py-2.5" placeholder="Tell us about your role" />
            </label>
            <Button className="w-fit">Save profile</Button>
          </div>
        )}

        {tab === 'Security' && (
          <div className="space-y-4 text-sm text-slatePremium-700">
            <Input label="Current password" type="password" />
            <Input label="New password" type="password" />
            <div className="rounded-xl border border-slatePremium-200 bg-slatePremium-50 p-4">
              <p className="font-semibold text-slatePremium-900">Two-factor authentication</p>
              <p className="mt-1 text-xs">Placeholder for 2FA setup flow.</p>
            </div>
            <Button className="w-fit">Update security settings</Button>
          </div>
        )}

        {tab === 'Notifications' && (
          <div className="space-y-3 text-sm text-slatePremium-700">
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Quote expiration alerts</label>
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Team invitation updates</label>
            <label className="flex items-center gap-2"><input type="checkbox" /> Billing notices</label>
          </div>
        )}

        {tab === 'Subscription' && (
          <div className="rounded-xl border border-slatePremium-200 bg-slatePremium-50 p-4 text-sm">
            <p>Current plan: <span className="font-semibold">{subscriptionStatus?.subscription?.plan_type || 'N/A'}</span></p>
            <p>Status: <span className="font-semibold">{subscriptionStatus?.profile.subscription_status || 'N/A'}</span></p>
            <p>Trial days remaining: <span className="font-semibold">{subscriptionStatus?.trial_days_remaining ?? 0}</span></p>
            <Button className="mt-4" variant="outline">Upgrade / Downgrade (coming soon)</Button>
          </div>
        )}

        {tab === 'Billing' && (
          <div className="space-y-3 text-sm text-slatePremium-700">
            <div className="rounded-xl border border-slatePremium-200 p-4">Payment method management placeholder</div>
            <div className="rounded-xl border border-slatePremium-200 p-4">Invoices history placeholder</div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
