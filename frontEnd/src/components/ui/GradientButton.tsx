'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface GradientButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  gradient?: string;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function GradientButton({
  children,
  variant = 'primary',
  gradient,
  onClick,
  disabled = false,
  fullWidth = false,
  size = 'md',
  loading = false,
}: GradientButtonProps) {
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const variantClasses = {
    primary: `bg-gradient-to-r ${gradient || 'from-blue-500 to-purple-600'} text-white font-semibold shadow-lg hover:shadow-xl`,
    secondary: 'backdrop-blur-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20',
    ghost: 'bg-transparent text-white font-medium hover:bg-white/5',
  };

  const baseClasses = `rounded-full transition-all duration-300 ${sizeClasses[size]} ${variantClasses[variant]}`;
  const widthClass = fullWidth ? 'w-full' : '';
  const disabledClass = disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

  return (
    <motion.button
      onClick={disabled || loading ? undefined : onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${widthClass} ${disabledClass} relative overflow-hidden`}
      whileHover={disabled || loading ? {} : { scale: 1.05 }}
      whileTap={disabled || loading ? {} : { scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {loading ? (
        <span className="flex items-center justify-center">
          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </span>
      ) : (
        children
      )}
      {variant === 'primary' && !disabled && !loading && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 hover:opacity-100 transition-opacity duration-300"
          style={{ zIndex: -1 }}
        />
      )}
    </motion.button>
  );
}
