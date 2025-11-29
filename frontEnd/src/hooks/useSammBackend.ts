/**
 * React Hook for SAMM Backend Integration
 * 
 * Provides optimal shard selection and multi-hop routing
 */

import { useState, useEffect, useCallback } from 'react';
import { SammBackendService, BestShardResponse, MultiHopResponse, SammUtils } from '@/services/sammBackendService';

export interface SwapQuoteBackend {
  poolAddress: string;
  poolName: string;
  amountIn: string;
  amountOut: string;
  fee: string;
  priceImpact: number;
  isMultiHop: boolean;
  path?: string[];
  steps?: any[];
}

export function useSammBackend() {
  const [isHealthy, setIsHealthy] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(true);
  const [shards, setShards] = useState<any[]>([]);
  const [isLoadingShards, setIsLoadingShards] = useState(false);

  // Check API health on mount
  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      const health = await SammBackendService.checkHealth();
      setIsHealthy(health.status === 'healthy');
    } catch (error) {
      console.error('Backend health check failed:', error);
      setIsHealthy(false);
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  const fetchShards = useCallback(async () => {
    setIsLoadingShards(true);
    try {
      const response = await SammBackendService.getAllShards();
      setShards(response.shards);
      return response.shards;
    } catch (error) {
      console.error('Failed to fetch shards:', error);
      return [];
    } finally {
      setIsLoadingShards(false);
    }
  }, []);

  /**
   * Get optimal swap quote
   * Automatically tries direct pair first, then multi-hop if needed
   *
   * @param amountIn - Input amount in smallest unit (what user wants to send)
   * @param tokenInAddress - Input token address
   * @param tokenOutAddress - Output token address
   * @param tokenInDecimals - Input token decimals
   * @param tokenOutDecimals - Output token decimals
   */
  const getSwapQuote = useCallback(async (
    amountIn: string,
    tokenInAddress: string,
    tokenOutAddress: string,
    tokenInDecimals: number,
    tokenOutDecimals: number
  ): Promise<SwapQuoteBackend | null> => {
    try {
      // Validate inputs
      if (!amountIn || !tokenInAddress || !tokenOutAddress) {
        console.error('Missing required parameters:', { amountIn, tokenInAddress, tokenOutAddress });
        return null;
      }

      // Estimate output amount for getBestShard (uses amountOut parameter)
      // For stablecoins (1:1), use 0.997 to account for 0.3% fee
      const estimatedAmountOut = (BigInt(amountIn) * 997n / 1000n).toString();

      console.log('📤 Calling backend with:', {
        estimatedAmountOut,
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress
      });

      // Try direct pair first using getBestShard
      try {
        const response = await SammBackendService.getBestShard(
          estimatedAmountOut,
          tokenInAddress,
          tokenOutAddress
        );

        // Check if response is valid
        if (!response || !response.bestShard) {
          console.log('⚠️  No direct pair found in backend response, trying multi-hop...');
          throw new Error('No direct pair found');
        }

        const priceImpact = SammUtils.calculatePriceImpact(
          response.bestShard.amountIn,
          response.bestShard.amountOut,
          response.bestShard.tradeFee
        );

        return {
          poolAddress: response.bestShard.address,
          poolName: response.bestShard.name,
          amountIn: response.bestShard.amountIn,
          amountOut: response.bestShard.amountOut,
          fee: response.bestShard.tradeFee,
          priceImpact,
          isMultiHop: false,
        };
      } catch (directError: any) {
        // If direct pair fails, try multi-hop routing
        if (directError.message?.includes('No direct pair') ||
            directError.message?.includes('not found')) {
          console.log('🔀 No direct pair found, trying multi-hop routing...');

          try {
            // Multi-hop uses amountIn (what user wants to send)
            const multiHopResponse = await SammBackendService.getMultiHopRoute(
              amountIn,
              tokenInAddress,
              tokenOutAddress
            );

            // Check if multi-hop response is valid
            if (!multiHopResponse || !multiHopResponse.path || multiHopResponse.path.length === 0) {
              console.log('❌ Multi-hop returned empty response');
              throw new Error(`No trading route found. This pair may not be available on Monad.`);
            }

            const priceImpact = SammUtils.calculatePriceImpact(
              multiHopResponse.amountIn,
              multiHopResponse.amountOut,
              multiHopResponse.totalFee
            );

            console.log(`✅ Multi-hop route found: ${multiHopResponse.path.join(' → ')}`);

            // Fetch deployment info to resolve pool names to addresses
            const deploymentInfo = await SammBackendService.getDeploymentInfo();
            
            // Create a map of pool names to addresses
            const poolNameToAddress: Record<string, string> = {};
            if (deploymentInfo && deploymentInfo.pools) {
              for (const [pairName, pools] of Object.entries(deploymentInfo.pools)) {
                for (const pool of pools) {
                  poolNameToAddress[pool.name] = pool.address;
                }
              }
            }
            
            console.log('📋 Pool name to address mapping:', poolNameToAddress);

            // Resolve pool names to addresses in steps
            const resolvedSteps = multiHopResponse.steps.map(step => {
              const poolAddress = poolNameToAddress[step.shard] || step.shard;
              console.log(`  - Resolving ${step.shard} → ${poolAddress}`);
              return {
                ...step,
                shard: poolAddress, // Replace name with address
              };
            });

            return {
              poolAddress: '', // Multi-hop uses multiple pools
              poolName: 'Multi-Hop Route',
              amountIn: multiHopResponse.amountIn,
              amountOut: multiHopResponse.amountOut,
              fee: multiHopResponse.totalFee,
              priceImpact,
              isMultiHop: true,
              path: multiHopResponse.path,
              steps: resolvedSteps,
            };
          } catch (multiHopError: any) {
            console.log('❌ Multi-hop routing failed:', multiHopError.message);
            throw new Error(
              `No trading route available for this token pair. ` +
              `Available pairs on Monad: USDC/USDT. ` +
              `Please try swapping through USDC or USDT first.`
            );
          }
        }

        throw directError;
      }
    } catch (error) {
      console.error('Failed to get swap quote:', error);
      return null;
    }
  }, []);

  /**
   * Get quote for multi-hop swap specifically
   */
  const getMultiHopQuote = useCallback(async (
    amountIn: string,
    tokenInAddress: string,
    tokenOutAddress: string
  ): Promise<MultiHopResponse | null> => {
    try {
      return await SammBackendService.getMultiHopRoute(
        amountIn,
        tokenInAddress,
        tokenOutAddress
      );
    } catch (error) {
      console.error('Failed to get multi-hop quote:', error);
      return null;
    }
  }, []);

  /**
   * Get specific shard details
   */
  const getShardDetails = useCallback(async (address: string) => {
    try {
      return await SammBackendService.getShard(address);
    } catch (error) {
      console.error('Failed to get shard details:', error);
      return null;
    }
  }, []);

  /**
   * Get deployment information
   */
  const getDeploymentInfo = useCallback(async () => {
    try {
      return await SammBackendService.getDeploymentInfo();
    } catch (error) {
      console.error('Failed to get deployment info:', error);
      return null;
    }
  }, []);

  return {
    // State
    isHealthy,
    isCheckingHealth,
    shards,
    isLoadingShards,

    // Methods
    checkHealth,
    fetchShards,
    getSwapQuote,
    getMultiHopQuote,
    getShardDetails,
    getDeploymentInfo,

    // Utils
    formatAmount: SammUtils.formatAmount,
    calculatePriceImpact: SammUtils.calculatePriceImpact,
    getPriceImpactColor: SammUtils.getPriceImpactColor,
    formatFeePercentage: SammUtils.formatFeePercentage,
    toSmallestUnit: SammUtils.toSmallestUnit,
  };
}
