/**
 * Keyboard Shortcuts System
 * 
 * Klavye kısayolları yönetim sistemi
 */

import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './auth';

export type ShortcutAction = 
  | { type: 'navigate'; path: string }
  | { type: 'callback'; callback: () => void }
  | { type: 'open-palette' }
  | { type: 'close-modal' }
  | { type: 'new-ticket' }
  | { type: 'focus-search' }
  | { type: 'show-help' };

export type ShortcutDefinition = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Cmd on Mac
  action: ShortcutAction;
  description: string;
  category?: string;
  enabled?: () => boolean;
};

// Global shortcuts registry
let shortcuts: ShortcutDefinition[] = [];
let helpModalOpen = false;
let setHelpModalOpen: ((open: boolean) => void) | null = null;

export function registerShortcut(shortcut: ShortcutDefinition) {
  shortcuts.push(shortcut);
}

export function unregisterShortcut(key: string) {
  shortcuts = shortcuts.filter(s => s.key !== key);
}

export function setHelpModalState(setter: (open: boolean) => void) {
  setHelpModalOpen = setter;
}

export function getShortcuts(): ShortcutDefinition[] {
  return shortcuts;
}

export function getShortcutsByCategory(): Record<string, ShortcutDefinition[]> {
  const grouped: Record<string, ShortcutDefinition[]> = {};
  for (const shortcut of shortcuts) {
    const category = shortcut.category || 'Genel';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(shortcut);
  }
  return grouped;
}

/**
 * Hook for using keyboard shortcuts
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { has } = useAuth();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if typing in input/textarea
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      (target.closest('[contenteditable="true"]') !== null)
    ) {
      // Allow escape to close modals even when typing
      if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        // Will be handled by shortcut system
      } else {
        return;
      }
    }

    const key = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey; // Cmd on Mac
    const shift = e.shiftKey;
    const alt = e.altKey;

    for (const shortcut of shortcuts) {
      // Check if shortcut matches
      if (
        shortcut.key.toLowerCase() === key &&
        !!shortcut.ctrl === ctrl &&
        !!shortcut.shift === shift &&
        !!shortcut.alt === alt &&
        (!shortcut.enabled || shortcut.enabled())
      ) {
        e.preventDefault();
        e.stopPropagation();

        // Execute action
        switch (shortcut.action.type) {
          case 'navigate':
            navigate(shortcut.action.path);
            break;
          case 'callback':
            shortcut.action.callback();
            break;
          case 'open-palette':
            // Command palette will handle this via event
            window.dispatchEvent(new CustomEvent('open-command-palette'));
            break;
          case 'close-modal':
            // Close any open modal
            window.dispatchEvent(new CustomEvent('close-modal'));
            break;
          case 'new-ticket':
            if (has('ticket.create')) {
              navigate('/tickets/new');
            }
            break;
          case 'focus-search':
            // Focus search input
            const searchInput = document.querySelector<HTMLInputElement>('input[type="search"], input[placeholder*="Ara"]');
            if (searchInput) {
              searchInput.focus();
              searchInput.select();
            }
            break;
          case 'show-help':
            if (setHelpModalOpen) {
              setHelpModalOpen(true);
            }
            break;
        }
        break;
      }
    }
  }, [navigate, has]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

/**
 * Initialize default shortcuts
 */
export function initDefaultShortcuts() {
  // Clear existing
  shortcuts = [];

  // Global shortcuts
  registerShortcut({
    key: 'k',
    ctrl: true,
    action: { type: 'open-palette' },
    description: 'Command Palette\'i aç',
    category: 'Genel',
  });

  registerShortcut({
    key: 'Escape',
    action: { type: 'close-modal' },
    description: 'Modal/Dropdown kapat',
    category: 'Genel',
  });

  registerShortcut({
    key: 'n',
    ctrl: true,
    action: { type: 'new-ticket' },
    description: 'Yeni ticket oluştur',
    category: 'Ticket',
    enabled: () => {
      // Check via auth context - will be set dynamically
      return true; // Will check in handler
    },
  });

  registerShortcut({
    key: '/',
    action: { type: 'focus-search' },
    description: 'Arama kutusuna odaklan',
    category: 'Genel',
  });

  registerShortcut({
    key: '?',
    action: { type: 'show-help' },
    description: 'Kısayol yardımını göster',
    category: 'Genel',
  });

  // Navigation shortcuts
  registerShortcut({
    key: 'g',
    ctrl: true,
    action: { type: 'navigate', path: '/tickets' },
    description: 'Tickets sayfasına git',
    category: 'Navigasyon',
  });

  registerShortcut({
    key: 'd',
    ctrl: true,
    action: { type: 'navigate', path: '/dashboard' },
    description: 'Dashboard\'a git',
    category: 'Navigasyon',
  });
}

