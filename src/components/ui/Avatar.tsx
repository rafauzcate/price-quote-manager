interface AvatarProps {
  name?: string;
}

export function Avatar({ name = 'User' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((chunk) => chunk[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-gold-400">
      {initials || 'U'}
    </div>
  );
}
