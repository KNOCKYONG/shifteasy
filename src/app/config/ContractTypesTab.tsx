import { FileText, Plus, Edit2, Trash2 } from "lucide-react";
import { useState } from "react";

interface ContractType {
  code: string;
  name: string;
  description: string;
  maxHoursPerWeek?: number;
  minHoursPerWeek?: number;
  isPrimary: boolean;
}

interface ContractTypesTabProps {
  contractTypes: ContractType[];
  setContractTypes: React.Dispatch<React.SetStateAction<ContractType[]>>;
  newContractType: ContractType;
  setNewContractType: React.Dispatch<React.SetStateAction<ContractType>>;
  editingContractType: string | null;
  setEditingContractType: React.Dispatch<React.SetStateAction<string | null>>;
}

export function ContractTypesTab({
  contractTypes,
  setContractTypes,
  newContractType,
  setNewContractType,
  editingContractType,
  setEditingContractType,
}: ContractTypesTabProps) {
  const handleAddContractType = () => {
    if (newContractType.code && newContractType.name) {
      const updatedContractTypes = [...contractTypes, newContractType];
      setContractTypes(updatedContractTypes);
      localStorage.setItem('customContractTypes', JSON.stringify(updatedContractTypes));
      setNewContractType({
        code: '',
        name: '',
        description: '',
        maxHoursPerWeek: undefined,
        minHoursPerWeek: undefined,
        isPrimary: false,
      });
    }
  };

  const handleUpdateContractType = (code: string, updates: Partial<ContractType>) => {
    const updatedContractTypes = contractTypes.map(c =>
      c.code === code ? { ...c, ...updates } : c
    );
    setContractTypes(updatedContractTypes);
    localStorage.setItem('customContractTypes', JSON.stringify(updatedContractTypes));
  };

  const handleDeleteContractType = (code: string) => {
    const contract = contractTypes.find(c => c.code === code);
    if (confirm(`"${contract?.name}" 계약 유형을 삭제하시겠습니까?`)) {
      const updatedContractTypes = contractTypes.filter(c => c.code !== code);
      setContractTypes(updatedContractTypes);
      localStorage.setItem('customContractTypes', JSON.stringify(updatedContractTypes));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4 flex items-start gap-3">
        <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-purple-900 dark:text-purple-300 font-medium">
            계약 유형 관리
          </p>
          <p className="text-sm text-purple-700 dark:text-purple-400 mt-1">
            정규직, 계약직, 파트타임 등 다양한 고용 형태를 설정합니다.
          </p>
          <p className="text-sm text-purple-600 dark:text-purple-500 mt-1 font-medium">
            💡 계약 유형별로 근무 시간 제한을 설정할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
          계약 유형 목록
        </h3>

        {/* Add new contract type form */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="코드 (예: FT)"
            value={newContractType.code}
            onChange={(e) => setNewContractType({ ...newContractType, code: e.target.value.toUpperCase() })}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            maxLength={5}
          />
          <input
            type="text"
            placeholder="계약 유형 (예: 정규직)"
            value={newContractType.name}
            onChange={(e) => setNewContractType({ ...newContractType, name: e.target.value })}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <input
            type="text"
            placeholder="설명 (선택사항)"
            value={newContractType.description}
            onChange={(e) => setNewContractType({ ...newContractType, description: e.target.value })}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="최소 시간/주"
              value={newContractType.minHoursPerWeek || ''}
              onChange={(e) => setNewContractType({ ...newContractType, minHoursPerWeek: e.target.value ? Number(e.target.value) : undefined })}
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <input
              type="number"
              placeholder="최대 시간/주"
              value={newContractType.maxHoursPerWeek || ''}
              onChange={(e) => setNewContractType({ ...newContractType, maxHoursPerWeek: e.target.value ? Number(e.target.value) : undefined })}
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="new-contract-primary"
              checked={newContractType.isPrimary}
              onChange={(e) => setNewContractType({ ...newContractType, isPrimary: e.target.checked })}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <label htmlFor="new-contract-primary" className="text-sm text-gray-600 dark:text-gray-400">
              주 계약
            </label>
          </div>
          <button
            onClick={handleAddContractType}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            추가
          </button>
        </div>

        {/* Contract types list */}
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {contractTypes.map((contract) => (
            <div key={contract.code} className="py-4">
              {editingContractType === contract.code ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={contract.code}
                    disabled
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg"
                  />
                  <input
                    type="text"
                    defaultValue={contract.name}
                    onBlur={(e) => handleUpdateContractType(contract.code, { name: e.target.value })}
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <input
                    type="text"
                    defaultValue={contract.description}
                    onBlur={(e) => handleUpdateContractType(contract.code, { description: e.target.value })}
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      defaultValue={contract.minHoursPerWeek || ''}
                      onBlur={(e) => handleUpdateContractType(contract.code, { minHoursPerWeek: e.target.value ? Number(e.target.value) : undefined })}
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      placeholder="최소"
                    />
                    <input
                      type="number"
                      defaultValue={contract.maxHoursPerWeek || ''}
                      onBlur={(e) => handleUpdateContractType(contract.code, { maxHoursPerWeek: e.target.value ? Number(e.target.value) : undefined })}
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      placeholder="최대"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`edit-contract-primary-${contract.code}`}
                      defaultChecked={contract.isPrimary}
                      onChange={(e) => handleUpdateContractType(contract.code, { isPrimary: e.target.checked })}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                    <label htmlFor={`edit-contract-primary-${contract.code}`} className="text-sm text-gray-600 dark:text-gray-400">
                      주 계약
                    </label>
                  </div>
                  <button
                    onClick={() => setEditingContractType(null)}
                    className="px-3 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600"
                  >
                    완료
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md font-mono text-sm">
                      {contract.code}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      {contract.name}
                    </span>
                    {contract.description && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {contract.description}
                      </span>
                    )}
                    {(contract.minHoursPerWeek || contract.maxHoursPerWeek) && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {contract.minHoursPerWeek && `최소 ${contract.minHoursPerWeek}시간`}
                        {contract.minHoursPerWeek && contract.maxHoursPerWeek && ' ~ '}
                        {contract.maxHoursPerWeek && `최대 ${contract.maxHoursPerWeek}시간`}
                      </span>
                    )}
                    {contract.isPrimary && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md text-sm">
                        주 계약
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingContractType(contract.code)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteContractType(contract.code)}
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

        {contractTypes.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            아직 등록된 계약 유형이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}