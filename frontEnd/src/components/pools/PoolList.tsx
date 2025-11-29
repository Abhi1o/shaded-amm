'use client';

import React, { useState, useMemo } from 'react';
import { MagnifyingGlassIcon, FunnelIcon, ArrowsUpDownIcon, ChevronRightIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Pool } from '@/types';
import { usePools } from '@/hooks/usePools';
import { usePoolRefresh } from '@/hooks/usePoolRefresh';
import { TokenLogo } from '@/components/tokens/TokenLogo';
import { formatCurrency } from '@/utils/formatting';

interface PoolListProps {
  onPoolSelect?: (pool: Pool) => void;
  showCreateButton?: boolean;
  onCreatePool?: () => void;
}

type SortField = 'liquidity' | 'volume24h' | 'fees24h' | 'created';
type SortDirection = 'asc' | 'desc';

interface FilterOptions {
  minLiquidity: string;
  tokenSymbol: string;
  ammType: string;
}

export function PoolList({ onPoolSelect, showCreateButton = true, onCreatePool }: PoolListProps) {
  const { pools, loading, error } = usePools();
  
  // Integrate pool refresh hook for real-time blockchain data
  const { 
    isInitialLoad,
    isBackgroundRefresh,
    manualRefresh, 
    error: refreshError,
    lastRefreshTime,
    consecutiveFailures 
  } = usePoolRefresh({
    enabled: true,
    refreshInterval: 30000, // 30 seconds
    onError: (err) => console.error('Pool refresh error:', err)
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('liquidity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    minLiquidity: '',
    tokenSymbol: '',
    ammType: '',
  });

  // Filter and sort pools
  const filteredAndSortedPools = useMemo(() => {
    let filtered = pools.filter(pool => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        pool.tokenA.symbol.toLowerCase().includes(searchLower) ||
        pool.tokenB.symbol.toLowerCase().includes(searchLower) ||
        pool.tokenA.name.toLowerCase().includes(searchLower) ||
        pool.tokenB.name.toLowerCase().includes(searchLower) ||
        pool.id.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      // Minimum liquidity filter
      if (filters.minLiquidity) {
        const minLiq = parseFloat(filters.minLiquidity);
        if (!isNaN(minLiq)) {
          const poolLiquidity = Number(pool.totalLiquidity) / 1e9; // Convert to SOL equivalent
          if (poolLiquidity < minLiq) return false;
        }
      }

      // Token symbol filter
      if (filters.tokenSymbol) {
        const symbolLower = filters.tokenSymbol.toLowerCase();
        const hasToken = pool.tokenA.symbol.toLowerCase().includes(symbolLower) ||
                        pool.tokenB.symbol.toLowerCase().includes(symbolLower);
        if (!hasToken) return false;
      }

      // AMM type filter
      if (filters.ammType && filters.ammType !== 'all') {
        if (pool.ammType !== filters.ammType) return false;
      }

      return true;
    });

    // Sort pools
    filtered.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortField) {
        case 'liquidity':
          aValue = Number(a.totalLiquidity);
          bValue = Number(b.totalLiquidity);
          break;
        case 'volume24h':
          aValue = Number(a.volume24h);
          bValue = Number(b.volume24h);
          break;
        case 'fees24h':
          aValue = Number(a.fees24h);
          bValue = Number(b.fees24h);
          break;
        case 'created':
          aValue = a.createdAt;
          bValue = b.createdAt;
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

    return filtered;
  }, [pools, searchQuery, sortField, sortDirection, filters]);

  // Handle sort change
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Calculate pool statistics
  const poolStats = useMemo(() => {
    const totalPools = pools.length;
    const totalLiquidity = pools.reduce((sum, pool) => sum + Number(pool.totalLiquidity), 0);
    const totalVolume24h = pools.reduce((sum, pool) => sum + Number(pool.volume24h), 0);
    const activePools = pools.filter(pool => pool.isActive).length;

    return {
      totalPools,
      totalLiquidity,
      totalVolume24h,
      activePools,
    };
  }, [pools]);

  // Show loading skeleton only when initial load is in progress AND no pools are loaded yet
  // Requirements: 3.1, 3.2, 3.3
  if (isInitialLoad && pools.length === 0) {
    return (
      <div className="space-y-4">
        {/* Loading skeleton */}
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-4">
              <div className="animate-pulse">
                <div className="flex items-center space-x-4">
                  <div className="flex space-x-2">
                    <div className="w-8 h-8 bg-white/10 rounded-full"></div>
                    <div className="w-8 h-8 bg-white/10 rounded-full"></div>
                  </div>
                  <div className="flex-1">
                    <div className="h-4 bg-white/10 rounded w-24 mb-2"></div>
                    <div className="h-3 bg-white/10 rounded w-32"></div>
                  </div>
                  <div className="text-right">
                    <div className="h-4 bg-white/10 rounded w-20 mb-2"></div>
                    <div className="h-3 bg-white/10 rounded w-16"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Enhanced error display with retry mechanism (Requirement 1.4, 4.4)
  if (error && pools.length === 0) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-red-500/30 rounded-3xl p-8">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <div className="text-red-400 mb-2 font-semibold text-lg">Failed to Load Pools</div>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={manualRefresh}
            disabled={isBackgroundRefresh}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-2xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBackgroundRefresh ? (
              <span className="flex items-center gap-2">
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                Retrying...
              </span>
            ) : (
              'Retry'
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Error Banner - Show only when error exists AND consecutiveFailures >= 3 (Requirements: 6.2, 6.3) */}
      {refreshError && consecutiveFailures >= 3 && (
        <div className="backdrop-blur-xl bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-red-300 mb-1">
                Connection Issue
              </div>
              <div className="text-xs text-red-200/80 mb-3">
                Unable to fetch live pool data. Displaying cached information.
              </div>
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

      {/* Header with refresh controls */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              {poolStats.totalPools} pools • {poolStats.activePools} active
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Manual refresh button */}
          <button
            onClick={manualRefresh}
            disabled={isBackgroundRefresh}
            className="flex items-center gap-2 px-4 py-2 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 text-white transition-all touch-manipulation text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh pool data"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isBackgroundRefresh ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          
          {showCreateButton && (
            <button
              onClick={onCreatePool}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-2xl transition-all shadow-lg hover:shadow-xl hover:scale-105 touch-manipulation text-sm sm:text-base whitespace-nowrap"
            >
              Create Pool
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search pools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-3 text-sm sm:text-base backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all touch-manipulation"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-center px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 text-white transition-all touch-manipulation text-sm sm:text-base whitespace-nowrap"
          >
            <FunnelIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Filters
          </button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                  Min Liquidity (SOL)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={filters.minLiquidity}
                  onChange={(e) => setFilters(prev => ({ ...prev, minLiquidity: e.target.value }))}
                  className="w-full px-3 py-2 text-sm sm:text-base backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all touch-manipulation"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                  Token Symbol
                </label>
                <input
                  type="text"
                  placeholder="SOL, USDC, etc."
                  value={filters.tokenSymbol}
                  onChange={(e) => setFilters(prev => ({ ...prev, tokenSymbol: e.target.value }))}
                  className="w-full px-3 py-2 text-sm sm:text-base backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all touch-manipulation"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                  AMM Type
                </label>
                <select
                  value={filters.ammType}
                  onChange={(e) => setFilters(prev => ({ ...prev, ammType: e.target.value }))}
                  className="w-full px-3 py-2 text-sm sm:text-base backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all touch-manipulation"
                >
                  <option value="" className="bg-gray-900">All Types</option>
                  <option value="constant_product" className="bg-gray-900">Constant Product</option>
                  <option value="stable" className="bg-gray-900">Stable</option>
                  <option value="concentrated" className="bg-gray-900">Concentrated</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sort Options */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs sm:text-sm font-medium text-gray-300 py-2">Sort by:</span>
        {[
          { field: 'liquidity' as SortField, label: 'Liquidity' },
          { field: 'volume24h' as SortField, label: '24h Volume' },
          { field: 'fees24h' as SortField, label: '24h Fees' },
          { field: 'created' as SortField, label: 'Created' },
        ].map(({ field, label }) => (
          <button
            key={field}
            onClick={() => handleSort(field)}
            className={`flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium touch-manipulation transition-all ${
              sortField === field
                ? 'backdrop-blur-xl bg-blue-500/20 border border-blue-500/50 text-blue-300'
                : 'backdrop-blur-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            {label}
            {sortField === field && (
              <ArrowsUpDownIcon className={`w-3 h-3 sm:w-4 sm:h-4 ml-1 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
            )}
          </button>
        ))}
      </div>

      {/* Pool List */}
      <div className="space-y-3">
        {filteredAndSortedPools.length === 0 ? (
          <div className="text-center py-12 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl">
            <div className="text-gray-300 mb-2 font-semibold">No pools found</div>
            <p className="text-sm text-gray-400">
              {searchQuery || Object.values(filters).some(f => f) 
                ? 'Try adjusting your search or filters'
                : 'No liquidity pools available yet'
              }
            </p>
          </div>
        ) : (
          filteredAndSortedPools.map((pool) => (
            <PoolCard
              key={pool.id}
              pool={pool}
              onClick={() => onPoolSelect?.(pool)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface PoolCardProps {
  pool: Pool;
  onClick?: () => void;
}

const PoolCard = React.memo(({ pool, onClick }: PoolCardProps) => {
  const liquidityValue = useMemo(() => Number(pool.totalLiquidity) / 1e9, [pool.totalLiquidity]);
  const volume24h = useMemo(() => Number(pool.volume24h) / 1e9, [pool.volume24h]);
  const fees24h = useMemo(() => Number(pool.fees24h) / 1e9, [pool.fees24h]);

  return (
    <div
      className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-3 sm:p-4 transition-all ${
        onClick ? 'hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] cursor-pointer touch-manipulation' : ''
      }`}
      onClick={onClick}
    >
      {/* Mobile Layout */}
      <div className="lg:hidden">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="flex -space-x-2">
              <TokenLogo token={pool.tokenA} size="sm" />
              <TokenLogo token={pool.tokenB} size="sm" />
            </div>
            <div>
              <div className="font-semibold text-white text-sm">
                {pool.tokenA.symbol}/{pool.tokenB.symbol}
              </div>
              <div className="text-xs text-gray-400">
                {pool.ammType.replace('_', ' ')} • {pool.feeRate}% fee
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${pool.isActive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {onClick && <ChevronRightIcon className="w-5 h-5 text-gray-400" />}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-gray-400">Liquidity</div>
            <div className="font-medium text-white truncate">
              {formatCurrency(liquidityValue)} SOL
            </div>
          </div>
          <div>
            <div className="text-gray-400">24h Volume</div>
            <div className="font-medium text-white truncate">
              {formatCurrency(volume24h)} SOL
            </div>
          </div>
          <div>
            <div className="text-gray-400">24h Fees</div>
            <div className="font-medium text-white truncate">
              {formatCurrency(fees24h)} SOL
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="flex -space-x-2">
              <TokenLogo token={pool.tokenA} size="md" />
              <TokenLogo token={pool.tokenB} size="md" />
            </div>
            <div>
              <div className="font-semibold text-white">
                {pool.tokenA.symbol}/{pool.tokenB.symbol}
              </div>
              <div className="text-sm text-gray-400">
                {pool.ammType.replace('_', ' ')} • {pool.feeRate}% fee
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-8">
          <div className="text-right">
            <div className="text-sm font-medium text-white">
              {formatCurrency(liquidityValue)} SOL
            </div>
            <div className="text-xs text-gray-400">Liquidity</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-white">
              {formatCurrency(volume24h)} SOL
            </div>
            <div className="text-xs text-gray-400">24h Volume</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-white">
              {formatCurrency(fees24h)} SOL
            </div>
            <div className="text-xs text-gray-400">24h Fees</div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${pool.isActive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {onClick && <ChevronRightIcon className="w-5 h-5 text-gray-400" />}
          </div>
        </div>
      </div>
    </div>
  );
});

PoolCard.displayName = 'PoolCard';