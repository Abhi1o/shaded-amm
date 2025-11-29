/**
 * Connection Status Indicator
 * 
 * Displays the current connection status to the Solana blockchain.
 * Shows different states: connected, connecting, disconnected, error.
 * 
 * Requirements:
 * - 1.4: Display connection status
 * - 4.4: Show error states
 * - 5.1: User feedback for connection issues
 */

'use client';

import React from 'react';
import { 
  SignalIcon, 
  SignalSlashIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon 
} from '@heroicons/react/24/outline';

export interface ConnectionStatusProps {
  /** Whether the connection is active */
  isConnected: boolean;
  /** Whether currently attempting to connect/refresh */
  isConnecting?: boolean;
  /** Error message if connection failed */
  error?: string | null;
  /** Number of consecutive failures */
  consecutiveFailures?: number;
  /** Callback to retry connection */
  onRetry?: () => void;
  /** Display variant */
  variant?: 'full' | 'compact' | 'icon-only';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Connection Status Indicator Component
 * 
 * Displays real-time connection status with visual feedback.
 * 
 * @example
 * ```tsx
 * <ConnectionStatus
 *   isConnected={true}
 *   isConnecting={false}
 *   variant="full"
 * />
 * ```
 */
export function ConnectionStatus({
  isConnected,
  isConnecting = false,
  error = null,
  consecutiveFailures = 0,
  onRetry,
  variant = 'full',
  className = ''
}: ConnectionStatusProps) {
  // Determine status
  const hasError = !!error || consecutiveFailures > 0;
  const isDisconnected = !isConnected && !isConnecting;

  // Status configuration
  const statusConfig = React.useMemo(() => {
    if (isConnecting) {
      return {
        icon: ArrowPathIcon,
        iconClass: 'text-blue-400 animate-spin',
        bgClass: 'bg-blue-500/10 border-blue-500/30',
        label: 'Connecting',
        description: 'Fetching blockchain data...'
      };
    }

    if (hasError) {
      return {
        icon: ExclamationTriangleIcon,
        iconClass: 'text-yellow-400',
        bgClass: 'bg-yellow-500/10 border-yellow-500/30',
        label: 'Connection Issues',
        description: consecutiveFailures > 3 
          ? 'Multiple connection failures. Using cached data.'
          : 'Temporary connection issue. Retrying...'
      };
    }

    if (isDisconnected) {
      return {
        icon: SignalSlashIcon,
        iconClass: 'text-red-400',
        bgClass: 'bg-red-500/10 border-red-500/30',
        label: 'Disconnected',
        description: 'Not connected to blockchain'
      };
    }

    return {
      icon: SignalIcon,
      iconClass: 'text-green-400',
      bgClass: 'bg-green-500/10 border-green-500/30',
      label: 'Connected',
      description: 'Live blockchain data'
    };
  }, [isConnected, isConnecting, hasError, consecutiveFailures]);

  const Icon = statusConfig.icon;

  // Icon-only variant
  if (variant === 'icon-only') {
    return (
      <div 
        className={`relative ${className}`}
        title={`${statusConfig.label}: ${statusConfig.description}`}
      >
        <Icon className={`w-5 h-5 ${statusConfig.iconClass}`} />
        {isConnected && !hasError && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        )}
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <div 
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl border ${statusConfig.bgClass} ${className}`}
        title={statusConfig.description}
      >
        <Icon className={`w-4 h-4 ${statusConfig.iconClass}`} />
        <span className="text-xs font-medium text-white">
          {statusConfig.label}
        </span>
      </div>
    );
  }

  // Full variant
  return (
    <div 
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl border ${statusConfig.bgClass} ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Icon className={`w-5 h-5 ${statusConfig.iconClass}`} />
          {isConnected && !hasError && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
          )}
        </div>
        <div>
          <div className="text-sm font-medium text-white">
            {statusConfig.label}
          </div>
          <div className="text-xs text-gray-400">
            {statusConfig.description}
          </div>
        </div>
      </div>

      {/* Retry button for errors */}
      {hasError && onRetry && (
        <button
          onClick={onRetry}
          disabled={isConnecting}
          className="px-3 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Retry
        </button>
      )}

      {/* Failure count indicator */}
      {consecutiveFailures > 0 && (
        <div className="text-xs text-gray-400">
          {consecutiveFailures} {consecutiveFailures === 1 ? 'failure' : 'failures'}
        </div>
      )}
    </div>
  );
}

/**
 * Mini Connection Status Badge
 * 
 * A minimal badge showing just connection status with a colored dot.
 * Useful for headers and compact layouts.
 */
export function ConnectionStatusBadge({
  isConnected,
  isConnecting = false,
  hasError = false,
  className = ''
}: {
  isConnected: boolean;
  isConnecting?: boolean;
  hasError?: boolean;
  className?: string;
}) {
  const statusColor = React.useMemo(() => {
    if (isConnecting) return 'bg-blue-400';
    if (hasError) return 'bg-yellow-400';
    if (!isConnected) return 'bg-red-400';
    return 'bg-green-400';
  }, [isConnected, isConnecting, hasError]);

  const statusLabel = React.useMemo(() => {
    if (isConnecting) return 'Connecting...';
    if (hasError) return 'Connection issues';
    if (!isConnected) return 'Disconnected';
    return 'Connected';
  }, [isConnected, isConnecting, hasError]);

  return (
    <div 
      className={`flex items-center gap-2 ${className}`}
      title={statusLabel}
    >
      <span className={`w-2 h-2 rounded-full ${statusColor} ${isConnected && !hasError ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-gray-400">{statusLabel}</span>
    </div>
  );
}
