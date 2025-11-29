'use client';

import { useEffect } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '../config/wagmi';
import { errorTracking } from '../lib/errorTracking';
import { analytics } from '../lib/analytics';
import { MultiChainProvider } from '../providers/MultiChainProvider';

const queryClient = new QueryClient();

/**
 * Client-side providers for error tracking and analytics
 * This component initializes monitoring services
 */
export function MonitoringProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize error tracking
    errorTracking.init().catch((error) => {
      console.error('Failed to initialize error tracking:', error);
    });

    // Track initial page view
    if (typeof window !== 'undefined') {
      analytics.trackPageView(window.location.pathname);
    }
  }, []);

  return <>{children}</>;
}

/**
 * Wagmi provider for EVM wallet connections
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config} reconnectOnMount={true}>
      <QueryClientProvider client={queryClient}>
        <MultiChainProvider>
          <MonitoringProvider>
            {children}
          </MonitoringProvider>
        </MultiChainProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
