'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton' | 'pulse';
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function LoadingState({
  variant = 'spinner',
  size = 'md',
  text,
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  if (variant === 'spinner') {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <motion.div
          className={`${sizeClasses[size]} border-4 border-white/20 border-t-white rounded-full`}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        {text && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-gray-400 text-sm"
          >
            {text}
          </motion.p>
        )}
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div className="space-y-4 p-6">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="backdrop-blur-xl bg-white/5 rounded-2xl h-20 border border-white/10"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <motion.div
        className="backdrop-blur-xl bg-white/5 rounded-2xl p-8 border border-white/10"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {text && <p className="text-gray-400 text-center">{text}</p>}
      </motion.div>
    );
  }

  return null;
}
