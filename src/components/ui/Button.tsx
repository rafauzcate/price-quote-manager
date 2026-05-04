import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-gold-500 text-navy-950 hover:bg-gold-400 shadow-premium',
  secondary: 'bg-navy-800 text-white hover:bg-navy-700',
  outline: 'border border-slatePremium-300 text-slatePremium-800 hover:bg-slatePremium-100',
  ghost: 'text-slatePremium-700 hover:bg-slatePremium-100',
  danger: 'bg-danger text-white hover:bg-red-600',
};

export function Button({ variant = 'primary', leftIcon, rightIcon, className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}
