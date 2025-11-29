'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Token } from '@/types';
import { useWallet } from './useWallet';
import { useTokenList } from './useTokenList';
import { useTokenBalanceUpdates } from './useTokenBalanceUpdates';

interface TokenBalanceData {
  balance: bigint;
  value: number;
  price: number;
  lastUpdated: number;
}

interface UseTokenBalanceManagerReturn {
  balances: Record<string, TokenBalanceData>;
  totalPortfolioValue: number;
  loading: boolean;
  error: string | null;
  refreshBalances: () => Promise<void>;
  refreshPrices: () => Promise<void>;
  getTokenBalance: (mint: string) => bigint;
  getTokenValue: (mint: string) => number;
  isBalanceStale: (mint: string, maxAgeMs?: number) => boolean;
}

export function useTokenBalanceManager(): UseTokenBalanceManagerReturn {
  const [balances, setBalances] = useState<Record<string, TokenBalanceData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { 
    isConnected, 
    fetchTokenBalances, 
    fetchTokenPrices,
    tokenBalances,
    tokenPrices 
  } = useWallet();
  const { tokens } = useTokenList();
  
  const refreshIntervalRef = useRef<NodeJS.Timeout>();
  const priceRefreshIntervalRef = useRef<NodeJS.Timeout>();

  // Handle real-time balance updates
  const handleBalanceUpdate = useCallback((mint: string, balance: bigint) => {
    setBalances(prev => {
      const existing = prev[mint];
      if (!existing) return prev;

      return {
        ...prev,
        [mint]: {
          ...existing,
          balance,
          value: (Number(balance) / Math.pow(10, getTokenDecimals(mint))) * existing.price,
          lastUpdated: Date.now()
        }
      };
    });
  }, []);

  // Get token decimals helper
  const getTokenDecimals = useCallback((mint: string): number => {
    const token = tokens.find(t => t.mint === mint);
    return token?.decimals || 0;
  }, [tokens]);

  // Set up real-time updates
  useTokenBalanceUpdates({
    tokens,
    onBalanceUpdate: handleBalanceUpdate,
    enabled: isConnected
  });

  // Refresh balances from blockchain
  const refreshBalances = useCallback(async () => {
    if (!isConnected || tokens.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      await fetchTokenBalances(tokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh balances');
    } finally {
      setLoading(false);
    }
  }, [isConnected, tokens, fetchTokenBalances]);

  // Refresh prices from API
  const refreshPrices = useCallback(async () => {
    if (tokens.length === 0) return;

    try {
      await fetchTokenPrices(tokens);
    } catch (err) {
      console.error('Failed to refresh prices:', err);
    }
  }, [tokens, fetchTokenPrices]);

  // Update balances state when wallet data changes
  useEffect(() => {
    if (!tokenBalances || !tokenPrices) return;

    const newBalances: Record<string, TokenBalanceData> = {};

    tokens.forEach(token => {
      const balance = tokenBalances[token.mint] || BigInt(0);
      const price = tokenPrices[token.mint] || 0;
      const balanceNumber = Number(balance) / Math.pow(10, token.decimals);
      const value = balanceNumber * price;

      newBalances[token.mint] = {
        balance,
        value,
        price,
        lastUpdated: Date.now()
      };
    });

    setBalances(newBalances);
  }, [tokenBalances, tokenPrices, tokens]);

  // Set up periodic refresh intervals
  useEffect(() => {
    if (!isConnected) return;

    // Refresh balances every 30 seconds
    refreshIntervalRef.current = setInterval(() => {
      refreshBalances();
    }, 30000);

    // Refresh prices every 60 seconds
    priceRefreshIntervalRef.current = setInterval(() => {
      refreshPrices();
    }, 60000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (priceRefreshIntervalRef.current) {
        clearInterval(priceRefreshIntervalRef.current);
      }
    };
  }, [isConnected, refreshBalances, refreshPrices]);

  // Calculate total portfolio value
  const totalPortfolioValue = Object.values(balances).reduce(
    (total, { value }) => total + value,
    0
  );

  // Helper functions
  const getTokenBalance = useCallback((mint: string): bigint => {
    return balances[mint]?.balance || BigInt(0);
  }, [balances]);

  const getTokenValue = useCallback((mint: string): number => {
    return balances[mint]?.value || 0;
  }, [balances]);

  const isBalanceStale = useCallback((mint: string, maxAgeMs = 60000): boolean => {
    const tokenData = balances[mint];
    if (!tokenData) return true;
    
    return Date.now() - tokenData.lastUpdated > maxAgeMs;
  }, [balances]);

  return {
    balances,
    totalPortfolioValue,
    loading,
    error,
    refreshBalances,
    refreshPrices,
    getTokenBalance,
    getTokenValue,
    isBalanceStale
  };
}