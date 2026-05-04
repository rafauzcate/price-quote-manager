import { type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <label className="block space-y-1.5 text-sm">
      {label && <span className="text-slatePremium-700 font-medium">{label}</span>}
      <input
        className={`w-full rounded-xl border border-slatePremium-300 bg-white px-3 py-2.5 text-slatePremium-900 placeholder:text-slatePremium-400 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20 ${className}`}
        {...props}
      />
    </label>
  );
}
