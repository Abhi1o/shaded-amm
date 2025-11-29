'use client';

import React, { useState, useMemo } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useTransactionStore } from '@/stores/transactionStore';
import { useSolanaConnection } from '@/hooks/useSolanaConnection';
import {
  WalletIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { TransactionType, TransactionStatus } from '@/types';


export function AccountDashboard() {
  const {
    isConnected,
    address,
    publicKey,
    walletName,
    network,
    formattedSolBalance,
  } = useWallet();

  const {
    transactions,
    currentPage,
    setCurrentPage,
    pageSize,
  } = useTransactionStore();

  const { connection } = useSolanaConnection();

  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'all' | '24h' | '7d' | '30d'>('all');

  // Get user's transactions
  const userTransactions = useMemo(() => {
    if (!address) return [];
    return transactions.filter(tx => tx.feePayer === address);
  }, [transactions, address]);

  // Apply filters
  const filteredTransactions = useMemo(() => {
    let filtered = userTransactions;

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(tx => tx.type === typeFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(tx => tx.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tx =>
        tx.signature.toLowerCase().includes(query) ||
        tx.tokenIn?.symbol.toLowerCase().includes(query) ||
        tx.tokenOut?.symbol.toLowerCase().includes(query)
      );
    }

    // Date range filter
    if (dateRange !== 'all') {
      const now = Date.now();
      const ranges = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      const rangeMs = ranges[dateRange];
      filtered = filtered.filter(tx => now - tx.timestamp < rangeMs);
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [userTransactions, typeFilter, statusFilter, searchQuery, dateRange]);

  // Pagination
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(startIndex, startIndex + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredTransactions.length / pageSize);

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

  // Copy address to clipboard
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

  // Refresh balances
  const handleRefresh = async () => {
    if (!isConnected || !connection) return;
    setRefreshing(true);
    try {
      // Refresh SOL balance
      if (publicKey) {
        await connection.getBalance(publicKey);
      }
      // Refresh token balances if needed
      // await fetchTokenBalances([]);
    } catch (error) {
      console.error('Failed to refresh balances:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  // Format amount
  const formatAmount = (amount: bigint | undefined, decimals: number = 9) => {
    if (!amount) return '0';
    const value = Number(amount) / Math.pow(10, decimals);
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  // Get explorer URL
  const getExplorerUrl = (signature: string) => {
    const baseUrl = 'https://solscan.io';
    return `${baseUrl}/tx/${signature}?cluster=${network}`;
  };

  // Get status color
  const getStatusColor = (status: TransactionStatus) => {
    switch (status) {
      case TransactionStatus.CONFIRMED:
        return 'bg-green-100 text-green-800';
      case TransactionStatus.FAILED:
        return 'bg-red-100 text-red-800';
      case TransactionStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800';
      case TransactionStatus.CANCELLED:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get type label
  const getTypeLabel = (type: TransactionType) => {
    const labels = {
      [TransactionType.SWAP]: 'Swap',
      [TransactionType.ADD_LIQUIDITY]: 'Add Liquidity',
      [TransactionType.REMOVE_LIQUIDITY]: 'Remove Liquidity',
      [TransactionType.CREATE_POOL]: 'Create Pool',
      [TransactionType.SPL_TRANSFER]: 'Token Transfer',
      [TransactionType.SOL_TRANSFER]: 'SOL Transfer',
    };
    return labels[type] || type;
  };

  if (!isConnected) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <WalletIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Connect Your Wallet
        </h2>
        <p className="text-gray-600">
          Connect your Solana wallet to view your account details and transaction history
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wallet Information Card */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Wallet Information</h2>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* Wallet Address */}
          <div>
            <label className="text-sm font-medium text-gray-500">Wallet Address</label>
            <div className="mt-1 flex items-center space-x-2">
              <code className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-sm font-mono text-gray-900 break-all">
                {address}
              </code>
              <button
                onClick={copyAddress}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                title="Copy address"
              >
                {copied ? (
                  <CheckIcon className="w-5 h-5 text-green-600" />
                ) : (
                  <ClipboardDocumentIcon className="w-5 h-5" />
                )}
              </button>
              <a
                href={`https://solscan.io/account/${address}?cluster=${network}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                title="View on explorer"
              >
                <ArrowTopRightOnSquareIcon className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Wallet Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-500 mb-1">Wallet Type</div>
              <div className="text-lg font-semibold text-gray-900">{walletName || 'Unknown'}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-500 mb-1">Network</div>
              <div className="text-lg font-semibold text-gray-900 capitalize">{network}</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium text-blue-600 mb-1">SOL Balance</div>
              <div className="text-lg font-semibold text-blue-900">{formattedSolBalance} SOL</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-500 mb-1">Total Transactions</div>
              <div className="text-lg font-semibold text-gray-900">{stats.total}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Statistics */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Transaction Statistics</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600 mt-1">Total</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-900">{stats.confirmed}</div>
              <div className="text-sm text-green-600 mt-1">Confirmed</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-900">{stats.failed}</div>
              <div className="text-sm text-red-600 mt-1">Failed</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-900">{stats.pending}</div>
              <div className="text-sm text-yellow-600 mt-1">Pending</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-900">{stats.swaps}</div>
              <div className="text-sm text-purple-600 mt-1">Swaps</div>
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">Total Fees Paid</span>
              <span className="text-lg font-bold text-blue-900">
                {formatAmount(stats.totalFees, 9)} SOL
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <FunnelIcon className="w-4 h-4" />
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <input
                type="text"
                placeholder="Search signature or token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TransactionType | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="all">All Types</option>
                <option value={TransactionType.SWAP}>Swap</option>
                <option value={TransactionType.ADD_LIQUIDITY}>Add Liquidity</option>
                <option value={TransactionType.REMOVE_LIQUIDITY}>Remove Liquidity</option>
                <option value={TransactionType.CREATE_POOL}>Create Pool</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TransactionStatus | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="all">All Status</option>
                <option value={TransactionStatus.CONFIRMED}>Confirmed</option>
                <option value={TransactionStatus.FAILED}>Failed</option>
                <option value={TransactionStatus.PENDING}>Pending</option>
              </select>

              {/* Date Range */}
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as '24h' | '7d' | '30d' | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="all">All Time</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  setTypeFilter('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                  setDateRange('all');
                }}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}

        {/* Transaction List */}
        <div className="overflow-x-auto">
          {paginatedTransactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {userTransactions.length === 0
                ? 'No transactions yet'
                : 'No transactions match your filters'}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Signature
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedTransactions.map((tx) => (
                  <tr key={tx.signature} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {getTypeLabel(tx.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {tx.tokenIn && tx.tokenOut && (
                        <div className="text-sm text-gray-900">
                          <div className="flex items-center space-x-2">
                            <span>
                              {formatAmount(tx.amountIn, tx.tokenIn.decimals)} {tx.tokenIn.symbol}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span>
                              {formatAmount(tx.amountOut, tx.tokenOut.decimals)} {tx.tokenOut.symbol}
                            </span>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                          tx.status
                        )}`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTimestamp(tx.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <a
                        href={getExplorerUrl(tx.signature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 font-mono flex items-center space-x-1"
                      >
                        <span>{formatAddress(tx.signature)}</span>
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredTransactions.length)} of{' '}
              {filteredTransactions.length} transactions
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
