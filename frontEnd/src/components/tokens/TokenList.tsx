'use client';

import React, { useState, useMemo } from 'react';
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { Token } from '@/types';
import { useTokenList } from '@/hooks/useTokenList';
import { useWallet } from '@/hooks/useWallet';
import { TokenLogo } from './TokenLogo';
import { formatTokenAmount, formatUsdAmount } from '@/utils/formatting';

interface TokenListProps {
  onTokenSelect?: (token: Token) => void;
  showBalancesOnly?: boolean;
  className?: string;
}

type SortOption = 'symbol' | 'balance' | 'value' | 'name';
type FilterOption = 'all' | 'withBalance' | 'favorites';

export function TokenList({ 
  onTokenSelect, 
  showBalancesOnly = false,
  className = '' 
}: TokenListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('balance');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [showFilters, setShowFilters] = useState(false);

  const { tokens, loading, favoriteTokens, toggleFavorite } = useTokenList();
  const { tokenBalances, tokenPrices } = useWallet();

  // Filter and sort tokens
  const processedTokens = useMemo(() => {
    let filtered = tokens;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(token =>
        token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.mint.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    switch (filterBy) {
      case 'withBalance':
        filtered = filtered.filter(token => 
          tokenBalances && tokenBalances[token.mint] && tokenBalances[token.mint] > BigInt(0)
        );
        break;
      case 'favorites':
        filtered = filtered.filter(token => favoriteTokens.includes(token.mint));
        break;
    }

    // Apply balance-only filter if specified
    if (showBalancesOnly) {
      filtered = filtered.filter(token => 
        tokenBalances && tokenBalances[token.mint] && tokenBalances[token.mint] > BigInt(0)
      );
    }

    // Sort tokens
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'symbol':
          return a.symbol.localeCompare(b.symbol);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'balance':
          const balanceA = tokenBalances?.[a.mint] || BigInt(0);
          const balanceB = tokenBalances?.[b.mint] || BigInt(0);
          return balanceA > balanceB ? -1 : balanceA < balanceB ? 1 : 0;
        case 'value':
          const valueA = calculateTokenValue(a);
          const valueB = calculateTokenValue(b);
          return valueB - valueA;
        default:
          return 0;
      }
    });

    return filtered;
  }, [tokens, searchQuery, filterBy, sortBy, tokenBalances, favoriteTokens, showBalancesOnly, tokenPrices]);

  // Calculate token value in USD
  const calculateTokenValue = (token: Token): number => {
    if (!tokenBalances || !tokenPrices) return 0;
    
    const balance = tokenBalances[token.mint];
    const price = tokenPrices[token.mint];
    
    if (!balance || !price) return 0;
    
    const balanceNumber = Number(balance) / Math.pow(10, token.decimals);
    return balanceNumber * price;
  };

  const handleTokenClick = (token: Token) => {
    if (onTokenSelect) {
      onTokenSelect(token);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg animate-pulse">
            <div className="w-8 h-8 bg-gray-300 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-300 rounded w-1/4" />
              <div className="h-3 bg-gray-300 rounded w-1/2" />
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-300 rounded w-16" />
              <div className="h-3 bg-gray-300 rounded w-12" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and Filter Controls */}
      <div className="space-y-3">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-1 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FunnelIcon className="w-4 h-4" />
              <span>Filters</span>
            </button>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="balance">Sort by Balance</option>
            <option value="value">Sort by Value</option>
            <option value="symbol">Sort by Symbol</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>

        {showFilters && (
          <div className="flex space-x-2">
            <button
              onClick={() => setFilterBy('all')}
              className={`px-3 py-1 text-sm rounded-lg ${
                filterBy === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Tokens
            </button>
            <button
              onClick={() => setFilterBy('withBalance')}
              className={`px-3 py-1 text-sm rounded-lg ${
                filterBy === 'withBalance' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              With Balance
            </button>
            <button
              onClick={() => setFilterBy('favorites')}
              className={`px-3 py-1 text-sm rounded-lg ${
                filterBy === 'favorites' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Favorites
            </button>
          </div>
        )}
      </div>

      {/* Token List */}
      <div className="space-y-2">
        {processedTokens.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? 'No tokens found matching your search' : 'No tokens available'}
          </div>
        ) : (
          processedTokens.map((token) => {
            const balance = tokenBalances?.[token.mint] || BigInt(0);
            const price = tokenPrices?.[token.mint];
            const value = calculateTokenValue(token);
            const isFavorite = favoriteTokens.includes(token.mint);

            return (
              <div
                key={token.mint}
                onClick={() => handleTokenClick(token)}
                className={`
                  flex items-center justify-between p-3 rounded-lg border transition-colors
                  ${onTokenSelect 
                    ? 'cursor-pointer hover:bg-gray-50 hover:border-gray-300' 
                    : 'bg-white border-gray-200'
                  }
                `}
              >
                <div className="flex items-center space-x-3">
                  <TokenLogo token={token} size="md" />
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{token.symbol}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(token.mint);
                        }}
                        className={`text-sm ${isFavorite ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}
                      >
                        ★
                      </button>
                    </div>
                    <div className="text-sm text-gray-500">{token.name}</div>
                    {price && (
                      <div className="text-xs text-gray-400">
                        ${price.toFixed(price < 1 ? 6 : 2)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-medium text-gray-900">
                    {formatTokenAmount(balance, token.decimals)}
                  </div>
                  {value > 0 && (
                    <div className="text-sm text-gray-500">
                      {formatUsdAmount(value)}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}