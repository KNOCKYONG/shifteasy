'use client';

import { useToast } from '@/components/ui/Toast';

export function useToastHelper() {
  const { addToast } = useToast();

  return {
    success: (title: string, description?: string) => {
      addToast({
        type: 'success',
        title,
        description,
        duration: 4000,
      });
    },
    error: (title: string, description?: string) => {
      addToast({
        type: 'error',
        title,
        description,
        duration: 6000,
      });
    },
    warning: (title: string, description?: string) => {
      addToast({
        type: 'warning',
        title,
        description,
        duration: 5000,
      });
    },
    info: (title: string, description?: string) => {
      addToast({
        type: 'info',
        title,
        description,
        duration: 4000,
      });
    },
    promise: async <T,>(
      promise: Promise<T>,
      messages: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((error: any) => string);
      }
    ) => {
      const loadingToast = {
        type: 'info' as const,
        title: messages.loading,
        duration: 0,
      };
      addToast(loadingToast);

      try {
        const result = await promise;
        const successMessage = typeof messages.success === 'function'
          ? messages.success(result)
          : messages.success;
        addToast({
          type: 'success',
          title: successMessage,
          duration: 4000,
        });
        return result;
      } catch (error) {
        const errorMessage = typeof messages.error === 'function'
          ? messages.error(error)
          : messages.error;
        addToast({
          type: 'error',
          title: errorMessage,
          duration: 6000,
        });
        throw error;
      }
    },
  };
}