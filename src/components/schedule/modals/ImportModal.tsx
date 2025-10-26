import React from 'react';
import { Upload, X, FileUp, FileText, RefreshCcw } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  importFile: File | null;
  setImportFile: (file: File | null) => void;
  onImport: () => void;
  isImporting: boolean;
}

export function ImportModal({
  isOpen,
  onClose,
  importFile,
  setImportFile,
  onImport,
  isImporting,
}: ImportModalProps) {
  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
    setImportFile(null);
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 dark:bg-gray-950/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              스케줄 가져오기
            </h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            이전에 내보낸 스케줄 파일을 선택하세요.
          </p>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
              <input
                type="file"
                accept=".json,.csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <FileUp className="w-12 h-12 text-gray-400 mb-3" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  클릭하여 파일 선택
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  JSON 또는 CSV 형식 지원
                </span>
              </label>
            </div>

            {importFile && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {importFile.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({(importFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={() => setImportFile(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={onImport}
                disabled={!importFile || isImporting}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg ${
                  !importFile || isImporting
                    ? "text-gray-400 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                    : "text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                }`}
              >
                {isImporting ? (
                  <>
                    <RefreshCcw className="w-4 h-4 animate-spin inline mr-2" />
                    가져오는 중...
                  </>
                ) : (
                  "가져오기"
                )}
              </button>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-3">
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                <strong>주의:</strong> 가져오기를 실행하면 현재 스케줄이 대체됩니다.
                가져오기 전에 현재 스케줄을 저장하는 것을 권장합니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
