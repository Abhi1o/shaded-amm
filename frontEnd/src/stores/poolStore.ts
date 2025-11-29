/**
 * Pool Store - EVM Version
 * 
 * Manages pool state for EVM chains
 */

import { create } from 'zustand';
import { getDexConfig } from '@/config/dex-config-loader';
import { createPublicClient, http, Address } from 'viem';
import { evmPoolService } from '@/services/evmPoolService';
import { MONAD_TESTNET } from '@/config/evm-networks';
import { getMinFetchInterval } from '@/config/pool-refresh-config';

export interface Pool {
  address: string;
  tokenA: string;
  tokenB: string;
  tokenASymbol: string;
  tokenBSymbol: string;
  liquidityA: string;
  liquidityB: string;
  shardNumber: number;
  chainId: number;
  isFresh?: boolean;
  lastBlockchainFetch?: number;
}

interface PoolStore {
  pools: Pool[];
  loading: boolean;
  error: string | null;
  lastFetchTime: number;
  isStale: boolean;
  consecutiveFailures: number;
  isInitialLoad: boolean;
  isBackgroundRefresh: boolean;
  
  setPools: (pools: Pool[]) => void;
  addPool: (pool: Pool) => void;
  updatePool: (poolId: string, updates: Partial<Pool>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLastFetchTime: (time: number) => void;
  fetchPools: (chainId: number, isInitial: boolean) => Promise<void>;
  refreshPools: (chainId: number) => Promise<void>;
  clearCache: () => void;
  resetFailures: () => void;
}

const STALE_THRESHOLD = 60 * 1000; // 60 seconds

export const usePoolStore = create<PoolStore>((set, get) => ({
  pools: [],
  loading: false,
  error: null,
  lastFetchTime: 0,
  isStale: false,
  consecutiveFailures: 0,
  isInitialLoad: false,
  isBackgroundRefresh: false,
  
  setPools: (pools) => {
    const now = Date.now();
    
    // Completely replace old pools with new ones (no accumulation)
    const freshPools = pools.map(pool => ({
      ...pool,
      isFresh: true,
      lastBlockchainFetch: now
    }));
    
    console.log(`📝 Replacing ${get().pools.length} old pools with ${freshPools.length} new pools`);
    
    set({ 
      pools: freshPools, // Complete replacement, not accumulation
      lastFetchTime: now,
      isStale: false,
      error: null
    });
  },
  
  addPool: (pool) => {
    set((state) => ({
      pools: [...state.pools, { ...pool, isFresh: true, lastBlockchainFetch: Date.now() }]
    }));
  },
  
  updatePool: (poolId, updates) => {
    set((state) => ({
      pools: state.pools.map(pool =>
        pool.address === poolId ? { ...pool, ...updates } : pool
      )
    }));
  },
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error }),
  
  setLastFetchTime: (time) => set({ lastFetchTime: time }),
  
  fetchPools: async (chainId: number, isInitial: boolean = false) => {
    const state = get();
    const minInterval = getMinFetchInterval();
    
    // Rate limiting: Don't fetch if we just fetched recently (unless it's initial load)
    if (!isInitial && state.lastFetchTime > 0) {
      const timeSinceLastFetch = Date.now() - state.lastFetchTime;
      if (timeSinceLastFetch < minInterval) {
        console.log(`⏱️  Skipping fetch - only ${Math.round(timeSinceLastFetch / 1000)}s since last fetch (min ${minInterval / 1000}s)`);
        return;
      }
    }
    
    set({ loading: true, isInitialLoad: isInitial, error: null });
    
    try {
      // Only fetch from backend for Monad (chainId 10143)
      // For other chains, fall back to config
      if (chainId === 10143) {
        try {
          // Import SammBackendService dynamically to avoid circular dependencies
          const { SammBackendService } = await import('@/services/sammBackendService');
          
          // Fetch pools from backend API
          const response = await SammBackendService.getAllShards();
          
          // Get config to map token addresses
          const config = getDexConfig(chainId);
          
          // Transform backend response to Pool format
          const pools: Pool[] = response.shards.map((shard, index) => {
            // Parse token addresses from pair name (e.g., "USDC/USDT")
            const [tokenASymbol, tokenBSymbol] = shard.pair.split('/');
            
            // Extract shard number from name (e.g., "USDC/USDT-1" -> 1)
            const shardNumber = parseInt(shard.name.split('-')[1] || '1');
            
            // Get token info from config
            const tokenAConfig = config?.tokens.find(t => t.symbol === tokenASymbol);
            const tokenBConfig = config?.tokens.find(t => t.symbol === tokenBSymbol);
            
            // Convert reserves from smallest unit to human-readable
            // USDC/USDT use 6 decimals, DAI uses 18 decimals
            const decimalsA = tokenAConfig?.decimals || 18; // Default to 18 for safety
            const decimalsB = tokenBConfig?.decimals || 18; // Fixed: was using tokenAConfig
            
            console.log(`🔢 Decimals for ${tokenASymbol}/${tokenBSymbol}: ${decimalsA}/${decimalsB}`);
            
            const liquidityA = (Number(shard.reserves.reserveA) / Math.pow(10, decimalsA)).toFixed(2);
            const liquidityB = (Number(shard.reserves.reserveB) / Math.pow(10, decimalsB)).toFixed(2);
            
            console.log(`💧 Converted liquidity: ${liquidityA} ${tokenASymbol} / ${liquidityB} ${tokenBSymbol}`);
            
            return {
              address: shard.address,
              tokenA: tokenAConfig?.address || '',
              tokenB: tokenBConfig?.address || '',
              tokenASymbol,
              tokenBSymbol,
              liquidityA,
              liquidityB,
              shardNumber,
              chainId,
              isFresh: true,
              lastBlockchainFetch: Date.now()
            };
          });
          
          console.log(`✅ Fetched ${pools.length} pools from SAMM Backend API`);
          
          // Explicitly clear old data and set new data
          const currentPoolCount = get().pools.length;
          if (currentPoolCount > 0) {
            console.log(`🗑️  Clearing ${currentPoolCount} old pools before setting ${pools.length} new pools`);
          }
          
          set({ 
            pools, // This completely replaces the old pools array
            loading: false,
            lastFetchTime: Date.now(),
            isStale: false,
            consecutiveFailures: 0,
            isInitialLoad: false
          });
          return;
        } catch (backendError) {
          console.warn('Failed to fetch from backend, falling back to config:', backendError);
          // Fall through to config-based loading
        }
      }
      
      // Fallback: Load pools from config
      const config = getDexConfig(chainId);
      
      if (!config) {
        console.warn(`No configuration found for chain ${chainId}`);
        set({ 
          pools: [],
          loading: false,
          lastFetchTime: Date.now(),
          isStale: false,
          consecutiveFailures: 0,
          isInitialLoad: false
        });
        return;
      }
      
      // Transform config pools to store format (cached data)
      const pools: Pool[] = config.pools.map(pool => ({
        address: pool.address,
        tokenA: pool.tokenA,
        tokenB: pool.tokenB,
        tokenASymbol: pool.tokenASymbol,
        tokenBSymbol: pool.tokenBSymbol,
        liquidityA: pool.initialLiquidity || '0',
        liquidityB: pool.initialLiquidity || '0',
        shardNumber: pool.shardNumber,
        chainId: pool.chainId,
        isFresh: false, // Mark as cached
        lastBlockchainFetch: 0
      }));
      
      console.log(`⚠️  Using cached pool data from config (${pools.length} pools)`);
      
      set({ 
        pools,
        loading: false,
        lastFetchTime: Date.now(),
        isStale: false,
        consecutiveFailures: 0,
        isInitialLoad: false
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch pools';
      console.error('Pool fetch error:', errorMessage);
      set((state) => ({
        loading: false,
        error: errorMessage,
        consecutiveFailures: state.consecutiveFailures + 1,
        isInitialLoad: false
      }));
    }
  },
  
  refreshPools: async (chainId: number) => {
    const state = get();
    const minInterval = getMinFetchInterval();
    
    // Don't refresh if already loading
    if (state.loading) {
      console.log('⏸️  Skipping refresh - already loading');
      return;
    }
    
    // Check if enough time has passed since last fetch
    const timeSinceLastFetch = Date.now() - state.lastFetchTime;
    if (timeSinceLastFetch < minInterval) {
      console.log(`⏸️  Skipping refresh - only ${Math.round(timeSinceLastFetch / 1000)}s since last fetch`);
      return;
    }
    
    set({ isBackgroundRefresh: true });
    await get().fetchPools(chainId, false);
    set({ isBackgroundRefresh: false });
  },
  
  clearCache: () => {
    set({
      pools: [],
      lastFetchTime: 0,
      isStale: true,
      error: null
    });
  },
  
  resetFailures: () => {
    set({ consecutiveFailures: 0 });
  }
}));
