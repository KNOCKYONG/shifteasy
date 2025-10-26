import React from 'react';
import { Download, X, FileSpreadsheet, FileText, Package } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'excel' | 'pdf' | 'both') => void;
  isExporting: boolean;
  generationResult: any;
  isConfirmed: boolean;
}

export function ExportModal({
  isOpen,
  onClose,
  onExport,
  isExporting,
  generationResult,
  isConfirmed,
}: ExportModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/50 dark:bg-gray-950/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Download className="w-5 h-5" />
              스케줄 내보내기
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            스케줄을 내보낼 파일 형식을 선택하세요.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => onExport('excel')}
              disabled={isExporting}
              className="w-full flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors"
            >
              <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400" />
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900 dark:text-gray-100">Excel 파일</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  편집 가능한 스프레드시트 형식 (.xlsx)
                </div>
              </div>
            </button>

            <button
              onClick={() => onExport('pdf')}
              disabled={isExporting}
              className="w-full flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
            >
              <FileText className="w-8 h-8 text-red-600 dark:text-red-400" />
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900 dark:text-gray-100">PDF 파일</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  인쇄 및 공유용 문서 형식 (.pdf)
                </div>
              </div>
            </button>

            <button
              onClick={() => onExport('both')}
              disabled={isExporting}
              className="w-full flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-colors"
            >
              <Package className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900 dark:text-gray-100">Excel + PDF</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  두 형식 모두 다운로드
                </div>
              </div>
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                <strong>포함 내용:</strong> 주간 스케줄, 직원별 근무시간, 시프트 통계,
                {generationResult && "AI 생성 결과, "}
                {isConfirmed && "확정 상태"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
