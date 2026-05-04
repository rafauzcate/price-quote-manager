import { Bell, CheckCheck, LogOut, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
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
  const {
    notifications,
    setCommandOpen,
    markNotificationRead,
    dismissNotification,
    clearNotifications,
  } = useUiState();
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const handleClearAll = () => {
    clearNotifications();
    toast.success('Notifications cleared');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slatePremium-200 bg-white/90 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <button
          onClick={() => setCommandOpen(true)}
          className="hidden items-center gap-2 rounded-xl border border-slatePremium-300 px-3 py-2 text-sm text-slatePremium-600 hover:bg-slatePremium-100 md:inline-flex"
          title="Open command palette (Cmd/Ctrl + K)"
          aria-label="Open command palette"
        >
          <Search size={15} />
          <kbd className="rounded bg-slatePremium-100 px-1.5 py-0.5 text-xs">⌘K</kbd>
        </button>

        <div className="relative ml-auto">
          <button
            onClick={() => setShowNotifications((prev) => !prev)}
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
              <div className="flex items-center justify-between px-2 py-2">
                <p className="text-xs font-semibold text-slatePremium-500">Recent notifications</p>
                {notifications.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slatePremium-600 hover:bg-slatePremium-100"
                  >
                    <Trash2 size={12} /> Clear all
                  </button>
                ) : null}
              </div>
              <div className="max-h-72 space-y-1 overflow-auto">
                {notifications.length === 0 ? (
                  <div className="rounded-xl p-3 text-xs text-slatePremium-500">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="rounded-xl p-2 hover:bg-slatePremium-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slatePremium-900">{n.title}</p>
                          <p className="text-xs text-slatePremium-600">{n.description}</p>
                          <p className="mt-1 text-[11px] text-slatePremium-400">{formatDate(n.timestamp)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {!n.read ? (
                            <button
                              type="button"
                              onClick={() => {
                                markNotificationRead(n.id);
                                toast.success('Notification marked as read');
                              }}
                              className="rounded p-1 text-slatePremium-500 hover:bg-slatePremium-100"
                              title="Mark as read"
                            >
                              <CheckCheck size={13} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              dismissNotification(n.id);
                              toast.success('Notification dismissed');
                            }}
                            className="rounded p-1 text-slatePremium-500 hover:bg-slatePremium-100"
                            title="Dismiss"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
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
