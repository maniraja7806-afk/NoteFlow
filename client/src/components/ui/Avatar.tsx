interface AvatarProps {
  src?: string;
  name: string;
  size?: number;
  className?: string;
  title?: string;
}

export function Avatar({ src, name, size = 32, className = '', title }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      title={title ?? name}
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-500 text-xs font-semibold text-white ring-2 ring-white/70 dark:ring-slate-900 ${className}`}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span>{initials || '?'}</span>
      )}
    </div>
  );
}
