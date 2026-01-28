import clsx from 'clsx';
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

export function Alert({
  variant = 'info',
  title,
  description,
  onClose,
  className
}: {
  variant?: AlertVariant;
  title?: string;
  description?: string;
  onClose?: () => void;
  className?: string;
}) {
  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info
  };

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const Icon = icons[variant];

  return (
    <div
      className={clsx(
        'rounded-lg border p-4 flex items-start gap-3 animate-fade-in',
        styles[variant],
        className
      )}
      role="alert"
    >
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold mb-1">{title}</div>}
        {description && <div className="text-sm">{description}</div>}
      </div>
      {onClose && (
        <Button variant="secondary" onClick={onClose} className="shrink-0 p-1 h-auto">
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

