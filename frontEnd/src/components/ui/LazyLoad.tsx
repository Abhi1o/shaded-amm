'use client';

import React, { Suspense, ComponentType, lazy } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface LazyLoadProps {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function LazyLoad({ fallback, children }: LazyLoadProps) {
  return (
    <Suspense fallback={fallback || <LoadingSpinner />}>
      {children}
    </Suspense>
  );
}

// Helper function to create lazy-loaded components with custom fallback
export function createLazyComponent<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFn);
  
  return (props: P) => (
    <Suspense fallback={fallback || <LoadingSpinner />}>
      <LazyComponent {...props} />
    </Suspense>
  );
}
