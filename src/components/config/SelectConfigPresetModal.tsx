'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, Settings, Calendar } from 'lucide-react';
import { api } from '@/lib/trpc/client';

export interface ConfigPresetShiftType {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  allowOvertime?: boolean;
}

export interface ConfigPresetPosition {
  id: string;
  name?: string | null;
}

export interface ConfigPresetCareerGroup {
  id: string;
  name?: string | null;
}

export interface ConfigPresetData {
  positions?: ConfigPresetPosition[];
  shift_types?: ConfigPresetShiftType[];
  career_groups?: ConfigPresetCareerGroup[];
  preferences?: Record<string, unknown> | null;
}

export interface ConfigPreset {
  id: string;
  name: string;
  data: ConfigPresetData;
  createdAt: string;
}

interface SelectConfigPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (preset: ConfigPreset | null) => void;
  onSkip: () => void;
}

export function SelectConfigPresetModal({
  isOpen,
  onClose,
  onSelect,
  onSkip,
}: SelectConfigPresetModalProps) {
  const { t } = useTranslation('config');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const { data: presets = [], isLoading: presetsLoading } = api.configs.listPresets.useQuery(
    undefined,
    { enabled: isOpen }
  );

  const { data: recentPreset, isLoading: recentLoading } = api.configs.getRecentConfigPreset.useQuery(
    undefined,
    { enabled: isOpen }
  );

  // Auto-select most recently used preset when data loads
  useEffect(() => {
    if (recentPreset?.presetId && !selectedPresetId) {
      setSelectedPresetId(recentPreset.presetId);
    }
  }, [recentPreset, selectedPresetId]);

  const handleConfirm = () => {
    if (selectedPresetId) {
      const selected = presets.find(p => p.id === selectedPresetId);
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

  const isLoading = presetsLoading || recentLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings className="w-6 h-6" />
              {t('presets.selectModal.title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('presets.selectModal.subtitle')}
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
                {t('presets.modal.loading')}
              </p>
            </div>
          ) : presets.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                {t('presets.modal.empty')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                {t('presets.selectModal.skipHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {presets.map((preset) => {
                const isRecent = preset.id === recentPreset?.presetId;
                const isSelected = preset.id === selectedPresetId;

                return (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={`
                      relative p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                      }
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

                    {/* Preset Info */}
                    <div className={isRecent ? 'mt-6' : ''}>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                        {preset.name}
                      </h3>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="flex flex-col">
                          <span className="text-gray-500 dark:text-gray-400">
                            {t('presets.selectModal.positions')}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {preset.data.positions?.length || 0}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500 dark:text-gray-400">
                            {t('presets.selectModal.shiftTypes')}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {preset.data.shift_types?.length || 0}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500 dark:text-gray-400">
                            {t('presets.selectModal.careerGroups')}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {preset.data.career_groups?.length || 0}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(preset.createdAt).toLocaleString()}
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
            {t('presets.selectModal.skipButton')}
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
              disabled={!selectedPresetId}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('presets.selectModal.confirmButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
