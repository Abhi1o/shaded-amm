'use client';

import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  children: React.ReactNode;
  blur?: boolean;
}

export function LoadingOverlay({ 
  isLoading, 
  message, 
  children,
  blur = true 
}: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center space-y-3">
            <LoadingSpinner size="lg" />
            {message && (
              <p className="text-sm font-medium text-gray-700">
                {message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
