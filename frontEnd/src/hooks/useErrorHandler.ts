'use client';

import { useCallback, useState } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { parseSolanaError, isRetryableError } from '@/utils/solanaErrors';

interface UseErrorHandlerOptions {
  maxRetries?: number;
  retryDelay?: number;
  showNotification?: boolean;
  onError?: (error: unknown) => void;
}

interface UseErrorHandlerReturn {
  error: Error | null;
  isRetrying: boolean;
  retryCount: number;
  handleError: (error: unknown, context?: string) => void;
  clearError: () => void;
  executeWithRetry: <T>(
    fn: () => Promise<T>,
    options?: { maxRetries?: number; retryDelay?: number }
  ) => Promise<T>;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}): UseErrorHandlerReturn {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    showNotification = true,
    onError,
  } = options;

  const [error, setError] = useState<Error | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const { showError, showWarning } = useNotificationStore();

  const handleError = useCallback(
    (error: unknown, context?: string) => {
      const parsedError = parseSolanaError(error);
      const errorObj = error instanceof Error ? error : new Error(parsedError.message);
      
      setError(errorObj);

      // Show notification if enabled
      if (showNotification) {
        const title = context || 'Error';
        showError(title, parsedError.userMessage, false);
      }

      // Call custom error handler
      if (onError) {
        onError(error);
      }

      // Log error for debugging
      console.error(`[ErrorHandler] ${context || 'Error'}:`, error);
    },
    [showNotification, showError, onError]
  );

  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  const executeWithRetry = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      retryOptions?: { maxRetries?: number; retryDelay?: number }
    ): Promise<T> => {
      const maxAttempts = retryOptions?.maxRetries ?? maxRetries;
      const delay = retryOptions?.retryDelay ?? retryDelay;
      let lastError: unknown;

      for (let attempt = 0; attempt <= maxAttempts; attempt++) {
        try {
          if (attempt > 0) {
            setIsRetrying(true);
            setRetryCount(attempt);
            
            // Show retry notification
            if (showNotification) {
              showWarning(
                'Retrying',
                `Attempt ${attempt} of ${maxAttempts}...`,
                true
              );
            }

            // Wait before retrying with exponential backoff
            await new Promise((resolve) => 
              setTimeout(resolve, delay * Math.pow(2, attempt - 1))
            );
          }

          const result = await fn();
          
          // Success - clear retry state
          setIsRetrying(false);
          setRetryCount(0);
          clearError();
          
          return result;
        } catch (err) {
          lastError = err;
          
          // Check if error is retryable
          if (!isRetryableError(err) || attempt === maxAttempts) {
            setIsRetrying(false);
            handleError(err, 'Operation failed');
            throw err;
          }
        }
      }

      // Should never reach here, but TypeScript needs it
      setIsRetrying(false);
      throw lastError;
    },
    [maxRetries, retryDelay, showNotification, showWarning, handleError, clearError]
  );

  return {
    error,
    isRetrying,
    retryCount,
    handleError,
    clearError,
    executeWithRetry,
  };
}
