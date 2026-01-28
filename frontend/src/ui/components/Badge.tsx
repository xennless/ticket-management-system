import clsx from 'clsx';

export function Badge({
  variant = 'default',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border',
        variant === 'default' && 'bg-slate-50 text-slate-700 border-slate-200/70',
        variant === 'success' && 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
        variant === 'warning' && 'bg-yellow-50 text-yellow-700 border-yellow-200/70',
        variant === 'danger' && 'bg-red-50 text-red-700 border-red-200/70',
        variant === 'info' && 'bg-blue-50 text-blue-700 border-blue-200/70',
        variant === 'secondary' && 'bg-slate-100 text-slate-600 border-slate-300/70',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

