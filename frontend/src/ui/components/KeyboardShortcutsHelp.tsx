/**
 * Keyboard Shortcuts Help Modal
 * 
 * Klavye kısayolları yardım modalı
 */

import { Modal } from './Modal';
import { Card } from './Card';
import { getShortcutsByCategory, type ShortcutDefinition } from '../../lib/keyboard-shortcuts';
import { Keyboard } from 'lucide-react';

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-2 py-1 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded shadow-sm">
      {children}
    </kbd>
  );
}

function ShortcutKey({ shortcut }: { shortcut: ShortcutDefinition }) {
  const keys: React.ReactNode[] = [];
  
  if (shortcut.ctrl) {
    keys.push(<Key key="ctrl">{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</Key>);
  }
  if (shortcut.alt) {
    keys.push(<Key key="alt">Alt</Key>);
  }
  if (shortcut.shift) {
    keys.push(<Key key="shift">Shift</Key>);
  }
  keys.push(<Key key="key">{shortcut.key === ' ' ? 'Space' : shortcut.key.toUpperCase()}</Key>);
  
  return (
    <div className="flex items-center gap-1">
      {keys.map((key, i) => (
        <span key={i} className="flex items-center gap-1">
          {key}
          {i < keys.length - 1 && <span className="text-slate-400">+</span>}
        </span>
      ))}
    </div>
  );
}

export function KeyboardShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const shortcutsByCategory = getShortcutsByCategory();
  
  return (
    <Modal title="Klavye Kısayolları" open={open} onClose={onClose} className="max-w-3xl">
      <div className="space-y-6">
        <div className="flex items-center gap-3 text-slate-600">
          <Keyboard className="w-5 h-5" />
          <p className="text-sm">
            Uygulamayı daha hızlı kullanmak için klavye kısayollarını kullanabilirsiniz.
          </p>
        </div>

        <div className="space-y-6">
          {Object.entries(shortcutsByCategory).map(([category, shortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">{category}</h3>
              <div className="space-y-2">
                {shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="text-sm text-slate-900">{shortcut.description}</div>
                    </div>
                    <ShortcutKey shortcut={shortcut} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            İpucu: Input alanlarında yazarken kısayollar devre dışıdır. Escape tuşu her zaman modal/dropdown'ları kapatır.
          </p>
        </div>
      </div>
    </Modal>
  );
}

