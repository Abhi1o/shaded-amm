'use client';

import { useState, useCallback, useRef } from 'react';
import { Connection } from '@solana/web3.js';
import { SolanaCluster } from '@/types';
import { useNotificationStore } from '@/stores/notificationStore';

interface RpcEndpoint {
  url: string;
  cluster: SolanaCluster;
  priority: number;
}

interface UseRpcFallbackOptions {
  cluster: SolanaCluster;
  maxRetries?: number;
  timeout?: number;
}

interface UseRpcFallbackReturn {
  connection: Connection | null;
  currentEndpoint: string | null;
  isHealthy: boolean;
  executeWithFallback: <T>(
    operation: (connection: Connection) => Promise<T>
  ) => Promise<T>;
  checkHealth: () => Promise<boolean>;
}

// Default RPC endpoints for each cluster
const DEFAULT_ENDPOINTS: Record<SolanaCluster, RpcEndpoint[]> = {
  [SolanaCluster.MAINNET]: [
    { url: 'https://api.mainnet-beta.solana.com', cluster: SolanaCluster.MAINNET, priority: 1 },
    { url: 'https://solana-api.projectserum.com', cluster: SolanaCluster.MAINNET, priority: 2 },
  ],
  [SolanaCluster.DEVNET]: [
    { url: 'https://api.devnet.solana.com', cluster: SolanaCluster.DEVNET, priority: 1 },
    { url: 'https://solana-devnet.g.alchemy.com/v2/-f0lKfodonOgvqviPDgyB', cluster: SolanaCluster.DEVNET, priority: 2 },
    { url: 'https://devnet.helius-rpc.com/?api-key=f4d5ea3d-bea6-48f6-ba0f-323908a8f19b', cluster: SolanaCluster.DEVNET, priority: 3 },
  ],
  [SolanaCluster.TESTNET]: [
    { url: 'https://api.testnet.solana.com', cluster: SolanaCluster.TESTNET, priority: 1 },
  ],
  [SolanaCluster.LOCALNET]: [
    { url: 'http://localhost:8899', cluster: SolanaCluster.LOCALNET, priority: 1 },
  ],
};

export function useRpcFallback(options: UseRpcFallbackOptions): UseRpcFallbackReturn {
  const { cluster, maxRetries = 3, timeout = 30000 } = options;
  
  const [connection, setConnection] = useState<Connection | null>(null);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [isHealthy, setIsHealthy] = useState(true);
  
  const endpointIndexRef = useRef(0);
  const failedEndpointsRef = useRef<Set<string>>(new Set());
  
  const { showWarning, showError } = useNotificationStore();

  const getNextEndpoint = useCallback((skipCurrent = false): RpcEndpoint | null => {
    const endpoints = DEFAULT_ENDPOINTS[cluster];

    if (skipCurrent && currentEndpoint) {
      // If skipping current, increment to avoid it
      endpointIndexRef.current++;
    }

    // Filter out failed endpoints
    const availableEndpoints = endpoints.filter(
      (ep) => !failedEndpointsRef.current.has(ep.url)
    );

    if (availableEndpoints.length === 0) {
      // Reset failed endpoints if all have failed
      console.log('🔄 All RPC endpoints failed, resetting and retrying');
      failedEndpointsRef.current.clear();
      endpointIndexRef.current = 0;
      return endpoints[0] || null;
    }

    // Round-robin: Get next endpoint in rotation
    const endpoint = availableEndpoints[endpointIndexRef.current % availableEndpoints.length];
    endpointIndexRef.current++;

    console.log(`🔀 Rotating to RPC endpoint: ${endpoint.url} (priority: ${endpoint.priority})`);

    return endpoint;
  }, [cluster, currentEndpoint]);

  const createConnection = useCallback((endpoint: RpcEndpoint): Connection => {
    return new Connection(endpoint.url, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: timeout,
    });
  }, [timeout]);

  const checkHealth = useCallback(async (): Promise<boolean> => {
    if (!connection) return false;

    try {
      const startTime = Date.now();
      await connection.getLatestBlockhash();
      const responseTime = Date.now() - startTime;

      // Consider unhealthy if response time > 5 seconds
      const healthy = responseTime < 5000;
      setIsHealthy(healthy);
      
      return healthy;
    } catch (error) {
      console.error('RPC health check failed:', error);
      setIsHealthy(false);
      return false;
    }
  }, [connection]);

  const executeWithFallback = useCallback(
    async <T,>(operation: (connection: Connection) => Promise<T>): Promise<T> => {
      let lastError: unknown;
      let attempts = 0;

      while (attempts < maxRetries) {
        try {
          // Get or create connection
          let conn = connection;

          if (!conn || (!isHealthy && attempts > 0)) {
            // Use round-robin for load balancing
            const endpoint = getNextEndpoint(attempts > 0);

            if (!endpoint) {
              throw new Error('No available RPC endpoints');
            }

            conn = createConnection(endpoint);
            setConnection(conn);
            setCurrentEndpoint(endpoint.url);

            if (attempts > 0) {
              showWarning(
                'Switching RPC',
                `Trying alternative endpoint (${attempts + 1}/${maxRetries})...`,
                true
              );
            }
          } else if (!conn) {
            // First request - initialize with round-robin
            const endpoint = getNextEndpoint(false);

            if (!endpoint) {
              throw new Error('No available RPC endpoints');
            }

            conn = createConnection(endpoint);
            setConnection(conn);
            setCurrentEndpoint(endpoint.url);
          }

          // Execute operation with timeout
          const result = await Promise.race([
            operation(conn),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('RPC request timeout')), timeout)
            ),
          ]);

          // Success - mark as healthy
          setIsHealthy(true);

          // Remove from failed set if it was there
          if (currentEndpoint && failedEndpointsRef.current.has(currentEndpoint)) {
            failedEndpointsRef.current.delete(currentEndpoint);
          }

          return result;
        } catch (error: any) {
          lastError = error;
          attempts++;

          // Check if it's a rate limit error (429)
          const isRateLimitError = error?.message?.includes('429') ||
                                   error?.status === 429 ||
                                   error?.code === 429;

          if (isRateLimitError) {
            console.warn(`⚠️  Rate limit hit on ${currentEndpoint}, rotating to next endpoint`);
          } else {
            console.error(`❌ RPC operation failed (attempt ${attempts}/${maxRetries}):`, error);
          }

          // Mark current endpoint as failed
          if (currentEndpoint) {
            failedEndpointsRef.current.add(currentEndpoint);
          }

          setIsHealthy(false);

          // If not last attempt, try next endpoint
          if (attempts < maxRetries) {
            const nextEndpoint = getNextEndpoint(true);
            if (nextEndpoint) {
              const newConnection = createConnection(nextEndpoint);
              setConnection(newConnection);
              setCurrentEndpoint(nextEndpoint.url);
            }
          }
        }
      }

      // All attempts failed
      showError(
        'RPC Connection Failed',
        'Unable to connect to Solana network after trying all endpoints. Please try again later.',
        false
      );

      throw lastError || new Error('RPC operation failed after all retries');
    },
    [
      connection,
      isHealthy,
      currentEndpoint,
      maxRetries,
      timeout,
      getNextEndpoint,
      createConnection,
      showWarning,
      showError,
    ]
  );

  return {
    connection,
    currentEndpoint,
    isHealthy,
    executeWithFallback,
    checkHealth,
  };
}
