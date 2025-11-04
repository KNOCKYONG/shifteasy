"use client";
import { useState } from "react";
import { Plus, Edit2, Trash2, Users, Save } from "lucide-react";
import { api } from "@/lib/trpc/client";

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

interface Department {
  id: string;
  name: string;
  code: string;
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
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);

  const [newTeam, setNewTeam] = useState({
    name: '',
    code: '',
    color: COLOR_OPTIONS[0],
    departmentId: '',
  });

  // Fetch departments
  const { data: departmentsData } = api.tenant.departments.list.useQuery();
  const departments = departmentsData?.items || [];

  // Fetch teams
  const { data: teams = [], refetch: refetchTeams } = api.teams.getAll.useQuery(
    selectedDepartment !== 'all' ? { departmentId: selectedDepartment } : undefined
  );

  // Mutations
  const createTeam = api.teams.create.useMutation({
    onSuccess: () => {
      refetchTeams();
      setShowAddModal(false);
      setNewTeam({ name: '', code: '', color: COLOR_OPTIONS[0], departmentId: '' });
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

  const handleCreateTeam = () => {
    if (!newTeam.name.trim() || !newTeam.code.trim()) {
      alert('팀 이름과 코드를 입력해주세요');
      return;
    }

    createTeam.mutate({
      name: newTeam.name,
      code: newTeam.code,
      color: newTeam.color,
      departmentId: newTeam.departmentId || undefined,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">팀 관리</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            부서별 팀을 생성하고 관리할 수 있습니다
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

      {/* Department Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">부서:</label>
        <select
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="all">전체 부서</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name} ({dept.code})
            </option>
          ))}
        </select>
      </div>

      {/* Teams List */}
      <div className="space-y-4">
        {teams.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">등록된 팀이 없습니다</p>
          </div>
        ) : (
          teams.map((team) => {
            const department = departments.find(d => d.id === team.departmentId);

            return (
              <div key={team.id} className="border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.code}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {team.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {department ? `${department.name} (${department.code})` : '전체 부서'}
                      </p>
                    </div>
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
                  부서
                </label>
                <select
                  value={newTeam.departmentId}
                  onChange={(e) => setNewTeam({ ...newTeam, departmentId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">전체 부서</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
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
                  setNewTeam({ name: '', code: '', color: COLOR_OPTIONS[0], departmentId: '' });
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
    </div>
  );
}
