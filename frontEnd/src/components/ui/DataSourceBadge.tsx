/**
 * Data Source Badge Component
 * 
 * Displays the source of pool data (blockchain, config, or hybrid).
 * Shows visual indicators for live vs cached data.
 * 
 * Requirements:
 * - 1.4: Show fallback indicator when using config data
 * - 5.1: User feedback for data source
 */

'use client';

import React from 'react';
import { 
  SignalIcon, 
  CloudIcon, 
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';

export type DataSource = 'blockchain' | 'config' | 'hybrid';

export interface DataSourceBadgeProps {
  /** Source of the data */
  dataSource: DataSource;
  /** Error message if blockchain fetch failed */
  error?: string | null;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show label text */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Data Source Badge Component
 * 
 * Visual indicator showing whether data is from blockchain or config.
 * 
 * @example
 * ```tsx
 * <DataSourceBadge
 *   dataSource="blockchain"
 *   showLabel={true}
 * />
 * ```
 */
export function DataSourceBadge({
  dataSource,
  error = null,
  size = 'md',
  showLabel = true,
  className = ''
}: DataSourceBadgeProps) {
  // Size classes
  const sizeClasses = {
    sm: {
      container: 'px-2 py-0.5 text-xs',
      icon: 'w-3 h-3'
    },
    md: {
      container: 'px-2.5 py-1 text-xs',
      icon: 'w-3.5 h-3.5'
    },
    lg: {
      container: 'px-3 py-1.5 text-sm',
      icon: 'w-4 h-4'
    }
  };

  const classes = sizeClasses[size];

  // Configuration based on data source
  const config = React.useMemo(() => {
    if (dataSource === 'blockchain') {
      return {
        icon: SignalIcon,
        iconClass: 'text-green-400',
        bgClass: 'bg-green-500/10 border-green-500/30',
        label: 'Live',
        description: 'Real-time blockchain data',
        showPulse: true
      };
    }

    if (dataSource === 'config' && error) {
      return {
        icon: ExclamationTriangleIcon,
        iconClass: 'text-yellow-400',
        bgClass: 'bg-yellow-500/10 border-yellow-500/30',
        label: 'Cached',
        description: 'Using cached data - blockchain fetch failed',
        showPulse: false
      };
    }

    if (dataSource === 'config') {
      return {
        icon: CloudIcon,
        iconClass: 'text-gray-400',
        bgClass: 'bg-gray-500/10 border-gray-500/30',
        label: 'Config',
        description: 'Static configuration data',
        showPulse: false
      };
    }

    // Hybrid
    return {
      icon: SignalIcon,
      iconClass: 'text-blue-400',
      bgClass: 'bg-blue-500/10 border-blue-500/30',
      label: 'Hybrid',
      description: 'Mixed blockchain and config data',
      showPulse: false
    };
  }, [dataSource, error]);

  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full backdrop-blur-xl border ${config.bgClass} ${classes.container} ${className}`}
      title={config.description}
    >
      <div className="relative">
        <Icon className={`${classes.icon} ${config.iconClass}`} />
        {config.showPulse && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
        )}
      </div>
      {showLabel && (
        <span className={`font-medium ${config.iconClass}`}>
          {config.label}
        </span>
      )}
    </div>
  );
}

/**
 * Data Source Indicator
 * 
 * A more detailed indicator with description text.
 */
export function DataSourceIndicator({
  dataSource,
  error = null,
  className = ''
}: {
  dataSource: DataSource;
  error?: string | null;
  className?: string;
}) {
  const config = React.useMemo(() => {
    if (dataSource === 'blockchain') {
      return {
        icon: SignalIcon,
        iconClass: 'text-green-400',
        bgClass: 'bg-green-500/10 border-green-500/30',
        title: 'Live Data',
        description: 'Real-time blockchain data',
        showPulse: true
      };
    }

    if (dataSource === 'config' && error) {
      return {
        icon: ExclamationTriangleIcon,
        iconClass: 'text-yellow-400',
        bgClass: 'bg-yellow-500/10 border-yellow-500/30',
        title: 'Cached Data',
        description: 'Blockchain unavailable, using cached data',
        showPulse: false
      };
    }

    if (dataSource === 'config') {
      return {
        icon: CloudIcon,
        iconClass: 'text-gray-400',
        bgClass: 'bg-gray-500/10 border-gray-500/30',
        title: 'Static Data',
        description: 'Configuration data',
        showPulse: false
      };
    }

    return {
      icon: SignalIcon,
      iconClass: 'text-blue-400',
      bgClass: 'bg-blue-500/10 border-blue-500/30',
      title: 'Hybrid Data',
      description: 'Mixed sources',
      showPulse: false
    };
  }, [dataSource, error]);

  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl border ${config.bgClass} ${className}`}
    >
      <div className="relative">
        <Icon className={`w-5 h-5 ${config.iconClass}`} />
        {config.showPulse && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        )}
      </div>
      <div>
        <div className={`text-sm font-medium ${config.iconClass}`}>
          {config.title}
        </div>
        <div className="text-xs text-gray-400">
          {config.description}
        </div>
      </div>
    </div>
  );
}
