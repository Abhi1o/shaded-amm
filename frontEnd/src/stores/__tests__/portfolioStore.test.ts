import { describe, it, expect, beforeEach } from 'vitest';
import { usePortfolioStore } from '../portfolioStore';
import { UserPortfolio, Token, Pool } from '@/types';
import { PublicKey } from '@solana/web3.js';

describe('portfolioStore', () => {
  const mockTokenSOL: Token = {
    mint: 'So11111111111111111111111111111111111111112',
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    isNative: true,
  };

  const mockTokenUSDC: Token = {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  };

  const mockTokenUSDT: Token = {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
  };

  const mockPublicKey = new PublicKey('11111111111111111111111111111111');

  const createMockPool = (): Pool => ({
    id: 'pool-1',
    programId: 'test-program',
    tokenA: mockTokenUSDC,
    tokenB: mockTokenUSDT,
    tokenAAccount: mockPublicKey,
    tokenBAccount: mockPublicKey,
    lpTokenMint: mockPublicKey,
    reserveA: BigInt('1000000000'),
    reserveB: BigInt('1000000000'),
    totalLiquidity: BigInt('2000000000'),
    lpTokenSupply: BigInt('1000000'),
    volume24h: BigInt('5000000000'),
    fees24h: BigInt('1250000'),
    feeRate: 0.25,
    isActive: true,
    createdAt: Date.now() - 86400000,
    lastUpdated: Date.now(),
    ammType: 'constant_product',
  });

  const createMockPortfolio = (overrides?: Partial<UserPortfolio>): UserPortfolio => ({
    totalValue: BigInt('5000000000'),
    totalValueUsd: 500,
    solBalance: BigInt('2000000000'),
    solValueUsd: 200,
    tokens: [
      {
        token: mockTokenUSDC,
        balance: BigInt('100000000'),
        tokenAccount: mockPublicKey,
        value: BigInt('2000000000'),
        valueUsd: 200,
        priceChange24h: 0.5,
      },
      {
        token: mockTokenUSDT,
        balance: BigInt('100000000'),
        tokenAccount: mockPublicKey,
        value: BigInt('1000000000'),
        valueUsd: 100,
        priceChange24h: -0.2,
      },
    ],
    liquidityPositions: [
      {
        pool: createMockPool(),
        lpTokenBalance: BigInt('50000'),
        lpTokenAccount: mockPublicKey,
        shareOfPool: 5.0,
        tokenAAmount: BigInt('50000000'),
        tokenBAmount: BigInt('50000000'),
        value: BigInt('100000000'),
        valueUsd: 10,
        feesEarned24h: BigInt('62500'),
      },
    ],
    performance: {
      change24h: BigInt('100000000'),
      change24hPercent: 2.0,
      change7d: BigInt('500000000'),
      change7dPercent: 10.0,
    },
    lastUpdated: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    // Reset store state
    usePortfolioStore.setState({
      portfolio: null,
      loading: false,
      error: null,
      lastUpdated: null,
      portfolioHistory: [],
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = usePortfolioStore.getState();

      expect(state.portfolio).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastUpdated).toBeNull();
      expect(state.portfolioHistory).toEqual([]);
    });
  });

  describe('portfolio management', () => {
    it('should set portfolio', () => {
      const { setPortfolio } = usePortfolioStore.getState();
      const portfolio = createMockPortfolio();
      const beforeTime = Date.now();

      setPortfolio(portfolio);

      const state = usePortfolioStore.getState();
      expect(state.portfolio).toEqual(portfolio);
      expect(state.lastUpdated).toBeGreaterThanOrEqual(beforeTime);
      expect(state.error).toBeNull();
    });

    it('should update portfolio value', () => {
      const { setPortfolio, updatePortfolioValue } = usePortfolioStore.getState();
      const portfolio = createMockPortfolio();

      setPortfolio(portfolio);
      updatePortfolioValue(BigInt('6000000000'), 600);

      const state = usePortfolioStore.getState();
      expect(state.portfolio?.totalValue).toBe(BigInt('6000000000'));
      expect(state.portfolio?.totalValueUsd).toBe(600);
    });

    it('should not update portfolio value if portfolio is null', () => {
      const { updatePortfolioValue } = usePortfolioStore.getState();

      updatePortfolioValue(BigInt('6000000000'), 600);

      const state = usePortfolioStore.getState();
      expect(state.portfolio).toBeNull();
    });

    it('should clear portfolio', () => {
      const { setPortfolio, clearPortfolio } = usePortfolioStore.getState();
      const portfolio = createMockPortfolio();

      setPortfolio(portfolio);
      clearPortfolio();

      const state = usePortfolioStore.getState();
      expect(state.portfolio).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastUpdated).toBeNull();
      expect(state.portfolioHistory).toEqual([]);
    });
  });

  describe('loading and error states', () => {
    it('should set loading state', () => {
      const { setLoading } = usePortfolioStore.getState();

      setLoading(true);
      expect(usePortfolioStore.getState().loading).toBe(true);

      setLoading(false);
      expect(usePortfolioStore.getState().loading).toBe(false);
    });

    it('should set error state and stop loading', () => {
      const { setLoading, setError } = usePortfolioStore.getState();

      setLoading(true);
      setError('Failed to fetch portfolio');

      const state = usePortfolioStore.getState();
      expect(state.error).toBe('Failed to fetch portfolio');
      expect(state.loading).toBe(false);
    });

    it('should clear error when setting portfolio', () => {
      const { setError, setPortfolio } = usePortfolioStore.getState();
      const portfolio = createMockPortfolio();

      setError('Previous error');
      setPortfolio(portfolio);

      const state = usePortfolioStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('historical data', () => {
    it('should add historical data point', () => {
      const { addHistoricalData } = usePortfolioStore.getState();
      const timestamp = Date.now();
      const totalValue = BigInt('5000000000');

      addHistoricalData(timestamp, totalValue, 500);

      const state = usePortfolioStore.getState();
      expect(state.portfolioHistory).toHaveLength(1);
      expect(state.portfolioHistory[0]).toEqual({
        timestamp,
        totalValue,
        totalValueUsd: 500,
      });
    });

    it('should maintain maximum of 168 historical data points', () => {
      const { addHistoricalData } = usePortfolioStore.getState();

      // Add 200 data points
      for (let i = 0; i < 200; i++) {
        addHistoricalData(Date.now() + i * 1000, BigInt('5000000000'), 500);
      }

      const state = usePortfolioStore.getState();
      expect(state.portfolioHistory).toHaveLength(168);
    });

    it('should keep most recent historical data when limit exceeded', () => {
      const { addHistoricalData } = usePortfolioStore.getState();

      // Add 170 data points with incrementing timestamps
      for (let i = 0; i < 170; i++) {
        addHistoricalData(i * 1000, BigInt('5000000000'), 500);
      }

      const state = usePortfolioStore.getState();
      expect(state.portfolioHistory).toHaveLength(168);
      // Should have the last 168 entries (starting from index 2)
      expect(state.portfolioHistory[0].timestamp).toBe(2000);
      expect(state.portfolioHistory[167].timestamp).toBe(169000);
    });
  });

  describe('computed getters', () => {
    describe('getTotalValue', () => {
      it('should return total value from portfolio', () => {
        const { setPortfolio, getTotalValue } = usePortfolioStore.getState();
        const portfolio = createMockPortfolio();

        setPortfolio(portfolio);
        const totalValue = getTotalValue();

        expect(totalValue).toBe(BigInt('5000000000'));
      });

      it('should return 0 when portfolio is null', () => {
        const { getTotalValue } = usePortfolioStore.getState();

        const totalValue = getTotalValue();

        expect(totalValue).toBe(BigInt(0));
      });
    });

    describe('getTotalValueUsd', () => {
      it('should return USD value from portfolio', () => {
        const { setPortfolio, getTotalValueUsd } = usePortfolioStore.getState();
        const portfolio = createMockPortfolio();

        setPortfolio(portfolio);
        const totalValueUsd = getTotalValueUsd();

        expect(totalValueUsd).toBe(500);
      });

      it('should return undefined when portfolio is null', () => {
        const { getTotalValueUsd } = usePortfolioStore.getState();

        const totalValueUsd = getTotalValueUsd();

        expect(totalValueUsd).toBeUndefined();
      });

      it('should return undefined when USD value is not available', () => {
        const { setPortfolio, getTotalValueUsd } = usePortfolioStore.getState();
        const portfolio = createMockPortfolio({ totalValueUsd: undefined });

        setPortfolio(portfolio);
        const totalValueUsd = getTotalValueUsd();

        expect(totalValueUsd).toBeUndefined();
      });
    });

    describe('getTokenCount', () => {
      it('should return number of tokens in portfolio', () => {
        const { setPortfolio, getTokenCount } = usePortfolioStore.getState();
        const portfolio = createMockPortfolio();

        setPortfolio(portfolio);
        const tokenCount = getTokenCount();

        expect(tokenCount).toBe(2);
      });

      it('should return 0 when portfolio is null', () => {
        const { getTokenCount } = usePortfolioStore.getState();

        const tokenCount = getTokenCount();

        expect(tokenCount).toBe(0);
      });

      it('should return 0 when portfolio has no tokens', () => {
        const { setPortfolio, getTokenCount } = usePortfolioStore.getState();
        const portfolio = createMockPortfolio({ tokens: [] });

        setPortfolio(portfolio);
        const tokenCount = getTokenCount();

        expect(tokenCount).toBe(0);
      });
    });

    describe('getLiquidityPositionCount', () => {
      it('should return number of liquidity positions', () => {
        const { setPortfolio, getLiquidityPositionCount } = usePortfolioStore.getState();
        const portfolio = createMockPortfolio();

        setPortfolio(portfolio);
        const positionCount = getLiquidityPositionCount();

        expect(positionCount).toBe(1);
      });

      it('should return 0 when portfolio is null', () => {
        const { getLiquidityPositionCount } = usePortfolioStore.getState();

        const positionCount = getLiquidityPositionCount();

        expect(positionCount).toBe(0);
      });

      it('should return 0 when portfolio has no positions', () => {
        const { setPortfolio, getLiquidityPositionCount } = usePortfolioStore.getState();
        const portfolio = createMockPortfolio({ liquidityPositions: [] });

        setPortfolio(portfolio);
        const positionCount = getLiquidityPositionCount();

        expect(positionCount).toBe(0);
      });
    });

    describe('getPerformance24h', () => {
      it('should return 24h performance data', () => {
        const { setPortfolio, getPerformance24h } = usePortfolioStore.getState();
        const portfolio = createMockPortfolio();

        setPortfolio(portfolio);
        const performance = getPerformance24h();

        expect(performance).toEqual({
          change: BigInt('100000000'),
          changePercent: 2.0,
        });
      });

      it('should return null when portfolio is null', () => {
        const { getPerformance24h } = usePortfolioStore.getState();

        const performance = getPerformance24h();

        expect(performance).toBeNull();
      });

      it('should return null when performance data is not available', () => {
        const { setPortfolio, getPerformance24h } = usePortfolioStore.getState();
        const portfolio = createMockPortfolio({ performance: undefined });

        setPortfolio(portfolio);
        const performance = getPerformance24h();

        expect(performance).toBeNull();
      });
    });
  });

  describe('portfolio calculations', () => {
    it('should calculate total value correctly with SOL and tokens', () => {
      const { setPortfolio } = usePortfolioStore.getState();
      const portfolio = createMockPortfolio({
        solBalance: BigInt('2000000000'), // 2 SOL
        tokens: [
          {
            token: mockTokenUSDC,
            balance: BigInt('100000000'), // 100 USDC
            tokenAccount: mockPublicKey,
            value: BigInt('2000000000'), // 2 SOL equivalent
            valueUsd: 200,
          },
        ],
        totalValue: BigInt('4000000000'), // 4 SOL total
      });

      setPortfolio(portfolio);

      const state = usePortfolioStore.getState();
      expect(state.portfolio?.totalValue).toBe(BigInt('4000000000'));
      expect(state.portfolio?.solBalance).toBe(BigInt('2000000000'));
      expect(state.portfolio?.tokens[0].value).toBe(BigInt('2000000000'));
    });

    it('should track token price changes', () => {
      const { setPortfolio } = usePortfolioStore.getState();
      const portfolio = createMockPortfolio();

      setPortfolio(portfolio);

      const state = usePortfolioStore.getState();
      expect(state.portfolio?.tokens[0].priceChange24h).toBe(0.5);
      expect(state.portfolio?.tokens[1].priceChange24h).toBe(-0.2);
    });

    it('should calculate liquidity position values', () => {
      const { setPortfolio } = usePortfolioStore.getState();
      const portfolio = createMockPortfolio();

      setPortfolio(portfolio);

      const state = usePortfolioStore.getState();
      const position = state.portfolio?.liquidityPositions[0];
      expect(position?.value).toBe(BigInt('100000000'));
      expect(position?.shareOfPool).toBe(5.0);
      expect(position?.feesEarned24h).toBe(BigInt('62500'));
    });

    it('should handle portfolio with no liquidity positions', () => {
      const { setPortfolio } = usePortfolioStore.getState();
      const portfolio = createMockPortfolio({ liquidityPositions: [] });

      setPortfolio(portfolio);

      const state = usePortfolioStore.getState();
      expect(state.portfolio?.liquidityPositions).toEqual([]);
      expect(usePortfolioStore.getState().getLiquidityPositionCount()).toBe(0);
    });
  });

  describe('portfolio value tracking', () => {
    it('should track portfolio value changes over time', () => {
      const { setPortfolio, updatePortfolioValue } = usePortfolioStore.getState();
      const portfolio = createMockPortfolio({ totalValue: BigInt('5000000000') });

      setPortfolio(portfolio);
      
      // Simulate value increase
      updatePortfolioValue(BigInt('5500000000'), 550);

      const state = usePortfolioStore.getState();
      expect(state.portfolio?.totalValue).toBe(BigInt('5500000000'));
      expect(state.portfolio?.totalValueUsd).toBe(550);
    });

    it('should maintain performance metrics', () => {
      const { setPortfolio } = usePortfolioStore.getState();
      const portfolio = createMockPortfolio({
        performance: {
          change24h: BigInt('200000000'),
          change24hPercent: 4.0,
          change7d: BigInt('800000000'),
          change7dPercent: 16.0,
        },
      });

      setPortfolio(portfolio);

      const state = usePortfolioStore.getState();
      expect(state.portfolio?.performance?.change24h).toBe(BigInt('200000000'));
      expect(state.portfolio?.performance?.change24hPercent).toBe(4.0);
      expect(state.portfolio?.performance?.change7d).toBe(BigInt('800000000'));
      expect(state.portfolio?.performance?.change7dPercent).toBe(16.0);
    });
  });

  describe('SPL token handling', () => {
    it('should track multiple SPL token balances', () => {
      const { setPortfolio } = usePortfolioStore.getState();
      const portfolio = createMockPortfolio();

      setPortfolio(portfolio);

      const state = usePortfolioStore.getState();
      expect(state.portfolio?.tokens).toHaveLength(2);
      expect(state.portfolio?.tokens[0].token.symbol).toBe('USDC');
      expect(state.portfolio?.tokens[1].token.symbol).toBe('USDT');
    });

    it('should calculate individual token values in SOL', () => {
      const { setPortfolio } = usePortfolioStore.getState();
      const portfolio = createMockPortfolio();

      setPortfolio(portfolio);

      const state = usePortfolioStore.getState();
      expect(state.portfolio?.tokens[0].value).toBe(BigInt('2000000000'));
      expect(state.portfolio?.tokens[1].value).toBe(BigInt('1000000000'));
    });

    it('should handle tokens without USD values', () => {
      const { setPortfolio } = usePortfolioStore.getState();
      const portfolio = createMockPortfolio({
        tokens: [
          {
            token: mockTokenUSDC,
            balance: BigInt('100000000'),
            tokenAccount: mockPublicKey,
            value: BigInt('2000000000'),
            valueUsd: undefined,
          },
        ],
      });

      setPortfolio(portfolio);

      const state = usePortfolioStore.getState();
      expect(state.portfolio?.tokens[0].valueUsd).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle portfolio with zero values', () => {
      const { setPortfolio } = usePortfolioStore.getState();
      const portfolio = createMockPortfolio({
        totalValue: BigInt(0),
        solBalance: BigInt(0),
        tokens: [],
        liquidityPositions: [],
      });

      setPortfolio(portfolio);

      const state = usePortfolioStore.getState();
      expect(state.portfolio?.totalValue).toBe(BigInt(0));
      expect(usePortfolioStore.getState().getTotalValue()).toBe(BigInt(0));
      expect(usePortfolioStore.getState().getTokenCount()).toBe(0);
    });

    it('should handle very large BigInt values', () => {
      const { setPortfolio } = usePortfolioStore.getState();
      const largeValue = BigInt('999999999999999999');
      const portfolio = createMockPortfolio({ totalValue: largeValue });

      setPortfolio(portfolio);

      const state = usePortfolioStore.getState();
      expect(state.portfolio?.totalValue).toBe(largeValue);
    });

    it('should handle negative performance changes', () => {
      const { setPortfolio } = usePortfolioStore.getState();
      const portfolio = createMockPortfolio({
        performance: {
          change24h: BigInt('-100000000'),
          change24hPercent: -2.0,
          change7d: BigInt('-500000000'),
          change7dPercent: -10.0,
        },
      });

      setPortfolio(portfolio);

      const performance = usePortfolioStore.getState().getPerformance24h();
      expect(performance?.change).toBe(BigInt('-100000000'));
      expect(performance?.changePercent).toBe(-2.0);
    });
  });
});
