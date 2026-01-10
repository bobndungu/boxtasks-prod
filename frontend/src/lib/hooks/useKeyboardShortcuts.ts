import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Only allow Escape in inputs
        if (event.key !== 'Escape') return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey;
        const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        // Handle Cmd/Ctrl shortcuts (either meta or ctrl)
        const cmdOrCtrl = shortcut.ctrl || shortcut.meta;
        const cmdOrCtrlMatch = cmdOrCtrl
          ? event.metaKey || event.ctrlKey
          : !event.metaKey && !event.ctrlKey;

        if (keyMatch && (cmdOrCtrl ? cmdOrCtrlMatch : ctrlMatch && metaMatch) && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}

// Commonly used shortcuts
export const SHORTCUTS = {
  SEARCH: { key: 'k', meta: true },
  ESCAPE: { key: 'Escape' },
  NEW_CARD: { key: 'n' },
  NEW_LIST: { key: 'l' },
  TOGGLE_ACTIVITY: { key: 'a' },
  HELP: { key: '?' },
} as const;
