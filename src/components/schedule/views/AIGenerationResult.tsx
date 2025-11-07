import React from 'react';
import { BarChart3, X } from 'lucide-react';

interface Violation {
  constraintName: string;
  message: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface GenerationResult {
  computationTime: number;
  score: {
    fairness: number;
    preference: number;
    total: number;
    coverage: number;
  };
  violations: Violation[];
}

interface AIGenerationResultProps {
  generationResult: GenerationResult | null;
  onClose: () => void;
}

export const AIGenerationResult = React.memo(function AIGenerationResult({ generationResult, onClose }: AIGenerationResultProps) {
  if (!generationResult) return null;

  const hardViolations = generationResult.violations.filter(v => v.type === 'hard');

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-xl border border-purple-100 dark:border-purple-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">AI 스케줄 생성 완료</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              처리 시간: {generationResult.computationTime}ms |
              공정성 점수: {generationResult.score.fairness}점 |
              선호도 만족: {generationResult.score.preference}점 |
              제약 위반: {hardViolations.length}건
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {hardViolations.length > 0 && (
        <div className="mt-3 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
          <p className="text-xs font-medium text-red-700 dark:text-red-400">경고: 하드 제약조건 위반이 있습니다</p>
          {hardViolations
            .slice(0, 3)
            .map((v, i) => (
              <p key={i} className="text-xs text-red-600 dark:text-red-400 mt-1">• {v.message}</p>
            ))
          }
        </div>
      )}
    </div>
  );
});
