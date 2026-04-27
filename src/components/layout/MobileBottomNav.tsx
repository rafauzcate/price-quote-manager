import { BarChart3, FileText, Home, Settings, Truck } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { label: 'Home', to: '/app/dashboard', icon: Home },
  { label: 'Quotes', to: '/app/quotes', icon: FileText },
  { label: 'Suppliers', to: '/app/suppliers', icon: Truck },
  { label: 'Analytics', to: '/app/analytics', icon: BarChart3 },
  { label: 'Settings', to: '/app/settings', icon: Settings },
];

export function MobileBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-slatePremium-200 bg-white/95 backdrop-blur md:hidden">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `flex flex-col items-center gap-1 py-2 text-[11px] ${isActive ? 'text-navy-900' : 'text-slatePremium-500'}`}
        >
          <item.icon size={16} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
