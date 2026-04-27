import { Bell, LogOut, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar } from '../ui/Avatar';
import { useUiState } from '../../hooks/useUiState';
import { formatDate } from '../../lib/format';
import { Button } from '../ui/Button';
import type { UserProfile } from '../../types/app';

interface TopNavProps {
  userProfile: UserProfile | null;
  userEmail?: string;
  onSignOut: () => void;
}

export function TopNav({ userProfile, userEmail, onSignOut }: TopNavProps) {
  const { notifications, setCommandOpen } = useUiState();
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  return (
    <header className="sticky top-0 z-30 border-b border-slatePremium-200 bg-white/90 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <button
          onClick={() => setCommandOpen(true)}
          className="hidden md:flex items-center gap-2 rounded-xl border border-slatePremium-300 px-3 py-2 text-sm text-slatePremium-500 hover:bg-slatePremium-100"
        >
          <Search size={15} /> Search quotes or jump... <kbd className="rounded bg-slatePremium-100 px-1.5 py-0.5">⌘K</kbd>
        </button>

        <div className="relative ml-auto">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-xl border border-slatePremium-300 p-2.5 hover:bg-slatePremium-100"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 rounded-full bg-danger px-1.5 text-[10px] text-white">{unreadCount}</span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slatePremium-200 bg-white p-2 shadow-premium">
              <p className="px-2 py-2 text-xs font-semibold text-slatePremium-500">Recent notifications</p>
              <div className="max-h-72 space-y-1 overflow-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="rounded-xl p-2 hover:bg-slatePremium-50">
                    <p className="text-sm font-medium text-slatePremium-900">{n.title}</p>
                    <p className="text-xs text-slatePremium-600">{n.description}</p>
                    <p className="mt-1 text-[11px] text-slatePremium-400">{formatDate(n.timestamp)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <p className="text-sm font-semibold text-slatePremium-900">{userProfile?.name || 'User'}</p>
            <p className="text-xs text-slatePremium-500">{userEmail}</p>
          </div>
          <Avatar name={userProfile?.name || 'User'} />
          <Button variant="ghost" onClick={onSignOut} leftIcon={<LogOut size={16} />}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
