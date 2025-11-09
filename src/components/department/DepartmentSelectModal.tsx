'use client';

import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';

interface Department {
  id: string;
  name: string;
}

interface DepartmentSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  selectedDepartmentId: string;
  onSelect: (departmentId: string) => void;
}

export function DepartmentSelectModal({
  isOpen,
  onClose,
  departments,
  selectedDepartmentId,
  onSelect,
}: DepartmentSelectModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDepartments = useMemo(() => {
    if (!searchQuery.trim()) {
      return departments;
    }
    return departments.filter((dept) =>
      dept.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [departments, searchQuery]);

  const handleSelect = (departmentId: string) => {
    onSelect(departmentId);
    setSearchQuery('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            부서 선택
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="부서 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              autoFocus
            />
          </div>
        </div>

        {/* Department List */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredDepartments.length > 0 ? (
            <div className="space-y-1">
              {filteredDepartments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => handleSelect(dept.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    selectedDepartmentId === dept.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {dept.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              검색 결과가 없습니다
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
