/**
 * Connection Pool Hook
 *
 * This hook provides access to the Solana connection pool with automatic
 * load balancing and failover capabilities.
 *
 * @module useConnectionPool
 */

'use client';

import { useCallback, useMemo } from 'react';
import { Connection } from '@solana/web3.js';
import { SolanaCluster } from '@/types';
import { getDevnetConnectionPool, SolanaConnectionPool } from '@/lib/solana/connectionPool';

interface UseConnectionPoolReturn {
  /** Get a connection with automatic load balancing */
  getConnection: () => Connection;
  /** Execute an operation with automatic failover */
  executeWithFailover: <T>(
    operation: (connection: Connection) => Promise<T>,
    maxRetries?: number
  ) => Promise<T>;
  /** Get current endpoint URL */
  getCurrentEndpoint: () => string | null;
  /** Get health status of all endpoints */
  getHealth: () => {
    url: string;
    isHealthy: boolean;
    consecutiveFailures: number;
    lastFailureTime: number;
    lastSuccessTime: number;
  }[];
  /** Connection pool instance */
  pool: SolanaConnectionPool;
}

/**
 * Hook to access the connection pool with automatic load balancing
 *
 * @param cluster - Solana cluster (currently only supports DEVNET)
 * @returns Connection pool utilities
 *
 * @example
 * ```tsx
 * const { executeWithFailover, getCurrentEndpoint } = useConnectionPool();
 *
 * // Execute RPC call with automatic failover
 * const balance = await executeWithFailover(async (conn) => {
 *   return await conn.getBalance(publicKey);
 * });
 *
 * // Get current endpoint
 * console.log('Using endpoint:', getCurrentEndpoint());
 * ```
 */
export function useConnectionPool(
  cluster: SolanaCluster = SolanaCluster.DEVNET
): UseConnectionPoolReturn {
  // Get the connection pool instance
  const pool = useMemo(() => {
    // Currently only devnet is supported with connection pool
    if (cluster === SolanaCluster.DEVNET) {
      return getDevnetConnectionPool();
    }
    // For other clusters, we'd need to create separate pools
    throw new Error(`Connection pool not yet implemented for cluster: ${cluster}`);
  }, [cluster]);

  // Get a connection with load balancing
  const getConnection = useCallback((): Connection => {
    return pool.getConnection();
  }, [pool]);

  // Execute operation with automatic failover
  const executeWithFailover = useCallback(
    async <T,>(
      operation: (connection: Connection) => Promise<T>,
      maxRetries = 3
    ): Promise<T> => {
      return pool.executeWithFailover(operation, maxRetries);
    },
    [pool]
  );

  // Get current endpoint
  const getCurrentEndpoint = useCallback((): string | null => {
    return pool.getCurrentEndpoint();
  }, [pool]);

  // Get health status
  const getHealth = useCallback(() => {
    return pool.getHealth();
  }, [pool]);

  return {
    getConnection,
    executeWithFailover,
    getCurrentEndpoint,
    getHealth,
    pool,
  };
}
