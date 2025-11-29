/**
 * useSolanaConnection Hook - Stub for EVM
 * 
 * This hook is no longer needed for EVM but kept for backward compatibility
 */

import { usePublicClient } from 'wagmi';

export function useSolanaConnection() {
  const publicClient = usePublicClient();

  return {
    connection: publicClient,
    isConnected: !!publicClient,
  };
}
