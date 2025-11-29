'use client';

import React, { useEffect, useMemo } from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import { Token } from '@/types';
import { useWallet } from '@/hooks/useWallet';
import { useTokenList } from '@/hooks/useTokenList';
import { TokenLogo } from './TokenLogo';
import { formatTokenAmount, formatUsdAmount } from '@/utils/formatting';

interface TokenPortfolioProps {
  className?: string;
  showZeroBalances?: boolean;
}

export function TokenPortfolio({ 
  className = '',
  showZeroBalances = false 
}: TokenPortfolioProps) {
  const { 
    tokenBalances, 
    tokenPrices, 
    balancesLoading, 
    fetchTokenBalances, 
    fetchTokenPrices,
    isConnected 
  } = useWallet();
  const { tokens } = useTokenList();

  // Fetch balances and prices when component mounts or wallet connects
  useEffect(() => {
    if (isConnected && tokens.length > 0) {
      fetchTokenBalances(tokens);
      fetchTokenPrices(tokens);
    }
  }, [isConnected, tokens, fetchTokenBalances, fetchTokenPrices]);

  // Calculate portfolio data
  const portfolioData = useMemo(() => {
    if (!tokenBalances || !tokens.length) {
      return {
        totalValue: 0,
        tokens: [],
        totalChange24h: 0,
        totalChange24hPercent: 0
      };
    }

    let totalValue = 0;
    const portfolioTokens: Array<{
      token: Token;
      balance: bigint;
      balanceFormatted: string;
      value: number;
      valueFormatted: string;
      price: number;
      change24h?: number;
    }> = [];

    tokens.forEach(token => {
      const balance = tokenBalances[token.mint] || BigInt(0);
      
      if (!showZeroBalances && balance === BigInt(0)) {
        return;
      }

      const price = tokenPrices[token.mint] || 0;
      const balanceNumber = Number(balance) / Math.pow(10, token.decimals);
      const value = balanceNumber * price;
      
      totalValue += value;
      
      portfolioTokens.push({
        token,
        balance,
        balanceFormatted: formatTokenAmount(balance, token.decimals),
        value,
        valueFormatted: formatUsdAmount(value),
        price,
        change24h: 0 // TODO: Implement 24h change tracking
      });
    });

    // Sort by value (highest first)
    portfolioTokens.sort((a, b) => b.value - a.value);

    return {
      totalValue,
      tokens: portfolioTokens,
      totalChange24h: 0, // TODO: Calculate total change
      totalChange24hPercent: 0 // TODO: Calculate percentage change
    };
  }, [tokenBalances, tokenPrices, tokens, showZeroBalances]);

  if (!isConnected) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-500">Connect your wallet to view your portfolio</p>
      </div>
    );
  }

  if (balancesLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
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
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Portfolio Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Portfolio Overview</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Total Value</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatUsdAmount(portfolioData.totalValue)}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-gray-500">24h Change</p>
            <div className="flex items-center space-x-1">
              {portfolioData.totalChange24h >= 0 ? (
                <ArrowUpIcon className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowDownIcon className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-lg font-semibold ${
                portfolioData.totalChange24h >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatUsdAmount(Math.abs(portfolioData.totalChange24h))} 
                ({Math.abs(portfolioData.totalChange24hPercent).toFixed(2)}%)
              </span>
            </div>
          </div>
          
          <div>
            <p className="text-sm text-gray-500">Assets</p>
            <p className="text-2xl font-bold text-gray-900">
              {portfolioData.tokens.length}
            </p>
          </div>
        </div>
      </div>

      {/* Token Holdings */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Holdings</h3>
        </div>
        
        <div className="divide-y divide-gray-200">
          {portfolioData.tokens.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No tokens found in your wallet
            </div>
          ) : (
            portfolioData.tokens.map(({ token, balance, balanceFormatted, value, valueFormatted, price }) => (
              <div key={token.mint} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <TokenLogo token={token} size="md" />
                    <div>
                      <div className="font-medium text-gray-900">{token.symbol}</div>
                      <div className="text-sm text-gray-500">{token.name}</div>
                      {price > 0 && (
                        <div className="text-xs text-gray-400">
                          ${price.toFixed(price < 1 ? 6 : 2)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-medium text-gray-900">
                      {balanceFormatted} {token.symbol}
                    </div>
                    {value > 0 && (
                      <div className="text-sm text-gray-500">
                        {valueFormatted}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      {((value / portfolioData.totalValue) * 100).toFixed(1)}% of portfolio
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}