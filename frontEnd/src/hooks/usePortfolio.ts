import { useEffect, useCallback, useRef } from 'react';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useWalletStore } from '@/stores/walletStore';
import { useSolanaConnection } from './useSolanaConnection';
import { UserPortfolio, Token } from '@/types';
import { PublicKey } from '@solana/web3.js';

interface UsePortfolioOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function usePortfolio(options: UsePortfolioOptions = {}) {
  const { autoRefresh = true, refreshInterval = 45000 } = options; // Increased from 30s to 45s
  const { connection } = useSolanaConnection();
  const { address, isConnected, tokenAccounts, solBalance } = useWalletStore();
  const {
    portfolio,
    loading,
    error,
    setPortfolio,
    setLoading,
    setError,
    addHistoricalData,
    clearPortfolio,
  } = usePortfolioStore();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch token metadata from Solana token registry
  const fetchTokenMetadata = useCallback(async (mintAddress: string): Promise<Token> => {
    try {
      // Try to fetch from Jupiter token list API
      const response = await fetch(`https://token.jup.ag/strict`);
      if (response.ok) {
        const tokens = await response.json();
        const tokenInfo = tokens.find((t: any) => t.address === mintAddress);
        
        if (tokenInfo) {
          return {
            mint: mintAddress,
            address: mintAddress,
            symbol: tokenInfo.symbol || 'UNKNOWN',
            name: tokenInfo.name || 'Unknown Token',
            decimals: tokenInfo.decimals || 9,
            logoURI: tokenInfo.logoURI,
          };
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch metadata for ${mintAddress}:`, error);
    }

    // Fallback to basic info
    return {
      mint: mintAddress,
      address: mintAddress,
      symbol: mintAddress.slice(0, 4) + '...' + mintAddress.slice(-4),
      name: 'Unknown Token',
      decimals: 9,
    };
  }, []);

  // Fetch token prices from Jupiter
  const fetchTokenPrices = useCallback(async (mints: string[]): Promise<Record<string, number>> => {
    if (mints.length === 0) return {};

    try {
      const mintList = mints.join(',');
      const response = await fetch(`https://price.jup.ag/v4/price?ids=${mintList}`);
      
      if (response.ok) {
        const data = await response.json();
        const prices: Record<string, number> = {};
        
        Object.entries(data.data || {}).forEach(([mint, priceData]: [string, any]) => {
          if (priceData && typeof priceData.price === 'number') {
            prices[mint] = priceData.price;
          }
        });
        
        return prices;
      }
    } catch (error) {
      console.warn('Failed to fetch token prices:', error);
    }

    return {};
  }, []);

  // Fetch portfolio data
  const fetchPortfolio = useCallback(async () => {
    if (!connection || !address || !isConnected) {
      clearPortfolio();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Fetching portfolio for:', address);
      console.log('Token accounts:', tokenAccounts.length);

      // Calculate total SOL value
      const totalSolValue = solBalance;

      // Fetch token metadata and prices
      const mints = tokenAccounts.map(account => account.mint.toString());
      const [tokenMetadataList, prices] = await Promise.all([
        Promise.all(mints.map(mint => fetchTokenMetadata(mint))),
        fetchTokenPrices([...mints, 'So11111111111111111111111111111111111111112']), // Include SOL
      ]);

      // Map token accounts to portfolio tokens
      const tokens = tokenAccounts.map((account, index) => {
        const token = tokenMetadataList[index];
        const mint = account.mint.toString();
        const price = prices[mint] || 0;
        const balance = account.amount;
        const balanceNumber = Number(balance) / Math.pow(10, account.decimals);
        const valueUsd = price * balanceNumber;
        const valueSol = price > 0 ? BigInt(Math.floor((valueUsd / (prices['So11111111111111111111111111111111111111112'] || 1)) * 1e9)) : BigInt(0);

        return {
          token,
          balance,
          tokenAccount: account.address,
          value: valueSol,
          valueUsd,
          priceChange24h: undefined, // Would need historical price data
        };
      });

      // Calculate SOL value in USD
      const solPrice = prices['So11111111111111111111111111111111111111112'] || 0;
      const solBalanceNumber = Number(totalSolValue) / 1e9;
      const solValueUsd = solPrice * solBalanceNumber;

      // TODO: Fetch liquidity positions from AMM programs
      const liquidityPositions: UserPortfolio['liquidityPositions'] = [];

      // Calculate total portfolio value
      const totalValue = totalSolValue + tokens.reduce((sum, t) => sum + t.value, BigInt(0));
      const totalValueUsd = solValueUsd + tokens.reduce((sum, t) => sum + (t.valueUsd || 0), 0);

      const portfolioData: UserPortfolio = {
        totalValue,
        totalValueUsd,
        solBalance: totalSolValue,
        solValueUsd,
        tokens,
        liquidityPositions,
        lastUpdated: Date.now(),
      };

      console.log('Portfolio data:', {
        totalValue: totalValue.toString(),
        totalValueUsd,
        tokenCount: tokens.length,
      });

      setPortfolio(portfolioData);
      addHistoricalData(Date.now(), totalValue, totalValueUsd);
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch portfolio');
    } finally {
      setLoading(false);
    }
  }, [
    connection,
    address,
    isConnected,
    solBalance,
    tokenAccounts,
    fetchTokenMetadata,
    fetchTokenPrices,
    setPortfolio,
    setLoading,
    setError,
    addHistoricalData,
    clearPortfolio,
  ]);

  // Fetch liquidity positions
  const fetchLiquidityPositions = useCallback(async () => {
    if (!connection || !address) return [];

    try {
      // TODO: Implement fetching liquidity positions from AMM programs
      // This would involve:
      // 1. Finding all LP token accounts owned by the user
      // 2. Fetching pool data for each LP token
      // 3. Calculating position value and earnings
      return [];
    } catch (error) {
      console.error('Failed to fetch liquidity positions:', error);
      return [];
    }
  }, [connection, address]);

  // Calculate portfolio performance
  const calculatePerformance = useCallback(() => {
    // TODO: Implement performance calculation using historical data
    // This would compare current value to past values
    return null;
  }, []);

  // Export portfolio data for tax reporting
  const exportPortfolio = useCallback(
    (format: 'csv' | 'json' = 'csv') => {
      if (!portfolio) return;

      if (format === 'json') {
        const data = JSON.stringify(portfolio, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        );
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `portfolio-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // CSV format
        const headers = ['Asset', 'Balance', 'Value (SOL)', 'Value (USD)'];
        const rows = [
          ['SOL', (Number(portfolio.solBalance) / 1e9).toString(), '-', portfolio.solValueUsd?.toString() || '-'],
          ...portfolio.tokens.map((t) => [
            t.token.symbol,
            (Number(t.balance) / Math.pow(10, t.token.decimals)).toString(),
            (Number(t.value) / 1e9).toString(),
            t.valueUsd?.toString() || '-',
          ]),
        ];

        const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `portfolio-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    [portfolio]
  );

  // Set up auto-refresh
  useEffect(() => {
    if (!autoRefresh || !isConnected) return;

    // Initial fetch
    fetchPortfolio();

    // Set up interval
    intervalRef.current = setInterval(() => {
      fetchPortfolio();
    }, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, isConnected, refreshInterval, fetchPortfolio]);

  // Clear portfolio when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      clearPortfolio();
    }
  }, [isConnected, clearPortfolio]);

  return {
    portfolio,
    loading,
    error,
    fetchPortfolio,
    fetchLiquidityPositions,
    calculatePerformance,
    exportPortfolio,
  };
}
