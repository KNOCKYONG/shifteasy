import { UserCheck, Plus, Edit2, Trash2 } from "lucide-react";
import { useState } from "react";

interface EmployeeStatus {
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  allowScheduling: boolean;
  color: string;
}

interface EmployeeStatusTabProps {
  employeeStatuses: EmployeeStatus[];
  setEmployeeStatuses: React.Dispatch<React.SetStateAction<EmployeeStatus[]>>;
  newEmployeeStatus: EmployeeStatus;
  setNewEmployeeStatus: React.Dispatch<React.SetStateAction<EmployeeStatus>>;
  editingEmployeeStatus: string | null;
  setEditingEmployeeStatus: React.Dispatch<React.SetStateAction<string | null>>;
}

const STATUS_COLORS = [
  { value: 'green', label: '초록', class: 'bg-green-500' },
  { value: 'blue', label: '파랑', class: 'bg-blue-500' },
  { value: 'amber', label: '노랑', class: 'bg-amber-500' },
  { value: 'red', label: '빨강', class: 'bg-red-500' },
  { value: 'gray', label: '회색', class: 'bg-gray-500' },
  { value: 'purple', label: '보라', class: 'bg-purple-500' },
];

export function EmployeeStatusTab({
  employeeStatuses,
  setEmployeeStatuses,
  newEmployeeStatus,
  setNewEmployeeStatus,
  editingEmployeeStatus,
  setEditingEmployeeStatus,
}: EmployeeStatusTabProps) {
  const handleAddEmployeeStatus = () => {
    if (newEmployeeStatus.code && newEmployeeStatus.name) {
      const updatedStatuses = [...employeeStatuses, newEmployeeStatus];
      setEmployeeStatuses(updatedStatuses);
      localStorage.setItem('customEmployeeStatuses', JSON.stringify(updatedStatuses));
      setNewEmployeeStatus({
        code: '',
        name: '',
        description: '',
        isActive: true,
        allowScheduling: true,
        color: 'green',
      });
    }
  };

  const handleUpdateEmployeeStatus = (code: string, updates: Partial<EmployeeStatus>) => {
    const updatedStatuses = employeeStatuses.map(s =>
      s.code === code ? { ...s, ...updates } : s
    );
    setEmployeeStatuses(updatedStatuses);
    localStorage.setItem('customEmployeeStatuses', JSON.stringify(updatedStatuses));
  };

  const handleDeleteEmployeeStatus = (code: string) => {
    const status = employeeStatuses.find(s => s.code === code);
    if (confirm(`"${status?.name}" 상태를 삭제하시겠습니까?`)) {
      const updatedStatuses = employeeStatuses.filter(s => s.code !== code);
      setEmployeeStatuses(updatedStatuses);
      localStorage.setItem('customEmployeeStatuses', JSON.stringify(updatedStatuses));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-xl p-4 flex items-start gap-3">
        <UserCheck className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-teal-900 dark:text-teal-300 font-medium">
            직원 상태 관리
          </p>
          <p className="text-sm text-teal-700 dark:text-teal-400 mt-1">
            활성, 휴가, 휴직 등 직원의 다양한 상태를 관리합니다.
          </p>
          <p className="text-sm text-teal-600 dark:text-teal-500 mt-1 font-medium">
            💡 상태별로 스케줄링 가능 여부를 설정할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
          직원 상태 목록
        </h3>

        {/* Add new employee status form */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="코드 (예: ACTIVE)"
            value={newEmployeeStatus.code}
            onChange={(e) => setNewEmployeeStatus({ ...newEmployeeStatus, code: e.target.value.toUpperCase() })}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            maxLength={10}
          />
          <input
            type="text"
            placeholder="상태명 (예: 활성)"
            value={newEmployeeStatus.name}
            onChange={(e) => setNewEmployeeStatus({ ...newEmployeeStatus, name: e.target.value })}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <input
            type="text"
            placeholder="설명 (선택사항)"
            value={newEmployeeStatus.description}
            onChange={(e) => setNewEmployeeStatus({ ...newEmployeeStatus, description: e.target.value })}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <select
            value={newEmployeeStatus.color}
            onChange={(e) => setNewEmployeeStatus({ ...newEmployeeStatus, color: e.target.value })}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            {STATUS_COLORS.map(color => (
              <option key={color.value} value={color.value}>{color.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="new-status-active"
                checked={newEmployeeStatus.isActive}
                onChange={(e) => setNewEmployeeStatus({ ...newEmployeeStatus, isActive: e.target.checked })}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              <label htmlFor="new-status-active" className="text-sm text-gray-600 dark:text-gray-400">
                활성
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="new-status-scheduling"
                checked={newEmployeeStatus.allowScheduling}
                onChange={(e) => setNewEmployeeStatus({ ...newEmployeeStatus, allowScheduling: e.target.checked })}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              <label htmlFor="new-status-scheduling" className="text-sm text-gray-600 dark:text-gray-400">
                스케줄 가능
              </label>
            </div>
          </div>
          <button
            onClick={handleAddEmployeeStatus}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            추가
          </button>
        </div>

        {/* Employee status list */}
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {employeeStatuses.map((status) => (
            <div key={status.code} className="py-4">
              {editingEmployeeStatus === status.code ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={status.code}
                    disabled
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg"
                  />
                  <input
                    type="text"
                    defaultValue={status.name}
                    onBlur={(e) => handleUpdateEmployeeStatus(status.code, { name: e.target.value })}
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <input
                    type="text"
                    defaultValue={status.description}
                    onBlur={(e) => handleUpdateEmployeeStatus(status.code, { description: e.target.value })}
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <select
                    defaultValue={status.color}
                    onChange={(e) => handleUpdateEmployeeStatus(status.code, { color: e.target.value })}
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    {STATUS_COLORS.map(color => (
                      <option key={color.value} value={color.value}>{color.label}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`edit-status-active-${status.code}`}
                        defaultChecked={status.isActive}
                        onChange={(e) => handleUpdateEmployeeStatus(status.code, { isActive: e.target.checked })}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                      />
                      <label htmlFor={`edit-status-active-${status.code}`} className="text-sm text-gray-600 dark:text-gray-400">
                        활성
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`edit-status-scheduling-${status.code}`}
                        defaultChecked={status.allowScheduling}
                        onChange={(e) => handleUpdateEmployeeStatus(status.code, { allowScheduling: e.target.checked })}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                      />
                      <label htmlFor={`edit-status-scheduling-${status.code}`} className="text-sm text-gray-600 dark:text-gray-400">
                        스케줄 가능
                      </label>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingEmployeeStatus(null)}
                    className="px-3 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600"
                  >
                    완료
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-4 h-4 rounded bg-${status.color}-500`}></div>
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md font-mono text-sm">
                      {status.code}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      {status.name}
                    </span>
                    {status.description && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {status.description}
                      </span>
                    )}
                    {status.isActive && (
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md text-sm">
                        활성
                      </span>
                    )}
                    {status.allowScheduling && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md text-sm">
                        스케줄 가능
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingEmployeeStatus(status.code)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteEmployeeStatus(status.code)}
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

        {employeeStatuses.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            아직 등록된 직원 상태가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}