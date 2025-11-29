/**
 * useShardedDex Hook - Direct Connection Version
 * 
 * Uses direct wallet connection instead of wagmi's broken state
 */

import { useState, useMemo, useCallback } from 'react';
import { useDirectWalletConnection } from './useDirectWalletConnection';
import { ShardedDexService, SwapQuote, TokenConfig, PoolData } from '../lib/shardedDex';

export function useShardedDexDirect() {
  const {
    walletClient,
    address,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    switchChain,
    publicClient,
    chainId,
  } = useDirectWalletConnection();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wallet is ready when we have both connection and wallet client
  const isWalletReady = useMemo(() => {
    return isConnected && !!address && !!walletClient;
  }, [isConnected, address, walletClient]);

  // Create ShardedDexService instance
  const dexService = useMemo(() => {
    if (!publicClient) return null;
    return new ShardedDexService(publicClient, chainId, walletClient || undefined);
  }, [publicClient, chainId, walletClient]);

  // Get available tokens
  const tokens: TokenConfig[] = useMemo(() => {
    if (!dexService) return [];
    try {
      return dexService.getTokens();
    } catch (err) {
      console.error('Failed to get tokens:', err);
      return [];
    }
  }, [dexService]);

  /**
   * Get swap quote
   */
  const getQuote = useCallback(async (
    inputToken: string,
    outputToken: string,
    inputAmount: number
  ): Promise<SwapQuote | null> => {
    if (!dexService) {
      setError('DEX service not initialized');
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      const quote = await dexService.getQuote(inputToken, outputToken, inputAmount);
      return quote;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get quote';
      setError(errorMsg);
      console.error('Get quote error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [dexService]);

  /**
   * Execute swap
   */
  const executeSwap = useCallback(async (
    quote: SwapQuote,
    slippageTolerance: number = 0.5
  ): Promise<string | null> => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔄 DIRECT SWAP EXECUTION');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  - Connected:', isConnected);
    console.log('  - Address:', address);
    console.log('  - Wallet Client:', !!walletClient);
    console.log('  - Wallet Ready:', isWalletReady);
    console.log('  - Current Chain ID:', chainId);
    console.log('  - Required Chain ID:', 10143);
    console.log('═══════════════════════════════════════════════════════');
    
    if (!dexService) {
      const msg = 'DEX service not initialized';
      console.error('❌', msg);
      setError(msg);
      return null;
    }

    if (!isConnected || !address) {
      const msg = 'Please connect your wallet';
      console.error('❌', msg);
      setError(msg);
      return null;
    }

    if (!walletClient) {
      const msg = 'Wallet client not ready';
      console.error('❌', msg);
      setError(msg);
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Check if we need to switch chains
      const MONAD_CHAIN_ID = 10143;
      if (chainId !== MONAD_CHAIN_ID) {
        console.log(`⚠️  Chain mismatch detected. Current: ${chainId}, Required: ${MONAD_CHAIN_ID}`);
        console.log('🔄 Switching to Monad Testnet...');
        
        try {
          await switchChain(MONAD_CHAIN_ID);
          console.log('✅ Successfully switched to Monad Testnet');
          
          // Wait a moment for the chain switch to propagate
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (switchError) {
          const switchMsg = switchError instanceof Error ? switchError.message : 'Failed to switch chain';
          console.error('❌ Chain switch failed:', switchMsg);
          setError(`Please switch to Monad Testnet in your wallet. ${switchMsg}`);
          throw new Error(`Chain switch required: ${switchMsg}`);
        }
      } else {
        console.log('✅ Already on correct chain (Monad Testnet)');
      }
      
      console.log('✅ Executing swap...');
      const signature = await dexService.executeSwap(quote, slippageTolerance);
      console.log('✅ Swap successful:', signature);
      console.log('═══════════════════════════════════════════════════════');
      
      return signature;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to execute swap';
      console.error('❌ Swap failed:', errorMsg);
      console.log('═══════════════════════════════════════════════════════');
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dexService, isConnected, address, walletClient, isWalletReady, chainId, switchChain]);

  /**
   * Get pools for a token pair with real-time data
   */
  const getPoolsForPairRealTime = useCallback(async (
    tokenA: string,
    tokenB: string
  ): Promise<PoolData[]> => {
    if (!dexService) return [];

    try {
      return await dexService.getPoolsForPairRealTime(tokenA, tokenB);
    } catch (err) {
      console.error('Failed to get real-time pools:', err);
      return dexService.getPoolsForPair(tokenA, tokenB);
    }
  }, [dexService]);

  /**
   * Get pools for a token pair from config
   */
  const getPoolsForPair = useCallback((tokenA: string, tokenB: string): any[] => {
    if (!dexService) return [];
    return dexService.getPoolsForPair(tokenA, tokenB);
  }, [dexService]);

  /**
   * Get all trading pairs
   */
  const getTradingPairs = useCallback((): { pair: string; shards: number }[] => {
    if (!dexService) return [];
    return dexService.getTradingPairs();
  }, [dexService]);

  /**
   * Add liquidity
   */
  const addLiquidity = useCallback(async (
    poolAddress: string,
    tokenASymbol: string,
    tokenBSymbol: string,
    amountA: number,
    amountB: number
  ): Promise<string | null> => {
    if (!dexService || !walletClient) {
      setError('Wallet not connected');
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      const hash = await dexService.addLiquidity(
        poolAddress,
        tokenASymbol,
        tokenBSymbol,
        amountA,
        amountB
      );
      return hash;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add liquidity';
      setError(errorMsg);
      console.error('Add liquidity error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dexService, walletClient]);

  /**
   * Remove liquidity
   */
  const removeLiquidity = useCallback(async (
    poolAddress: string,
    lpTokenAmount: number
  ): Promise<string | null> => {
    if (!dexService || !walletClient) {
      setError('Wallet not connected');
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      const hash = await dexService.removeLiquidity(poolAddress, lpTokenAmount);
      return hash;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to remove liquidity';
      setError(errorMsg);
      console.error('Remove liquidity error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dexService, walletClient]);

  return {
    tokens,
    loading,
    error,
    isWalletReady,
    isConnected,
    isConnecting,
    walletAddress: address,
    connect,
    disconnect,
    switchChain,
    getQuote,
    executeSwap,
    getPoolsForPairRealTime,
    getPoolsForPair,
    getTradingPairs,
    addLiquidity,
    removeLiquidity,
  };
}
