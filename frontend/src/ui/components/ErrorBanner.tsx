import { AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export function ErrorBanner({
  title = 'Hata',
  message,
  className
}: {
  title?: string;
  message: string;
  className?: string;
}) {
  return (
    <div className={clsx('rounded-xl border border-red-200 bg-red-50 p-4', className)} role="alert" aria-live="polite">
      <div className="flex items-center gap-2 text-red-700">
        <AlertCircle className="w-4 h-4" />
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="mt-1 text-sm text-red-700/90">{message}</div>
    </div>
  );
}


