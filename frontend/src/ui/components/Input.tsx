import clsx from 'clsx';
import { memo } from 'react';

export const Input = memo(function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input
      className={clsx(
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none',
        'placeholder:text-slate-400',
        'text-slate-900',
        'focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300',
        className
      )}
      {...props}
    />
  );
});


