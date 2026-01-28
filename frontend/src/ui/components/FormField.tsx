import clsx from 'clsx';

export function FormField({
  label,
  hint,
  error,
  children
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-xs font-medium text-slate-600">{label}</div>
        {hint && <div className="text-xs text-slate-400">{hint}</div>}
      </div>
      <div className={clsx('mt-1', error && 'ring-1 ring-red-200 rounded-md')}>{children}</div>
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </div>
  );
}


