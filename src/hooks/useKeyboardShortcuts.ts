'use client';

import { useEffect, useCallback, useRef } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: () => void;
  description?: string;
  enabled?: boolean;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const activeShortcuts = useRef<Set<string>>(new Set());

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      shortcuts.forEach((shortcut) => {
        if (shortcut.enabled === false) return;

        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !shortcut.ctrl || event.ctrlKey || event.metaKey;
        const shiftMatch = !shortcut.shift || event.shiftKey;
        const altMatch = !shortcut.alt || event.altKey;
        const metaMatch = !shortcut.meta || event.metaKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          const shortcutId = `${shortcut.ctrl ? 'ctrl+' : ''}${shortcut.shift ? 'shift+' : ''}${
            shortcut.alt ? 'alt+' : ''
          }${shortcut.meta ? 'meta+' : ''}${shortcut.key}`;

          // Prevent duplicate triggers
          if (!activeShortcuts.current.has(shortcutId)) {
            activeShortcuts.current.add(shortcutId);
            event.preventDefault();
            shortcut.handler();
          }
        }
      });
    },
    [shortcuts]
  );

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    activeShortcuts.current.clear();
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
}

// Global shortcuts hook for common application shortcuts
export function useGlobalShortcuts() {
  const shortcuts: ShortcutConfig[] = [
    {
      key: 's',
      ctrl: true,
      handler: () => {
        // Save current work
        console.log('Saving...');
        // Trigger save action
      },
      description: 'Save',
    },
    {
      key: 'z',
      ctrl: true,
      handler: () => {
        // Undo last action
        console.log('Undo');
      },
      description: 'Undo',
    },
    {
      key: 'z',
      ctrl: true,
      shift: true,
      handler: () => {
        // Redo last action
        console.log('Redo');
      },
      description: 'Redo',
    },
    {
      key: 'k',
      ctrl: true,
      handler: () => {
        // Open command palette
        console.log('Opening command palette...');
      },
      description: 'Command Palette',
    },
    {
      key: '/',
      ctrl: true,
      handler: () => {
        // Focus search
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
        searchInput?.focus();
      },
      description: 'Search',
    },
    {
      key: 'Escape',
      handler: () => {
        // Close modals, dropdowns, etc.
        console.log('Escape pressed');
      },
      description: 'Close/Cancel',
    },
  ];

  useKeyboardShortcuts(shortcuts);

  return shortcuts;
}

// Shortcut display component
export function getShortcutDisplay(shortcut: ShortcutConfig): string {
  const keys = [];
  if (shortcut.ctrl) keys.push('Ctrl');
  if (shortcut.shift) keys.push('Shift');
  if (shortcut.alt) keys.push('Alt');
  if (shortcut.meta) keys.push('⌘');
  keys.push(shortcut.key.toUpperCase());
  return keys.join('+');
}