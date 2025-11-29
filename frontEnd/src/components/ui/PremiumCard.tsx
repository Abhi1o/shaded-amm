'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface PremiumCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'gradient' | 'elevated';
  gradient?: string;
  className?: string;
  hoverable?: boolean;
  animated?: boolean;
}

export function PremiumCard({
  children,
  variant = 'default',
  gradient,
  className = '',
  hoverable = false,
  animated = true,
}: PremiumCardProps) {
  const baseClasses = 'backdrop-blur-xl rounded-3xl border transition-all duration-300';
  
  const variantClasses = {
    default: 'bg-white/5 border-white/10 hover:border-white/20',
    gradient: `bg-gradient-to-br ${gradient || 'from-blue-500/10 to-purple-600/10'} border-white/10 hover:border-white/20`,
    elevated: 'bg-white/10 border-white/20 shadow-2xl hover:shadow-3xl',
  };

  const hoverProps = hoverable
    ? {
        whileHover: { scale: 1.02, y: -4 },
        transition: { duration: 0.2, ease: [0.25, 0.4, 0.25, 1] },
      }
    : {};

  const Component = animated ? motion.div : 'div';

  return (
    <Component
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...(animated ? hoverProps : {})}
    >
      {children}
    </Component>
  );
}
