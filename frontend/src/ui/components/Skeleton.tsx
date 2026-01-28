import clsx from 'clsx';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div
      className={clsx('animate-pulse rounded-lg bg-slate-200', className)}
      {...props}
    />
  );
}

