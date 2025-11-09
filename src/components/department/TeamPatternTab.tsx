"use client";

import { TeamPatternPanel } from "./TeamPatternPanel";

interface ShiftType {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
}

interface TeamPatternTabProps {
  departmentId: string;
  departmentName: string;
  totalMembers: number;
  canEdit: boolean;
  shiftTypes: ShiftType[];
}

export function TeamPatternTab({
  departmentId,
  departmentName,
  totalMembers,
  canEdit,
  shiftTypes,
}: TeamPatternTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">부서 패턴 설정</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          부서별 근무 패턴을 설정하고 관리할 수 있습니다
        </p>
      </div>

      <TeamPatternPanel
        departmentId={departmentId}
        departmentName={departmentName}
        totalMembers={totalMembers}
        canEdit={canEdit}
        shiftTypes={shiftTypes}
      />
    </div>
  );
}
