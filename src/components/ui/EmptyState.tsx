import { type ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slatePremium-300 bg-slatePremium-50 p-10 text-center">
      {icon && <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">{icon}</div>}
      <h3 className="text-lg font-semibold text-slatePremium-900">{title}</h3>
      <p className="mt-2 text-sm text-slatePremium-600">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
