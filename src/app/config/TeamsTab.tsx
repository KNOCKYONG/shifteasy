"use client";
import { useState } from "react";
import { Plus, Edit2, Trash2, Users, Save, ChevronDown, ChevronUp, X } from "lucide-react";
import { api } from "@/lib/trpc/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface Team {
  id: string;
  name: string;
  code: string;
  color: string;
  departmentId: string | null;
  displayOrder: number | null;
  isActive: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  employeeId: string | null;
  position: string | null;
  teamId: string | null;
}

const COLOR_OPTIONS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

export function TeamsTab() {
  const currentUser = useCurrentUser();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
  const [unassignedCollapsed, setUnassignedCollapsed] = useState(false);
  const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);
  const [unassigningMember, setUnassigningMember] = useState<TeamMember | null>(null);

  const [newTeam, setNewTeam] = useState({
    name: '',
    code: '',
    color: COLOR_OPTIONS[0],
  });

  // Fetch teams
  const { data: teams = [], refetch: refetchTeams } = api.teams.getAll.useQuery(undefined, {
    staleTime: 3 * 60 * 1000, // 3분 동안 fresh 유지 (팀 정보는 가끔 변경됨)
    refetchOnWindowFocus: false, // 탭 전환 시 refetch 비활성화
  });

  // Fetch all users
  const { data: usersData, refetch: refetchUsers } = api.tenant.users.list.useQuery({
    limit: 100,
    offset: 0,
  }, {
    staleTime: 3 * 60 * 1000, // 3분 동안 fresh 유지
    refetchOnWindowFocus: false, // 탭 전환 시 refetch 비활성화
  });
  const allUsers = usersData?.items || [];

  // Mutations
  const createTeam = api.teams.create.useMutation({
    onSuccess: () => {
      refetchTeams();
      setShowAddModal(false);
      setNewTeam({ name: '', code: '', color: COLOR_OPTIONS[0] });
      alert('팀이 생성되었습니다');
    },
    onError: (error) => {
      alert('팀 생성 실패: ' + error.message);
    },
  });

  const updateTeam = api.teams.update.useMutation({
    onSuccess: () => {
      refetchTeams();
      setShowEditModal(false);
      setEditingTeam(null);
      alert('팀이 수정되었습니다');
    },
    onError: (error) => {
      alert('팀 수정 실패: ' + error.message);
    },
  });

  const deleteTeam = api.teams.delete.useMutation({
    onSuccess: () => {
      refetchTeams();
      setShowDeleteConfirm(false);
      setDeletingTeam(null);
      alert('팀이 삭제되었습니다');
    },
    onError: (error) => {
      alert('팀 삭제 실패: ' + error.message);
    },
  });

  const updateUserTeam = api.tenant.users.update.useMutation({
    onSuccess: () => {
      // UI에 즉각 반영 - alert 대신 자동 refetch
      refetchUsers();
    },
    onError: (error) => {
      alert('팀 배정 실패: ' + error.message);
    },
  });

  // Get team members for each team
  const getTeamMembers = (teamId: string): TeamMember[] => {
    return allUsers.filter(user => user.teamId === teamId);
  };

  // Get unassigned members
  const getUnassignedMembers = (): TeamMember[] => {
    return allUsers.filter(user => !user.teamId);
  };

  const handleCreateTeam = () => {
    if (!newTeam.name.trim() || !newTeam.code.trim()) {
      alert('팀 이름과 코드를 입력해주세요');
      return;
    }

    createTeam.mutate({
      name: newTeam.name,
      code: newTeam.code,
      color: newTeam.color,
      departmentId: currentUser.dbUser?.departmentId || undefined,
    });
  };

  const handleUpdateTeam = () => {
    if (!editingTeam) return;

    updateTeam.mutate({
      id: editingTeam.id,
      name: editingTeam.name,
      code: editingTeam.code,
      color: editingTeam.color,
    });
  };

  const handleDeleteTeam = () => {
    if (!deletingTeam) return;
    deleteTeam.mutate({ id: deletingTeam.id });
  };

  const toggleTeamCollapse = (teamId: string) => {
    setCollapsedTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  const handleAssignToTeam = (userId: string, teamId: string) => {
    updateUserTeam.mutate({
      userId: userId,
      teamId: teamId,
    });
  };

  const handleUnassignFromTeam = (member: TeamMember) => {
    setUnassigningMember(member);
    setShowUnassignConfirm(true);
  };

  const confirmUnassign = () => {
    if (!unassigningMember) return;
    updateUserTeam.mutate({
      userId: unassigningMember.id,
      teamId: null,
    });
    setShowUnassignConfirm(false);
    setUnassigningMember(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">팀 배정</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            팀을 생성하고 직원을 배정할 수 있습니다
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          팀 추가
        </button>
      </div>

      {/* Unassigned Members Section - Moved to top */}
      {getUnassignedMembers().length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setUnassignedCollapsed(!unassignedCollapsed)}
              className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              {unassignedCollapsed ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              팀 미배정 ({getUnassignedMembers().length}명)
            </h4>
          </div>
          {!unassignedCollapsed && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getUnassignedMembers().map((member) => (
                <div
                  key={member.id}
                  className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-4 border border-amber-200 dark:border-amber-800"
                >
                  <div className="mb-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{member.name}</div>
                    {member.employeeId && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        사번: {member.employeeId}
                      </div>
                    )}
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {member.position || '직책 미지정'}
                    </div>
                  </div>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAssignToTeam(member.id, e.target.value);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    defaultValue=""
                  >
                    <option value="">팀 선택...</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.code})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Teams List */}
      <div className="space-y-6">
        {teams.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">등록된 팀이 없습니다</p>
          </div>
        ) : (
          teams.map((team) => {
            const teamMembers = getTeamMembers(team.id);

            return (
              <div key={team.id} className="mb-6 last:mb-0">
                {/* Team Header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleTeamCollapse(team.id)}
                      className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                      {collapsedTeams.has(team.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronUp className="w-4 h-4" />
                      )}
                    </button>
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: team.color }}
                    ></div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {team.name} ({teamMembers.length}명)
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingTeam(team);
                        setShowEditModal(true);
                      }}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setDeletingTeam(team);
                        setShowDeleteConfirm(true);
                      }}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Team Members Grid */}
                {!collapsedTeams.has(team.id) && (
                  teamMembers.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                      배정된 직원이 없습니다
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {teamMembers.map((member) => (
                        <div
                          key={member.id}
                          className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 relative"
                        >
                          <button
                            onClick={() => handleUnassignFromTeam(member)}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100 pr-6">{member.name}</div>
                            {member.employeeId && (
                              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                사번: {member.employeeId}
                              </div>
                            )}
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {member.position || '직책 미지정'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Team Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">팀 추가</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  팀 이름
                </label>
                <input
                  type="text"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  placeholder="예: A팀"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  팀 코드
                </label>
                <input
                  type="text"
                  value={newTeam.code}
                  onChange={(e) => setNewTeam({ ...newTeam, code: e.target.value.toUpperCase() })}
                  placeholder="예: A"
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  팀 색상
                </label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewTeam({ ...newTeam, color })}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        newTeam.color === color
                          ? 'border-gray-900 dark:border-white scale-110'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewTeam({ name: '', code: '', color: COLOR_OPTIONS[0] });
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                취소
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={!newTeam.name.trim() || !newTeam.code.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {showEditModal && editingTeam && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">팀 수정</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  팀 이름
                </label>
                <input
                  type="text"
                  value={editingTeam.name}
                  onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  팀 코드
                </label>
                <input
                  type="text"
                  value={editingTeam.code}
                  onChange={(e) => setEditingTeam({ ...editingTeam, code: e.target.value.toUpperCase() })}
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  팀 색상
                </label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditingTeam({ ...editingTeam, color })}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        editingTeam.color === color
                          ? 'border-gray-900 dark:border-white scale-110'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingTeam(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                취소
              </button>
              <button
                onClick={handleUpdateTeam}
                disabled={!editingTeam.name.trim() || !editingTeam.code.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && deletingTeam && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">팀 삭제</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              <span className="font-semibold text-red-600 dark:text-red-400">{deletingTeam.name}</span> 팀을
              삭제하시겠습니까? 이 팀에 배정된 직원들의 팀 정보도 함께 제거됩니다.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingTeam(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                취소
              </button>
              <button
                onClick={handleDeleteTeam}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unassign Confirm Modal */}
      {showUnassignConfirm && unassigningMember && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">팀 배정 해제</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              <span className="font-semibold text-blue-600 dark:text-blue-400">{unassigningMember.name}</span>
              {unassigningMember.employeeId && (
                <span className="text-sm text-gray-500"> (사번: {unassigningMember.employeeId})</span>
              )}
              님을 팀에서 배정 해제하시겠습니까?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUnassignConfirm(false);
                  setUnassigningMember(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                취소
              </button>
              <button
                onClick={confirmUnassign}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                배정 해제
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
