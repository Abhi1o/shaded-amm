'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { 
  XMarkIcon, 
  ArrowTopRightOnSquareIcon,
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  BeakerIcon
} from '@heroicons/react/24/outline';
import { Pool } from '@/types';
import { TokenLogo } from '@/components/tokens/TokenLogo';
import { formatTokenAmount, formatNumber, formatCurrency, formatDate } from '@/utils/formatting';

interface PoolDetailsProps {
  pool: Pool | null;
  isOpen: boolean;
  onClose: () => void;
  onAddLiquidity?: (pool: Pool) => void;
  onRemoveLiquidity?: (pool: Pool) => void;
}

interface PoolMetrics {
  totalValueLocked: number;
  volume24h: number;
  volume7d: number;
  fees24h: number;
  fees7d: number;
  apr: number;
  priceChange24h: number;
}

export function PoolDetails({ pool, isOpen, onClose, onAddLiquidity, onRemoveLiquidity }: PoolDetailsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'analytics'>('overview');
  const [metrics, setMetrics] = useState<PoolMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch pool metrics when pool changes
  useEffect(() => {
    if (pool && isOpen) {
      fetchPoolMetrics(pool.id);
    }
  }, [pool, isOpen]);

  const fetchPoolMetrics = async (poolId: string) => {
    setLoading(true);
    try {
      // TODO: Implement actual metrics fetching from Solana
      // This is mock data for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockMetrics: PoolMetrics = {
        totalValueLocked: Number(pool?.totalLiquidity || 0) / 1e9,
        volume24h: Number(pool?.volume24h || 0) / 1e9,
        volume7d: Number(pool?.volume24h || 0) * 7 / 1e9,
        fees24h: Number(pool?.fees24h || 0) / 1e9,
        fees7d: Number(pool?.fees24h || 0) * 7 / 1e9,
        apr: Math.random() * 50 + 5, // 5-55% APR
        priceChange24h: (Math.random() - 0.5) * 20, // -10% to +10%
      };
      
      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Failed to fetch pool metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!pool) return null;

  const currentPrice = pool.reserveA > 0 && pool.reserveB > 0 
    ? Number(pool.reserveA) / Number(pool.reserveB)
    : 0;

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: ChartBarIcon },
    { id: 'transactions' as const, label: 'Transactions', icon: ClockIcon },
    { id: 'analytics' as const, label: 'Analytics', icon: BeakerIcon },
  ];

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/25" />
      
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-4">
                <div className="flex -space-x-2">
                  <TokenLogo token={pool.tokenA} size="lg" />
                  <TokenLogo token={pool.tokenB} size="lg" />
                </div>
                <div>
                  <Dialog.Title className="text-xl font-semibold text-gray-900">
                    {pool.tokenA.symbol}/{pool.tokenB.symbol}
                  </Dialog.Title>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>{pool.ammType.replace('_', ' ')} AMM</span>
                    <span>•</span>
                    <span>{pool.feeRate}% fee</span>
                    <span>•</span>
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${pool.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span>{pool.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.open(`https://solscan.io/account/${pool.id}`, '_blank')}
                  className="p-2 text-gray-400 hover:text-gray-600"
                  title="View on Solscan"
                >
                  <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Content */}
            <div className="p-6">
              {activeTab === 'overview' && (
                <OverviewTab 
                  pool={pool} 
                  metrics={metrics} 
                  loading={loading}
                  currentPrice={currentPrice}
                  onAddLiquidity={onAddLiquidity}
                  onRemoveLiquidity={onRemoveLiquidity}
                />
              )}
              {activeTab === 'transactions' && (
                <TransactionsTab pool={pool} />
              )}
              {activeTab === 'analytics' && (
                <AnalyticsTab pool={pool} metrics={metrics} />
              )}
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
}

interface OverviewTabProps {
  pool: Pool;
  metrics: PoolMetrics | null;
  loading: boolean;
  currentPrice: number;
  onAddLiquidity?: (pool: Pool) => void;
  onRemoveLiquidity?: (pool: Pool) => void;
}

function OverviewTab({ pool, metrics, loading, currentPrice, onAddLiquidity, onRemoveLiquidity }: OverviewTabProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-300 rounded w-20 mb-2"></div>
                <div className="h-6 bg-gray-300 rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500">Total Value Locked</div>
          <div className="text-2xl font-semibold text-gray-900">
            {formatCurrency(metrics?.totalValueLocked || 0)} SOL
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500">24h Volume</div>
          <div className="text-2xl font-semibold text-gray-900">
            {formatCurrency(metrics?.volume24h || 0)} SOL
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500">24h Fees</div>
          <div className="text-2xl font-semibold text-gray-900">
            {formatCurrency(metrics?.fees24h || 0)} SOL
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500">APR</div>
          <div className="text-2xl font-semibold text-green-600">
            {formatNumber(metrics?.apr || 0, 2)}%
          </div>
        </div>
      </div>

      {/* Pool Composition */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pool Composition</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <TokenLogo token={pool.tokenA} size="sm" />
                <span className="font-medium">{pool.tokenA.symbol}</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {formatTokenAmount(pool.reserveA, pool.tokenA.decimals)}
                </div>
                <div className="text-sm text-gray-500">50%</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <TokenLogo token={pool.tokenB} size="sm" />
                <span className="font-medium">{pool.tokenB.symbol}</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {formatTokenAmount(pool.reserveB, pool.tokenB.decimals)}
                </div>
                <div className="text-sm text-gray-500">50%</div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-500">Current Price</div>
              <div className="text-lg font-semibold">
                1 {pool.tokenB.symbol} = {formatNumber(currentPrice)} {pool.tokenA.symbol}
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-500">LP Token Supply</div>
              <div className="text-lg font-semibold">
                {formatTokenAmount(pool.lpTokenSupply, 6)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-4">
        <button
          onClick={() => onAddLiquidity?.(pool)}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
        >
          Add Liquidity
        </button>
        <button
          onClick={() => onRemoveLiquidity?.(pool)}
          className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium"
        >
          Remove Liquidity
        </button>
      </div>
    </div>
  );
}

function TransactionsTab({ pool }: { pool: Pool }) {
  // TODO: Implement transaction history fetching
  return (
    <div className="text-center py-8">
      <ClockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <div className="text-gray-500 mb-2">Transaction History</div>
      <p className="text-sm text-gray-400">
        Transaction history will be displayed here
      </p>
    </div>
  );
}

function AnalyticsTab({ pool, metrics }: { pool: Pool; metrics: PoolMetrics | null }) {
  // TODO: Implement analytics charts and data
  return (
    <div className="text-center py-8">
      <BeakerIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <div className="text-gray-500 mb-2">Pool Analytics</div>
      <p className="text-sm text-gray-400">
        Charts and analytics will be displayed here
      </p>
    </div>
  );
}