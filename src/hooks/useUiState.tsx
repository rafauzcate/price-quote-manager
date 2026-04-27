import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface UiNotification {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'warning' | 'success';
  timestamp: string;
  read?: boolean;
}

interface UiStateValue {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;
  commandOpen: boolean;
  setCommandOpen: (value: boolean) => void;
  notifications: UiNotification[];
  setNotifications: (value: UiNotification[]) => void;
}

const UiStateContext = createContext<UiStateValue | null>(null);

const fallbackNotifications: UiNotification[] = [
  {
    id: '1',
    title: 'Quote expiring soon',
    description: 'Quote #Q-1092 expires in 2 days.',
    type: 'warning',
    timestamp: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Team invitation accepted',
    description: 'A new member joined your organization.',
    type: 'success',
    timestamp: new Date().toISOString(),
  },
];

export function UiStateProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifications, setNotifications] = useState<UiNotification[]>(fallbackNotifications);

  const value = useMemo(
    () => ({ sidebarCollapsed, setSidebarCollapsed, commandOpen, setCommandOpen, notifications, setNotifications }),
    [sidebarCollapsed, commandOpen, notifications],
  );

  return <UiStateContext.Provider value={value}>{children}</UiStateContext.Provider>;
}

export function useUiState() {
  const ctx = useContext(UiStateContext);
  if (!ctx) throw new Error('useUiState must be used within UiStateProvider');
  return ctx;
}
