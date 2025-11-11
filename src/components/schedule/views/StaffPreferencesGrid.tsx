import React, { useMemo } from 'react';
import { ListChecks, Users } from 'lucide-react';
import { api } from '@/lib/trpc/client';
import type { UnifiedEmployee } from '@/lib/types/unified-employee';

interface StaffPreferencesGridProps {
  allMembers: UnifiedEmployee[];
  onEmployeeClick: (member: UnifiedEmployee) => void;
}

export function StaffPreferencesGrid({ allMembers, onEmployeeClick }: StaffPreferencesGridProps) {
  // Fetch teams
  const { data: teams = [] } = api.teams.getAll.useQuery();

  // Group members by team
  const groupedMembers = useMemo(() => {
    // 1. 팀 배정 안된 직원들
    const unassigned = allMembers
      .filter(m => !m.teamId)
      .sort((a, b) => a.name.localeCompare(b.name));

    // 2. 팀별로 그룹핑
    const byTeam = teams
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .map(team => ({
        team,
        members: allMembers
          .filter(m => m.teamId === team.id)
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter(group => group.members.length > 0);

    return { unassigned, byTeam };
  }, [allMembers, teams]);

  const renderMemberCard = (member: UnifiedEmployee) => {
    const hasCareerInfo = typeof member.yearsOfService === 'number' && Number.isFinite(member.yearsOfService);
    const careerYears = hasCareerInfo ? member.yearsOfService : null;
    const careerLabel = careerYears !== null && careerYears > 0
      ? `${careerYears}년 차`
      : careerYears === 0
        ? '신입'
        : '경력 정보 없음';
    const positionLabel = member.position || '직급 정보 없음';

    return (
      <div
        key={member.id}
        className="bg-gray-50 dark:bg-gray-800 rounded-md p-3 border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        onClick={() => onEmployeeClick(member)}
      >
        <div className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{member.name}</span>
          <span>{careerLabel}</span>
          <span>{positionLabel}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-6">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-blue-500" />
          이번 달 직원 요구사항 및 선호사항
        </h3>

        {/* 팀 배정 안된 직원 */}
        {groupedMembers.unassigned.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                팀 미배정 ({groupedMembers.unassigned.length}명)
              </h4>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-3">
              {groupedMembers.unassigned.map(member => renderMemberCard(member))}
            </div>
          </div>
        )}

        {/* 팀별 그룹 */}
        {groupedMembers.byTeam.map(({ team, members }) => (
          <div key={team.id} className="mb-6 last:mb-0">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: team.color }}
              ></div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {team.name} ({members.length}명)
              </h4>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-3">
              {members.map(member => renderMemberCard(member))}
            </div>
          </div>
        ))}

        {allMembers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">선택된 부서에 직원이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
