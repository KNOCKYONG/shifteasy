import { cn } from '@/lib/utils';
import {
  Calendar,
  Users,
  FileText,
  Search,
  Inbox,
  CalendarX,
  UserX,
  FileX,
  Package
} from 'lucide-react';

interface EmptyStateProps {
  variant?: 'default' | 'no-data' | 'no-results' | 'error' | 'success';
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

// Animated SVG Illustrations
const illustrations = {
  noSchedule: (
    <svg className="w-64 h-64" viewBox="0 0 400 300" fill="none">
      <g className="animate-float">
        <rect x="50" y="50" width="300" height="200" rx="10" fill="currentColor" className="text-gray-100 dark:text-gray-800" />
        <rect x="70" y="80" width="260" height="20" rx="4" fill="currentColor" className="text-gray-200 dark:text-gray-700" />
        {[...Array(5)].map((_, i) => (
          <rect key={i} x="70" y={110 + i * 30} width="60" height="20" rx="4" fill="currentColor" className="text-gray-200 dark:text-gray-700" />
        ))}
        {[...Array(5)].map((_, i) => (
          <g key={`row-${i}`}>
            {[...Array(4)].map((_, j) => (
              <rect
                key={`cell-${i}-${j}`}
                x={140 + j * 50}
                y={110 + i * 30}
                width="40"
                height="20"
                rx="4"
                fill="currentColor"
                className="text-blue-100 dark:text-blue-900 animate-pulse"
                style={{ animationDelay: `${(i + j) * 0.1}s` }}
              />
            ))}
          </g>
        ))}
      </g>
      <g className="animate-bounce-slow">
        <circle cx="320" cy="80" r="30" fill="currentColor" className="text-yellow-400" />
        <text x="320" y="90" textAnchor="middle" className="text-2xl">📅</text>
      </g>
    </svg>
  ),

  noTeam: (
    <svg className="w-64 h-64" viewBox="0 0 400 300" fill="none">
      <g className="animate-float">
        {[...Array(3)].map((_, i) => (
          <g key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}>
            <circle
              cx={100 + i * 100}
              cy="150"
              r="40"
              fill="currentColor"
              className="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx={100 + i * 100}
              cy="130"
              r="20"
              fill="currentColor"
              className="text-gray-300 dark:text-gray-600"
            />
          </g>
        ))}
      </g>
      <g className="animate-bounce-slow">
        <text x="200" y="220" textAnchor="middle" className="text-6xl">👥</text>
      </g>
    </svg>
  ),

  noResults: (
    <svg className="w-64 h-64" viewBox="0 0 400 300" fill="none">
      <g className="animate-float">
        <circle cx="200" cy="150" r="80" stroke="currentColor" strokeWidth="8" className="text-gray-300 dark:text-gray-600" fill="none" />
        <line x1="250" y1="200" x2="320" y2="270" stroke="currentColor" strokeWidth="8" strokeLinecap="round" className="text-gray-300 dark:text-gray-600" />
      </g>
      <g className="animate-bounce-slow">
        <text x="200" y="160" textAnchor="middle" className="text-6xl">🔍</text>
      </g>
      <g className="animate-pulse">
        <text x="200" y="50" textAnchor="middle" className="text-2xl opacity-50">?</text>
      </g>
    </svg>
  ),

  success: (
    <svg className="w-64 h-64" viewBox="0 0 400 300" fill="none">
      <g className="animate-scale-in">
        <circle cx="200" cy="150" r="80" fill="currentColor" className="text-green-100 dark:text-green-900" />
        <path
          d="M160 150 L185 175 L240 120"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-green-500 animate-draw"
          fill="none"
        />
      </g>
      <g className="animate-bounce-slow">
        {[...Array(6)].map((_, i) => (
          <circle
            key={i}
            cx={200 + Math.cos(i * Math.PI / 3) * 120}
            cy={150 + Math.sin(i * Math.PI / 3) * 120}
            r="5"
            fill="currentColor"
            className="text-green-400 animate-twinkle"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </g>
    </svg>
  ),

  error: (
    <svg className="w-64 h-64" viewBox="0 0 400 300" fill="none">
      <g className="animate-shake">
        <circle cx="200" cy="150" r="80" fill="currentColor" className="text-red-100 dark:text-red-900" />
        <text x="200" y="180" textAnchor="middle" className="text-6xl">⚠️</text>
      </g>
    </svg>
  )
};

export function EmptyState({
  variant = 'default',
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const getIllustration = () => {
    switch (variant) {
      case 'no-data':
        return illustrations.noSchedule;
      case 'no-results':
        return illustrations.noResults;
      case 'error':
        return illustrations.error;
      case 'success':
        return illustrations.success;
      default:
        return illustrations.noTeam;
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        'animate-fadeIn',
        className
      )}
    >
      {/* Illustration or Icon */}
      <div className="mb-6">
        {icon || getIllustration()}
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mb-6">
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all transform hover:scale-105 hover:shadow-lg active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Specific Empty State Components
export function EmptySchedule({ onCreateSchedule }: { onCreateSchedule?: () => void }) {
  return (
    <EmptyState
      variant="no-data"
      title="스케줄이 없습니다"
      description="새로운 스케줄을 생성하여 팀의 근무 일정을 관리하세요."
      action={
        onCreateSchedule
          ? {
              label: "스케줄 생성하기",
              onClick: onCreateSchedule,
            }
          : undefined
      }
    />
  );
}

export function EmptyTeam({ onAddMember }: { onAddMember?: () => void }) {
  return (
    <EmptyState
      variant="default"
      title="팀원이 없습니다"
      description="팀원을 추가하여 근무 일정을 배정하세요."
      action={
        onAddMember
          ? {
              label: "팀원 추가하기",
              onClick: onAddMember,
            }
          : undefined
      }
    />
  );
}

export function NoSearchResults({ query }: { query?: string }) {
  return (
    <EmptyState
      variant="no-results"
      title="검색 결과가 없습니다"
      description={query ? `"${query}"에 대한 검색 결과를 찾을 수 없습니다.` : "다른 검색어를 시도해보세요."}
    />
  );
}

export function SuccessState({
  title = "성공적으로 완료되었습니다!",
  description,
  onContinue
}: {
  title?: string;
  description?: string;
  onContinue?: () => void;
}) {
  return (
    <EmptyState
      variant="success"
      title={title}
      description={description}
      action={
        onContinue
          ? {
              label: "계속하기",
              onClick: onContinue,
            }
          : undefined
      }
    />
  );
}

export function ErrorState({
  title = "오류가 발생했습니다",
  description = "잠시 후 다시 시도해주세요.",
  onRetry
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      variant="error"
      title={title}
      description={description}
      action={
        onRetry
          ? {
              label: "다시 시도",
              onClick: onRetry,
            }
          : undefined
      }
    />
  );
}