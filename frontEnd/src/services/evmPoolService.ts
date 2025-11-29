/**
 * EVM Pool Service
 * 
 * Handles fetching and caching pool state from EVM smart contracts
 */

import { PublicClient, Address, formatUnits } from 'viem';
import PoolABI from '../abis/Pool.json';
import { getDexConfig } from '../config/dex-config-loader';

const CACHE_TTL = 300000; // 5 minutes (increased to reduce RPC calls)
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const REQUEST_DELAY = 100; // 100ms delay between requests

interface PoolReserves {
  reserve0: bigint;
  reserve1: bigint;
  blockTimestampLast: number;
}

interface CachedPoolData {
  reserves: PoolReserves;
  timestamp: number;
  dataSource: 'blockchain' | 'cache';
}

interface PoolData {
  poolAddress: string;
  tokenA: string;
  tokenB: string;
  tokenASymbol: string;
  tokenBSymbol: string;
  liquidityA: string;
  liquidityB: string;
  shardNumber: number;
  dataSource: 'blockchain' | 'cache';
  chainId: number;
}

class EVMPoolService {
  private cache: Map<string, CachedPoolData> = new Map();
  private lastRequestTime: number = 0;

  /**
   * Get pool configuration for a specific chain
   */
  private getPoolConfig(chainId: number) {
    return getDexConfig(chainId);
  }

