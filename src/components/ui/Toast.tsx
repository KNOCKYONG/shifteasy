'use client';

import { useState, createContext, useContext, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Haptic feedback for mobile devices
    if ('vibrate' in navigator) {
      switch (toast.type) {
        case 'success':
          navigator.vibrate([50, 30, 50]); // Double short vibration
          break;
        case 'error':
          navigator.vibrate([200]); // Long vibration
          break;
        case 'warning':
          navigator.vibrate([100, 50, 100]); // Pattern vibration
          break;
        default:
          navigator.vibrate(50); // Short vibration
      }
    }

    // Auto remove after duration
    const duration = toast.duration || 5000;
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-0 right-0 z-50 p-4 space-y-2 pointer-events-none">
      {toasts.map((toast, index) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
          style={{
            animation: `slideInRight var(--animation-base) var(--ease-smooth) forwards`,
            animationDelay: `${index * 50}ms`,
          }}
        />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onClose,
  style,
}: {
  toast: Toast;
  onClose: () => void;
  style?: React.CSSProperties;
}) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  };

  const bgColors = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  };

  return (
    <div
      className={cn(
        'pointer-events-auto min-w-[350px] max-w-md p-4 rounded-lg shadow-lg border backdrop-blur-sm',
        'transform transition-all duration-300',
        bgColors[toast.type],
        isExiting && 'translate-x-full opacity-0'
      )}
      style={style}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {toast.title}
          </p>
          {toast.description && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {toast.description}
            </p>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Helper hook for easier toast usage in components
// Usage: const toast = useToastHelper();
//        toast.success('Success!');
export function useToastHelper() {
  const { addToast } = useToast();

  return {
    success: (title: string, description?: string, options?: Partial<Toast>) => {
      addToast({ type: 'success', title, description, ...options });
    },
    error: (title: string, description?: string, options?: Partial<Toast>) => {
      addToast({ type: 'error', title, description, ...options });
    },
    warning: (title: string, description?: string, options?: Partial<Toast>) => {
      addToast({ type: 'warning', title, description, ...options });
    },
    info: (title: string, description?: string, options?: Partial<Toast>) => {
      addToast({ type: 'info', title, description, ...options });
    },
    /* eslint-disable @typescript-eslint/no-explicit-any */
    promise: async <T,>(
      promise: Promise<T>,
      messages: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((error: any) => string);
      }
    ) => {
      // Show loading toast
      addToast({
        type: 'info',
        title: messages.loading,
        duration: 0,
      });

      try {
        const result = await promise;
        const successMessage = typeof messages.success === 'function'
          ? messages.success(result)
          : messages.success;
        addToast({ type: 'success', title: successMessage });
        return result;
      } catch (error) {
        const errorMessage = typeof messages.error === 'function'
          ? messages.error(error)
          : messages.error;
        addToast({ type: 'error', title: errorMessage });
        throw error;
      }
    },
    /* eslint-enable @typescript-eslint/no-explicit-any */
  };
}