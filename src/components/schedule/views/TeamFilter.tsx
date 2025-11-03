import React from 'react';

interface Team {
  id: string;
  code: string;
  name: string;
  color: string;
}

interface TeamFilterProps {
  teams: Team[];
  selectedTeams: Set<string>;
  onToggleTeam: (teamId: string) => void;
  onClearFilters: () => void;
}

export function TeamFilter({
  teams,
  selectedTeams,
  onToggleTeam,
  onClearFilters,
}: TeamFilterProps) {
  return (
    <div className="mb-4 flex items-center gap-3 flex-wrap">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">팀 필터:</span>
      {teams.map((team) => {
        const isSelected = selectedTeams.has(team.id);
        const selectedStyle = isSelected
          ? { backgroundColor: team.color, color: 'white' }
          : {};
        const baseClass = !isSelected
          ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          : '';

        return (
          <button
            key={team.id}
            onClick={() => onToggleTeam(team.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${baseClass}`}
            style={isSelected ? selectedStyle : undefined}
          >
            {team.code}팀
          </button>
        );
      })}
      {selectedTeams.size > 0 && (
        <button
          onClick={onClearFilters}
          className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
        >
          필터 초기화
        </button>
      )}
    </div>
  );
}
