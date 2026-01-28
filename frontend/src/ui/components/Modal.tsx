import { X } from 'lucide-react';
import { Button } from './Button';

export function Modal({
  title,
  open,
  onClose,
  children,
  className
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className={className ? `w-full ${className} rounded-2xl border border-slate-200/70 bg-white shadow-2xl shadow-slate-900/10` : "w-full max-w-3xl rounded-2xl border border-slate-200/70 bg-white shadow-2xl shadow-slate-900/10"}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
            <div className="text-base font-semibold text-slate-900">{title}</div>
            <Button variant="secondary" onClick={onClose} className="px-2 py-2">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-5 max-h-[calc(100vh-12rem)] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}


