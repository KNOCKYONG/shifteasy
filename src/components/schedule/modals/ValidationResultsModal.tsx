import React, { useMemo, useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface ValidationIssue {
  constraintName?: string;
  type?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message?: string;
  details?: string;
  suggestion?: string;
  affectedEmployees?: string[];
}

interface ValidationResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  validationScore: number | null;
  validationIssues: ValidationIssue[];
  employeeNameMap?: Record<string, string>;
}

export function ValidationResultsModal({
  isOpen,
  onClose,
  validationScore,
  validationIssues,
  employeeNameMap = {},
}: ValidationResultsModalProps) {
  if (!isOpen) return null;

  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    if (isOpen) {
      setSelectedSeverity('all');
    }
  }, [isOpen]);

  const severityOptions = useMemo(
    () => [
      { value: 'all', label: '전체', color: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200' },
      { value: 'critical', label: '치명적', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' },
      { value: 'high', label: '높음', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' },
      { value: 'medium', label: '중간', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200' },
      { value: 'low', label: '낮음', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' },
    ],
    []
  );

  const severityCounts = useMemo(() => {
    return validationIssues.reduce<Record<string, number>>((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {});
  }, [validationIssues]);

  const filteredIssues = useMemo(() => {
    if (selectedSeverity === 'all') {
      return validationIssues;
    }
    return validationIssues.filter((issue) => issue.severity === selectedSeverity);
  }, [validationIssues, selectedSeverity]);

  return (
    <div className="fixed inset-0 bg-gray-900/50 dark:bg-gray-950/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              스케줄 검증 결과
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
          {/* Validation Score */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                검증 점수
              </h3>
              <span className={`text-2xl font-bold ${
                validationScore && validationScore >= 80
                  ? 'text-green-600 dark:text-green-400'
                  : validationScore && validationScore >= 60
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {validationScore}점
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${
                  validationScore && validationScore >= 80
                    ? 'bg-green-500'
                    : validationScore && validationScore >= 60
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${validationScore}%` }}
              />
            </div>
          </div>

          {/* Severity Filter */}
          {validationIssues.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  발견된 문제점
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  총 {validationIssues.length}건
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {severityOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`px-3 py-1.5 text-sm rounded-full border transition ${
                      selectedSeverity === option.value
                        ? `${option.color} border-transparent`
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => setSelectedSeverity(option.value as typeof selectedSeverity)}
                  >
                    {option.label}
                    {option.value !== 'all' && (
                      <span className="ml-2 text-xs">
                        {severityCounts[option.value] ?? 0}
                      </span>
                    )}
                    {option.value === 'all' && (
                      <span className="ml-2 text-xs">{validationIssues.length}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Validation Issues */}
          {filteredIssues.length > 0 ? (
            <div className="mb-6">
              <div className="space-y-3">
                {filteredIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg p-4 ${
                      issue.severity === 'critical'
                        ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
                        : issue.severity === 'high'
                        ? 'bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800'
                        : issue.severity === 'medium'
                        ? 'bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800'
                        : 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {issue.constraintName || issue.type}
                      </span>
                      <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                        issue.severity === 'critical'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          : issue.severity === 'high'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                          : issue.severity === 'medium'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      }`}>
                        {issue.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {issue.message || issue.details}
                    </p>
                    {issue.affectedEmployees && issue.affectedEmployees.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          영향 직원
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {issue.affectedEmployees.map((employeeId) => {
                            const displayName = employeeNameMap[employeeId] || employeeId;
                            return (
                              <span
                                key={employeeId}
                                className="px-2 py-1 text-xs rounded-full bg-white/70 text-gray-700 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
                              >
                                {displayName}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {issue.suggestion && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                        💡 {issue.suggestion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                선택한 중요도({severityOptions.find(opt => opt.value === selectedSeverity)?.label})에 해당하는 문제는 없습니다.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
