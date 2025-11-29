/**
 * useWallet Hook - EVM Version
 * 
 * Provides wallet state and actions for EVM chains
 */

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useAccount, useBalance, useDisconnect, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { useWalletStore } from '@/stores/walletStore';
import { getTokensByChainId } from '@/config/evm-tokens';
import { evmApprovalService } from '@/services/evmApprovalService';
import { usePublicClient } from 'wagmi';
import type { Address } from 'viem';

export interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  mint?: string; // For backward compatibility
  isNative?: boolean;
}

export const useWallet = () => {
  const walletStore = useWalletStore();
  const { address, isConnected, connector } = useAccount();
  const { disconnect: disconnectWallet } = useDisconnect();
  const chainId = useChainId();
  const { data: nativeBalance } = useBalance({ address });
  const publicClient = usePublicClient();

  // Token balances and prices state
  const [tokenBalances, setTokenBalances] = useState<Record<string, bigint>>({});
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});
  const [balancesLoading, setBalancesLoading] = useState(false);

  // Sync wallet state with store
  useEffect(() => {
    if (isConnected && address && connector) {
      const currentAddress = address.toString();
      if (walletStore.address !== currentAddress || 
          walletStore.isConnected !== true ||
          walletStore.walletName !== connector.name) {
        walletStore.setWallet({
          publicKey: null, // EVM doesn't use publicKey
          address: currentAddress,
          isConnected: true,
          isConnecting: false,
          walletName: connector.name,
        });
        walletStore.resetConnectionAttempts();
      }
    } else if (!isConnected) {
      if (walletStore.isConnected) {
        walletStore.setWallet({
          publicKey: null,
          address: null,
          isConnected: false,
          isConnecting: false,
          walletName: null,
          walletType: null,
        });
      }
    }
  }, [isConnected, address, connector?.name, walletStore]);

  // Update native balance in store
  useEffect(() => {
    if (nativeBalance) {
      walletStore.updateBalance(nativeBalance.value);
    }
  }, [nativeBalance, walletStore]);

  // Fetch token balances for a list of tokens
  const fetchTokenBalances = useCallback(async (tokens: Token[]) => {
    if (!isConnected || !address || !publicClient) return;

    setBalancesLoading(true);
    try {
      const balances: Record<string, bigint> = {};
      
      // Fetch native balance
      if (nativeBalance) {
        balances['native'] = nativeBalance.value;
      }

      // Fetch ERC-20 token balances
      const tokenAccountPromises = tokens
        .filter(token => !token.isNative)
        .map(async (token) => {
          try {
            const balance = await evmApprovalService.getTokenBalance(
              publicClient,
              token.address as Address,
              address
            );
            balances[token.address] = balance;
          } catch (error) {
            console.error(`Failed to fetch ${token.symbol} balance:`, error);
            balances[token.address] = BigInt(0);
          }
        });

      await Promise.all(tokenAccountPromises);
      setTokenBalances(balances);
    } catch (error) {
      console.error('Failed to fetch token balances:', error);
    } finally {
      setBalancesLoading(false);
    }
  }, [isConnected, address, publicClient, nativeBalance]);

  // Fetch token prices (placeholder - implement with your price oracle)
  const fetchTokenPrices = useCallback(async (tokens: Token[]) => {
    try {
      // TODO: Implement price fetching from your preferred oracle
      // For now, return empty prices
      const prices: Record<string, number> = {};
      setTokenPrices(prices);
    } catch (error) {
      console.error('Failed to fetch token prices:', error);
    }
  }, []);

  // Handle wallet disconnection
  const handleDisconnect = useCallback(async () => {
    try {
      disconnectWallet();
      walletStore.disconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      walletStore.disconnect();
    }
  }, [disconnectWallet, walletStore]);

  // Get formatted native balance
  const getFormattedSolBalance = useCallback(() => {
    if (!nativeBalance) return '0.0000';
    const balance = Number(formatUnits(nativeBalance.value, nativeBalance.decimals));
    return balance.toFixed(4);
  }, [nativeBalance]);

  // Check if wallet can reconnect
  const canReconnectValue = useMemo(() => {
    const { connectionAttempts, lastConnectionAttempt } = walletStore;
    const maxAttempts = 3;
    const cooldownPeriod = 5 * 60 * 1000; // 5 minutes
    
    if (connectionAttempts >= maxAttempts && lastConnectionAttempt) {
      const timeSinceLastAttempt = Date.now() - lastConnectionAttempt;
      return timeSinceLastAttempt > cooldownPeriod;
    }
    
    return connectionAttempts < maxAttempts;
  }, [walletStore.connectionAttempts, walletStore.lastConnectionAttempt]);

  // Get SOL balance (for backward compatibility)
  const solBalance = nativeBalance ? nativeBalance.value : BigInt(0);

  // Get public key (for backward compatibility - return address as string)
  const publicKey = address ? { toString: () => address } : null;

  return {
    // Wallet state from store
    ...walletStore,
    
    // Computed properties
    isConnected: walletStore.isConnected && !!walletStore.address,
    formattedSolBalance: getFormattedSolBalance(),
    canReconnect: canReconnectValue,
    solBalance,
    publicKey,
    
    // Token balances and prices
    tokenBalances,
    tokenPrices,
    balancesLoading,
    
    // Actions
    disconnect: handleDisconnect,
    fetchTokenBalances,
    fetchTokenPrices,
    
    // Network info
    network: chainId,
    chainId,
    
    // Connection state
    connecting: false, // wagmi handles this differently
    connectionError: walletStore.connectionError,
    connectionAttempts: walletStore.connectionAttempts,
  };
};
