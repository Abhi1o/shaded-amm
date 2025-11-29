'use client';

import { usePortfolio } from '@/hooks/usePortfolio';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useWalletStore } from '@/stores/walletStore';
import { ArrowUpIcon, ArrowDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export function PortfolioDashboard() {
  const { isConnected } = useWalletStore();
  const { portfolio, loading } = usePortfolioStore();
  const { fetchPortfolio, exportPortfolio } = usePortfolio();

  if (!isConnected) {
    return (
      <div className="w-full p-8 text-center">
        <p className="text-gray-500">Connect your wallet to view your portfolio</p>
      </div>
    );
  }

  const formatSolAmount = (lamports: bigint) => {
    const sol = Number(lamports) / 1e9;
    return sol.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 9,
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

  const performance = portfolio?.performance;
  const isPositive = performance && performance.change24hPercent >= 0;

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold">Portfolio</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => fetchPortfolio()}
            disabled={loading}
            className="inline-flex items-center px-3 sm:px-4 py-2 border border-gray-300 rounded-md shadow-sm text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 touch-manipulation"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => exportPortfolio('csv')}
            disabled={!portfolio}
            className="px-3 sm:px-4 py-2 border border-gray-300 rounded-md shadow-sm text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 touch-manipulation"
          >
            Export CSV
          </button>
          <button
            onClick={() => exportPortfolio('json')}
            disabled={!portfolio}
            className="px-3 sm:px-4 py-2 border border-gray-300 rounded-md shadow-sm text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 touch-manipulation"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
        {/* Total Value */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="text-xs sm:text-sm font-medium text-gray-500 mb-2">Total Value</div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
            {portfolio ? formatSolAmount(portfolio.totalValue) : '0.00'} SOL
          </div>
          {portfolio?.totalValueUsd && (
            <div className="text-xs sm:text-sm text-gray-500 mt-1">
              {formatUsd(portfolio.totalValueUsd)}
            </div>
          )}
          {performance && (
            <div className="flex items-center mt-2">
              {isPositive ? (
                <ArrowUpIcon className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 mr-1" />
              ) : (
                <ArrowDownIcon className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 mr-1" />
              )}
              <span className={`text-xs sm:text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(performance.change24hPercent).toFixed(2)}% (24h)
              </span>
            </div>
          )}
        </div>

        {/* SOL Balance */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="text-xs sm:text-sm font-medium text-gray-500 mb-2">SOL Balance</div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
            {portfolio ? formatSolAmount(portfolio.solBalance) : '0.00'}
          </div>
          {portfolio?.solValueUsd && (
            <div className="text-xs sm:text-sm text-gray-500 mt-1">
              {formatUsd(portfolio.solValueUsd)}
            </div>
          )}
        </div>

        {/* Assets Count */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="text-xs sm:text-sm font-medium text-gray-500 mb-2">Assets</div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900">
            {portfolio ? portfolio.tokens.length + 1 : 0}
          </div>
          <div className="text-xs sm:text-sm text-gray-500 mt-1">
            {portfolio?.liquidityPositions.length || 0} LP positions
          </div>
        </div>
      </div>

      {/* Token Holdings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h3 className="text-base sm:text-lg font-medium text-gray-900">Token Holdings</h3>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          {!portfolio || portfolio.tokens.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-gray-500 text-sm sm:text-base">
              No tokens found
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Asset
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="hidden sm:table-cell px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value (SOL)
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value (USD)
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    24h Change
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* SOL Row */}
                <tr>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">SOL</div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm text-gray-900">
                    {formatSolAmount(portfolio.solBalance)}
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    -
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm text-gray-900">
                    {formatUsd(portfolio.solValueUsd)}
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                    -
                  </td>
                </tr>
                {/* Token Rows */}
                {portfolio.tokens.map((token, index) => (
                  <tr key={index}>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-xs sm:text-sm font-medium text-gray-900">
                          {token.token.symbol}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm text-gray-900">
                      {formatTokenAmount(token.balance, token.token.decimals)}
                    </td>
                    <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatSolAmount(token.value)}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm text-gray-900">
                      {formatUsd(token.valueUsd)}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-right text-sm">
                      {token.priceChange24h !== undefined ? (
                        <span
                          className={
                            token.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'
                          }
                        >
                          {token.priceChange24h >= 0 ? '+' : ''}
                          {token.priceChange24h.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Liquidity Positions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h3 className="text-base sm:text-lg font-medium text-gray-900">Liquidity Positions</h3>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          {!portfolio || portfolio.liquidityPositions.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-gray-500 text-sm sm:text-base">
              No liquidity positions found
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pool
                  </th>
                  <th className="hidden sm:table-cell px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Share
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value (SOL)
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value (USD)
                  </th>
                  <th className="hidden lg:table-cell px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fees Earned (24h)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {portfolio.liquidityPositions.map((position, index) => (
                  <tr key={index}>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">
                        {position.pool.tokenA.symbol}/{position.pool.tokenB.symbol}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {position.shareOfPool.toFixed(4)}%
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatSolAmount(position.value)}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm text-gray-900">
                      {formatUsd(position.valueUsd)}
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {position.feesEarned24h
                        ? formatSolAmount(position.feesEarned24h)
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
