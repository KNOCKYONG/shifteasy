import React, { useMemo } from 'react';
import { ListChecks, AlertCircle, Users } from 'lucide-react';
import { api } from '@/lib/trpc/client';

interface WorkSchedule {
  preferredShifts?: ('day' | 'evening' | 'night')[];
}

interface Member {
  id: string;
  name: string;
  position?: string;
  status: string;
  workSchedule?: WorkSchedule;
  skills?: string[];
  teamId?: string | null;
}

interface StaffPreferencesGridProps {
  allMembers: Member[];
  onEmployeeClick: (member: Member) => void;
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedMembers.unassigned.map(member => (
            <div
              key={member.id}
              className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={() => onEmployeeClick(member)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">{member.name}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{member.position}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {/* 선호 시프트 */}
                {member.workSchedule?.preferredShifts && member.workSchedule.preferredShifts.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-green-500 dark:text-green-400">✓</span>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">선호:</span>
                      <span className="ml-1 text-gray-900 dark:text-gray-100">
                        {member.workSchedule.preferredShifts.map((shift: string) =>
                          shift === 'day' ? '주간' : shift === 'evening' ? '저녁' : shift === 'night' ? '야간' : shift
                        ).join(', ')}
                      </span>
                    </div>
                  </div>
                )}

                {/* 회피 시프트 */}
                {(member as any).avoidShifts && (member as any).avoidShifts.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 dark:text-red-400">✗</span>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">회피:</span>
                      <span className="ml-1 text-gray-900 dark:text-gray-100">
                        {(member as any).avoidShifts.map((shift: string) =>
                          shift === 'day' ? '주간' : shift === 'evening' ? '저녁' : shift === 'night' ? '야간' : shift
                        ).join(', ')}
                      </span>
                    </div>
                  </div>
                )}

                {/* 특별 요구사항 */}
                {member.skills?.includes('신입') && (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5" />
                    <div>
                      <span className="text-amber-600 dark:text-amber-400">신입 교육 중</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map(member => (
                <div
                  key={member.id}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => onEmployeeClick(member)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">{member.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{member.position}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {/* 선호 시프트 */}
                    {member.workSchedule?.preferredShifts && member.workSchedule.preferredShifts.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-green-500 dark:text-green-400">✓</span>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">선호:</span>
                          <span className="ml-1 text-gray-900 dark:text-gray-100">
                            {member.workSchedule.preferredShifts.map((shift: string) =>
                              shift === 'day' ? '주간' : shift === 'evening' ? '저녁' : shift === 'night' ? '야간' : shift
                            ).join(', ')}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 회피 시프트 */}
                    {(member as any).avoidShifts && (member as any).avoidShifts.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-red-500 dark:text-red-400">✗</span>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">회피:</span>
                          <span className="ml-1 text-gray-900 dark:text-gray-100">
                            {(member as any).avoidShifts.map((shift: string) =>
                              shift === 'day' ? '주간' : shift === 'evening' ? '저녁' : shift === 'night' ? '야간' : shift
                            ).join(', ')}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 특별 요구사항 */}
                    {member.skills?.includes('신입') && (
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5" />
                        <div>
                          <span className="text-amber-600 dark:text-amber-400">신입 교육 중</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
