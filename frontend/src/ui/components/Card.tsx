import clsx from 'clsx';
import { memo } from 'react';

export const Card = memo(function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-900/5',
        className
      )}
      {...props}
    />
  );
});


