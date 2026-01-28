import { createContext, useContext, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'info';
};

type ToastContextValue = {
  push: (t: Omit<ToastItem, 'id'>) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = (t: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random()}`;
    const item: ToastItem = { id, ...t };
    setItems((s) => [item, ...s].slice(0, 5));
    window.setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 3500);
  };

  const value = useMemo(() => ({ push }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'rounded-2xl border bg-white shadow-lg shadow-slate-900/10 px-4 py-3',
              t.type === 'success' && 'border-emerald-200/70',
              t.type === 'error' && 'border-red-200/70',
              t.type === 'info' && 'border-slate-200/70'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{t.title}</div>
                {t.description && <div className="text-xs text-slate-600 mt-0.5">{t.description}</div>}
              </div>
              <button
                className="rounded-md p-1 hover:bg-slate-100"
                onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast ToastProvider dışında kullanılamaz');
  return ctx;
}


