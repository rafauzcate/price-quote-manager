import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

export interface UiNotification {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'warning' | 'success';
  timestamp: string;
  read?: boolean;
  dismissed_at?: string | null;
}

interface UiStateValue {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  commandOpen: boolean;
  setCommandOpen: Dispatch<SetStateAction<boolean>>;
  notifications: UiNotification[];
  setNotifications: Dispatch<SetStateAction<UiNotification[]>>;
  markNotificationRead: (id: string) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
}

const UiStateContext = createContext<UiStateValue | null>(null);
const STORAGE_KEY = 'vantagepm.notifications';

const fallbackNotifications: UiNotification[] = [
  {
    id: '1',
    title: 'Quote expiring soon',
    description: 'Quote #Q-1092 expires in 2 days.',
    type: 'warning',
    timestamp: new Date().toISOString(),
    read: false,
    dismissed_at: null,
  },
  {
    id: '2',
    title: 'Team invitation accepted',
    description: 'A new member joined your organization.',
    type: 'success',
    timestamp: new Date().toISOString(),
    read: false,
    dismissed_at: null,
  },
];

function loadNotifications(): UiNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallbackNotifications;
    const parsed = JSON.parse(raw) as UiNotification[];
    if (!Array.isArray(parsed)) return fallbackNotifications;
    return parsed.filter((item) => !item.dismissed_at);
  } catch {
    return fallbackNotifications;
  }
}

export function UiStateProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifications, setNotifications] = useState<UiNotification[]>(() => loadNotifications());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
  };

  const dismissNotification = (id: string) => {
    const dismissedAt = new Date().toISOString();
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true, dismissed_at: dismissedAt } : item)).filter((item) => !item.dismissed_at));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      commandOpen,
      setCommandOpen,
      notifications,
      setNotifications,
      markNotificationRead,
      dismissNotification,
      clearNotifications,
    }),
    [sidebarCollapsed, commandOpen, notifications],
  );

  return <UiStateContext.Provider value={value}>{children}</UiStateContext.Provider>;
}

export function useUiState() {
  const ctx = useContext(UiStateContext);
  if (!ctx) throw new Error('useUiState must be used within UiStateProvider');
  return ctx;
}
