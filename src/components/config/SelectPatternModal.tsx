'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, Users, Calendar } from 'lucide-react';
import { api } from '@/lib/trpc/client';

export interface DepartmentPattern {
  id: string;
  tenantId?: string;
  departmentId: string;
  requiredStaffDay: number;
  requiredStaffEvening: number;
  requiredStaffNight: number;
  requiredStaffByShift: Record<string, number>;
  defaultPatterns: string[][];
  avoidPatterns: string[][] | null;
  totalMembers: number;
  isActive: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SelectPatternModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (pattern: DepartmentPattern | null) => void;
  onSkip: () => void;
}

export function SelectPatternModal({
  isOpen,
  onClose,
  onSelect,
  onSkip,
}: SelectPatternModalProps) {
  const { t } = useTranslation('config');
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);

  const { data: patterns = [], isLoading: patternsLoading } = api.departmentPatterns.getAll.useQuery(
    undefined,
    { enabled: isOpen }
  );

  const { data: recentPattern, isLoading: recentLoading } = api.departmentPatterns.getRecentDepartmentPattern.useQuery(
    undefined,
    { enabled: isOpen }
  );

  // Auto-select most recently used pattern when data loads
  useEffect(() => {
    if (recentPattern?.departmentId && !selectedPatternId) {
      setSelectedPatternId(recentPattern.departmentId);
    }
  }, [recentPattern, selectedPatternId]);

  const handleConfirm = () => {
    if (selectedPatternId) {
      const selected = patterns.find(p => p.departmentId === selectedPatternId);
      if (selected) {
        onSelect(selected);
      }
    }
    onClose();
  };

  const handleSkip = () => {
    onSelect(null);
    onSkip();
    onClose();
  };

  if (!isOpen) return null;

  const isLoading = patternsLoading || recentLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-3xl max-h-[80vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-6 h-6" />
              {t('presets.patterns.selectModal.title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('presets.patterns.selectModal.subtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {t('presets.patterns.loading')}
              </p>
            </div>
          ) : patterns.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                {t('presets.patterns.empty')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                {t('presets.patterns.selectModal.skipHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {patterns.map((pattern) => {
                const isRecent = pattern.departmentId === recentPattern?.departmentId;
                const isSelected = pattern.departmentId === selectedPatternId;
                const isActivePattern = pattern.isActive === 'true';

                return (
                  <div
                    key={pattern.departmentId}
                    onClick={() => setSelectedPatternId(pattern.departmentId)}
                    className={`
                      relative p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                      }
                      ${!isActivePattern ? 'opacity-60' : ''}
                    `}
                  >
                    {/* Selection Indicator */}
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}

                    {/* Recent Badge */}
                    {isRecent && (
                      <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                          <Calendar className="w-3 h-3" />
                          {t('presets.selectModal.recentBadge')}
                        </span>
                      </div>
                    )}

                    {/* Pattern Info */}
                    <div className={isRecent ? 'mt-6' : ''}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {`Department ${pattern.departmentId.slice(0, 8)}`}
                        </h3>
                        {isActivePattern && (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded">
                            {t('presets.patterns.active')}
                          </span>
                        )}
                      </div>

                      {/* Required Staff */}
                      <div className="grid grid-cols-4 gap-3 mb-3 text-sm">
                        <div className="flex flex-col p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
                          <span className="text-gray-500 dark:text-gray-400 text-xs">
                            {t('presets.patterns.day')}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {pattern.requiredStaffDay}
                          </span>
                        </div>
                        <div className="flex flex-col p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
                          <span className="text-gray-500 dark:text-gray-400 text-xs">
                            {t('presets.patterns.evening')}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {pattern.requiredStaffEvening}
                          </span>
                        </div>
                        <div className="flex flex-col p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
                          <span className="text-gray-500 dark:text-gray-400 text-xs">
                            {t('presets.patterns.night')}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {pattern.requiredStaffNight}
                          </span>
                        </div>
                        <div className="flex flex-col p-2 bg-blue-50 dark:bg-blue-900/30 rounded">
                          <span className="text-gray-500 dark:text-gray-400 text-xs">
                            {t('presets.patterns.total')}
                          </span>
                          <span className="font-medium text-blue-600 dark:text-blue-400">
                            {pattern.totalMembers}
                          </span>
                        </div>
                      </div>

                      {/* Patterns Summary */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <span>{t('presets.patterns.defaultPattern')}:</span>
                          <span className="font-medium">{pattern.defaultPatterns.length}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <span>{t('presets.patterns.avoidPattern')}:</span>
                          <span className="font-medium">{pattern.avoidPatterns?.length || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('presets.patterns.selectModal.skipButton')}
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t('presets.modal.close')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedPatternId}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('presets.patterns.selectModal.confirmButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
