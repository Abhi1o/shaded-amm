'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface StatusBadgeProps {
  status: 'success' | 'pending' | 'failed' | 'warning';
  text: string;
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({
  status,
  text,
  animated = true,
  size = 'md',
}: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const statusConfig = {
    success: {
      bg: 'bg-green-500/20',
      border: 'border-green-500/50',
      text: 'text-green-400',
      icon: '✓',
    },
    pending: {
      bg: 'bg-yellow-500/20',
      border: 'border-yellow-500/50',
      text: 'text-yellow-400',
      icon: '⋯',
    },
    failed: {
      bg: 'bg-red-500/20',
      border: 'border-red-500/50',
      text: 'text-red-400',
      icon: '✕',
    },
    warning: {
      bg: 'bg-orange-500/20',
      border: 'border-orange-500/50',
      text: 'text-orange-400',
      icon: '⚠',
    },
  };

  const config = statusConfig[status];
  const Component = animated ? motion.span : 'span';

  const pulseAnimation = status === 'pending' && animated
    ? {
        animate: { opacity: [1, 0.5, 1] },
        transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
      }
    : {};

  return (
    <Component
      className={`inline-flex items-center gap-1.5 rounded-full border backdrop-blur-sm font-medium ${sizeClasses[size]} ${config.bg} ${config.border} ${config.text}`}
      {...pulseAnimation}
    >
      <span className="flex-shrink-0">{config.icon}</span>
      <span>{text}</span>
    </Component>
  );
}
