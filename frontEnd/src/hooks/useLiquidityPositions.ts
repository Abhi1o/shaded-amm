/**
 * useLiquidityPositions Hook - EVM Version
 * 
 * Provides liquidity position data for all 6 SAMM pools on Monad Testnet
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useChainId, usePublicClient } from 'wagmi';
import { Address, formatUnits } from 'viem';
import { evmLiquidityService } from '@/services/evmLiquidityService';

// Monad Testnet tokens
const MONAD_TOKENS = {
  USDC: { address: '0x67DcA5710a9dA091e00093dF04765d711759f435' as Address, decimals: 6, symbol: 'USDC' },
  USDT: { address: '0x1888FF2446f2542cbb399eD179F4d6d966268C1F' as Address, decimals: 6, symbol: 'USDT' },
  DAI: { address: '0x60CB213FCd1616FbBD44319Eb11A35d5671E692e' as Address, decimals: 18, symbol: 'DAI' },
};

// All 6 pools on Monad Testnet
const MONAD_POOLS = [
  // USDC/USDT Shards
  { address: '0x686ff8090b18C0DF4f828f02deAf122CeC40B1DE' as Address, tokenA: MONAD_TOKENS.USDC, tokenB: MONAD_TOKENS.USDT, shardNumber: 1, pairName: 'USDC/USDT' },
  { address: '0x0481CD694F9C4EfC925C694f49835547404c0460' as Address, tokenA: MONAD_TOKENS.USDC, tokenB: MONAD_TOKENS.USDT, shardNumber: 2, pairName: 'USDC/USDT' },
  { address: '0x49ac6067BB0b6d5b793e9F3af3CD78b3a108AA5a' as Address, tokenA: MONAD_TOKENS.USDC, tokenB: MONAD_TOKENS.USDT, shardNumber: 3, pairName: 'USDC/USDT' },
  // USDT/DAI Shards
  { address: '0x20c893A2706a71695894b15A4C385a3710C213eb' as Address, tokenA: MONAD_TOKENS.USDT, tokenB: MONAD_TOKENS.DAI, shardNumber: 1, pairName: 'USDT/DAI' },
  { address: '0xe369Fe406ecB270b0F73C641260791C5A2edEB81' as Address, tokenA: MONAD_TOKENS.USDT, tokenB: MONAD_TOKENS.DAI, shardNumber: 2, pairName: 'USDT/DAI' },
  { address: '0x4d3c19832713A7993d69870cB421586CBC36dceA' as Address, tokenA: MONAD_TOKENS.USDT, tokenB: MONAD_TOKENS.DAI, shardNumber: 3, pairName: 'USDT/DAI' },
];

export interface LiquidityPosition {
  poolAddress: string;
  pairName: string;
  shardNumber: number;
  lpTokenBalance: bigint;
  lpTokenBalanceFormatted: string;
  shareOfPool: number;
  tokenAValue: bigint;
  tokenBValue: bigint;
  tokenAValueFormatted: string;
  tokenBValueFormatted: string;
  tokenASymbol: string;
  tokenBSymbol: string;
  tokenADecimals: number;
  tokenBDecimals: number;
}

export function useLiquidityPositions() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  
  const [positions, setPositions] = useState<LiquidityPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMonadTestnet = chainId === 10143;

  const fetchPositions = useCallback(async () => {
    if (!isConnected || !address || !publicClient || !isMonadTestnet) {
      setPositions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const positionPromises = MONAD_POOLS.map(async (pool) => {
        try {
          // Get LP token balance
          const lpBalance = await evmLiquidityService.getLPTokenBalance(
            publicClient,
            pool.address,
            address
          );

          // Skip if no balance
          if (lpBalance === 0n) {
            return null;
          }

          // Get pool state for calculations
          const poolState = await evmLiquidityService.getPoolState(publicClient, pool.address);

          // Calculate share of pool
          const shareOfPool = poolState.totalSupply > 0n
            ? (Number(lpBalance) / Number(poolState.totalSupply)) * 100
            : 0;

          // Calculate token values
          const tokenAValue = poolState.totalSupply > 0n
            ? (lpBalance * poolState.reserveA) / poolState.totalSupply
            : 0n;
          const tokenBValue = poolState.totalSupply > 0n
            ? (lpBalance * poolState.reserveB) / poolState.totalSupply
            : 0n;

          return {
            poolAddress: pool.address,
            pairName: pool.pairName,
            shardNumber: pool.shardNumber,
            lpTokenBalance: lpBalance,
            lpTokenBalanceFormatted: formatUnits(lpBalance, 18),
            shareOfPool,
            tokenAValue,
            tokenBValue,
            tokenAValueFormatted: formatUnits(tokenAValue, pool.tokenA.decimals),
            tokenBValueFormatted: formatUnits(tokenBValue, pool.tokenB.decimals),
            tokenASymbol: pool.tokenA.symbol,
            tokenBSymbol: pool.tokenB.symbol,
            tokenADecimals: pool.tokenA.decimals,
            tokenBDecimals: pool.tokenB.decimals,
          };
        } catch (poolError) {
          console.error(`Failed to fetch position for pool ${pool.address}:`, poolError);
          return null;
        }
      });

      const fetchedPositions = await Promise.all(positionPromises);
      // Filter out null positions (no balance or errors)
      const validPositions = fetchedPositions.filter((p): p is NonNullable<typeof p> => p !== null) as LiquidityPosition[];
      setPositions(validPositions);
    } catch (err) {
      console.error('Failed to fetch positions:', err);
      setError('Failed to load positions');
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, publicClient, isMonadTestnet]);

  // Fetch positions on mount and when dependencies change
  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!isConnected || !isMonadTestnet) return;

    const interval = setInterval(fetchPositions, 60000);
    return () => clearInterval(interval);
  }, [fetchPositions, isConnected, isMonadTestnet]);

  const refreshAfterOperation = useCallback(async () => {
    // Small delay to allow blockchain state to update
    await new Promise(resolve => setTimeout(resolve, 2000));
    await fetchPositions();
  }, [fetchPositions]);

  // Calculate total value across all positions
  const totalPositions = positions.length;
  const hasPositions = totalPositions > 0;

  return {
    positions,
    loading,
    error,
    refreshAfterOperation,
    totalPositions,
    hasPositions,
    isMonadTestnet,
  };
}
