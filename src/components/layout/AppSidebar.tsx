import { BarChart3, Building2, FileText, Home, Settings, Shield, Truck, ChevronLeft, ChevronRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { useUiState } from '../../hooks/useUiState';

interface AppSidebarProps {
  canManageOrg?: boolean;
  isSuperadmin?: boolean;
}

export function AppSidebar({ canManageOrg, isSuperadmin }: AppSidebarProps) {
  const { sidebarCollapsed, setSidebarCollapsed } = useUiState();

  const navItems = [
    { label: 'Dashboard', to: '/app/dashboard', icon: Home },
    { label: 'Quotes', to: '/app/quotes', icon: FileText },
    { label: 'Suppliers', to: '/app/suppliers', icon: Truck },
    { label: 'Analytics', to: '/app/analytics', icon: BarChart3 },
    ...(canManageOrg ? [{ label: 'Organization', to: '/app/organization', icon: Building2 }] : []),
    { label: 'Settings', to: '/app/settings', icon: Settings },
    ...(isSuperadmin ? [{ label: 'Admin Dashboard', to: '/app/admin', icon: Shield }] : []),
  ];

  return (
    <aside
      className={`hidden md:flex h-screen sticky top-0 flex-col border-r border-slatePremium-200 bg-navy-950 text-white transition-all ${
        sidebarCollapsed ? 'w-20' : 'w-72'
      }`}
    >
      <div className="flex items-center justify-between border-b border-navy-800 px-4 py-4">
        <BrandLogo compact={sidebarCollapsed} />
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="rounded-lg p-2 hover:bg-navy-800">
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                isActive ? 'bg-gold-500 text-navy-950 font-semibold' : 'text-slate-300 hover:bg-navy-800 hover:text-white'
              }`
            }
          >
            <item.icon size={18} />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-navy-800 p-4 text-xs text-slate-400">{!sidebarCollapsed && 'Cmd/Ctrl + K for command palette'}</div>
    </aside>
  );
}
