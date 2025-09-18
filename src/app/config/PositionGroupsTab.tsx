import { Users, Plus, Edit2, Trash2, ChevronRight } from "lucide-react";
import { useState } from "react";

interface Position {
  value: string;
  label: string;
  level: number;
}

interface PositionGroup {
  id: string;
  name: string;
  description: string;
  positionCodes: string[];
  color: string;
}

interface PositionGroupsTabProps {
  positionGroups: PositionGroup[];
  setPositionGroups: React.Dispatch<React.SetStateAction<PositionGroup[]>>;
  positions: Position[];
}

const GROUP_COLORS = [
  { value: 'blue', label: '파랑', class: 'bg-blue-500' },
  { value: 'green', label: '초록', class: 'bg-green-500' },
  { value: 'purple', label: '보라', class: 'bg-purple-500' },
  { value: 'orange', label: '주황', class: 'bg-orange-500' },
  { value: 'teal', label: '청록', class: 'bg-teal-500' },
  { value: 'pink', label: '분홍', class: 'bg-pink-500' },
];

export function PositionGroupsTab({
  positionGroups,
  setPositionGroups,
  positions,
}: PositionGroupsTabProps) {
  const [newGroup, setNewGroup] = useState<PositionGroup>({
    id: '',
    name: '',
    description: '',
    positionCodes: [],
    color: 'blue',
  });
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);

  const handleAddGroup = () => {
    if (newGroup.name && selectedPositions.length > 0) {
      const groupId = `group-${Date.now()}`;
      const createdGroup = {
        ...newGroup,
        id: groupId,
        positionCodes: selectedPositions,
      };
      const updatedGroups = [...positionGroups, createdGroup];
      setPositionGroups(updatedGroups);
      localStorage.setItem('customPositionGroups', JSON.stringify(updatedGroups));

      // Reset form
      setNewGroup({
        id: '',
        name: '',
        description: '',
        positionCodes: [],
        color: 'blue',
      });
      setSelectedPositions([]);
    }
  };

  const handleUpdateGroup = (groupId: string, updates: Partial<PositionGroup>) => {
    const updatedGroups = positionGroups.map(g =>
      g.id === groupId ? { ...g, ...updates } : g
    );
    setPositionGroups(updatedGroups);
    localStorage.setItem('customPositionGroups', JSON.stringify(updatedGroups));
  };

  const handleDeleteGroup = (groupId: string) => {
    const group = positionGroups.find(g => g.id === groupId);
    if (confirm(`"${group?.name}" 그룹을 삭제하시겠습니까?`)) {
      const updatedGroups = positionGroups.filter(g => g.id !== groupId);
      setPositionGroups(updatedGroups);
      localStorage.setItem('customPositionGroups', JSON.stringify(updatedGroups));
    }
  };

  const togglePosition = (positionCode: string, isEditing: boolean = false, groupId?: string) => {
    if (isEditing && groupId) {
      const group = positionGroups.find(g => g.id === groupId);
      if (group) {
        const currentPositions = group.positionCodes;
        const newPositions = currentPositions.includes(positionCode)
          ? currentPositions.filter(p => p !== positionCode)
          : [...currentPositions, positionCode];
        handleUpdateGroup(groupId, { positionCodes: newPositions });
      }
    } else {
      setSelectedPositions(prev =>
        prev.includes(positionCode)
          ? prev.filter(p => p !== positionCode)
          : [...prev, positionCode]
      );
    }
  };

  const getPositionsByLevel = () => {
    return [...positions].sort((a, b) => b.level - a.level);
  };

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 flex items-start gap-3">
        <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-indigo-900 dark:text-indigo-300 font-medium">
            직책 그룹 관리
          </p>
          <p className="text-sm text-indigo-700 dark:text-indigo-400 mt-1">
            유사한 직책들을 그룹으로 묶어 스케줄 밸런싱에 활용합니다.
          </p>
          <p className="text-sm text-indigo-600 dark:text-indigo-500 mt-1 font-medium">
            💡 그룹별로 최소 인원을 설정하여 균형잡힌 스케줄을 만들 수 있습니다.
          </p>
        </div>
      </div>

      {/* Add new group form */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
          새 그룹 추가
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="그룹명 (예: 시니어 그룹)"
              value={newGroup.name}
              onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <input
              type="text"
              placeholder="설명 (선택사항)"
              value={newGroup.description}
              onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <select
              value={newGroup.color}
              onChange={(e) => setNewGroup({ ...newGroup, color: e.target.value })}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              {GROUP_COLORS.map(color => (
                <option key={color.value} value={color.value}>{color.label}</option>
              ))}
            </select>
          </div>

          {/* Position selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              그룹에 포함할 직책 선택
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {getPositionsByLevel().map((position) => (
                <label
                  key={position.value}
                  className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPositions.includes(position.value)}
                    onChange={() => togglePosition(position.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {position.label}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    (Lv.{position.level})
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleAddGroup}
            disabled={!newGroup.name || selectedPositions.length === 0}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            그룹 추가
          </button>
        </div>
      </div>

      {/* Groups list */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
          직책 그룹 목록
        </h3>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {positionGroups.map((group) => (
            <div key={group.id} className="py-4">
              {editingGroup === group.id ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      defaultValue={group.name}
                      onBlur={(e) => handleUpdateGroup(group.id, { name: e.target.value })}
                      className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                    <input
                      type="text"
                      defaultValue={group.description}
                      onBlur={(e) => handleUpdateGroup(group.id, { description: e.target.value })}
                      className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                    <select
                      defaultValue={group.color}
                      onChange={(e) => handleUpdateGroup(group.id, { color: e.target.value })}
                      className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    >
                      {GROUP_COLORS.map(color => (
                        <option key={color.value} value={color.value}>{color.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      포함된 직책
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {getPositionsByLevel().map((position) => (
                        <label
                          key={position.value}
                          className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={group.positionCodes.includes(position.value)}
                            onChange={() => togglePosition(position.value, true, group.id)}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {position.label}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            (Lv.{position.level})
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setEditingGroup(null)}
                    className="px-3 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600"
                  >
                    완료
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-4 h-4 rounded bg-${group.color}-500 mt-1`}></div>
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-900 dark:text-gray-100 font-medium text-lg">
                          {group.name}
                        </span>
                        {group.description && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {group.description}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {group.positionCodes.map(code => {
                          const position = positions.find(p => p.value === code);
                          return position ? (
                            <span
                              key={code}
                              className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm flex items-center gap-1"
                            >
                              {position.label}
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Lv.{position.level}
                              </span>
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingGroup(group.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {positionGroups.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            아직 등록된 직책 그룹이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}