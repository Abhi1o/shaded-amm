'use client';

import React from 'react';

interface SkeletonLoaderProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number;
}

export function SkeletonLoader({
  variant = 'text',
  width,
  height,
  className = '',
  count = 1,
}: SkeletonLoaderProps) {
  const baseClasses = 'animate-pulse bg-gray-200';
  
  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded',
  };

  const style: React.CSSProperties = {
    width: width || (variant === 'circular' ? '40px' : '100%'),
    height: height || (variant === 'text' ? '1rem' : '40px'),
  };

  const skeletons = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  ));

  return count > 1 ? (
    <div className="space-y-2">{skeletons}</div>
  ) : (
    <>{skeletons}</>
  );
}

// Pre-built skeleton components for common use cases
export function TokenListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
          <SkeletonLoader variant="circular" width={40} height={40} />
          <div className="flex-1 space-y-2">
            <SkeletonLoader variant="text" width="40%" />
            <SkeletonLoader variant="text" width="60%" />
          </div>
          <SkeletonLoader variant="text" width="20%" />
        </div>
      ))}
    </div>
  );
}

export function PoolCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center space-x-2">
            <SkeletonLoader variant="circular" width={32} height={32} />
            <SkeletonLoader variant="circular" width={32} height={32} />
            <SkeletonLoader variant="text" width="40%" />
          </div>
          <div className="space-y-2">
            <SkeletonLoader variant="text" width="60%" />
            <SkeletonLoader variant="text" width="80%" />
            <SkeletonLoader variant="text" width="50%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TransactionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
          <div className="flex items-center space-x-3 flex-1">
            <SkeletonLoader variant="circular" width={24} height={24} />
            <div className="space-y-2 flex-1">
              <SkeletonLoader variant="text" width="30%" />
              <SkeletonLoader variant="text" width="50%" />
            </div>
          </div>
          <SkeletonLoader variant="text" width="15%" />
        </div>
      ))}
    </div>
  );
}
