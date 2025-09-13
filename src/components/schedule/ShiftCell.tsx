"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type ShiftType } from "@/lib/types";

interface ShiftCellProps {
  id: string;
  shift?: ShiftType;
  isDisabled?: boolean;
  onShiftChange?: (shift: ShiftType | null) => void;
}

const SHIFT_OPTIONS: { value: ShiftType; label: string; colors: { bg: string; border: string; text: string } }[] = [
  {
    value: "D",
    label: "주간",
    colors: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" }
  },
  {
    value: "E",
    label: "저녁",
    colors: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" }
  },
  {
    value: "N",
    label: "야간",
    colors: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700" }
  },
  {
    value: "O",
    label: "휴무",
    colors: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-500" }
  },
];

export function ShiftCell({ id, shift, isDisabled, onShiftChange }: ShiftCellProps) {
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

    // Cycle through shifts: null -> D -> E -> N -> O -> null
    const shiftOrder: (ShiftType | null)[] = [null, "D", "E", "N", "O"];
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
          className={`w-16 h-10 rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all ${
            isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
          }`}
        >
          <span className="text-gray-400 text-sm">-</span>
        </button>
      </div>
    );
  }

  const shiftConfig = SHIFT_OPTIONS.find(s => s.value === shift) || SHIFT_OPTIONS[0];

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