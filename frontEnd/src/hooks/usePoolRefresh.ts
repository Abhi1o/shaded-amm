/**
 * usePoolRefresh Hook - EVM Version
 * 
 * Provides pool refresh functionality for EVM chains
 */

import { useEffect, useCallback } from 'react';
import { useChainId } from 'wagmi';
import { usePoolStore } from '@/stores/poolStore';

interface UsePoolRefreshOptions {
  enabled?: boolean;
  refreshInterval?: number;
}

export function usePoolRefresh(options: UsePoolRefreshOptions = {}) {
  const { enabled = true, refreshInterval = 30000 } = options;
  const chainId = useChainId();
  const { 
    loading,
    error,
    lastFetchTime,
    consecutiveFailures,
    isInitialLoad,
    isBackgroundRefresh,
    fetchPools,
    refreshPools,
    clearCache
  } = usePoolStore();

  // Initial load - only when chainId changes
  useEffect(() => {
    if (enabled && chainId) {
      console.log(`Loading pools for chain ${chainId}`);
      fetchPools(chainId, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, enabled]);

  // Auto-refresh - only every 30 seconds
  useEffect(() => {
    if (!enabled || !chainId || refreshInterval <= 0) return;

    console.log(`Setting up auto-refresh every ${refreshInterval}ms for chain ${chainId}`);
    
    const interval = setInterval(() => {
      console.log(`Auto-refreshing pools for chain ${chainId}`);
      refreshPools(chainId);
    }, refreshInterval);

    return () => {
      console.log(`Cleaning up auto-refresh for chain ${chainId}`);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, enabled, refreshInterval]);

  const manualRefresh = useCallback(async () => {
    if (chainId) {
      console.log(`Manual refresh for chain ${chainId}`);
      await refreshPools(chainId);
    }
  }, [chainId, refreshPools]);

  const clearAndRefresh = useCallback(async () => {
    console.log('Clearing cache and refreshing');
    clearCache();
    if (chainId) {
      await fetchPools(chainId, true);
    }
  }, [chainId, clearCache, fetchPools]);

  return {
    isInitialLoad,
    isBackgroundRefresh,
    lastRefreshTime: lastFetchTime,
    manualRefresh,
    clearAndRefresh,
    consecutiveFailures,
    error,
    loading
  };
}
