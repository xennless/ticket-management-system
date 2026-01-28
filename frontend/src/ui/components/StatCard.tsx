import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  variant = 'default',
  className
}: {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: number;
  trendLabel?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}) {
  const variants = {
    default: 'text-slate-600',
    success: 'text-green-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    info: 'text-blue-600'
  };

  return (
    <Card className={clsx('p-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm text-slate-500 mb-1">{title}</div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          {trend !== undefined && trendLabel && (
            <div className={clsx('text-xs mt-1 flex items-center gap-1', variants[variant])}>
              <span>{trend > 0 ? '↑' : trend < 0 ? '↓' : '→'}</span>
              <span>{Math.abs(trend)}%</span>
              <span className="text-slate-500">{trendLabel}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={clsx('w-12 h-12 rounded-lg flex items-center justify-center', variants[variant], 'bg-opacity-10')}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </Card>
  );
}

