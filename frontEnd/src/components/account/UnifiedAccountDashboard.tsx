'use client';

import React, { useState, useMemo } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useTokenAccounts } from '@/hooks/useTokenAccounts';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useTransactionStore } from '@/stores/transactionStore';
import {
  WalletIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  ChartBarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import { TransactionType, TransactionStatus } from '@/types';
import { MotionReveal, MotionStagger, MotionScale, MotionFadeIn } from '../animations';
import { motion } from 'framer-motion';

export function UnifiedAccountDashboard() {
  const {
    isConnected,
    address,
    walletName,
    network,
    formattedSolBalance,
  } = useWallet();

  const { portfolio, loading } = usePortfolioStore();
  const { fetchPortfolio } = usePortfolio();
  const { fetchTokenAccounts, loading: tokenAccountsLoading } = useTokenAccounts({
    enabled: true,
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { transactions } = useTransactionStore();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'tokens' | 'transactions'>('overview');
  const [showFilters, setShowFilters] = useState(false);

  // Get user's transactions
  const userTransactions = useMemo(() => {
    if (!address) return [];
    return transactions.filter(tx => tx.feePayer === address);
  }, [transactions, address]);

  // Transaction statistics
  const stats = useMemo(() => {
    const confirmed = userTransactions.filter(tx => tx.status === TransactionStatus.CONFIRMED).length;
    const failed = userTransactions.filter(tx => tx.status === TransactionStatus.FAILED).length;
    const pending = userTransactions.filter(tx => tx.status === TransactionStatus.PENDING).length;
    const swaps = userTransactions.filter(tx => tx.type === TransactionType.SWAP).length;
    const totalFees = userTransactions.reduce((sum, tx) => sum + Number(tx.solFee || BigInt(0)), 0);

    return {
      total: userTransactions.length,
      confirmed,
      failed,
      pending,
      swaps,
      totalFees: BigInt(Math.floor(totalFees)),
    };
  }, [userTransactions]);

  // Copy address
  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  // Format functions
  const formatSolAmount = (lamports: bigint) => {
    const sol = Number(lamports) / 1e9;
    return sol.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const formatTokenAmount = (amount: bigint, decimals: number) => {
    const value = Number(amount) / Math.pow(10, decimals);
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const formatUsd = (value: number | undefined) => {
    if (value === undefined) return '-';
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };



  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const performance = portfolio?.performance;
  const isPositive = performance && performance.change24hPercent >= 0;

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <MotionReveal direction="up">
          <div className="backdrop-blur-xl bg-white/5 rounded-3xl p-12 border border-white/10 text-center max-w-md">
            <WalletIcon className="w-20 h-20 mx-auto text-gray-400 mb-6" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Connect Your Wallet
            </h2>
            <p className="text-gray-400 font-light">
              Connect your Solana wallet to view your portfolio, transaction history, and account details
            </p>
          </div>
        </MotionReveal>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <MotionFadeIn delay={0.1}>
          <div className="mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2">
              Account
            </h1>
            <p className="text-gray-400 font-light">
              Manage your portfolio and track your activity
            </p>
          </div>
        </MotionFadeIn>

        {/* Wallet Card */}
        <MotionReveal direction="up" delay={0.2}>
          <div className="backdrop-blur-xl bg-white/5 rounded-3xl p-6 sm:p-8 border border-white/10 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-white">Wallet</h2>
              <MotionScale>
                <button
                  onClick={() => {
                    fetchTokenAccounts();
                    fetchPortfolio();
                  }}
                  disabled={loading || tokenAccountsLoading}
                  className="p-2 backdrop-blur-xl bg-white/10 rounded-xl hover:bg-white/20 transition-all border border-white/10"
                >
                  <ArrowPathIcon className={`w-5 h-5 text-white ${(loading || tokenAccountsLoading) ? 'animate-spin' : ''}`} />
                </button>
              </MotionScale>
            </div>

            {/* Address */}
            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-2 block">Address</label>
              <div className="flex items-center space-x-2">
                <code className="flex-1 px-4 py-3 backdrop-blur-xl bg-white/5 rounded-xl text-sm font-mono text-white border border-white/10">
                  {address}
                </code>
                <MotionScale>
                  <button
                    onClick={copyAddress}
                    className="p-3 backdrop-blur-xl bg-white/10 rounded-xl hover:bg-white/20 transition-all border border-white/10"
                  >
                    {copied ? (
                      <CheckIcon className="w-5 h-5 text-green-400" />
                    ) : (
                      <ClipboardDocumentIcon className="w-5 h-5 text-white" />
                    )}
                  </button>
                </MotionScale>
                <MotionScale>
                  <a
                    href={`https://solscan.io/account/${address}?cluster=${network}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 backdrop-blur-xl bg-white/10 rounded-xl hover:bg-white/20 transition-all border border-white/10"
                  >
                    <ArrowTopRightOnSquareIcon className="w-5 h-5 text-white" />
                  </a>
                </MotionScale>
              </div>
            </div>

            {/* Wallet Info Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="text-sm text-gray-400 mb-1">Wallet</div>
                <div className="text-lg font-semibold text-white">{walletName || 'Unknown'}</div>
              </div>
              <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="text-sm text-gray-400 mb-1">Network</div>
                <div className="text-lg font-semibold text-white capitalize">{network}</div>
              </div>
              <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl p-4 border border-blue-500/30">
                <div className="text-sm text-blue-300 mb-1">SOL Balance</div>
                <div className="text-lg font-semibold text-white">{formattedSolBalance}</div>
              </div>
              <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="text-sm text-gray-400 mb-1">Transactions</div>
                <div className="text-lg font-semibold text-white">{stats.total}</div>
              </div>
            </div>
          </div>
        </MotionReveal>

        {/* Stats Grid */}
        <MotionStagger staggerDelay={0.1}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Value', value: portfolio ? `${formatSolAmount(portfolio.totalValue)} SOL` : '0.00 SOL', gradient: 'from-blue-500 to-cyan-500' },
              { label: 'Assets', value: portfolio ? `${portfolio.tokens.length + 1}` : '0', gradient: 'from-purple-500 to-pink-500' },
              { label: 'Confirmed', value: stats.confirmed.toString(), gradient: 'from-green-500 to-emerald-500' },
              { label: 'Total Fees', value: `${formatSolAmount(stats.totalFees)} SOL`, gradient: 'from-orange-500 to-red-500' },
            ].map((stat, index) => (
              <MotionReveal key={index} delay={0.3 + index * 0.1} direction="up">
                <MotionScale>
                  <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all">
                    <div className="text-sm text-gray-400 mb-2">{stat.label}</div>
                    <div className={`text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${stat.gradient}`}>
                      {stat.value}
                    </div>
                  </div>
                </MotionScale>
              </MotionReveal>
            ))}
          </div>
        </MotionStagger>

        {/* Tabs */}
        <MotionReveal direction="up" delay={0.5}>
          <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-2 border border-white/10 mb-8 inline-flex">
            {[
              { id: 'overview' as const, label: 'Overview', icon: Squares2X2Icon },
              { id: 'tokens' as const, label: 'Tokens', icon: ChartBarIcon },
              { id: 'transactions' as const, label: 'Transactions', icon: ListBulletIcon },
            ].map((tab) => (
              <MotionScale key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              </MotionScale>
            ))}
          </div>
        </MotionReveal>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Performance Card */}
              {performance && (
                <MotionReveal direction="up">
                  <div className="backdrop-blur-xl bg-white/5 rounded-3xl p-6 border border-white/10">
                    <h3 className="text-xl font-semibold text-white mb-4">Performance</h3>
                    <div className="flex items-center space-x-4">
                      <div className={`flex items-center space-x-2 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? (
                          <ArrowUpIcon className="w-6 h-6" />
                        ) : (
                          <ArrowDownIcon className="w-6 h-6" />
                        )}
                        <span className="text-3xl font-bold">
                          {Math.abs(performance.change24hPercent).toFixed(2)}%
                        </span>
                      </div>
                      <span className="text-gray-400">24h Change</span>
                    </div>
                  </div>
                </MotionReveal>
              )}

              {/* Quick Stats */}
              <MotionReveal direction="up" delay={0.1}>
                <div className="backdrop-blur-xl bg-white/5 rounded-3xl p-6 border border-white/10">
                  <h3 className="text-xl font-semibold text-white mb-4">Activity</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Total', value: stats.total, color: 'text-gray-400' },
                      { label: 'Confirmed', value: stats.confirmed, color: 'text-green-400' },
                      { label: 'Failed', value: stats.failed, color: 'text-red-400' },
                      { label: 'Swaps', value: stats.swaps, color: 'text-purple-400' },
                    ].map((item, index) => (
                      <div key={index} className="text-center">
                        <div className={`text-3xl font-bold ${item.color}`}>{item.value}</div>
                        <div className="text-sm text-gray-400 mt-1">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </MotionReveal>
            </div>
          )}

          {activeTab === 'tokens' && (
            <MotionReveal direction="up">
              <div className="backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Token Holdings</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {portfolio ? `${portfolio.tokens.length + 1} assets` : 'Loading...'}
                    </p>
                  </div>
                  {(loading || tokenAccountsLoading) && (
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      <span>Loading...</span>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  {!portfolio || (portfolio.tokens.length === 0 && !loading && !tokenAccountsLoading) ? (
                    <div className="p-12 text-center">
                      <ChartBarIcon className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                      <div className="text-gray-400 mb-2">No tokens found</div>
                      <p className="text-sm text-gray-500">
                        Your SPL token holdings will appear here
                      </p>
                      <button
                        onClick={() => {
                          fetchTokenAccounts();
                          fetchPortfolio();
                        }}
                        className="mt-4 px-4 py-2 backdrop-blur-xl bg-blue-500/20 border border-blue-500/50 rounded-xl text-blue-300 hover:bg-blue-500/30 transition-all"
                      >
                        Refresh Holdings
                      </button>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="border-b border-white/10">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Asset</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Name</th>
                          <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Balance</th>
                          <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Value (USD)</th>
                          <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Value (SOL)</th>
                          <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {/* SOL Row */}
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                <span className="text-white font-bold text-xs">◎</span>
                              </div>
                              <div className="text-sm font-semibold text-white">SOL</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-300">Solana</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-sm font-medium text-white">
                              {portfolio ? formatSolAmount(portfolio.solBalance) : '0.00'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-sm font-medium text-white">
                              ${portfolio?.solValueUsd ? formatUsd(portfolio.solValueUsd) : '0.00'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-sm text-gray-400">-</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center space-x-2">
                              <a
                                href={`https://solscan.io/account/${address}?cluster=${network}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-gray-400 hover:text-white transition-colors"
                                title="View on explorer"
                              >
                                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                              </a>
                            </div>
                          </td>
                        </tr>
                        
                        {/* Token Rows */}
                        {portfolio?.tokens.map((token, index) => (
                          <tr key={index} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                {token.token.logoURI ? (
                                  <img
                                    src={token.token.logoURI}
                                    alt={token.token.symbol}
                                    className="w-8 h-8 rounded-full"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                    <span className="text-white font-bold text-xs">
                                      {token.token.symbol.charAt(0)}
                                    </span>
                                  </div>
                                )}
                                <div className="text-sm font-semibold text-white">{token.token.symbol}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-300 max-w-xs truncate">
                                {token.token.name}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-sm font-medium text-white">
                                {formatTokenAmount(token.balance, token.token.decimals)}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-sm font-medium text-white">
                                ${token.valueUsd ? formatUsd(token.valueUsd) : '0.00'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-sm text-gray-400">
                                {formatSolAmount(token.value)}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center space-x-2">
                                <a
                                  href={`https://solscan.io/token/${token.token.mint}?cluster=${network}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 text-gray-400 hover:text-white transition-colors"
                                  title="View token on explorer"
                                >
                                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                
                {/* Summary Footer */}
                {portfolio && portfolio.tokens.length > 0 && (
                  <div className="p-6 border-t border-white/10 bg-white/5">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-400">Total Portfolio Value</div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-lg font-bold text-white">
                            ${portfolio.totalValueUsd ? formatUsd(portfolio.totalValueUsd) : '0.00'}
                          </div>
                          <div className="text-sm text-gray-400">
                            {formatSolAmount(portfolio.totalValue)} SOL
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </MotionReveal>
          )}

          {activeTab === 'transactions' && (
            <MotionReveal direction="up">
              <div className="backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">Recent Transactions</h3>
                  <MotionScale>
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className="flex items-center space-x-2 px-4 py-2 backdrop-blur-xl bg-white/10 rounded-xl hover:bg-white/20 transition-all border border-white/10"
                    >
                      <FunnelIcon className="w-4 h-4 text-white" />
                      <span className="text-sm text-white">Filters</span>
                    </button>
                  </MotionScale>
                </div>
                <div className="overflow-x-auto">
                  {userTransactions.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                      No transactions yet
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="border-b border-white/10">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Details</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {userTransactions.slice(0, 10).map((tx) => (
                          <tr key={tx.signature} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4">
                              <span className="text-sm font-medium text-white">
                                {tx.type === TransactionType.SWAP ? 'Swap' : tx.type}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {tx.tokenIn && tx.tokenOut && (
                                <div className="text-sm text-gray-300">
                                  {tx.tokenIn.symbol} → {tx.tokenOut.symbol}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                tx.status === TransactionStatus.CONFIRMED
                                  ? 'bg-green-500/20 text-green-400'
                                  : tx.status === TransactionStatus.FAILED
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {tx.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-400">
                              {formatTimestamp(tx.timestamp)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </MotionReveal>
          )}
        </motion.div>
      </div>
    </div>
  );
}
