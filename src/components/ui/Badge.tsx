interface BadgeProps {
  children: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'gold';
}

const styles = {
  default: 'bg-slatePremium-100 text-slatePremium-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  gold: 'bg-gold-500/20 text-gold-600',
};

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[variant]}`}>{children}</span>;
}
