import { useState } from 'react';

/**
 * 스케줄 페이지의 필터 및 뷰 상태를 관리하는 커스텀 훅
 */
export function useScheduleFilters() {
  // View State
  const [activeView, setActiveView] = useState<'preferences' | 'today' | 'schedule'>('preferences');
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [showCodeFormat, setShowCodeFormat] = useState(false);

  // Filter State
  const [selectedShiftTypes, setSelectedShiftTypes] = useState<Set<string>>(new Set());
  const [showMyScheduleOnly, setShowMyScheduleOnly] = useState(false);
  const [showSameSchedule, setShowSameSchedule] = useState(false);

  // Helper function: Toggle shift type
  const toggleShiftType = (shiftType: string) => {
    setSelectedShiftTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(shiftType)) {
        newSet.delete(shiftType);
      } else {
        newSet.add(shiftType);
      }
      return newSet;
    });
  };

  // Helper function: Clear all shift type filters
  const clearShiftTypeFilters = () => {
    setSelectedShiftTypes(new Set());
  };

  return {
    // View State
    activeView,
    setActiveView,
    viewMode,
    setViewMode,
    showCodeFormat,
    setShowCodeFormat,

    // Filter State
    selectedShiftTypes,
    setSelectedShiftTypes,
    showMyScheduleOnly,
    setShowMyScheduleOnly,
    showSameSchedule,
    setShowSameSchedule,

    // Helper Functions
    toggleShiftType,
    clearShiftTypeFilters,
  };
}
