'use client';

import { useState, useMemo } from 'react';
import { useTransactionStore } from '@/stores/transactionStore';
import { useTransactionTracking } from '@/hooks/useTransactionTracking';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import { TransactionType, TransactionStatus } from '@/types';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
// Lightweight relative time formatter to avoid external dependency
const formatDistanceToNow = (timestamp: number): string => {
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const diffMs = Date.now() - timestamp;
  const seconds = Math.round(diffMs / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  if (Math.abs(seconds) < 60) return rtf.format(-seconds, 'second');
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute');
  if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-days, 'day');
};

const EXPLORER_URLS = {
  mainnet: 'https://solscan.io',
  devnet: 'https://solscan.io',
  testnet: 'https://solscan.io',
};

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  [TransactionType.SWAP]: 'Swap',
  [TransactionType.ADD_LIQUIDITY]: 'Add Liquidity',
  [TransactionType.REMOVE_LIQUIDITY]: 'Remove Liquidity',
  [TransactionType.CREATE_POOL]: 'Create Pool',
  [TransactionType.SPL_TRANSFER]: 'Token Transfer',
  [TransactionType.SOL_TRANSFER]: 'SOL Transfer',
};

const STATUS_COLORS: Record<TransactionStatus, string> = {
  [TransactionStatus.PENDING]: 'backdrop-blur-xl bg-yellow-500/20 border border-yellow-500/50 text-yellow-300',
  [TransactionStatus.CONFIRMED]: 'backdrop-blur-xl bg-green-500/20 border border-green-500/50 text-green-300',
  [TransactionStatus.FAILED]: 'backdrop-blur-xl bg-red-500/20 border border-red-500/50 text-red-300',
  [TransactionStatus.CANCELLED]: 'backdrop-blur-xl bg-gray-500/20 border border-gray-500/50 text-gray-300',
  [TransactionStatus.TIMEOUT]: 'backdrop-blur-xl bg-orange-500/20 border border-orange-500/50 text-orange-300',
};

