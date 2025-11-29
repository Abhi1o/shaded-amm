import { create } from 'zustand';
import { UserPortfolio } from '@/types';

interface PortfolioStore {
  portfolio: UserPortfolio | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  
  // Historical data for charts
  portfolioHistory: Array<{
    timestamp: number;
    totalValue: bigint;
    totalValueUsd?: number;
  }>;
  
  // Actions
  setPortfolio: (portfolio: UserPortfolio) => void;
  updatePortfolioValue: (totalValue: bigint, totalValueUsd?: number) => void;
  addHistoricalData: (timestamp: number, totalValue: bigint, totalValueUsd?: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearPortfolio: () => void;
  
  // Computed getters
  getTotalValue: () => bigint;
  getTotalValueUsd: () => number | undefined;
  getTokenCount: () => number;
  getLiquidityPositionCount: () => number;
  getPerformance24h: () => { change: bigint; changePercent: number } | null;
}

export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
  portfolio: null,
  loading: false,
  error: null,
  lastUpdated: null,
  portfolioHistory: [],
  
  setPortfolio: (portfolio) => set({
    portfolio,
    lastUpdated: Date.now(),
    error: null,
  }),
  
  updatePortfolioValue: (totalValue, totalValueUsd) => set((state) => {
    if (!state.portfolio) return state;
    
    return {
      portfolio: {
        ...state.portfolio,
        totalValue,
        totalValueUsd,
        lastUpdated: Date.now(),
      },
      lastUpdated: Date.now(),
    };
  }),
  
  addHistoricalData: (timestamp, totalValue, totalValueUsd) => set((state) => ({
    portfolioHistory: [
      ...state.portfolioHistory,
      { timestamp, totalValue, totalValueUsd },
    ].slice(-168), // Keep last 7 days of hourly data
  })),
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error, loading: false }),
  
  clearPortfolio: () => set({
    portfolio: null,
    loading: false,
    error: null,
    lastUpdated: null,
    portfolioHistory: [],
  }),
  
  getTotalValue: () => {
    const { portfolio } = get();
    return portfolio?.totalValue || BigInt(0);
  },
  
  getTotalValueUsd: () => {
    const { portfolio } = get();
    return portfolio?.totalValueUsd;
  },
  
  getTokenCount: () => {
    const { portfolio } = get();
    return portfolio?.tokens.length || 0;
  },
  
  getLiquidityPositionCount: () => {
    const { portfolio } = get();
    return portfolio?.liquidityPositions.length || 0;
  },
  
  getPerformance24h: () => {
    const { portfolio } = get();
    if (!portfolio?.performance) return null;
    
    return {
      change: portfolio.performance.change24h,
      changePercent: portfolio.performance.change24hPercent,
    };
  },
}));
