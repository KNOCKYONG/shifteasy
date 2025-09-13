import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'dots' | 'pulse' | 'bars' | 'ring';
  color?: 'primary' | 'secondary' | 'accent' | 'white';
  className?: string;
}

export function Spinner({
  size = 'md',
  variant = 'default',
  color = 'primary',
  className,
}: SpinnerProps) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  const colorClasses = {
    primary: 'text-blue-500',
    secondary: 'text-purple-500',
    accent: 'text-green-500',
    white: 'text-white',
  };

  if (variant === 'dots') {
    return (
      <div className={cn('flex space-x-1', className)}>
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'rounded-full bg-current animate-bounce',
              sizeClasses[size],
              colorClasses[color]
            )}
            style={{
              animationDelay: `${i * 0.15}s`,
              animationDuration: '0.6s',
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={cn('relative', sizeClasses[size], className)}>
        <div
          className={cn(
            'absolute inset-0 rounded-full bg-current opacity-75 animate-ping',
            colorClasses[color]
          )}
        />
        <div
          className={cn(
            'relative rounded-full bg-current',
            sizeClasses[size],
            colorClasses[color]
          )}
        />
      </div>
    );
  }

  if (variant === 'bars') {
    return (
      <div className={cn('flex space-x-1', className)}>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'bg-current animate-pulse',
              colorClasses[color]
            )}
            style={{
              width: '3px',
              height: parseInt(sizeClasses[size].split('-')[1]) * 4 + 'px',
              animationDelay: `${i * 0.15}s`,
              animationDuration: '0.8s',
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'ring') {
    return (
      <div className={cn('relative', sizeClasses[size], className)}>
        <div className={cn('absolute inset-0', colorClasses[color])}>
          <svg className="animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      </div>
    );
  }

  // Default spinner
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
    />
  );
}

// Loading Overlay Component
export function LoadingOverlay({
  show,
  message,
  variant = 'default',
}: {
  show: boolean;
  message?: string;
  variant?: SpinnerProps['variant'];
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl flex flex-col items-center space-y-4">
        <Spinner size="lg" variant={variant} />
        {message && (
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

// Inline Loading Component
export function InlineLoading({
  text = 'Loading...',
  size = 'sm',
}: {
  text?: string;
  size?: SpinnerProps['size'];
}) {
  return (
    <div className="inline-flex items-center space-x-2">
      <Spinner size={size} />
      <span className="text-sm text-gray-600 dark:text-gray-400">{text}</span>
    </div>
  );
}

// Button with Loading State
export function LoadingButton({
  loading,
  children,
  disabled,
  className,
  ...props
}: {
  loading?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  [key: string]: any;
}) {
  return (
    <button
      disabled={loading || disabled}
      className={cn(
        'relative px-4 py-2 rounded-lg font-medium transition-all',
        'bg-blue-500 hover:bg-blue-600 text-white',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-inherit rounded-lg">
          <Spinner size="sm" color="white" />
        </div>
      )}
      <span className={cn(loading && 'invisible')}>{children}</span>
    </button>
  );
}