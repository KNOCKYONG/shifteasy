"use client";

import { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  presetColors?: string[];
}

export function ColorPicker({ color, onChange, presetColors }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Default preset colors matching D, E, N, A, O, V
  const defaultPresets = [
    '#3b82f6', // blue - D
    '#f59e0b', // amber - E
    '#6366f1', // indigo - N
    '#10b981', // green - A
    '#6b7280', // gray - O
    '#a855f7', // purple - V
    '#ef4444', // red
    '#ec4899', // pink
  ];

  const presets = presetColors || defaultPresets;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      >
        <div
          className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
          {color.toUpperCase()}
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
          <HexColorPicker color={color} onChange={onChange} />

          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">프리셋 색상</p>
            <div className="grid grid-cols-4 gap-2">
              {presets.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => {
                    onChange(presetColor);
                    setIsOpen(false);
                  }}
                  className={`w-8 h-8 rounded border-2 hover:scale-110 transition-transform ${
                    color.toLowerCase() === presetColor.toLowerCase()
                      ? 'border-blue-500 dark:border-blue-400'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  style={{ backgroundColor: presetColor }}
                  title={presetColor}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
