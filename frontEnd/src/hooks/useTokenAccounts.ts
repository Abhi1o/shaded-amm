/**
 * useTokenAccounts Hook - EVM Version
 * 
 * Provides token account data for EVM chains
 */

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useChainId } from 'wagmi';
import { getTokensByChainId } from '@/config/evm-tokens';
import { evmApprovalService } from '@/services/evmApprovalService';
import type { Address } from 'viem';

export interface TokenAccount {
  address: string;
  symbol: string;
  balance: bigint;
  decimals: number;
}

export function useTokenAccounts() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const [tokenAccounts, setTokenAccounts] = useState<TokenAccount[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isConnected || !address || !publicClient) {
      setTokenAccounts([]);
      return;
    }

    async function fetchTokenAccounts() {
      if (!address || !publicClient) return;

      setLoading(true);
      try {
        const tokens = getTokensByChainId(chainId);
        const accounts = await Promise.all(
          tokens.map(async (token) => {
            try {
              const balance = await evmApprovalService.getTokenBalance(
                publicClient,
                token.address as Address,
                address
              );

              return {
                address: token.address,
                symbol: token.symbol,
                balance,
                decimals: token.decimals,
              };
            } catch (error) {
              return {
                address: token.address,
                symbol: token.symbol,
                balance: BigInt(0),
                decimals: token.decimals,
              };
            }
          })
        );

        setTokenAccounts(accounts);
      } catch (error) {
        console.error('Failed to fetch token accounts:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTokenAccounts();
  }, [address, isConnected, publicClient, chainId]);

  return {
    tokenAccounts,
    loading,
  };
}