  /**
   * Sleep helper for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Rate limit requests to avoid 429 errors
   */
  private async rateLimitRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < REQUEST_DELAY) {
      await this.sleep(REQUEST_DELAY - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch pool reserves from blockchain with retry logic
   */
  async fetchPoolReserves(
    client: PublicClient,
    poolAddress: Address,
    silent: boolean = false,
    retryCount: number = 0
  ): Promise<PoolReserves | null> {
    try {
      // Rate limit requests to avoid 429 errors
      await this.rateLimitRequest();

      // First check if contract exists by getting code
      const code = await client.getBytecode({ address: poolAddress });
      if (!code || code === '0x') {
        // This is expected when checking pools from different chains - only log if not silent
        if (!silent) {
          console.debug(`Pool ${poolAddress} does not exist on this chain`);
        }
        return null;
      }

      const data = await client.readContract({
        address: poolAddress,
        abi: PoolABI,
        functionName: 'getReserves',
      }) as [bigint, bigint, number];

      // Check if reserves are valid (not empty)
      if (!data || data.length < 3) {
        if (!silent) {
          console.warn(`⚠️  Pool ${poolAddress} returned invalid data`);
        }
        return null;
      }

      // Check if pool has been initialized (has liquidity)
      if (data[0] === 0n && data[1] === 0n) {
        if (!silent) {
          console.warn(`⚠️  Pool ${poolAddress} has no liquidity (not initialized yet)`);
        }
        return null;
      }

      return {
        reserve0: data[0],
        reserve1: data[1],
        blockTimestampLast: data[2],
      };
    } catch (error: any) {
      // Check for 429 (Too Many Requests) and retry with exponential backoff
      if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
        if (retryCount < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
          if (!silent) {
            console.warn(`⚠️  Rate limited, retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          }
          await this.sleep(delay);
          return this.fetchPoolReserves(client, poolAddress, silent, retryCount + 1);
        } else {
          if (!silent) {
            console.error(`❌ Max retries reached for pool ${poolAddress} - rate limit persists`);
          }
          return null;
        }
      }

      // Check if it's a "position out of bounds" error (contract doesn't exist or wrong chain)
      if (error.message?.includes('Position') && error.message?.includes('out of bounds')) {
        // This is expected when checking pools from other chains
        if (!silent) {
          console.debug(`Pool ${poolAddress} not on this chain`);
        }
        return null;
      }

      // Check for other common errors
      if (error.message?.includes('execution reverted')) {
        if (!silent) {
          console.debug(`Pool ${poolAddress} call reverted`);
        }
        return null;
      }

      // Only log unexpected errors
      if (!silent) {
        console.error(`❌ Failed to fetch reserves for pool ${poolAddress}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Get pool reserves with caching
   */
  async getPoolReserves(
    client: PublicClient,
    poolAddress: Address,
    useCache: boolean = true,
    silent: boolean = false
  ): Promise<{ reserves: PoolReserves | null; dataSource: 'blockchain' | 'cache' }> {
    const cacheKey = `${poolAddress}`;
    const now = Date.now();

    // Check cache
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_TTL) {
        return {
          reserves: cached.reserves,
          dataSource: 'cache',
        };
      }
    }

    // Fetch fresh data (silent mode to suppress expected warnings)
    const reserves = await this.fetchPoolReserves(client, poolAddress, silent);

    // Only cache if we got valid reserves
    if (reserves) {
      this.cache.set(cacheKey, {
        reserves,
        timestamp: now,
        dataSource: 'blockchain',
      });
    }

    return {
      reserves,
      dataSource: 'blockchain',
    };
  }

  /**
   * Fetch all shards for a token pair with real-time reserves
   * NOTE: This method is deprecated for data fetching. Use SammBackendService.getAllShards() instead.
   * This method should only be used for transaction-related operations.
   */
  async fetchAllShards(
    client: PublicClient,
    chainId: number,
    tokenASymbol: string,
    tokenBSymbol: string
  ): Promise<PoolData[]> {
    const config = this.getPoolConfig(chainId);

    // Return empty array if chain is not supported (e.g., Sepolia)
    if (!config) {
      console.debug(`No DEX configuration for chain ${chainId}, returning empty pools`);
      return [];
    }

    // Find all pools for this pair
    const pools = config.pools.filter(
      (pool: any) =>
        (pool.tokenASymbol === tokenASymbol && pool.tokenBSymbol === tokenBSymbol) ||
        (pool.tokenASymbol === tokenBSymbol && pool.tokenBSymbol === tokenASymbol)
    );

    // Fetch reserves for all pools (silent mode to reduce console noise)
    const poolDataPromises = pools.map(async (pool: any) => {
      try {
        const { reserves, dataSource } = await this.getPoolReserves(
          client,
          pool.address as Address,
          true, // useCache
          true  // silent mode
        );

        // If reserves are null (pool doesn't exist or not initialized), use config data
        if (!reserves) {
          return {
            poolAddress: pool.address,
            tokenA: pool.tokenA,
            tokenB: pool.tokenB,
            tokenASymbol: pool.tokenASymbol,
            tokenBSymbol: pool.tokenBSymbol,
            liquidityA: pool.initialLiquidity || '0',
            liquidityB: pool.initialLiquidity || '0',
            shardNumber: pool.shardNumber,
            dataSource: 'cache' as const,
            chainId,
          };
        }

        // Determine which reserve is which token
        const isTokenAFirst = pool.tokenASymbol === tokenASymbol;
        const liquidityA = isTokenAFirst ? reserves.reserve0 : reserves.reserve1;
        const liquidityB = isTokenAFirst ? reserves.reserve1 : reserves.reserve0;

        return {
          poolAddress: pool.address,
          tokenA: pool.tokenA,
          tokenB: pool.tokenB,
          tokenASymbol: pool.tokenASymbol,
          tokenBSymbol: pool.tokenBSymbol,
          liquidityA: formatUnits(liquidityA, 18),
          liquidityB: formatUnits(liquidityB, 18),
          shardNumber: pool.shardNumber,
          dataSource,
          chainId,
        };
      } catch (error) {
        console.error(`Failed to fetch pool ${pool.address}:`, error);
        // Return pool with cached/config data
        return {
          poolAddress: pool.address,
          tokenA: pool.tokenA,
          tokenB: pool.tokenB,
          tokenASymbol: pool.tokenASymbol,
          tokenBSymbol: pool.tokenBSymbol,
          liquidityA: pool.initialLiquidity || '0',
          liquidityB: pool.initialLiquidity || '0',
          shardNumber: pool.shardNumber,
          dataSource: 'cache' as const,
          chainId,
        };
      }
    });

    return Promise.all(poolDataPromises);
  }

  /**
   * Get pools for a specific pair from config
   */
  getPoolsForPair(
    chainId: number,
    tokenASymbol: string,
    tokenBSymbol: string
  ): any[] {
    const config = this.getPoolConfig(chainId);

    // Return empty array if chain is not supported
    if (!config) {
      return [];
    }

    return config.pools.filter(
      (pool: any) =>
        (pool.tokenASymbol === tokenASymbol && pool.tokenBSymbol === tokenBSymbol) ||
        (pool.tokenASymbol === tokenBSymbol && pool.tokenBSymbol === tokenASymbol)
    );
  }

  /**
   * Clear cache for a specific pool or all pools
   */
  clearCache(poolAddress?: string) {
    if (poolAddress) {
      this.cache.delete(poolAddress);
    } else {
      this.cache.clear();
    }
  }
}

export const evmPoolService = new EVMPoolService();
