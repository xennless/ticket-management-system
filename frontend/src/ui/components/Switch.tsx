import clsx from 'clsx';

export function Switch({
  checked,
  onChange,
  disabled,
  label
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'inline-flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-sm',
        'transition hover:bg-slate-50/70',
        'focus:outline-none focus:ring-2 focus:ring-slate-900/10',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
    >
      <span
        className={clsx(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full transition',
          checked ? 'bg-slate-900' : 'bg-slate-200'
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition',
            checked ? 'left-[18px]' : 'left-[2px]'
          )}
        />
      </span>
      {label && <span className="text-slate-700">{label}</span>}
    </button>
  );
}


