"use client";
import { useState, useCallback } from "react";
import { format, startOfWeek, addDays, isSameDay, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { StaffCard } from "./StaffCard";
import { ShiftCell } from "./ShiftCell";
import { EmployeePreferencesModal, type ExtendedEmployeePreferences } from "./EmployeePreferencesModal";
import { type Staff, type ShiftType, type WeekSchedule } from "@/lib/types";
import { type Employee } from "@/lib/scheduler/types";
import { SHIFT_COLORS } from "@/lib/constants";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { staffToEmployee } from "@/lib/utils/staff-converter";
import { api } from "@/trpc/react";

const DAYS = DAYS_OF_WEEK.KO; // Use Korean days by default

interface ScheduleBoardProps {
  staff: Staff[];
  schedule: WeekSchedule;
  currentWeek: Date;
  onScheduleChange: (schedule: WeekSchedule) => void;
  isConfirmed?: boolean;
}

export function ScheduleBoard({
  staff,
  schedule,
  currentWeek,
  onScheduleChange,
  isConfirmed = false,
}: ScheduleBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedShift, setDraggedShift] = useState<{
    staffId: string;
    day: number;
    shift: ShiftType;
  } | null>(null);

  // Modal state for employee preferences
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);

  // TRPC mutation for saving preferences
  const savePreferences = api.preferences.upsert.useMutation({
    onSuccess: () => {
      console.log('Preferences saved successfully');
      // TODO: Show success toast
    },
    onError: (error) => {
      console.error('Failed to save preferences:', error);
      // TODO: Show error toast
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    // Parse the drag data from the id
    const [staffId, day, shift] = (active.id as string).split("-");
    if (staffId && day && shift) {
      setDraggedShift({
        staffId,
        day: parseInt(day),
        shift: shift as ShiftType,
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || isConfirmed) {
      setActiveId(null);
      setDraggedShift(null);
      return;
    }

    // Parse source and destination
    const [fromStaffId, fromDay] = (active.id as string).split("-");
    const [toStaffId, toDay] = (over.id as string).split("-");

    if (fromStaffId && toStaffId && fromDay && toDay) {
      const newSchedule = { ...schedule };

      // Swap shifts
      const fromShift = newSchedule[fromStaffId]?.[parseInt(fromDay)];
      const toShift = newSchedule[toStaffId]?.[parseInt(toDay)];

      if (!newSchedule[fromStaffId]) newSchedule[fromStaffId] = {};
      if (!newSchedule[toStaffId]) newSchedule[toStaffId] = {};

      if (toShift) {
        newSchedule[fromStaffId][parseInt(fromDay)] = toShift;
      } else {
        delete newSchedule[fromStaffId][parseInt(fromDay)];
      }

      if (fromShift) {
        newSchedule[toStaffId][parseInt(toDay)] = fromShift;
      } else {
        delete newSchedule[toStaffId][parseInt(toDay)];
      }

      onScheduleChange(newSchedule);
    }

    setActiveId(null);
    setDraggedShift(null);
  };

  // Handle staff card click to open preferences modal
  const handleStaffClick = (member: Staff) => {
    setSelectedStaff(member);
    setIsPreferencesModalOpen(true);
  };

  // Handle preferences save
  const handlePreferencesSave = async (preferences: ExtendedEmployeePreferences) => {
    if (!selectedStaff) return;

    // Convert ExtendedEmployeePreferences to API format
    const preferenceData = {
      staffId: selectedStaff.id,
      preferredShiftTypes: {
        D: preferences.preferredShifts.includes('day') ? 10 : 0,
        E: preferences.preferredShifts.includes('evening') ? 10 : 0,
        N: preferences.preferredShifts.includes('night') ? 10 : 0,
      },
      maxConsecutiveDaysPreferred: preferences.maxConsecutiveDays,
      preferAlternatingWeekends: preferences.flexibilityLevel === 'high',
      preferredColleagues: preferences.preferredPartners || [],
      avoidColleagues: preferences.avoidPartners || [],
      mentorshipPreference: preferences.mentorshipRole,
      workLifeBalance: {
        childcare: preferences.personalConstraints.some(c => c.type === 'childcare'),
        eldercare: preferences.personalConstraints.some(c => c.type === 'eldercare'),
        education: preferences.personalConstraints.some(c => c.type === 'education'),
        secondJob: false,
      },
      commutePreferences: {
        maxCommuteTime: preferences.commuteConsiderations.maxCommuteTime,
        preferPublicTransport: preferences.commuteConsiderations.publicTransportDependent,
        parkingRequired: preferences.commuteConsiderations.needsParking,
      },
    };

    // Save via TRPC
    await savePreferences.mutateAsync(preferenceData);

    // Close modal
    setIsPreferencesModalOpen(false);
    setSelectedStaff(null);
  };

  // Handle modal close
  const handleModalClose = () => {
    setIsPreferencesModalOpen(false);
    setSelectedStaff(null);
  };

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 border border-gray-100 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            주간 스케줄
          </h2>
          {isConfirmed && (
            <span className="px-3 py-1 bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
              확정됨
            </span>
          )}
        </div>
      </div>

      {/* Schedule Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700">
                <th className="sticky left-0 bg-white dark:bg-slate-800 z-10 px-6 py-3 text-left">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">직원</span>
                </th>
                {weekDates.map((date, i) => (
                  <th key={i} className="px-2 py-3 text-center min-w-[100px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-xs font-medium ${
                        isToday(date) ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
                      }`}>
                        {DAYS[i]}
                      </span>
                      <span className={`text-sm font-semibold ${
                        isToday(date) ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white"
                      }`}>
                        {format(date, "M/d")}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="sticky left-0 bg-white dark:bg-slate-800 z-10 px-6 py-4">
                    <StaffCard
                      staff={member}
                      compact
                      onClick={() => handleStaffClick(member)}
                    />
                  </td>
                  {weekDates.map((_, dayIndex) => {
                    const shift = schedule[member.id]?.[dayIndex];
                    return (
                      <td key={dayIndex} className="px-2 py-4">
                        <ShiftCell
                          id={`${member.id}-${dayIndex}`}
                          shift={shift}
                          isDisabled={isConfirmed}
                          onShiftChange={(newShift) => {
                            if (!isConfirmed) {
                              const newSchedule = { ...schedule };
                              if (!newSchedule[member.id]) {
                                newSchedule[member.id] = {};
                              }
                              if (newShift) {
                                newSchedule[member.id][dayIndex] = newShift;
                              } else {
                                delete newSchedule[member.id][dayIndex];
                              }
                              onScheduleChange(newSchedule);
                            }
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DragOverlay>
          {activeId && draggedShift && (
            <div className={`px-4 py-2 rounded-xl font-medium shadow-lg ${
              SHIFT_COLORS[draggedShift.shift].bg
            } ${SHIFT_COLORS[draggedShift.shift].border} ${
              SHIFT_COLORS[draggedShift.shift].text
            } border-2`}>
              {draggedShift.shift}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Footer Stats */}
      <div className="px-6 py-4 bg-gray-50/50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {Object.entries(SHIFT_COLORS).map(([shift, colors]) => (
              <div key={shift} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${colors.bg} ${colors.border} border`} />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {shift === "D" ? "주간" : shift === "E" ? "저녁" : shift === "N" ? "야간" : "휴무"}
                </span>
              </div>
            ))}
          </div>
          <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
            통계 보기
          </button>
        </div>
      </div>

      {/* Employee Preferences Modal */}
      {isPreferencesModalOpen && selectedStaff && (
        <EmployeePreferencesModal
          employee={staffToEmployee(selectedStaff)}
          teamMembers={staff.map(staffToEmployee)}
          onSave={handlePreferencesSave}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}