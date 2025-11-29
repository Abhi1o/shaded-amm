/**
 * Hook to load pools from blockchain
 * 
 * This hook loads pool metadata from dex-config.json and fetches real-time data
 * from the Solana blockchain. It replaces the old config-only loading approach.
 */

import { useEffect } from 'react';
import { usePoolStore } from '@/stores/poolStore';
import { useSolanaConnection } from './useSolanaConnection';

/**
 * Load pools from blockchain on mount
 * 
 * This hook triggers an initial pool fetch from the blockchain when the component mounts.
 * It uses the pool store's fetchPools method which loads pool metadata from config
 * and enriches it with real-time blockchain data.
 * 
 * @deprecated Use usePoolRefresh hook instead for automatic refresh functionality
 */
export function usePoolsFromConfig() {
  const { connection } = useSolanaConnection();
  const { fetchPools } = usePoolStore();

  useEffect(() => {
    // Fetch pools from blockchain on mount
    fetchPools(connection, true).catch(error => {
      console.error('Failed to load pools from blockchain:', error);
    });
  }, [connection, fetchPools]);
}
