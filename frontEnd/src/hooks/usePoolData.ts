/**
 * On-Demand Pool Data Hook
 * 
 * This hook provides on-demand fetching of pool data from the blockchain.
 * Unlike the old approach that fetched ALL pools, this only fetches data
 * for the specific token pair the user is interested in.
 * 
 * Use Cases:
 * - Add Liquidity: Fetch pool data when user selects tokens
 * - Remove Liquidity: Fetch pool data for user's positions
 * - Swap: Fetch pool data for selected token pair
 * 
 * @module usePoolData
 */

'use client';

import { useState, useCallback } from 'react';
import { Connection } from '@solana/web3.js';
import { Pool } from '@/types';
import { getPoolsByTokenPair } from '@/lib/solana/poolLoader';
import { useSolanaConnection } from './useSolanaConnection';

export interface UsePoolDataOptions {
  /** Whether to automatically fetch on mount */
  autoFetch?: boolean;
  /** Token A mint address */
  tokenAMint?: string;
  /** Token B mint address */
  tokenBMint?: string;
}

export interface UsePoolDataReturn {
  /** Pools for the token pair */
  pools: Pool[];
  /** Whether data is currently being fetched */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Fetch pools for a specific token pair */
  fetchPoolsForPair: (tokenAMint: string, tokenBMint: string) => Promise<Pool[]>;
  /** Clear current pool data */
  clearPools: () => void;
  /** Timestamp of last fetch */
  lastFetchTime: number;
}

/**
 * Hook for on-demand pool data fetching
 * 
 * This hook fetches pool data only when needed, not automatically.
 * It's designed for use in components where users select specific token pairs.
 * 
 * @param options - Configuration options
 * @returns Pool data and fetch functions
 * 
 * @example
 * ```tsx
 * // In Add Liquidity component
 * const { pools, loading, fetchPoolsForPair } = usePoolData();
 * 
 * // When user selects both tokens
 * useEffect(() => {
 *   if (tokenA && tokenB) {
 *     fetchPoolsForPair(tokenA.mint, tokenB.mint);
 *   }
 * }, [tokenA, tokenB]);
 * ```
 */
export function usePoolData(options: UsePoolDataOptions = {}): UsePoolDataReturn {
  const { autoFetch = false, tokenAMint, tokenBMint } = options;
  const { connection } = useSolanaConnection();

  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState(0);

  /**
   * Fetch pools for a specific token pair
   */
  const fetchPoolsForPair = useCallback(
    async (tokenAMint: string, tokenBMint: string): Promise<Pool[]> => {
      if (!connection) {
        const errorMsg = 'No connection available';
        setError(errorMsg);
        return [];
      }

      console.log(`🔍 Fetching pools for pair: ${tokenAMint}/${tokenBMint}`);
      setLoading(true);
      setError(null);

      try {
        // Fetch only the pools for this specific token pair
        const fetchedPools = await getPoolsByTokenPair(
          connection,
          tokenAMint,
          tokenBMint
        );

        console.log(`✅ Fetched ${fetchedPools.length} pool(s) for pair`);
        setPools(fetchedPools);
        setLastFetchTime(Date.now());
        return fetchedPools;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('❌ Failed to fetch pools for pair:', errorMessage);
        setError(errorMessage);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [connection]
  );

  /**
   * Clear current pool data
   */
  const clearPools = useCallback(() => {
    setPools([]);
    setError(null);
    setLastFetchTime(0);
  }, []);

  // Auto-fetch if enabled and token mints provided
  React.useEffect(() => {
    if (autoFetch && tokenAMint && tokenBMint && connection) {
      fetchPoolsForPair(tokenAMint, tokenBMint);
    }
  }, [autoFetch, tokenAMint, tokenBMint, connection, fetchPoolsForPair]);

  return {
    pools,
    loading,
    error,
    fetchPoolsForPair,
    clearPools,
    lastFetchTime,
  };
}

/**
 * Hook for fetching a single pool by address
 * 
 * Use this when you know the exact pool address (e.g., from user's LP positions)
 */
export function usePoolByAddress(poolAddress: string | null) {
  const { connection } = useSolanaConnection();
  const [pool, setPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPool = useCallback(async () => {
    if (!poolAddress || !connection) return;

    console.log(`🔍 Fetching pool: ${poolAddress}`);
    setLoading(true);
    setError(null);

    try {
      const { getPoolByAddress } = await import('@/lib/solana/poolLoader');
      const fetchedPool = await getPoolByAddress(connection, poolAddress);

      if (fetchedPool) {
        console.log(`✅ Fetched pool data`);
        setPool(fetchedPool);
      } else {
        setError('Pool not found');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('❌ Failed to fetch pool:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [poolAddress, connection]);

  React.useEffect(() => {
    if (poolAddress) {
      fetchPool();
    }
  }, [poolAddress, fetchPool]);

  return {
    pool,
    loading,
    error,
    refetch: fetchPool,
  };
}

// Add React import for useEffect
import React from 'react';
