"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DragOverEvent,
  Active,
  Over,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, addDays } from "date-fns";
import { ko } from "date-fns/locale";
import { GripVertical, User, AlertTriangle, CheckCircle2, ArrowUpDown } from "lucide-react";
import { type ScheduleAssignment } from "@/lib/scheduler/types";
import { type Staff } from "@/lib/types";

interface DraggableScheduleViewProps {
  schedule: ScheduleAssignment[];
  staff: Staff[];
  currentWeek: Date;
  onScheduleUpdate: (schedule: ScheduleAssignment[]) => void;
  onCellClick?: (employeeId: string, date: Date, shiftId: string) => void;
  highlightChanges?: boolean;
  originalSchedule?: ScheduleAssignment[];
}

interface ShiftCellProps {
  assignment: ScheduleAssignment | undefined;
  employeeId: string;
  date: Date;
  isOver?: boolean;
  isDragging?: boolean;
  canDrop?: boolean;
  isChanged?: boolean;
}

// 드래그 가능한 직원 카드
function DraggableEmployeeShift({
  assignment,
  employeeId,
  date,
  staffMember,
  isChanged,
}: {
  assignment: ScheduleAssignment | undefined;
  employeeId: string;
  date: Date;
  staffMember: Staff;
  isChanged?: boolean;
}) {
  const dragId = `${employeeId}-${date.toISOString()}`;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: dragId,
    data: {
      type: 'shift',
      employeeId,
      date,
      assignment,
      staffMember,
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getShiftColor = (shiftId: string | undefined) => {
    if (!shiftId) return "bg-gray-100 dark:bg-gray-800";
    if (shiftId.includes("day")) return "bg-blue-100 dark:bg-blue-900/30";
    if (shiftId.includes("evening")) return "bg-purple-100 dark:bg-purple-900/30";
    if (shiftId.includes("night")) return "bg-indigo-100 dark:bg-indigo-900/30";
    return "bg-gray-100 dark:bg-gray-800";
  };

  const getShiftTextColor = (shiftId: string | undefined) => {
    if (!shiftId) return "text-gray-500 dark:text-gray-400";
    if (shiftId.includes("day")) return "text-blue-700 dark:text-blue-300";
    if (shiftId.includes("evening")) return "text-purple-700 dark:text-purple-300";
    if (shiftId.includes("night")) return "text-indigo-700 dark:text-indigo-300";
    return "text-gray-500 dark:text-gray-400";
  };

  const getShiftName = (shiftId: string | undefined) => {
    if (!shiftId) return "휴무";
    if (shiftId.includes("day")) return "주간";
    if (shiftId.includes("evening")) return "저녁";
    if (shiftId.includes("night")) return "야간";
    return shiftId;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative p-2 rounded-lg border transition-all cursor-move
        ${getShiftColor(assignment?.shiftId)}
        ${isDragging ? 'shadow-lg scale-105 z-50' : 'hover:shadow-md'}
        ${isChanged ? 'ring-2 ring-orange-400 ring-opacity-50' : 'border-gray-200 dark:border-gray-700'}
      `}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400" />
          <span className={`text-sm font-medium ${getShiftTextColor(assignment?.shiftId)}`}>
            {getShiftName(assignment?.shiftId)}
          </span>
        </div>
        {isChanged && (
          <span className="text-xs text-orange-500 dark:text-orange-400">변경됨</span>
        )}
      </div>
    </div>
  );
}

// 드롭 가능한 스케줄 셀
function DroppableScheduleCell({
  assignment,
  employeeId,
  date,
  isOver,
  canDrop,
  isChanged,
}: ShiftCellProps) {
  const dropId = `drop-${employeeId}-${date.toISOString()}`;

  const {
    setNodeRef,
    isOver: localIsOver,
  } = useSortable({
    id: dropId,
    data: {
      type: 'cell',
      employeeId,
      date,
      accepts: ['shift'],
    }
  });

  const getShiftColor = (shiftId: string | undefined) => {
    if (!shiftId) return "";
    if (shiftId.includes("day")) return "#3B82F6";
    if (shiftId.includes("evening")) return "#9333EA";
    if (shiftId.includes("night")) return "#6366F1";
    return "#6B7280";
  };

  return (
    <div
      ref={setNodeRef}
      className={`
        p-1 border-l border-gray-100 dark:border-gray-800 min-h-[40px]
        ${localIsOver || isOver ? 'bg-blue-50 dark:bg-blue-950/20' : ''}
        ${canDrop ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}
        ${isChanged ? 'bg-orange-50 dark:bg-orange-950/10' : ''}
      `}
    >
      {assignment && (
        <div
          className="px-2 py-1 rounded text-xs font-medium text-white text-center"
          style={{ backgroundColor: getShiftColor(assignment.shiftId) }}
        >
          {assignment.shiftId.includes("day") && "주간"}
          {assignment.shiftId.includes("evening") && "저녁"}
          {assignment.shiftId.includes("night") && "야간"}
        </div>
      )}
      {!assignment && (
        <div className="px-2 py-1 rounded text-xs text-gray-400 dark:text-gray-500 text-center bg-gray-50 dark:bg-gray-800">
          휴무
        </div>
      )}
    </div>
  );
}

export function DraggableScheduleView({
  schedule,
  staff,
  currentWeek,
  onScheduleUpdate,
  onCellClick,
  highlightChanges = false,
  originalSchedule = [],
}: DraggableScheduleViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 주간 날짜 배열 생성
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));

  // 스케줄 데이터를 맵으로 변환
  const scheduleMap = useMemo(() => {
    const map = new Map<string, ScheduleAssignment>();
    schedule.forEach(assignment => {
      const dateStr = assignment.date instanceof Date
        ? assignment.date.toISOString().split('T')[0]
        : assignment.date;
      const key = `${assignment.employeeId}-${dateStr}`;
      map.set(key, assignment);
    });
    return map;
  }, [schedule]);

  // 원본 스케줄 맵
  const originalMap = useMemo(() => {
    const map = new Map<string, ScheduleAssignment>();
    originalSchedule.forEach(assignment => {
      const dateStr = assignment.date instanceof Date
        ? assignment.date.toISOString().split('T')[0]
        : assignment.date;
      const key = `${assignment.employeeId}-${dateStr}`;
      map.set(key, assignment);
    });
    return map;
  }, [originalSchedule]);

  // 변경 여부 확인
  const isChanged = (employeeId: string, date: Date) => {
    if (!highlightChanges) return false;
    const key = `${employeeId}-${date.toISOString().split('T')[0]}`;
    const current = scheduleMap.get(key);
    const original = originalMap.get(key);

    if (!current && !original) return false;
    if (!current || !original) return true;
    return current.shiftId !== original.shiftId;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    setDraggedItem(active.data.current);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveId(null);
      setOverId(null);
      setDraggedItem(null);
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    // 스왑 로직
    if (activeData?.type === 'shift' && overData?.type === 'cell') {
      const newSchedule = [...schedule];

      // 드래그한 직원의 스케줄 찾기
      const activeDateStr = activeData.date.toISOString().split('T')[0];
      const activeIndex = newSchedule.findIndex(
        s => s.employeeId === activeData.employeeId &&
            (s.date instanceof Date ? s.date.toISOString().split('T')[0] : s.date) === activeDateStr
      );

      // 드롭 위치의 스케줄 찾기
      const overDateStr = overData.date.toISOString().split('T')[0];
      const overIndex = newSchedule.findIndex(
        s => s.employeeId === overData.employeeId &&
            (s.date instanceof Date ? s.date.toISOString().split('T')[0] : s.date) === overDateStr
      );

      if (activeIndex !== -1 && overIndex !== -1) {
        // 시프트 스왑
        const tempShift = newSchedule[activeIndex].shiftId;
        newSchedule[activeIndex].shiftId = newSchedule[overIndex].shiftId;
        newSchedule[overIndex].shiftId = tempShift;
      } else if (activeIndex !== -1 && overIndex === -1) {
        // 빈 슬롯으로 이동
        const activeAssignment = newSchedule[activeIndex];
        const newAssignment: ScheduleAssignment = {
          employeeId: overData.employeeId,
          date: overData.date,
          shiftId: activeAssignment.shiftId,
          isLocked: false,
        };
        newSchedule[activeIndex].shiftId = "off";
        newSchedule.push(newAssignment);
      }

      onScheduleUpdate(newSchedule);
    }

    setActiveId(null);
    setOverId(null);
    setDraggedItem(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
    setDraggedItem(null);
  };

  // 모든 드래그 가능한 아이템의 ID 목록
  const allIds = staff.flatMap(member =>
    weekDates.map(date => `${member.id}-${date.toISOString()}`)
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                드래그 & 드롭으로 스케줄 수정
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-100 rounded"></div>
                <span className="text-gray-600 dark:text-gray-400">주간</span>
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-purple-100 rounded"></div>
                <span className="text-gray-600 dark:text-gray-400">저녁</span>
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-indigo-100 rounded"></div>
                <span className="text-gray-600 dark:text-gray-400">야간</span>
              </span>
            </div>
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="overflow-x-auto">
          <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
            <div className="min-w-[800px]">
              {/* Date Headers */}
              <div className="grid grid-cols-8 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="p-4 font-medium text-sm text-gray-700 dark:text-gray-300">
                  직원
                </div>
                {weekDates.map((date, i) => (
                  <div key={i} className="p-4 text-center border-l border-gray-200 dark:border-gray-700">
                    <div className="font-medium text-sm text-gray-700 dark:text-gray-300">
                      {date.toLocaleDateString('ko-KR', { weekday: 'short' })}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {format(date, 'M/d')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Employee Rows */}
              {staff.map(member => (
                <div key={member.id} className="grid grid-cols-8 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="p-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {member.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {member.role}
                    </div>
                  </div>
                  {weekDates.map((date, dayIndex) => {
                    const dateStr = date.toISOString().split('T')[0];
                    const assignment = schedule.find(
                      a => a.employeeId === member.id &&
                          (a.date instanceof Date ? a.date.toISOString().split('T')[0] : a.date) === dateStr
                    );
                    const changed = isChanged(member.id, date);

                    return (
                      <DroppableScheduleCell
                        key={dayIndex}
                        assignment={assignment}
                        employeeId={member.id}
                        date={date}
                        isOver={overId === `drop-${member.id}-${date.toISOString()}`}
                        canDrop={activeId !== null && activeId !== `${member.id}-${date.toISOString()}`}
                        isChanged={changed}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </SortableContext>
        </div>

        {/* Instructions */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            💡 팁: 직원의 시프트를 드래그하여 다른 직원이나 날짜로 이동할 수 있습니다.
            변경사항은 실시간으로 페널티가 계산됩니다.
          </p>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && draggedItem && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-3 border-2 border-blue-500">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">
                {draggedItem.staffMember?.name}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {draggedItem.assignment?.shiftId || "휴무"}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}