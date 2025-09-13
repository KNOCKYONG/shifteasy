'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Command, ArrowRight, Hash, User, Calendar, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  category?: string;
  keywords?: string[];
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  commands: CommandItem[];
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ commands, open, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands based on search
  const filteredCommands = commands.filter((command) => {
    const searchLower = search.toLowerCase();
    return (
      command.title.toLowerCase().includes(searchLower) ||
      command.description?.toLowerCase().includes(searchLower) ||
      command.keywords?.some((keyword) => keyword.toLowerCase().includes(searchLower)) ||
      command.category?.toLowerCase().includes(searchLower)
    );
  });

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, command) => {
    const category = command.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(command);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  // Keyboard navigation
  useKeyboardShortcuts([
    {
      key: 'ArrowDown',
      handler: () => {
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      },
    },
    {
      key: 'ArrowUp',
      handler: () => {
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      },
    },
    {
      key: 'Enter',
      handler: () => {
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
      },
    },
    {
      key: 'Escape',
      handler: onClose,
    },
  ]);

  // Reset on search change
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setSearch('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Scroll to selected item
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fadeIn"
        onClick={onClose}
      />

      {/* Command Palette */}
      <div className="fixed inset-x-0 top-20 mx-auto max-w-2xl z-50 animate-slideInDown">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* Search Input */}
          <div className="flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <Search className="w-5 h-5 text-gray-400 mr-3" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500"
            />
            <kbd className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-500 dark:text-gray-400">
              ESC
            </kbd>
          </div>

          {/* Command List */}
          <div ref={listRef} className="max-h-96 overflow-y-auto p-2">
            {Object.entries(groupedCommands).map(([category, items]) => (
              <div key={category}>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  {category}
                </div>
                {items.map((command, index) => {
                  const globalIndex = filteredCommands.indexOf(command);
                  return (
                    <button
                      key={command.id}
                      data-index={globalIndex}
                      onClick={() => {
                        command.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      className={cn(
                        'w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors',
                        globalIndex === selectedIndex
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      )}
                    >
                      {command.icon && (
                        <div className="mr-3 text-gray-400">{command.icon}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{command.title}</div>
                        {command.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {command.description}
                          </div>
                        )}
                      </div>
                      {command.shortcut && (
                        <kbd className="ml-3 text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-500 dark:text-gray-400">
                          {command.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {filteredCommands.length === 0 && (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                No commands found for "{search}"
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <kbd className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded mr-1">↑</kbd>
                <kbd className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded mr-2">↓</kbd>
                Navigate
              </span>
              <span className="flex items-center">
                <kbd className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded mr-2">↵</kbd>
                Select
              </span>
            </div>
            <div className="flex items-center">
              <Command className="w-3 h-3 mr-1" />
              <span>Command Palette</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Default commands for the application
export const defaultCommands: CommandItem[] = [
  {
    id: 'new-schedule',
    title: 'Create New Schedule',
    description: 'Start a new schedule from scratch',
    icon: <Calendar className="w-4 h-4" />,
    category: 'Schedule',
    keywords: ['new', 'create', 'schedule', 'shift'],
    action: () => console.log('Creating new schedule...'),
    shortcut: 'Ctrl+N',
  },
  {
    id: 'add-staff',
    title: 'Add Staff Member',
    description: 'Add a new team member',
    icon: <User className="w-4 h-4" />,
    category: 'Team',
    keywords: ['add', 'staff', 'employee', 'member'],
    action: () => console.log('Adding staff member...'),
    shortcut: 'Ctrl+Shift+A',
  },
  {
    id: 'settings',
    title: 'Open Settings',
    description: 'Configure application settings',
    icon: <Settings className="w-4 h-4" />,
    category: 'System',
    keywords: ['settings', 'preferences', 'config'],
    action: () => console.log('Opening settings...'),
    shortcut: 'Ctrl+,',
  },
  {
    id: 'search',
    title: 'Search',
    description: 'Search across the application',
    icon: <Search className="w-4 h-4" />,
    category: 'Navigation',
    keywords: ['search', 'find', 'locate'],
    action: () => console.log('Focusing search...'),
    shortcut: 'Ctrl+/',
  },
];