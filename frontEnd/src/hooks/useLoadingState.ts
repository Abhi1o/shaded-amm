'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';

interface UseLoadingStateOptions {
  timeout?: number;
  onTimeout?: () => void;
  showTimeoutNotification?: boolean;
}

interface UseLoadingStateReturn {
  isLoading: boolean;
  startLoading: (message?: string) => void;
  stopLoading: () => void;
  loadingMessage: string | null;
  hasTimedOut: boolean;
  executeWithLoading: <T>(
    fn: () => Promise<T>,
    message?: string
  ) => Promise<T>;
}

export function useLoadingState(options: UseLoadingStateOptions = {}): UseLoadingStateReturn {
  const {
    timeout = 30000, // 30 seconds default
    onTimeout,
    showTimeoutNotification = true,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { showWarning } = useNotificationStore();

  const clearLoadingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startLoading = useCallback(
    (message?: string) => {
      setIsLoading(true);
      setLoadingMessage(message || null);
      setHasTimedOut(false);

      // Set timeout
      clearLoadingTimeout();
      timeoutRef.current = setTimeout(() => {
        setHasTimedOut(true);
        
        if (showTimeoutNotification) {
          showWarning(
            'Operation Taking Longer Than Expected',
            'The network may be congested. Please wait or try again later.',
            false
          );
        }

        if (onTimeout) {
          onTimeout();
        }
      }, timeout);
    },
    [timeout, onTimeout, showTimeoutNotification, showWarning, clearLoadingTimeout]
  );

  const stopLoading = useCallback(() => {
    setIsLoading(false);
    setLoadingMessage(null);
    clearLoadingTimeout();
  }, [clearLoadingTimeout]);

  const executeWithLoading = useCallback(
    async <T,>(fn: () => Promise<T>, message?: string): Promise<T> => {
      try {
        startLoading(message);
        const result = await fn();
        return result;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearLoadingTimeout();
    };
  }, [clearLoadingTimeout]);

  return {
    isLoading,
    startLoading,
    stopLoading,
    loadingMessage,
    hasTimedOut,
    executeWithLoading,
  };
}
