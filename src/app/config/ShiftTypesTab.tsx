import { Clock, Plus, Edit2, Trash2 } from "lucide-react";
import { useState } from "react";

interface ShiftType {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  allowOvertime: boolean;
}

interface ShiftTypesTabProps {
  shiftTypes: ShiftType[];
  setShiftTypes: React.Dispatch<React.SetStateAction<ShiftType[]>>;
  newShiftType: ShiftType;
  setNewShiftType: React.Dispatch<React.SetStateAction<ShiftType>>;
  editingShiftType: string | null;
  setEditingShiftType: React.Dispatch<React.SetStateAction<string | null>>;
}

const AVAILABLE_COLORS = [
  { value: 'blue', label: '파랑', class: 'bg-blue-500' },
  { value: 'green', label: '초록', class: 'bg-green-500' },
  { value: 'amber', label: '노랑', class: 'bg-amber-500' },
  { value: 'red', label: '빨강', class: 'bg-red-500' },
  { value: 'purple', label: '보라', class: 'bg-purple-500' },
  { value: 'indigo', label: '남색', class: 'bg-indigo-500' },
  { value: 'pink', label: '분홍', class: 'bg-pink-500' },
  { value: 'gray', label: '회색', class: 'bg-gray-500' },
];

export function ShiftTypesTab({
  shiftTypes,
  setShiftTypes,
  newShiftType,
  setNewShiftType,
  editingShiftType,
  setEditingShiftType,
}: ShiftTypesTabProps) {
  const normalizedNewCode = newShiftType.code.trim().toUpperCase();
  const normalizedNewName = newShiftType.name.trim();
  const isDuplicateCode = normalizedNewCode.length > 0 && shiftTypes.some(
    st => st.code.toUpperCase() === normalizedNewCode
  );
  const canAddShiftType = normalizedNewCode.length > 0 && normalizedNewName.length > 0 && !isDuplicateCode;

  const handleAddShiftType = () => {
    if (!canAddShiftType) return;

    const preparedShiftType: ShiftType = {
      ...newShiftType,
      code: normalizedNewCode,
      name: normalizedNewName,
    };

    const updatedShiftTypes = [...shiftTypes, preparedShiftType];
    setShiftTypes(updatedShiftTypes);
    setNewShiftType({
      code: '',
      name: '',
      startTime: '09:00',
      endTime: '17:00',
      color: 'blue',
      allowOvertime: false,
    });
  };

  const handleUpdateShiftType = (code: string, updates: Partial<ShiftType>) => {
    const updatedShiftTypes = shiftTypes.map(s =>
      s.code === code ? { ...s, ...updates } : s
    );
    setShiftTypes(updatedShiftTypes);
  };

  const handleDeleteShiftType = (code: string) => {
    if (confirm(`"${shiftTypes.find(s => s.code === code)?.name}" 근무 타입을 삭제하시겠습니까?`)) {
      const updatedShiftTypes = shiftTypes.filter(s => s.code !== code);
      setShiftTypes(updatedShiftTypes);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-cyan-900 dark:text-cyan-300 font-medium">
            근무 타입 설정
          </p>
          <p className="text-sm text-cyan-700 dark:text-cyan-400 mt-1">
            조직에 맞는 근무 시간과 타입을 설정할 수 있습니다.
          </p>
          <p className="text-sm text-cyan-600 dark:text-cyan-500 mt-1 font-medium">
            💡 각 근무 타입별로 시간, 색상, 최소 인원을 설정하세요.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
          근무 타입 목록
        </h3>

        {/* Add new shift type form */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex flex-col gap-1">
            <input
              type="text"
              placeholder="코드 (예: M)"
              value={newShiftType.code}
              onChange={(e) => setNewShiftType({ ...newShiftType, code: e.target.value.toUpperCase() })}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              maxLength={3}
            />
            {isDuplicateCode && (
              <p className="text-sm text-red-500 dark:text-red-400">
                이미 사용 중인 코드입니다. 다른 코드를 입력해 주세요.
              </p>
            )}
          </div>
          <input
            type="text"
            placeholder="근무명 (예: 오전 근무)"
            value={newShiftType.name}
            onChange={(e) => setNewShiftType({ ...newShiftType, name: e.target.value })}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <div className="flex gap-2">
            <input
              type="time"
              value={newShiftType.startTime}
              onChange={(e) => setNewShiftType({ ...newShiftType, startTime: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <input
              type="time"
              value={newShiftType.endTime}
              onChange={(e) => setNewShiftType({ ...newShiftType, endTime: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={newShiftType.color}
              onChange={(e) => setNewShiftType({ ...newShiftType, color: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              {AVAILABLE_COLORS.map(color => (
                <option key={color.value} value={color.value}>{color.label}</option>
              ))}
            </select>
            <button
              onClick={handleAddShiftType}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                canAddShiftType
                  ? "bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
              }`}
              disabled={!canAddShiftType}
            >
              <Plus className="w-4 h-4" />
              추가
            </button>
          </div>
        </div>

        {/* Shift types list */}
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {shiftTypes.map((shift) => (
            <div key={shift.code} className="py-4">
              {editingShiftType === shift.code ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={shift.code}
                    disabled
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg"
                  />
                  <input
                    type="text"
                    defaultValue={shift.name}
                    onBlur={(e) => handleUpdateShiftType(shift.code, { name: e.target.value })}
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <div className="flex gap-2">
                    <input
                      type="time"
                      defaultValue={shift.startTime}
                      onBlur={(e) => handleUpdateShiftType(shift.code, { startTime: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                    <input
                      type="time"
                      defaultValue={shift.endTime}
                      onBlur={(e) => handleUpdateShiftType(shift.code, { endTime: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      defaultValue={shift.color}
                      onChange={(e) => handleUpdateShiftType(shift.code, { color: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    >
                      {AVAILABLE_COLORS.map(color => (
                        <option key={color.value} value={color.value}>{color.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setEditingShiftType(null)}
                      className="px-3 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600"
                    >
                      완료
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-4 h-4 rounded bg-${shift.color}-500`}></div>
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md font-mono text-sm">
                      {shift.code}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      {shift.name}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {shift.startTime} - {shift.endTime}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingShiftType(shift.code)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteShiftType(shift.code)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                      disabled={['D', 'E', 'N', 'A', 'O'].includes(shift.code)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {shiftTypes.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            아직 등록된 근무 타입이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
