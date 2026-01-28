import { Input } from './Input';
import { Calendar } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

export function DatePicker({
  value,
  onChange,
  placeholder = 'Tarih seçin',
  className
}: {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const handleDateSelect = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    onChange(dateStr);
    setOpen(false);
  };

  const today = new Date();
  const selectedDate = value ? new Date(value) : null;

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Input
          value={value || ''}
          onChange={() => {}}
          onClick={() => setOpen(!open)}
          placeholder={placeholder}
          readOnly
          className={clsx('pr-10 cursor-pointer', className)}
        />
        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4 w-64 animate-scale-in">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day) => (
              <div key={day} className="text-xs font-semibold text-slate-500 text-center py-1">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }, (_, i) => {
              const date = new Date(today.getFullYear(), today.getMonth(), 1);
              date.setDate(date.getDate() + i - date.getDay() + 1);
              const isCurrentMonth = date.getMonth() === today.getMonth();
              const isToday = date.toDateString() === today.toDateString();
              const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

              return (
                <button
                  key={i}
                  onClick={() => handleDateSelect(date)}
                  disabled={!isCurrentMonth}
                  className={clsx(
                    'text-sm rounded-md py-1.5 transition',
                    !isCurrentMonth && 'text-slate-300',
                    isCurrentMonth && 'text-slate-700 hover:bg-slate-100',
                    isToday && 'bg-blue-100 text-blue-700 font-semibold',
                    isSelected && 'bg-slate-900 text-white'
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

