import clsx from 'clsx';

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { className?: string }) {
  return (
    <select
      className={clsx(
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none',
        'text-slate-900',
        'focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  );
}

