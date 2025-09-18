"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type ShiftType } from "@/lib/types";
import { getShiftOptions } from "@/lib/config/shiftTypes";
import { useState, useEffect } from "react";

interface ShiftCellProps {
  id: string;
  shift?: ShiftType;
  isDisabled?: boolean;
  onShiftChange?: (shift: ShiftType | null) => void;
}

export function ShiftCell({ id, shift, isDisabled, onShiftChange }: ShiftCellProps) {
  const [shiftOptions, setShiftOptions] = useState(getShiftOptions());

  useEffect(() => {
    // Reload shift options when component mounts or localStorage changes
    const loadOptions = () => setShiftOptions(getShiftOptions());
    loadOptions();

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'customShiftTypes') {
        loadOptions();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: isDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = () => {
    if (isDisabled || !onShiftChange) return;

    // Cycle through shifts dynamically based on configured shift types
    const shiftCodes = shiftOptions.map(opt => opt.value as ShiftType);
    const shiftOrder: (ShiftType | null)[] = [null, ...shiftCodes];
    const currentIndex = shift ? shiftOrder.indexOf(shift) : 0;
    const nextIndex = (currentIndex + 1) % shiftOrder.length;
    onShiftChange(shiftOrder[nextIndex]);
  };

  if (!shift) {
    return (
      <div className="flex items-center justify-center h-full">
        <button
          onClick={handleClick}
          disabled={isDisabled}
          className={`w-16 h-10 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-all ${
            isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
          }`}
        >
          <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
        </button>
      </div>
    );
  }

  const shiftConfig = shiftOptions.find(s => s.value === shift) || shiftOptions[0];

  return (
    <div className="flex items-center justify-center h-full">
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={handleClick}
        className={`
          w-16 h-10 rounded-xl font-medium flex items-center justify-center
          ${shiftConfig.colors.bg} ${shiftConfig.colors.border} ${shiftConfig.colors.text}
          border-2 shadow-sm hover:shadow-md transition-all cursor-pointer
          ${isDisabled ? "cursor-not-allowed opacity-60" : "cursor-move hover:scale-105"}
        `}
      >
        <span className="text-sm font-semibold select-none">{shift}</span>
      </div>
    </div>
  );
}