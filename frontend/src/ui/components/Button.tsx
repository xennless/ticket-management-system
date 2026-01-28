import clsx from 'clsx';
import { memo } from 'react';

/**
 * Button Component
 * 
 * @component
 * @example
 * ```tsx
 * <Button variant="primary" onClick={handleClick}>
 *   Kaydet
 * </Button>
 * ```
 * 
 * @param variant - Button variant: 'primary' | 'secondary' | 'danger'
 * @param size - Button size: 'sm' | 'md' | 'lg'
 * @param className - Additional CSS classes
 * @param props - Standard HTML button attributes
 */
export const Button = memo(function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-lg font-medium transition-all',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-2 focus:ring-slate-900/10',
        'hover:scale-[1.02] active:scale-[0.98]',
        // Size variants
        size === 'sm' && 'px-2.5 py-1.5 text-xs',
        size === 'md' && 'px-3 py-2 text-sm',
        size === 'lg' && 'px-4 py-2.5 text-base',
        // Color variants
        variant === 'primary' &&
          'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-900 shadow-sm transition-colors',
        variant === 'secondary' &&
          'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 active:bg-slate-100 transition-colors',
        variant === 'danger' &&
          'bg-red-600 text-white hover:bg-red-500 active:bg-red-600 shadow-sm transition-colors',
        className
      )}
      {...props}
    />
  );
});


