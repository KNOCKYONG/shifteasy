import { Building, Plus, Edit2, Trash2 } from "lucide-react";
import { useState } from "react";

interface Department {
  id: string;
  name: string;
  code: string;
  requiresSpecialSkills: boolean;
}

interface DepartmentsTabProps {
  departments: Department[];
  setDepartments: React.Dispatch<React.SetStateAction<Department[]>>;
  newDepartment: Department;
  setNewDepartment: React.Dispatch<React.SetStateAction<Department>>;
  editingDepartment: string | null;
  setEditingDepartment: React.Dispatch<React.SetStateAction<string | null>>;
}

export function DepartmentsTab({
  departments,
  setDepartments,
  newDepartment,
  setNewDepartment,
  editingDepartment,
  setEditingDepartment,
}: DepartmentsTabProps) {
  const handleAddDepartment = () => {
    if (newDepartment.code && newDepartment.name) {
      const newDept = {
        ...newDepartment,
        id: `dept-${newDepartment.code.toLowerCase()}`,
      };
      const updatedDepartments = [...departments, newDept];
      setDepartments(updatedDepartments);
      setNewDepartment({
        id: '',
        name: '',
        code: '',
        requiresSpecialSkills: false,
      });
    }
  };

  const handleUpdateDepartment = (id: string, updates: Partial<Department>) => {
    const updatedDepartments = departments.map(d =>
      d.id === id ? { ...d, ...updates } : d
    );
    setDepartments(updatedDepartments);
  };

  const handleDeleteDepartment = (id: string) => {
    const dept = departments.find(d => d.id === id);
    if (confirm(`"${dept?.name}" 부서를 삭제하시겠습니까?`)) {
      const updatedDepartments = departments.filter(d => d.id !== id);
      setDepartments(updatedDepartments);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-start gap-3">
        <Building className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-emerald-900 dark:text-emerald-300 font-medium">
            부서/병동 관리
          </p>
          <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
            조직의 부서와 병동을 추가하고 관리할 수 있습니다.
          </p>
          <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1 font-medium">
            💡 부서별로 최소 인원과 특수 기술 요구사항을 설정하세요.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
          부서/병동 목록
        </h3>

        {/* Add new department form */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="부서 코드 (예: PED)"
            value={newDepartment.code}
            onChange={(e) => setNewDepartment({ ...newDepartment, code: e.target.value.toUpperCase() })}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            maxLength={10}
          />
          <input
            type="text"
            placeholder="부서명 (예: 소아과)"
            value={newDepartment.name}
            onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="new-dept-special"
              checked={newDepartment.requiresSpecialSkills}
              onChange={(e) => setNewDepartment({ ...newDepartment, requiresSpecialSkills: e.target.checked })}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <label htmlFor="new-dept-special" className="text-sm text-gray-600 dark:text-gray-400">
              특수기술 필요
            </label>
          </div>
          <button
            onClick={handleAddDepartment}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            추가
          </button>
        </div>

        {/* Departments list */}
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {departments.map((dept) => (
            <div key={dept.id} className="py-4">
              {editingDepartment === dept.id ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={dept.code}
                    disabled
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg"
                  />
                  <input
                    type="text"
                    defaultValue={dept.name}
                    onBlur={(e) => handleUpdateDepartment(dept.id, { name: e.target.value })}
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`edit-dept-special-${dept.id}`}
                      defaultChecked={dept.requiresSpecialSkills}
                      onChange={(e) => handleUpdateDepartment(dept.id, { requiresSpecialSkills: e.target.checked })}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                    <label htmlFor={`edit-dept-special-${dept.id}`} className="text-sm text-gray-600 dark:text-gray-400">
                      특수기술
                    </label>
                  </div>
                  <button
                    onClick={() => setEditingDepartment(null)}
                    className="px-3 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600"
                  >
                    완료
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md font-mono text-sm">
                      {dept.code}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium text-lg">
                      {dept.name}
                    </span>
                    {dept.requiresSpecialSkills && (
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-md text-sm">
                        특수기술 필요
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingDepartment(dept.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteDepartment(dept.id)}
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

        {departments.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            아직 등록된 부서가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}