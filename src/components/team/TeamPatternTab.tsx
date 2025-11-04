"use client";

import { TeamPatternPanel } from "./TeamPatternPanel";

interface TeamPatternTabProps {
  departmentId: string;
  departmentName: string;
  totalMembers: number;
  canEdit: boolean;
}

export function TeamPatternTab({
  departmentId,
  departmentName,
  totalMembers,
  canEdit,
}: TeamPatternTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">팀 패턴 설정</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          팀별 근무 패턴을 설정하고 관리할 수 있습니다
        </p>
      </div>

      <TeamPatternPanel
        departmentId={departmentId}
        departmentName={departmentName}
        totalMembers={totalMembers}
        canEdit={canEdit}
      />
    </div>
  );
}
