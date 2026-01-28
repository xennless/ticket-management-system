import { useState } from 'react';
import clsx from 'clsx';

export function Tooltip({
  content,
  children,
  position = 'top'
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [show, setShow] = useState(false);

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className={clsx(
            'absolute z-50 rounded-lg bg-slate-900 text-white text-xs px-2 py-1.5 shadow-lg whitespace-nowrap',
            positions[position],
            'before:absolute before:border-4 before:border-transparent',
            position === 'top' && 'before:top-full before:left-1/2 before:-translate-x-1/2 before:border-t-slate-900',
            position === 'bottom' && 'before:bottom-full before:left-1/2 before:-translate-x-1/2 before:border-b-slate-900',
            position === 'left' && 'before:left-full before:top-1/2 before:-translate-y-1/2 before:border-l-slate-900',
            position === 'right' && 'before:right-full before:top-1/2 before:-translate-y-1/2 before:border-r-slate-900'
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

