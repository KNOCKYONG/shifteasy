import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'shimmer';
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  animation = 'shimmer',
}: SkeletonProps) {
  const variantClasses = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse bg-gray-200 dark:bg-gray-700',
    wave: 'bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-wave',
    shimmer: 'skeleton',
  };

  return (
    <div
      className={cn(
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={{
        width: width,
        height: height || (variant === 'text' ? '1rem' : undefined),
      }}
    />
  );
}

// Skeleton Card Component
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('p-4 space-y-3 rounded-lg border border-gray-200 dark:border-gray-700', className)}>
      <Skeleton variant="rectangular" height={200} className="rounded-lg" />
      <div className="space-y-2">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
      </div>
      <div className="flex items-center space-x-2">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="30%" />
          <Skeleton variant="text" width="20%" />
        </div>
      </div>
    </div>
  );
}

// Skeleton Table Component
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full">
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-4">
            <Skeleton variant="text" width="20%" />
            <Skeleton variant="text" width="30%" />
            <Skeleton variant="text" width="25%" />
            <Skeleton variant="text" width="25%" />
          </div>
        </div>
        {/* Rows */}
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
            <div className="flex space-x-4">
              <Skeleton variant="text" width="20%" />
              <Skeleton variant="text" width="30%" />
              <Skeleton variant="text" width="25%" />
              <Skeleton variant="text" width="25%" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Skeleton Avatar Component
export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center space-x-3">
      <Skeleton variant="circular" width={size} height={size} />
      <div className="space-y-2">
        <Skeleton variant="text" width={120} />
        <Skeleton variant="text" width={80} height={12} />
      </div>
    </div>
  );
}

// Skeleton Schedule Component
export function SkeletonSchedule() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <Skeleton variant="text" width={200} height={32} />
        <div className="flex space-x-2">
          <Skeleton variant="rounded" width={100} height={40} />
          <Skeleton variant="rounded" width={100} height={40} />
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="text-center">
            <Skeleton variant="text" width="100%" height={20} className="mb-2" />
          </div>
        ))}
        {[...Array(35)].map((_, i) => (
          <Skeleton key={i} variant="rounded" height={80} className="w-full" />
        ))}
      </div>
    </div>
  );
}