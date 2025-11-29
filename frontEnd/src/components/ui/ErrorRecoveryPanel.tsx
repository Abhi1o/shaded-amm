/**
 * Error Recovery Panel Component
 * 
 * Displays error messages with retry functionality and connection status.
 * Used when blockchain data fetching fails but the application can continue
 * with cached data.
 * 
 * Requirements:
 * - 1.4: Display error messages when blockchain fetch fails
 * - 4.4: Implement retry mechanism with user notification
 * - 5.1: User feedback for connection issues
 * 
 * @module ErrorRecoveryPanel
 */

'use client';

import React from 'react';
import { 
  ExclamationTriangleIcon, 
  ArrowPathIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';

export interface ErrorRecoveryPanelProps {
  /** Error message to display */
  error: string | Error | null;
  /** Number of consecutive failures */
  consecutiveFailures?: number;
  /** Whether a retry is currently in progress */
  isRetrying?: boolean;
  /** Callback to retry the failed operation */
  onRetry?: () => void;
  /** Callback to dismiss the error panel */
  onDismiss?: () => void;
  /** Whether to show the dismiss button */
  showDismiss?: boolean;
  /** Severity level of the error */
  severity?: 'error' | 'warning' | 'info';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Error Recovery Panel Component
 * 
 * Displays error information with retry and dismiss options.
 * Provides clear feedback about connection issues and recovery options.
 * 
 * @example
 * ```tsx
 * <ErrorRecoveryPanel
 *   error="Failed to fetch blockchain data"
 *   consecutiveFailures={3}
 *   isRetrying={false}
 *   onRetry={handleRetry}
 *   severity="error"
 * />
 * ```
 */
export function ErrorRecoveryPanel({
  error,
  consecutiveFailures = 0,
  isRetrying = false,
  onRetry,
  onDismiss,
  showDismiss = false,
  severity = 'error',
  className = ''
}: ErrorRecoveryPanelProps) {
  if (!error) return null;

  const errorMessage = error instanceof Error ? error.message : String(error);

  // Determine styling based on severity
  const severityConfig = React.useMemo(() => {
    switch (severity) {
      case 'warning':
        return {
          bgClass: 'bg-yellow-500/10 border-yellow-500/30',
          iconClass: 'text-yellow-400',
          textClass: 'text-yellow-300',
          buttonClass: 'bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/50 text-yellow-200'
        };
      case 'info':
        return {
          bgClass: 'bg-blue-500/10 border-blue-500/30',
          iconClass: 'text-blue-400',
          textClass: 'text-blue-300',
          buttonClass: 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/50 text-blue-200'
        };
      default: // error
        return {
          bgClass: 'bg-red-500/10 border-red-500/30',
          iconClass: 'text-red-400',
          textClass: 'text-red-300',
          buttonClass: 'bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-red-200'
        };
    }
  }, [severity]);

  return (
    <div 
      className={`backdrop-blur-xl border rounded-2xl p-4 ${severityConfig.bgClass} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon 
          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${severityConfig.iconClass}`}
          aria-hidden="true"
        />
        
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold mb-1 ${severityConfig.textClass}`}>
            {severity === 'error' ? 'Connection Error' : severity === 'warning' ? 'Connection Warning' : 'Connection Info'}
          </div>
          
          <div className={`text-xs mb-3 ${severityConfig.textClass} opacity-90`}>
            {errorMessage}
            {consecutiveFailures > 0 && (
              <span className="block mt-1 opacity-75">
                {consecutiveFailures} failed {consecutiveFailures === 1 ? 'attempt' : 'attempts'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onRetry && (
              <button
                onClick={onRetry}
                disabled={isRetrying}
                className={`px-4 py-2 border rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${severityConfig.buttonClass}`}
                aria-label="Retry connection"
              >
                {isRetrying ? (
                  <span className="flex items-center gap-2">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Retrying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ArrowPathIcon className="w-4 h-4" aria-hidden="true" />
                    Retry Connection
                  </span>
                )}
              </button>
            )}

            {showDismiss && onDismiss && (
              <button
                onClick={onDismiss}
                className={`px-3 py-2 border rounded-lg text-xs font-medium transition-all ${severityConfig.buttonClass}`}
                aria-label="Dismiss error"
              >
                <XMarkIcon className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact Error Recovery Banner
 * 
 * A more compact version for use in headers or tight spaces.
 */
export function ErrorRecoveryBanner({
  error,
  onRetry,
  isRetrying = false,
  className = ''
}: {
  error: string | Error | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}) {
  if (!error) return null;

  const errorMessage = error instanceof Error ? error.message : String(error);

  return (
    <div 
      className={`flex items-center justify-between gap-3 px-4 py-2 backdrop-blur-xl bg-red-500/10 border border-red-500/30 rounded-xl ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0" aria-hidden="true" />
        <span className="text-xs text-red-300 truncate">{errorMessage}</span>
      </div>
      
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-red-200 text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          aria-label="Retry"
        >
          {isRetrying ? (
            <ArrowPathIcon className="w-3 h-3 animate-spin" aria-hidden="true" />
          ) : (
            'Retry'
          )}
        </button>
      )}
    </div>
  );
}