export function TransactionList() {
  const {
    transactions,
    filters,
    setFilters,
    clearFilters,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    getPaginatedTransactions,
    getFilteredTransactions,
    setSelectedTransaction,
  } = useTransactionStore();

  useTransactionTracking();
  
  // Fetch historical transactions from blockchain
  const { loading, error, progress, fetchTransactionHistory, transactionCount } = useTransactionHistory({
    enabled: true,
    limit: 1000, // Fetch up to 1000 transactions
    fetchOnMount: true,
    batchSize: 20, // Process 20 at a time
  });

  const [searchInput, setSearchInput] = useState(filters.searchQuery || '');

  const paginatedTransactions = getPaginatedTransactions();
  const filteredTransactions = getFilteredTransactions();
  const totalPages = Math.ceil(filteredTransactions.length / pageSize);

  const handleSearch = (query: string) => {
    setSearchInput(query);
    setFilters({ searchQuery: query || undefined });
  };

  const handleTypeFilter = (type: TransactionType | 'all') => {
    setFilters({ type: type === 'all' ? undefined : type });
  };

  const handleStatusFilter = (status: TransactionStatus | 'all') => {
    setFilters({ status: status === 'all' ? undefined : status });
  };

  const getExplorerUrl = (signature: string, cluster: string = 'devnet') => {
    const baseUrl = EXPLORER_URLS[cluster as keyof typeof EXPLORER_URLS] || EXPLORER_URLS.devnet;
    return `${baseUrl}/tx/${signature}?cluster=${cluster}`;
  };

  const formatAmount = (amount: bigint | undefined, decimals: number = 9) => {
    if (!amount) return '0';
    const value = Number(amount) / Math.pow(10, decimals);
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const truncateSignature = (signature: string) => {
    return `${signature.slice(0, 8)}...${signature.slice(-8)}`;
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all"
          >
            Clear Filters
          </button>
          <button
            onClick={() => fetchTransactionHistory()}
            disabled={loading}
            className="px-4 py-2 text-sm backdrop-blur-xl bg-blue-500/20 border border-blue-500/50 rounded-2xl text-blue-300 hover:bg-blue-500/30 hover:border-blue-500/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {transactionCount > 0 && (
          <div className="text-sm text-gray-400">
            {transactionCount} transaction{transactionCount !== 1 ? 's' : ''} found
          </div>
        )}
      </div>
      
      {error && (
        <div className="backdrop-blur-xl bg-red-500/20 border border-red-500/50 rounded-2xl p-4 text-red-300 text-sm space-y-2">
          <div className="font-semibold">Error loading transactions:</div>
          <div>{error}</div>
          {error.includes('RPC endpoint') && (
            <div className="mt-3 pt-3 border-t border-red-500/30">
              <div className="text-xs text-red-200 mb-2">To fix this issue:</div>
              <ol className="list-decimal list-inside text-xs text-red-200 space-y-1 ml-2">
                <li>Create a <code className="bg-red-500/20 px-1 rounded">.env.local</code> file in your project root</li>
                <li>Add: <code className="bg-red-500/20 px-1 rounded">NEXT_PUBLIC_SOLANA_RPC_MAINNET=https://your-rpc-endpoint.com</code></li>
                <li>Use a free RPC provider like Helius, QuickNode, Infura, or Alchemy</li>
                <li>Restart your development server</li>
              </ol>
              <div className="mt-2 text-xs text-red-200">
                <div className="font-semibold mb-1">Popular free options:</div>
                <div>• Helius: https://www.helius.dev/</div>
                <div>• QuickNode: https://www.quicknode.com/</div>
                <div>• Infura: https://www.infura.io/</div>
                <div>• Alchemy: https://www.alchemy.com/</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search by signature or token..."
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          />
        </div>

        {/* Type Filter */}
        <div>
          <select
            value={filters.type || 'all'}
            onChange={(e) => handleTypeFilter(e.target.value as TransactionType | 'all')}
            className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          >
            <option value="all" className="bg-gray-900">All Types</option>
            {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value} className="bg-gray-900">
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={filters.status || 'all'}
            onChange={(e) => handleStatusFilter(e.target.value as TransactionStatus | 'all')}
            className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          >
            <option value="all" className="bg-gray-900">All Status</option>
            <option value={TransactionStatus.PENDING} className="bg-gray-900">Pending</option>
            <option value={TransactionStatus.CONFIRMED} className="bg-gray-900">Confirmed</option>
            <option value={TransactionStatus.FAILED} className="bg-gray-900">Failed</option>
            <option value={TransactionStatus.CANCELLED} className="bg-gray-900">Cancelled</option>
            <option value={TransactionStatus.TIMEOUT} className="bg-gray-900">Timeout</option>
          </select>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-3">
        {loading && paginatedTransactions.length === 0 ? (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
            <ArrowPathIcon className="w-8 h-8 mx-auto mb-4 text-blue-400 animate-spin" />
            <div className="text-gray-300 font-semibold mb-2">Loading transactions...</div>
            <p className="text-sm text-gray-400">Fetching your transaction history from the blockchain</p>
            {progress && (
              <div className="mt-4">
                <div className="text-xs text-gray-500 mb-2">
                  Processing batch {progress.current} of {progress.total}
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : paginatedTransactions.length === 0 ? (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
            <div className="text-gray-300 font-semibold mb-2">No transactions found</div>
            <p className="text-sm text-gray-400">Your transaction history will appear here</p>
            <button
              onClick={() => fetchTransactionHistory()}
              className="mt-4 px-4 py-2 text-sm backdrop-blur-xl bg-blue-500/20 border border-blue-500/50 rounded-2xl text-blue-300 hover:bg-blue-500/30 transition-all"
            >
              Load Transactions
            </button>
          </div>
        ) : (
          paginatedTransactions.map((tx) => (
            <div
              key={tx.signature}
              onClick={() => setSelectedTransaction(tx)}
              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-6 hover:bg-white/10 hover:border-white/20 hover:scale-[1.01] cursor-pointer transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-semibold text-white">
                      {TRANSACTION_TYPE_LABELS[tx.type]}
                    </span>
                    <span
                      className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${
                        STATUS_COLORS[tx.status]
                      }`}
                    >
                      {tx.status}
                    </span>
                  </div>
                  {tx.tokenIn && tx.tokenOut ? (
                    <div className="flex items-center space-x-2 text-sm text-gray-300">
                      <span>
                        {formatAmount(tx.amountIn, tx.tokenIn.decimals)} {tx.tokenIn.symbol}
                      </span>
                      <span className="text-gray-500">→</span>
                      <span>
                        {formatAmount(tx.amountOut, tx.tokenOut.decimals)} {tx.tokenOut.symbol}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">
                      {tx.type === TransactionType.SOL_TRANSFER ? 'SOL Transfer' : 
                       tx.type === TransactionType.SPL_TRANSFER ? 'Token Transfer' :
                       tx.type === TransactionType.ADD_LIQUIDITY ? 'Liquidity Added' :
                       tx.type === TransactionType.REMOVE_LIQUIDITY ? 'Liquidity Removed' :
                       tx.type === TransactionType.CREATE_POOL ? 'Pool Created' : 'Transaction'}
                    </div>
                  )}
                  {tx.solFee > BigInt(0) && (
                    <div className="text-xs text-gray-500 mt-1">
                      Fee: {(Number(tx.solFee) / 1e9).toFixed(6)} SOL
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(tx.timestamp)}
                  </span>
                  <a
                    href={getExplorerUrl(tx.signature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
                  >
                    {truncateSignature(tx.signature)}
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-300">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredTransactions.length)} of{' '}
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-medium backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl text-white hover:bg-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <span className="text-sm text-gray-300 px-4">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm font-medium backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl text-white hover:bg-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Load More Button - for fetching additional historical transactions */}
      {!loading && paginatedTransactions.length > 0 && transactionCount >= 1000 && (
        <div className="pt-4 border-t border-white/10 text-center">
          <button
            onClick={() => {
              const oldestTx = transactions[transactions.length - 1];
              if (oldestTx) {
                fetchTransactionHistory(oldestTx.signature);
              }
            }}
            className="px-6 py-3 text-sm font-medium backdrop-blur-xl bg-purple-500/20 border border-purple-500/50 rounded-2xl text-purple-300 hover:bg-purple-500/30 hover:border-purple-500/70 transition-all"
          >
            Load Older Transactions
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Fetch transactions before {new Date(transactions[transactions.length - 1]?.timestamp).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}
