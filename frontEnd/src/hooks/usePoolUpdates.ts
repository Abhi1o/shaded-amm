'use client';

import { useEffect, useCallback, useRef } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';
import { Pool, PoolUpdateEvent } from '@/types';
import { usePoolStore } from '@/stores/poolStore';

interface UsePoolUpdatesOptions {
  enabled?: boolean;
  updateInterval?: number; // milliseconds
}

interface UsePoolUpdatesReturn {
  subscribeToPool: (poolId: string) => void;
  unsubscribeFromPool: (poolId: string) => void;
  subscribeToAllPools: () => void;
  unsubscribeFromAllPools: () => void;
}

export function usePoolUpdates(options: UsePoolUpdatesOptions = {}): UsePoolUpdatesReturn {
  const { enabled = true, updateInterval = 60000 } = options; // Increased from 30s to 60s
  const { connection } = useConnection();
  const { pools, setPools } = usePoolStore();
  
  const subscriptionsRef = useRef<Map<string, number>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsConnectionRef = useRef<WebSocket | null>(null);

  // Fetch pool data from Solana
  const fetchPoolData = useCallback(async (poolId: string): Promise<Partial<Pool> | null> => {
    try {
      const poolPubkey = new PublicKey(poolId);
      
      // TODO: Implement actual pool data fetching from Solana programs
      // This would involve:
      // 1. Fetching pool account data
      // 2. Parsing AMM-specific data structures
      // 3. Calculating current reserves, volume, fees, etc.
      
      // For now, return mock updated data
      const mockUpdate: Partial<Pool> = {
        reserveA: BigInt(Math.floor(Math.random() * 1000000 * 1e9)),
        reserveB: BigInt(Math.floor(Math.random() * 1000000 * 1e6)),
        volume24h: BigInt(Math.floor(Math.random() * 100000 * 1e9)),
        fees24h: BigInt(Math.floor(Math.random() * 1000 * 1e9)),
        lastUpdated: Date.now(),
      };

      return mockUpdate;
    } catch (error) {
      console.error(`Failed to fetch pool data for ${poolId}:`, error);
      return null;
    }
  }, []);

  // Update pool data in store
  const updatePoolData = useCallback((poolId: string, updates: Partial<Pool>) => {
    setPools(pools.map(pool => 
      pool.id === poolId 
        ? { ...pool, ...updates }
        : pool
    ));
  }, [pools, setPools]);

  // Fetch updates for all subscribed pools
  const fetchAllPoolUpdates = useCallback(async () => {
    if (!enabled || subscriptionsRef.current.size === 0) return;

    const updatePromises = Array.from(subscriptionsRef.current.keys()).map(async (poolId) => {
      const updates = await fetchPoolData(poolId);
      if (updates) {
        updatePoolData(poolId, updates);
      }
    });

    await Promise.all(updatePromises);
  }, [enabled, fetchPoolData, updatePoolData]);

  // Set up WebSocket connection for real-time updates
  const setupWebSocketConnection = useCallback(() => {
    if (!enabled || wsConnectionRef.current) return;

    try {
      // TODO: Implement actual WebSocket connection to Solana RPC
      // For now, we'll use polling instead of WebSocket
      console.log('WebSocket connection would be established here');
      
      // Mock WebSocket connection
      const mockWs = {
        close: () => console.log('Mock WebSocket closed'),
        send: (data: string) => console.log('Mock WebSocket send:', data),
      } as any;
      
      wsConnectionRef.current = mockWs;
    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
    }
  }, [enabled]);

  // Close WebSocket connection
  const closeWebSocketConnection = useCallback(() => {
    if (wsConnectionRef.current) {
      wsConnectionRef.current.close();
      wsConnectionRef.current = null;
    }
  }, []);

  // Subscribe to pool updates
  const subscribeToPool = useCallback((poolId: string) => {
    if (!enabled) return;

    // Add to subscriptions
    subscriptionsRef.current.set(poolId, Date.now());

    // Set up WebSocket if not already connected
    setupWebSocketConnection();

    // TODO: Subscribe to specific pool account changes via WebSocket
    console.log(`Subscribed to pool updates: ${poolId}`);
  }, [enabled, setupWebSocketConnection]);

  // Unsubscribe from pool updates
  const unsubscribeFromPool = useCallback((poolId: string) => {
    subscriptionsRef.current.delete(poolId);

    // Close WebSocket if no more subscriptions
    if (subscriptionsRef.current.size === 0) {
      closeWebSocketConnection();
    }

    console.log(`Unsubscribed from pool updates: ${poolId}`);
  }, [closeWebSocketConnection]);

  // Subscribe to all pools
  const subscribeToAllPools = useCallback(() => {
    pools.forEach(pool => subscribeToPool(pool.id));
  }, [pools, subscribeToPool]);

  // Unsubscribe from all pools
  const unsubscribeFromAllPools = useCallback(() => {
    Array.from(subscriptionsRef.current.keys()).forEach(poolId => {
      unsubscribeFromPool(poolId);
    });
  }, [unsubscribeFromPool]);

  // Set up polling interval for updates
  useEffect(() => {
    if (!enabled) return;

    intervalRef.current = setInterval(fetchAllPoolUpdates, updateInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, updateInterval, fetchAllPoolUpdates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeFromAllPools();
      closeWebSocketConnection();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [unsubscribeFromAllPools, closeWebSocketConnection]);

  return {
    subscribeToPool,
    unsubscribeFromPool,
    subscribeToAllPools,
    unsubscribeFromAllPools,
  };
}

// Hook for subscribing to specific pool updates
export function usePoolSubscription(poolId: string | null, enabled: boolean = true) {
  const { subscribeToPool, unsubscribeFromPool } = usePoolUpdates({ enabled });

  useEffect(() => {
    if (poolId && enabled) {
      subscribeToPool(poolId);
      return () => unsubscribeFromPool(poolId);
    }
  }, [poolId, enabled, subscribeToPool, unsubscribeFromPool]);
}

// Hook for managing pool list subscriptions
export function usePoolListSubscriptions(enabled: boolean = true) {
  const { subscribeToAllPools, unsubscribeFromAllPools } = usePoolUpdates({ enabled });
  const { pools } = usePoolStore();

  useEffect(() => {
    if (enabled && pools.length > 0) {
      subscribeToAllPools();
    }

    return () => {
      if (enabled) {
        unsubscribeFromAllPools();
      }
    };
  }, [enabled, pools.length, subscribeToAllPools, unsubscribeFromAllPools]);
}