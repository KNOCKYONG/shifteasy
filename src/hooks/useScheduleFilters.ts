import { useState, useDeferredValue } from 'react';

/**
 * 스케줄 페이지의 필터 및 뷰 상태를 관리하는 커스텀 훅
 * ✅ OPTIMIZED: useDeferredValue를 사용하여 필터 변경 시 UI 블로킹 방지
 */
export function useScheduleFilters() {
  // View State
  const [activeView, setActiveView] = useState<'preferences' | 'today' | 'schedule' | 'calendar'>('preferences');
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [showCodeFormat, setShowCodeFormat] = useState(true);

  // Filter State (immediate updates)
  const [selectedShiftTypes, setSelectedShiftTypes] = useState<Set<string>>(new Set());
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [showMyScheduleOnly, setShowMyScheduleOnly] = useState(false);
  const [showSameSchedule, setShowSameSchedule] = useState(false);

  // ✅ OPTIMIZED: Deferred values for non-blocking UI updates
  const deferredShiftTypes = useDeferredValue(selectedShiftTypes);
  const deferredTeams = useDeferredValue(selectedTeams);

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

  // Helper function: Toggle team
  const toggleTeam = (teamId: string) => {
    setSelectedTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  // Helper function: Clear all team filters
  const clearTeamFilters = () => {
    setSelectedTeams(new Set());
  };

  return {
    // View State
    activeView,
    setActiveView,
    viewMode,
    setViewMode,
    showCodeFormat,
    setShowCodeFormat,

    // Filter State (immediate for UI feedback)
    selectedShiftTypes,
    setSelectedShiftTypes,
    selectedTeams,
    setSelectedTeams,
    showMyScheduleOnly,
    setShowMyScheduleOnly,
    showSameSchedule,
    setShowSameSchedule,

    // ✅ OPTIMIZED: Deferred values for filtering logic (non-blocking)
    deferredShiftTypes,
    deferredTeams,

    // Helper Functions
    toggleShiftType,
    clearShiftTypeFilters,
    toggleTeam,
    clearTeamFilters,
  };
}
