import { useState } from 'react';
import clsx from 'clsx';

export function Tabs({
  tabs,
  defaultTab,
  onChange
}: {
  tabs: Array<{ id: string; label: string; icon?: React.ReactNode }>;
  defaultTab?: string;
  onChange?: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id);

  const handleChange = (id: string) => {
    setActiveTab(id);
    onChange?.(id);
  };

  return (
    <div className="border-b border-slate-200/70">
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleChange(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            )}
          >
            {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

