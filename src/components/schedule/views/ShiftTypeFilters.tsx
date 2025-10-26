import React from 'react';

interface ShiftType {
  code: string;
  name: string;
  color: string;
}

interface ShiftTypeFiltersProps {
  customShiftTypes: ShiftType[];
  selectedShiftTypes: Set<string>;
  onToggleShiftType: (shiftType: string) => void;
  onClearFilters: () => void;
}

export function ShiftTypeFilters({
  customShiftTypes,
  selectedShiftTypes,
  onToggleShiftType,
  onClearFilters,
}: ShiftTypeFiltersProps) {
  const colorMap: Record<string, string> = {
    'blue': 'bg-blue-500 text-white',
    'green': 'bg-green-500 text-white',
    'amber': 'bg-amber-500 text-white',
    'red': 'bg-red-500 text-white',
    'purple': 'bg-purple-500 text-white',
    'indigo': 'bg-indigo-500 text-white',
    'pink': 'bg-pink-500 text-white',
    'gray': 'bg-gray-500 text-white',
  };

  return (
    <div className="mb-4 flex items-center gap-3 flex-wrap">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">근무 필터:</span>
      {customShiftTypes.map((shiftType) => {
        const isSelected = selectedShiftTypes.has(shiftType.code);
        const selectedClass = isSelected ? colorMap[shiftType.color] || colorMap['blue'] : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300';
        const baseClass = !isSelected ? 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700' : '';

        return (
          <button
            key={shiftType.code}
            onClick={() => onToggleShiftType(shiftType.code)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${selectedClass} ${baseClass}`}
          >
            {shiftType.name} ({shiftType.code})
          </button>
        );
      })}
      {selectedShiftTypes.size > 0 && (
        <button
          onClick={onClearFilters}
          className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
        >
          필터 초기화
        </button>
      )}
    </div>
  );
}
