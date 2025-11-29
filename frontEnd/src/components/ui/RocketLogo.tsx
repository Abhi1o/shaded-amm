'use client';

import React from 'react';

interface RocketLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function RocketLogo({ size = 'md', className = '' }: RocketLogoProps) {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <svg
      className={`${sizes[size]} ${className}`}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Rocket body */}
      <path
        d="M32 8C32 8 24 12 24 24V44C24 48 28 52 32 52C36 52 40 48 40 44V24C40 12 32 8 32 8Z"
        fill="url(#rocketGradient)"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Window */}
      <circle
        cx="32"
        cy="24"
        r="4"
        fill="rgba(59, 130, 246, 0.3)"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* Left fin */}
      <path
        d="M24 36L16 44C16 44 18 46 20 46L24 42V36Z"
        fill="url(#finGradient)"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Right fin */}
      <path
        d="M40 36L48 44C48 44 46 46 44 46L40 42V36Z"
        fill="url(#finGradient)"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Flame 1 */}
      <path
        d="M28 52C28 52 26 54 26 56C26 58 28 60 30 60C30 58 28 56 28 54V52Z"
        fill="url(#flameGradient1)"
        className="animate-pulse"
      />

      {/* Flame 2 */}
      <path
        d="M32 52C32 52 30 55 30 58C30 60 32 62 34 62C34 60 32 57 32 54V52Z"
        fill="url(#flameGradient2)"
        className="animate-pulse"
        style={{ animationDelay: '0.1s' }}
      />

      {/* Flame 3 */}
      <path
        d="M36 52C36 52 34 54 34 56C34 58 36 60 38 60C38 58 36 56 36 54V52Z"
        fill="url(#flameGradient1)"
        className="animate-pulse"
        style={{ animationDelay: '0.2s' }}
      />

      {/* Stars */}
      <circle cx="12" cy="12" r="1" fill="currentColor" className="animate-pulse" />
      <circle cx="52" cy="16" r="1" fill="currentColor" className="animate-pulse" style={{ animationDelay: '0.3s' }} />
      <circle cx="8" cy="28" r="1" fill="currentColor" className="animate-pulse" style={{ animationDelay: '0.5s' }} />
      <circle cx="56" cy="32" r="1" fill="currentColor" className="animate-pulse" style={{ animationDelay: '0.7s' }} />

      {/* Gradients */}
      <defs>
        <linearGradient id="rocketGradient" x1="32" y1="8" x2="32" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>

        <linearGradient id="finGradient" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>

        <linearGradient id="flameGradient1" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#EF4444" />
        </linearGradient>

        <linearGradient id="flameGradient2" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>
    </svg>
  );
}
