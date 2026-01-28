import { useMemo, useState } from 'react';
import clsx from 'clsx';

export type MultiSelectOption = {
  id: string;
  label: string;
  subLabel?: string;
  right?: React.ReactNode;
};

export function MultiSelect({
  title,
  options,
  value,
  onChange,
  placeholder = 'Ara…',
  emptyText = 'Kayıt yok.'
}: {
  title: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  emptyText?: string;
}) {
  const [q, setQ] = useState('');
  const set = useMemo(() => new Set(value), [value]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => `${o.label} ${o.subLabel ?? ''}`.toLowerCase().includes(needle));
  }, [options, q]);

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white shadow-sm shadow-slate-900/5">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/70">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-400">{value.length} seçili</div>
      </div>

      <div className="px-4 py-3 border-b border-slate-200/70">
        <input
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 text-slate-900 focus:ring-2 focus:ring-slate-900/10"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="max-h-72 overflow-auto">
        {filtered.length === 0 && <div className="px-4 py-4 text-sm text-slate-500">{emptyText}</div>}
        {filtered.map((o) => {
          const checked = set.has(o.id);
          return (
            <label
              key={o.id}
              className={clsx(
                'flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-slate-100/70 last:border-b-0',
                checked ? 'bg-slate-50' : 'hover:bg-slate-50/70'
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  if (e.target.checked) onChange(Array.from(new Set([...value, o.id])));
                  else onChange(value.filter((id) => id !== o.id));
                }}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{o.label}</div>
                {o.subLabel && <div className="text-xs text-slate-500 truncate">{o.subLabel}</div>}
              </div>
              {o.right && <div className="shrink-0">{o.right}</div>}
            </label>
          );
        })}
      </div>
    </div>
  );
}


