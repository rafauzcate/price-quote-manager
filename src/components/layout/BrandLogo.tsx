import logo from '@/assets/logo.png';

interface BrandLogoProps {
  compact?: boolean;
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className="flex items-center gap-3">
      <img src={logo} alt="VantagePM logo" className="h-9 w-9 rounded-lg object-cover border border-gold-500/40" />
      {!compact && (
        <div>
          <p className="text-lg font-heading font-bold text-navy-950 leading-tight">VantagePM</p>
          <p className="text-[11px] text-slatePremium-500">Premium Quote Intelligence</p>
        </div>
      )}
    </div>
  );
}
