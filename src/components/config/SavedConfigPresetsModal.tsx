"use client";
import React, { useState } from 'react';
import { X, Trash2, Settings, AlertCircle, Loader2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { api } from '@/lib/trpc/client';

interface ConfigPreset {
  id: string;
  name: string;
  data: {
    positions?: unknown[];
    shift_types?: unknown[];
    career_groups?: unknown[];
    preferences?: unknown;
  };
  createdAt: string | Date;
  updatedAt: Date;
}

interface SavedConfigPresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPresetLoad?: (presetData: ConfigPreset['data']) => void;
}

export function SavedConfigPresetsModal({ isOpen, onClose, onPresetLoad }: SavedConfigPresetsModalProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const utils = api.useUtils();

  // Fetch presets from database
  const { data: presets = [], isLoading } = api.configs.listPresets.useQuery(
    undefined,
    { enabled: isOpen }
  );

  // Delete mutation
  const deleteMutation = api.configs.deletePreset.useMutation({
    onSuccess: async () => {
      await utils.configs.listPresets.invalidate();
      setDeleteConfirmId(null);
    },
    onError: (error) => {
      alert(`삭제 실패: ${error.message}`);
    },
  });

  const handleDelete = (presetId: string) => {
    deleteMutation.mutate({ id: presetId });
  };

  const handleLoad = (preset: ConfigPreset) => {
    if (onPresetLoad) {
      onPresetLoad(preset.data);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              저장된 설정 프리셋
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              저장된 설정 프리셋을 불러오거나 삭제할 수 있습니다
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                프리셋 로딩 중...
              </p>
            </div>
          ) : presets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Settings className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                저장된 프리셋이 없습니다
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                설정 페이지에서 프리셋을 저장하면 여기에 표시됩니다
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {presets.map((preset) => {
                const createdDate = typeof preset.createdAt === 'string'
                  ? new Date(preset.createdAt)
                  : preset.createdAt;

                return (
                  <div
                    key={preset.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-all relative"
                  >
                    {/* Loading overlay when deleting this preset */}
                    {deleteMutation.isPending && deleteConfirmId === preset.id && (
                      <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">삭제 중...</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start justify-between">
                      <div
                        className="flex-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg p-2 -m-2 transition-colors"
                        onClick={() => handleLoad(preset)}
                        title="클릭하여 이 프리셋 불러오기"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <Settings className="w-5 h-5 text-blue-500" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {preset.name}
                          </h3>
                          <Download className="w-4 h-4 text-gray-400" />
                        </div>

                        <div className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-4 flex-wrap">
                            {preset.data.positions && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                직책 {Array.isArray(preset.data.positions) ? preset.data.positions.length : 0}개
                              </span>
                            )}
                            {preset.data.shift_types && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                근무타입 {Array.isArray(preset.data.shift_types) ? preset.data.shift_types.length : 0}개
                              </span>
                            )}
                            {preset.data.career_groups && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                경력그룹 {Array.isArray(preset.data.career_groups) ? preset.data.career_groups.length : 0}개
                              </span>
                            )}
                          </div>
                          <div className="text-gray-400 dark:text-gray-500">
                            생성: {format(createdDate, 'yyyy-MM-dd HH:mm', { locale: ko })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {deleteConfirmId === preset.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDelete(preset.id)}
                              disabled={deleteMutation.isPending}
                              className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
                            >
                              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                              삭제 확인
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              disabled={deleteMutation.isPending}
                              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 rounded-lg transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(preset.id)}
                            disabled={deleteMutation.isPending}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-4 h-4" />
            <span>프리셋 삭제는 되돌릴 수 없습니다</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
