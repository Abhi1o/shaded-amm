'use client';

import { useEffect, useCallback, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useSolanaConnection } from './useSolanaConnection';
import { useWallet } from './useWallet';
import { Token } from '@/types';

interface UseTokenBalanceUpdatesProps {
  tokens: Token[];
  onBalanceUpdate?: (mint: string, balance: bigint) => void;
  enabled?: boolean;
}

export function useTokenBalanceUpdates({
  tokens,
  onBalanceUpdate,
  enabled = true
}: UseTokenBalanceUpdatesProps) {
  const { connection } = useSolanaConnection();
  const { publicKey, isConnected } = useWallet();
  const subscriptionsRef = useRef<Map<string, number>>(new Map());

  // Handle balance change notifications
  const handleBalanceChange = useCallback((mint: string, balance: bigint) => {
    if (onBalanceUpdate) {
      onBalanceUpdate(mint, balance);
    }
  }, [onBalanceUpdate]);

  // Subscribe to account changes for a specific token
  const subscribeToToken = useCallback(async (token: Token) => {
    if (!publicKey || !connection || !enabled) return;

    try {
      let accountToWatch: PublicKey;
      
      if (token.isNative) {
        // For SOL, watch the wallet's main account
        accountToWatch = publicKey;
      } else {
        // For SPL tokens, watch the associated token account
        accountToWatch = await getAssociatedTokenAddress(
          new PublicKey(token.mint),
          publicKey
        );
      }

      // Subscribe to account changes
      const subscriptionId = connection.onAccountChange(
        accountToWatch,
        (accountInfo) => {
          if (token.isNative) {
            // For SOL, the balance is in lamports
            handleBalanceChange(token.mint, BigInt(accountInfo.lamports));
          } else {
            // For SPL tokens, parse the token account data
            try {
              if (accountInfo.data.length >= 64) {
                // Parse token account data (simplified)
                const dataView = new DataView(accountInfo.data.buffer);
                const amount = dataView.getBigUint64(64, true); // Amount is at offset 64
                handleBalanceChange(token.mint, amount);
              }
            } catch (error) {
              console.error('Failed to parse token account data:', error);
            }
          }
        },
        'confirmed'
      );

      subscriptionsRef.current.set(token.mint, subscriptionId);
    } catch (error) {
      console.error(`Failed to subscribe to token ${token.symbol}:`, error);
    }
  }, [publicKey, connection, enabled, handleBalanceChange]);

  // Unsubscribe from a token
  const unsubscribeFromToken = useCallback((mint: string) => {
    const subscriptionId = subscriptionsRef.current.get(mint);
    if (subscriptionId !== undefined) {
      try {
        connection.removeAccountChangeListener(subscriptionId);
        subscriptionsRef.current.delete(mint);
      } catch (error) {
        console.error(`Failed to unsubscribe from token ${mint}:`, error);
      }
    }
  }, [connection]);

  // Subscribe to all tokens when wallet connects or tokens change
  useEffect(() => {
    if (!isConnected || !enabled || tokens.length === 0) {
      return;
    }

    // Subscribe to all tokens
    tokens.forEach(token => {
      subscribeToToken(token);
    });

    // Cleanup function
    return () => {
      subscriptionsRef.current.forEach((subscriptionId, mint) => {
        try {
          connection.removeAccountChangeListener(subscriptionId);
        } catch (error) {
          console.error(`Failed to cleanup subscription for ${mint}:`, error);
        }
      });
      subscriptionsRef.current.clear();
    };
  }, [isConnected, tokens, enabled, subscribeToToken, connection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach((subscriptionId) => {
        try {
          connection.removeAccountChangeListener(subscriptionId);
        } catch (error) {
          console.error('Failed to cleanup subscription:', error);
        }
      });
      subscriptionsRef.current.clear();
    };
  }, [connection]);

  return {
    subscribeToToken,
    unsubscribeFromToken,
    activeSubscriptions: Array.from(subscriptionsRef.current.keys())
  };
}