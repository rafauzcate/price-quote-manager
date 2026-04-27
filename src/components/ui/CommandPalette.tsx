import { Command } from 'cmdk';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUiState } from '../../hooks/useUiState';

const routes = [
  { label: 'Dashboard', path: '/app/dashboard' },
  { label: 'Quotes', path: '/app/quotes' },
  { label: 'Suppliers', path: '/app/suppliers' },
  { label: 'Analytics', path: '/app/analytics' },
  { label: 'Organization', path: '/app/organization' },
  { label: 'Settings', path: '/app/settings' },
  { label: 'Admin Dashboard', path: '/app/admin' },
];

export function CommandPalette() {
  const { commandOpen, setCommandOpen } = useUiState();
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [commandOpen, setCommandOpen]);

  if (!commandOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-navy-950/70 p-4 backdrop-blur-sm" onClick={() => setCommandOpen(false)}>
      <Command
        className="mx-auto mt-20 max-w-xl overflow-hidden rounded-2xl border border-slatePremium-200 bg-white shadow-premium"
        label="Command Palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slatePremium-200">
          <Command.Input
            autoFocus
            className="w-full bg-transparent px-4 py-4 text-sm outline-none"
            placeholder="Search pages, actions, or records..."
          />
        </div>
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-sm text-slatePremium-500">No results found.</Command.Empty>
          <Command.Group heading="Navigate" className="px-2 py-1 text-xs text-slatePremium-500">
            {routes.map((route) => (
              <Command.Item
                key={route.path}
                className="cursor-pointer rounded-lg px-3 py-2 text-sm data-[selected=true]:bg-slatePremium-100"
                onSelect={() => {
                  navigate(route.path);
                  setCommandOpen(false);
                }}
              >
                {route.label}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
