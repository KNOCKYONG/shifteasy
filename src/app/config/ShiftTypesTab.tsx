import { Clock, Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { ColorPicker } from "@/components/ui/ColorPicker";

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
  newShiftType: ShiftType;
  setNewShiftType: React.Dispatch<React.SetStateAction<ShiftType>>;
  editingShiftType: string | null;
  setEditingShiftType: React.Dispatch<React.SetStateAction<string | null>>;
  onPersistShiftTypes: (updated: ShiftType[]) => Promise<void>;
  isSavingShiftTypes: boolean;
}

// Preset colors for the color picker - matching default shift types
const PRESET_COLORS = [
  '#3b82f6', // blue - D
  '#f59e0b', // amber - E
  '#6366f1', // indigo - N
  '#10b981', // green - A
  '#6b7280', // gray - O
  '#a855f7', // purple - V
  '#ef4444', // red
  '#ec4899', // pink
];

export function ShiftTypesTab({
  shiftTypes,
  newShiftType,
  setNewShiftType,
  editingShiftType,
  setEditingShiftType,
  onPersistShiftTypes,
  isSavingShiftTypes,
}: ShiftTypesTabProps) {
  const normalizedNewCode = newShiftType.code.trim().toUpperCase();
  const normalizedNewName = newShiftType.name.trim();
  const isDuplicateCode = normalizedNewCode.length > 0 && shiftTypes.some(
    st => st.code.toUpperCase() === normalizedNewCode
  );
  const canAddShiftType = normalizedNewCode.length > 0 && normalizedNewName.length > 0 && !isDuplicateCode;

  const handleAddShiftType = async () => {
    if (!canAddShiftType) return;

    const preparedShiftType: ShiftType = {
      ...newShiftType,
      code: normalizedNewCode,
      name: normalizedNewName,
    };

    const updatedShiftTypes = [...shiftTypes, preparedShiftType];
    try {
      await onPersistShiftTypes(updatedShiftTypes);
      setNewShiftType({
        code: '',
        name: '',
        startTime: '09:00',
        endTime: '17:00',
        color: '#3b82f6', // default blue
        allowOvertime: false,
      });
    } catch (error) {
      console.error('Failed to add shift type:', error);
    }
  };

  const handleUpdateShiftType = async (code: string, updates: Partial<ShiftType>) => {
    const updatedShiftTypes = shiftTypes.map((s) =>
      s.code === code ? { ...s, ...updates } : s
    );
    try {
      await onPersistShiftTypes(updatedShiftTypes);
    } catch (error) {
      console.error('Failed to update shift type:', error);
    }
  };

  const handleDeleteShiftType = async (code: string) => {
    if (confirm(`"${shiftTypes.find(s => s.code === code)?.name}" 근무 타입을 삭제하시겠습니까?`)) {
      const updatedShiftTypes = shiftTypes.filter((s) => s.code !== code);
      try {
        await onPersistShiftTypes(updatedShiftTypes);
      } catch (error) {
        console.error('Failed to delete shift type:', error);
      }
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
            <ColorPicker
              color={newShiftType.color}
              onChange={(color) => setNewShiftType({ ...newShiftType, color })}
              presetColors={PRESET_COLORS}
            />
            <button
              onClick={handleAddShiftType}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                canAddShiftType && !isSavingShiftTypes
                  ? "bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
              }`}
              disabled={!canAddShiftType || isSavingShiftTypes}
            >
              {isSavingShiftTypes ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  추가
                </>
              )}
            </button>
          </div>
        </div>

        {/* Shift types list - Improved Card Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shiftTypes.map((shift) => (
            <div
              key={shift.code}
              className="relative bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              {editingShiftType === shift.code ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-12 h-12 rounded-lg border-2 border-gray-300 dark:border-gray-600 flex-shrink-0"
                      style={{ backgroundColor: shift.color }}
                    />
                    <input
                      type="text"
                      value={shift.code}
                      disabled
                      className="w-20 px-2 py-1 text-center border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg font-mono text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    defaultValue={shift.name}
                    onBlur={(e) => handleUpdateShiftType(shift.code, { name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <div className="flex gap-2">
                    <input
                      type="time"
                      defaultValue={shift.startTime}
                      onBlur={(e) => handleUpdateShiftType(shift.code, { startTime: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                    <span className="text-gray-500 dark:text-gray-400 self-center">~</span>
                    <input
                      type="time"
                      defaultValue={shift.endTime}
                      onBlur={(e) => handleUpdateShiftType(shift.code, { endTime: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                  </div>
                  <div className="flex gap-2">
                    <ColorPicker
                      color={shift.color}
                      onChange={(color) => handleUpdateShiftType(shift.code, { color })}
                      presetColors={PRESET_COLORS}
                    />
                    <button
                      onClick={() => setEditingShiftType(null)}
                      className="px-3 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 flex items-center gap-1 text-sm"
                    >
                      완료
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      defaultChecked={shift.allowOvertime}
                      onChange={(e) => handleUpdateShiftType(shift.code, { allowOvertime: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">초과 근무 허용</span>
                  </label>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-lg border-2 border-gray-300 dark:border-gray-600"
                        style={{ backgroundColor: shift.color }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-md font-mono text-lg font-semibold">
                            {shift.code}
                          </span>
                          <h4 className="text-gray-900 dark:text-gray-100 font-semibold">
                            {shift.name}
                          </h4>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {shift.startTime === '00:00' && shift.endTime === '00:00'
                            ? '시간 제한 없음'
                            : `${shift.startTime} ~ ${shift.endTime}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {shift.allowOvertime && (
                    <div className="mb-3">
                      <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                        초과 근무 가능
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditingShiftType(shift.code)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteShiftType(shift.code)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                      disabled={['D', 'E', 'N', 'A', 'O', 'V'].includes(shift.code)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                    </button>
                  </div>
                </>
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
