'use client';

import React, { useState, useMemo } from 'react';
import { MotionFadeIn, MotionReveal, MotionStagger } from '@/components/animations';
import { AnimatedStat } from '@/components/ui/AnimatedStat';
import { motion } from 'framer-motion';
import { 
  CurrencyDollarIcon, 
  ChartBarIcon, 
  BeakerIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { TokenPairIcon } from '@/components/tokens/TokenIcon';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { usePoolStore } from '@/stores/poolStore';
import { usePoolRefresh } from '@/hooks/usePoolRefresh';
import { useChainId } from 'wagmi';
import { getDexConfig } from '@/config/dex-config-loader';
import { getAutoRefreshInterval } from '@/config/pool-refresh-config';

interface PoolData {
  poolAddress: string;
  tokenA: string;
  tokenB: string;
  tokenASymbol: string;
  tokenBSymbol: string;
  liquidityA: string;
  liquidityB: string;
  shardNumber: number;
  poolTokenMint: string;
  dataSource?: 'config' | 'blockchain' | 'hybrid';
  isFresh?: boolean;
  lastBlockchainFetch?: number;
  tokenADecimals?: number;
  tokenBDecimals?: number;
}

function formatTokenAmount(amount: string, symbol: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0';

  if (symbol === 'USDC' || symbol === 'USDT') {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (symbol === 'SOL') {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  } else if (symbol === 'ETH') {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }

  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function formatRelativeTime(timestamp: number): string {
  if (timestamp === 0) return '';
  
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function PoolsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPair, setSelectedPair] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Get current chain
  const chainId = useChainId();
  const dexConfig = getDexConfig(chainId);
  
  // Use centralized pool store and refresh hook
  const { pools } = usePoolStore();
  const { 
    isInitialLoad,
    isBackgroundRefresh,
    lastRefreshTime,
    manualRefresh,
    clearAndRefresh,
    consecutiveFailures 
  } = usePoolRefresh({
    enabled: true,
    refreshInterval: getAutoRefreshInterval(), // Configurable, default 30 seconds
  });

  const poolsData = useMemo(() => {
    return pools.map(pool => ({
      poolAddress: pool.address,
      tokenA: pool.tokenA,
      tokenB: pool.tokenB,
      tokenASymbol: pool.tokenASymbol,
      tokenBSymbol: pool.tokenBSymbol,
      liquidityA: pool.liquidityA,
      liquidityB: pool.liquidityB,
      shardNumber: pool.shardNumber,
      poolTokenMint: pool.address, // Use address as identifier
      dataSource: pool.isFresh ? 'blockchain' as const : 'config' as const,
      isFresh: pool.isFresh,
      lastBlockchainFetch: pool.lastBlockchainFetch,
      tokenADecimals: 18,
      tokenBDecimals: 18
    }));
  }, [pools]);

  const stats = useMemo(() => {
    const totalLiquidityUSD = poolsData.reduce((sum, pool) => {
      const tokenAValue = pool.tokenASymbol === 'USDC' || pool.tokenASymbol === 'USDT' 
        ? parseFloat(pool.liquidityA)
        : pool.tokenASymbol === 'SOL'
        ? parseFloat(pool.liquidityA) * 100
        : parseFloat(pool.liquidityA) * 2000;
      return sum + tokenAValue;
    }, 0);

    return {
      totalLiquidity: totalLiquidityUSD,
      totalPools: poolsData.length,
      totalVolume: totalLiquidityUSD * 0.02,
    };
  }, [poolsData]);

  const filteredPools = useMemo(() => {
    let filtered = poolsData;

    if (searchQuery) {
      filtered = filtered.filter(pool => 
        pool.tokenASymbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pool.tokenBSymbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pool.poolAddress.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedPair !== 'all') {
      filtered = filtered.filter(pool => 
        `${pool.tokenASymbol}/${pool.tokenBSymbol}` === selectedPair
      );
    }

    return filtered;
  }, [poolsData, searchQuery, selectedPair]);

  const poolsByPair = useMemo(() => {
    const grouped: { [key: string]: PoolData[] } = {};
    filteredPools.forEach(pool => {
      const pairKey = `${pool.tokenASymbol}/${pool.tokenBSymbol}`;
      if (!grouped[pairKey]) {
        grouped[pairKey] = [];
      }
      grouped[pairKey].push(pool);
    });
    return grouped;
  }, [filteredPools]);

  return (
    <div className="relative bg-black text-white min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(110,84,255,0.03),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(110,84,255,0.05),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(110,84,255,0.03),transparent_70%)]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <MotionFadeIn delay={0.1}>
          <div className="text-center mb-12">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
              className="text-4xl sm:text-5xl font-bold mb-4 text-gradient-hero"
            >
              Liquidity Pools
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.4, 0.25, 1] }}
              className="text-base sm:text-lg text-gray-400 font-light"
            >
              Provide liquidity and earn rewards from trading fees
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
              className="flex flex-col items-center gap-3 mt-6"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={manualRefresh}
                  disabled={isBackgroundRefresh}
                  className="flex items-center gap-2 px-4 py-2 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowPathIcon className={`w-4 h-4 ${isBackgroundRefresh ? 'animate-spin' : ''}`} />
                  <span className="text-sm">Refresh Pools</span>
                </button>

                <button
                  onClick={clearAndRefresh}
                  disabled={isBackgroundRefresh}
                  className="flex items-center gap-2 px-4 py-2 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl hover:bg-red-500/20 hover:border-red-500/30 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Clear cache and refresh"
                >
                  <span className="text-sm">Clear Cache</span>
                </button>
              </div>

              {lastRefreshTime > 0 && (
                <div className="text-xs text-gray-400">
                  Last updated: {formatRelativeTime(lastRefreshTime)}
                  <span className="text-gray-500 ml-2">• Auto-refreshes every 30s</span>
                </div>
              )}
            </motion.div>
          </div>
        </MotionFadeIn>

        {isInitialLoad && pools.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 mb-12">
            <LoadingSpinner size="lg" />
            <p className="text-gray-400 mt-4">Loading pool data...</p>
          </div>
        )}

        {consecutiveFailures >= 3 && pools.length === 0 && (
          <div className="mb-8 backdrop-blur-xl bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-300 mb-1">Connection Issue</h3>
                <p className="text-sm text-gray-300 mb-3">Unable to fetch pool data. Displaying cached information.</p>
                <button
                  onClick={manualRefresh}
                  disabled={isBackgroundRefresh}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-red-200 text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBackgroundRefresh ? (
                    <span className="flex items-center gap-2">
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Retrying...
                    </span>
                  ) : (
                    'Retry'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {pools.length > 0 && pools.some(p => !p.isFresh) && (
          <div className="mb-8 backdrop-blur-xl bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-yellow-300 mb-1">Showing Cached Data</h3>
                <p className="text-sm text-gray-300">
                  Pools may not be deployed on this chain yet. Showing estimated liquidity from config.
                </p>
              </div>
            </div>
          </div>
        )}

        {pools.length > 0 && (
          <>
            <MotionStagger staggerDelay={0.1}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <AnimatedStat
                  value={`${(stats.totalLiquidity / 1000000).toFixed(2)}M`}
                  label="Total Value Locked"
                  gradient="from-purple-400 to-purple-300"
                  icon={<CurrencyDollarIcon className="w-full h-full text-white" />}
                  delay={0.2}
                />
                <AnimatedStat
                  value={stats.totalPools.toString()}
                  label="Active Pools"
                  gradient="from-purple-500 to-purple-400"
                  icon={<BeakerIcon className="w-full h-full text-white" />}
                  delay={0.3}
                />
                <AnimatedStat
                  value={`${(stats.totalVolume / 1000).toFixed(1)}K`}
                  label="24h Volume"
                  gradient="from-purple-600 to-purple-400"
                  icon={<ChartBarIcon className="w-full h-full text-white" />}
                  delay={0.4}
                />
              </div>
            </MotionStagger>

            <MotionReveal delay={0.5} direction="up">
              <div className="mb-8 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search pools by token or address..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]/50 transition-all"
                    />
                  </div>

                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center justify-center px-6 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 text-white transition-all"
                  >
                    <FunnelIcon className="w-5 h-5 mr-2" />
                    Filters
                  </button>
                </div>

                {showFilters && dexConfig && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4"
                  >
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Filter by Trading Pair
                    </label>
                    <select
                      value={selectedPair}
                      onChange={(e) => setSelectedPair(e.target.value)}
                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)]/50 transition-all"
                    >
                      <option value="all" className="bg-gray-900">All Pairs</option>
                      {dexConfig.multiShardStats && Object.entries(
                        poolsData.reduce((acc, pool) => {
                          const pairKey = `${pool.tokenASymbol}/${pool.tokenBSymbol}`;
                          acc[pairKey] = (acc[pairKey] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([pair, count]) => (
                        <option key={pair} value={pair} className="bg-gray-900">
                          {pair} ({count} shard{count > 1 ? 's' : ''})
                        </option>
                      ))}
                    </select>
                  </motion.div>
                )}
              </div>
            </MotionReveal>

            <MotionReveal delay={0.6} direction="up">
              <div className="space-y-8 relative">
                {Object.entries(poolsByPair).map(([pairKey, pairPools], pairIndex) => {
                  const totalLiquidityA = pairPools.reduce((sum, p) => sum + parseFloat(p.liquidityA), 0);
                  const totalLiquidityB = pairPools.reduce((sum, p) => sum + parseFloat(p.liquidityB), 0);

                  return (
                    <motion.div
                      key={pairKey}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: pairIndex * 0.1 }}
                      className="backdrop-blur-xl bg-white/5 rounded-3xl p-6 sm:p-8 border border-white/10"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <TokenPairIcon 
                              tokenA={pairPools[0].tokenASymbol} 
                              tokenB={pairPools[0].tokenBSymbol} 
                              size="lg"
                            />
                            <div>
                              <h3 className="text-2xl font-bold text-white">{pairKey}</h3>
                              <p className="text-sm text-gray-400">{pairPools.length} shard{pairPools.length > 1 ? 's' : ''} available</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400">Total Liquidity</div>
                          <div className="text-lg font-bold text-white">
                            {formatTokenAmount(totalLiquidityA.toString(), pairPools[0].tokenASymbol)} {pairPools[0].tokenASymbol}
                          </div>
                          <div className="text-sm text-gray-400">
                            {formatTokenAmount(totalLiquidityB.toString(), pairPools[0].tokenBSymbol)} {pairPools[0].tokenBSymbol}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {pairPools.map((pool) => (
                          <div
                            key={pool.poolAddress}
                            className="backdrop-blur-xl rounded-2xl p-4 border transition-all cursor-pointer group relative bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 backdrop-blur-xl text-xs font-bold rounded-full bg-[var(--color-primary-glow)] border border-[var(--color-border)] text-purple-300">
                                  Shard #{pool.shardNumber}
                                </span>
                                {!pool.isFresh && (
                                  <span className="px-2 py-1 backdrop-blur-xl text-xs font-medium rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-300" title="Data from cache">
                                    Cached
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-400 group-hover:text-white transition-colors">
                                View →
                              </span>
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-400">{pool.tokenASymbol}:</span>
                                <span className="font-medium text-white">
                                  {formatTokenAmount(pool.liquidityA, pool.tokenASymbol)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">{pool.tokenBSymbol}:</span>
                                <span className="font-medium text-white">
                                  {formatTokenAmount(pool.liquidityB, pool.tokenBSymbol)}
                                </span>
                              </div>
                              <div className="pt-2 border-t border-white/10">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">APR:</span>
                                  <span className="text-green-400 font-medium">~12.5%</span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-white/10">
                              <div className="text-xs text-gray-500 font-mono truncate" title={pool.poolAddress}>
                                {pool.poolAddress.slice(0, 8)}...{pool.poolAddress.slice(-8)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}

                {filteredPools.length === 0 && (
                  <div className="backdrop-blur-xl bg-white/5 rounded-3xl p-12 border border-white/10 text-center">
                    <BeakerIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-xl font-bold text-white mb-2">No pools found</h3>
                    <p className="text-gray-400">
                      {searchQuery || selectedPair !== 'all'
                        ? 'Try adjusting your search or filters'
                        : 'No liquidity pools available yet'}
                    </p>
                  </div>
                )}
              </div>
            </MotionReveal>
          </>
        )}
      </div>
    </div>
  );
}
