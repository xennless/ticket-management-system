import clsx from 'clsx';

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
  return (
    <textarea
      className={clsx(
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none resize-y',
        'placeholder:text-slate-400',
        'text-slate-900',
        'focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  );
}

