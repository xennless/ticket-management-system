import type { LucideIcon } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { Link } from 'react-router-dom';
import { HelpCircle, Plus } from 'lucide-react';

export type EmptyStateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary';
};

export type EmptyStateHelpLink = {
  label: string;
  href: string;
  external?: boolean;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actions = [],
  helpLinks = [],
  className
}: {
  icon: LucideIcon;
  title: string;
  description?: string | React.ReactNode;
  actions?: EmptyStateAction[];
  helpLinks?: EmptyStateHelpLink[];
  className?: string;
}) {
  return (
    <Card className={`py-16 px-6 ${className || ''}`}>
      <div className="flex flex-col items-center justify-center text-center max-w-lg mx-auto">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-6 shadow-sm">
          <Icon className="w-10 h-10 text-slate-500" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-slate-900 mb-3">{title}</h3>

        {/* Description */}
        {description && (
          <div className="text-sm text-slate-600 mb-6 leading-relaxed">
            {typeof description === 'string' ? <p>{description}</p> : description}
          </div>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            {actions.map((action, index) => {
              const ButtonComponent = action.href ? (
                <Link to={action.href}>
                  <Button
                    key={index}
                    variant={action.variant || 'primary'}
                    onClick={action.onClick}
                  >
                    {action.variant !== 'secondary' && <Plus className="w-4 h-4 mr-2" />}
                    {action.label}
                  </Button>
                </Link>
              ) : (
                <Button
                  key={index}
                  variant={action.variant || 'primary'}
                  onClick={action.onClick}
                >
                  {action.variant !== 'primary' && <Plus className="w-4 h-4 mr-2" />}
                  {action.label}
                </Button>
              );
              return ButtonComponent;
            })}
          </div>
        )}

        {/* Help Links */}
        {helpLinks.length > 0 && (
          <div className="pt-6 border-t border-slate-200 w-full">
            <div className="flex items-center justify-center gap-2 mb-3">
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Yardım
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {helpLinks.map((link, index) => (
                link.external ? (
                  <a
                    key={index}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-600 hover:text-slate-900 hover:underline transition-colors"
                  >
                    {link.label} →
                  </a>
                ) : (
                  <Link
                    key={index}
                    to={link.href}
                    className="text-sm text-slate-600 hover:text-slate-900 hover:underline transition-colors"
                  >
                    {link.label}
                  </Link>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

