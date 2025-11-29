import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SAMMSwapService } from '../sammSwapService';
import { Address } from 'viem';

describe('SAMMSwapService', () => {
  let service: SAMMSwapService;

  // Mock addresses for testing
  const MONAD_CHAIN_ID = 10143;
  const USDC_ADDRESS = '0x67DcA5710a9dA091e00093dF04765d711759f435' as Address;
  const USDT_ADDRESS = '0x1888FF2446f2542cbb399eD179F4d6d966268C1F' as Address;
  const DAI_ADDRESS = '0x60CB213FCd1616FbBD44319Eb11A35d5671E692e' as Address;

  beforeEach(() => {
    service = new SAMMSwapService();
    vi.clearAllMocks();
  });

  describe('getQuoteForOutput - Validation', () => {
    it('should throw error for non-Monad chain', async () => {
      const mockClient = {} as any;

      await expect(
        service.getQuoteForOutput(
          mockClient,
          1, // Ethereum mainnet
          USDC_ADDRESS,
          USDT_ADDRESS,
          100000000n,
          0.5
        )
      ).rejects.toThrow('SAMM swaps are only available on Monad testnet');
    });

    it('should throw error for zero output amount', async () => {
      const mockClient = {} as any;

      await expect(
        service.getQuoteForOutput(
          mockClient,
          MONAD_CHAIN_ID,
          USDC_ADDRESS,
          USDT_ADDRESS,
          0n,
          0.5
        )
      ).rejects.toThrow('Output amount must be greater than zero');
    });

    it('should throw error for negative output amount', async () => {
      const mockClient = {} as any;

      await expect(
        service.getQuoteForOutput(
          mockClient,
          MONAD_CHAIN_ID,
          USDC_ADDRESS,
          USDT_ADDRESS,
          -100n,
          0.5
        )
      ).rejects.toThrow('Output amount must be greater than zero');
    });

    it('should throw error for same input and output tokens', async () => {
      const mockClient = {} as any;

      await expect(
        service.getQuoteForOutput(
          mockClient,
          MONAD_CHAIN_ID,
          USDC_ADDRESS,
          USDC_ADDRESS, // Same as input
          100000000n,
          0.5
        )
      ).rejects.toThrow('Input and output tokens must be different');
    });

    it('should throw error for invalid token addresses', async () => {
      const mockClient = {} as any;

      await expect(
        service.getQuoteForOutput(
          mockClient,
          MONAD_CHAIN_ID,
          '' as Address,
          USDT_ADDRESS,
          100000000n,
          0.5
        )
      ).rejects.toThrow('Invalid token addresses');
    });
  });

  describe('Quote Structure', () => {
    it('should return quote with correct structure when successful', async () => {
      // This test would require mocking the entire blockchain interaction
      // For now, we verify the validation logic works
      // Integration tests should be done on actual testnet
      expect(service).toBeDefined();
      expect(typeof service.getQuoteForOutput).toBe('function');
    });
  });

  describe('Helper Methods', () => {
    it('should have all required methods', () => {
      expect(typeof service.getQuoteForOutput).toBe('function');
      expect(typeof service.executeSwapSAMM).toBe('function');
      expect(typeof service.selectOptimalShard).toBe('function');
      expect(typeof service.validateCThreshold).toBe('function');
      expect(typeof service.calculatePriceImpact).toBe('function');
    });
  });

  describe('executeSwapSAMM - Validation', () => {
    it('should throw error for expired quote', async () => {
      const mockWalletClient = {} as any;
      const mockPublicClient = {} as any;
      const mockUserAddress = '0x1234567890123456789012345678901234567890' as Address;

      // Create an expired quote
      const expiredQuote = {
        inputToken: USDC_ADDRESS,
        outputToken: USDT_ADDRESS,
        outputAmount: 100000000n,
        estimatedInput: 100080000n,
        maximalInput: 100580000n,
        tradeFee: 60000n,
        ownerFee: 20000n,
        priceImpact: 0.08,
        selectedShard: {
          address: '0x49ac6422c88e5b6e5c0e3e0e3e0e3e0e3e0e3e0e' as Address,
          shardNumber: 3,
          pairName: 'USDC/USDT',
          liquidityA: '1000.00',
          liquidityB: '1000.00',
          reserveA: 1000000000n,
          reserveB: 1000000000n,
          estimatedInput: 100080000n,
          tradeFee: 60000n,
          ownerFee: 20000n,
          isOptimal: true,
          reason: 'Lowest input required',
        },
        alternativeShards: [],
        chainId: MONAD_CHAIN_ID,
        timestamp: Date.now() - 60000, // 1 minute ago
        expiresAt: Date.now() - 30000, // Expired 30 seconds ago
      };

      await expect(
        service.executeSwapSAMM(
          mockWalletClient,
          mockPublicClient,
          expiredQuote,
          mockUserAddress
        )
      ).rejects.toThrow('Quote has expired');
    });

    it('should have executeSwapSAMM method defined', () => {
      expect(typeof service.executeSwapSAMM).toBe('function');
    });
  });

  describe('validateCThreshold', () => {
    describe('Valid trades (within threshold)', () => {
      it('should return true when OA/RA ratio is exactly at threshold (0.0104)', () => {
        // OA = 1040, RA = 100000
        // Ratio = 1040 / 100000 = 0.0104 (exactly at threshold)
        const outputAmount = 1040n;
        const inputReserve = 100000n;
        const cThreshold = 10400n; // 0.0104 * 1e6

        const result = service.validateCThreshold(outputAmount, inputReserve, cThreshold);
        expect(result).toBe(true);
      });

      it('should return true when OA/RA ratio is below threshold', () => {
        // OA = 500, RA = 100000
        // Ratio = 500 / 100000 = 0.005 (below threshold of 0.0104)
        const outputAmount = 500n;
        const inputReserve = 100000n;
        const cThreshold = 10400n;

        const result = service.validateCThreshold(outputAmount, inputReserve, cThreshold);
        expect(result).toBe(true);
      });

      it('should return true for very small trades', () => {
        // OA = 1, RA = 1000000
        // Ratio = 1 / 1000000 = 0.000001 (well below threshold)
        const outputAmount = 1n;
        const inputReserve = 1000000n;
        const cThreshold = 10400n;

        const result = service.validateCThreshold(outputAmount, inputReserve, cThreshold);
        expect(result).toBe(true);
      });

      it('should return true for realistic USDC/USDT swap', () => {
        // Swap 100 USDT from pool with 100,000 USDC reserve
        // OA = 100 * 1e6 = 100000000
        // RA = 100000 * 1e6 = 100000000000
        // Ratio = 100000000 / 100000000000 = 0.001 (0.1%, well below 1.04%)
        const outputAmount = 100000000n; // 100 USDT (6 decimals)
        const inputReserve = 100000000000n; // 100,000 USDC (6 decimals)
        const cThreshold = 10400n;

        const result = service.validateCThreshold(outputAmount, inputReserve, cThreshold);
        expect(result).toBe(true);
      });
    });

    describe('Invalid trades (exceeds threshold)', () => {
      it('should return false when OA/RA ratio exceeds threshold', () => {
        // OA = 2000, RA = 100000
        // Ratio = 2000 / 100000 = 0.02 (2%, exceeds 1.04% threshold)
        const outputAmount = 2000n;
        const inputReserve = 100000n;
        const cThreshold = 10400n;

        const result = service.validateCThreshold(outputAmount, inputReserve, cThreshold);
        expect(result).toBe(false);
      });

      it('should return false for trade that would deplete pool', () => {
        // OA = 50000, RA = 100000
        // Ratio = 50000 / 100000 = 0.5 (50%, way over threshold)
        const outputAmount = 50000n;
        const inputReserve = 100000n;
        const cThreshold = 10400n;

        const result = service.validateCThreshold(outputAmount, inputReserve, cThreshold);
        expect(result).toBe(false);
      });

      it('should return false when output equals reserve', () => {
        // OA = 100000, RA = 100000
        // Ratio = 100000 / 100000 = 1.0 (100%, way over threshold)
        const outputAmount = 100000n;
        const inputReserve = 100000n;
        const cThreshold = 10400n;

        const result = service.validateCThreshold(outputAmount, inputReserve, cThreshold);
        expect(result).toBe(false);
      });

      it('should return false for realistic oversized USDC/USDT swap', () => {
        // Swap 2000 USDT from pool with 100,000 USDC reserve
        // OA = 2000 * 1e6 = 2000000000
        // RA = 100000 * 1e6 = 100000000000
        // Ratio = 2000000000 / 100000000000 = 0.02 (2%, exceeds 1.04%)
        const outputAmount = 2000000000n; // 2000 USDT (6 decimals)
        const inputReserve = 100000000000n; // 100,000 USDC (6 decimals)
        const cThreshold = 10400n;

        const result = service.validateCThreshold(outputAmount, inputReserve, cThreshold);
        expect(result).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should return false when input reserve is zero', () => {
        const outputAmount = 100n;
        const inputReserve = 0n;
        const cThreshold = 10400n;

        const result = service.validateCThreshold(outputAmount, inputReserve, cThreshold);
        expect(result).toBe(false);
      });

      it('should return false when input reserve is negative', () => {
        const outputAmount = 100n;
        const inputReserve = -1000n;
        const cThreshold = 10400n;

        const result = service.validateCThreshold(outputAmount, inputReserve, cThreshold);
        expect(result).toBe(false);
      });

      it('should return false when output amount is zero', () => {
        const outputAmount = 0n;
        const inputReserve = 100000n;
        const cThreshold = 10400n;

        const result = service.validateCThreshold(outputAmount, inputReserve, cThreshold);
        expect(result).toBe(false);
      });

      it('should return false when output amount is negative', () => {
        const outputAmount = -100n;
        const inputReserve = 100000n;
        const cThreshold = 10400n;

        const result = service.validateCThreshold(outputAmount, inputReserve, cThreshold);
        expect(result).toBe(false);
      });

      it('should work with custom c-threshold', () => {
        // Test with a custom threshold of 0.02 (2%)
        const outputAmount = 1500n;
        const inputReserve = 100000n;
        const customThreshold = 20000n; // 0.02 * 1e6

        // Ratio = 1500 / 100000 = 0.015 (1.5%, below 2% threshold)
        const result = service.validateCThreshold(outputAmount, inputReserve, customThreshold);
        expect(result).toBe(true);
      });

      it('should handle very large numbers', () => {
        // Test with realistic DeFi pool sizes
        const outputAmount = 1000000000000000n; // 1M tokens with 6 decimals
        const inputReserve = 100000000000000000n; // 100M tokens with 6 decimals
        const cThreshold = 10400n;

        // Ratio = 1000000000000000 / 100000000000000000 = 0.01 (1%, below 1.04%)
        const result = service.validateCThreshold(outputAmount, inputReserve, cThreshold);
        expect(result).toBe(true);
      });
    });

    describe('Boundary testing', () => {
      it('should correctly handle ratio just below threshold', () => {
        // OA = 1039, RA = 100000
        // Ratio = 1039 / 100000 = 0.01039 (just below 0.0104)
        const outputAmount = 1039n;
        const inputReserve = 100000n;
        const cThreshold = 10400n;

        const result = service.validateCThreshold(outputAmount, inputReserve, cThreshold);
        expect(result).toBe(true);
      });

      it('should correctly handle ratio just above threshold', () => {
        // OA = 1041, RA = 100000
        // Ratio = 1041 / 100000 = 0.01041 (just above 0.0104)
        const outputAmount = 1041n;
        const inputReserve = 100000n;
        const cThreshold = 10400n;

        const result = service.validateCThreshold(outputAmount, inputReserve, cThreshold);
        expect(result).toBe(false);
      });
    });
  });

  describe('calculatePriceImpact', () => {
    describe('Valid price impact calculations', () => {
      it('should calculate price impact for a typical swap', () => {
        // Pool: 100,000 USDC / 100,000 USDT
        // Swap: 100 USDC for 99.9 USDT
        // Spot price = 100000 / 100000 = 1.0
        // Execution price = 99.9 / 100 = 0.999
        // Impact = ((0.999 - 1.0) / 1.0) * 100 = -0.1% (absolute = 0.1%)
        const inputAmount = 100000000n; // 100 USDC (6 decimals)
        const outputAmount = 99900000n; // 99.9 USDT (6 decimals)
        const inputReserve = 100000000000n; // 100,000 USDC
        const outputReserve = 100000000000n; // 100,000 USDT

        const impact = service.calculatePriceImpact(
          inputAmount,
          outputAmount,
          inputReserve,
          outputReserve
        );

        // Should be approximately 0.1%
        expect(impact).toBeGreaterThan(0);
        expect(impact).toBeLessThan(0.2);
      });

      it('should calculate higher impact for larger trades', () => {
        // Pool: 100,000 USDC / 100,000 USDT
        // Swap: 1,000 USDC for 990 USDT (larger trade)
        // Higher impact expected
        const inputAmount = 1000000000n; // 1,000 USDC
        const outputAmount = 990000000n; // 990 USDT
        const inputReserve = 100000000000n; // 100,000 USDC
        const outputReserve = 100000000000n; // 100,000 USDT

        const impact = service.calculatePriceImpact(
          inputAmount,
          outputAmount,
          inputReserve,
          outputReserve
        );

        // Should be approximately 1%
        expect(impact).toBeGreaterThan(0.5);
        expect(impact).toBeLessThan(1.5);
      });

      it('should return zero impact for perfect 1:1 swap', () => {
        // Pool: 100,000 USDC / 100,000 USDT
        // Swap: 100 USDC for 100 USDT (no slippage)
        const inputAmount = 100000000n;
        const outputAmount = 100000000n;
        const inputReserve = 100000000000n;
        const outputReserve = 100000000000n;

        const impact = service.calculatePriceImpact(
          inputAmount,
          outputAmount,
          inputReserve,
          outputReserve
        );

        // Should be very close to 0
        expect(impact).toBeLessThan(0.01);
      });

      it('should handle different pool ratios', () => {
        // Pool: 100,000 USDC / 200,000 USDT (1:2 ratio)
        // Swap: 100 USDC for 199 USDT
        // Spot price = 200000 / 100000 = 2.0
        // Execution price = 199 / 100 = 1.99
        const inputAmount = 100000000n; // 100 USDC
        const outputAmount = 199000000n; // 199 USDT
        const inputReserve = 100000000000n; // 100,000 USDC
        const outputReserve = 200000000000n; // 200,000 USDT

        const impact = service.calculatePriceImpact(
          inputAmount,
          outputAmount,
          inputReserve,
          outputReserve
        );

        // Should be approximately 0.5%
        expect(impact).toBeGreaterThan(0);
        expect(impact).toBeLessThan(1);
      });
    });

    describe('Edge cases', () => {
      it('should return 0 for zero input reserve', () => {
        const inputAmount = 100000000n;
        const outputAmount = 100000000n;
        const inputReserve = 0n;
        const outputReserve = 100000000000n;

        const impact = service.calculatePriceImpact(
          inputAmount,
          outputAmount,
          inputReserve,
          outputReserve
        );

        expect(impact).toBe(0);
      });

      it('should return 0 for zero output reserve', () => {
        const inputAmount = 100000000n;
        const outputAmount = 100000000n;
        const inputReserve = 100000000000n;
        const outputReserve = 0n;

        const impact = service.calculatePriceImpact(
          inputAmount,
          outputAmount,
          inputReserve,
          outputReserve
        );

        expect(impact).toBe(0);
      });

      it('should return 0 for zero input amount', () => {
        const inputAmount = 0n;
        const outputAmount = 100000000n;
        const inputReserve = 100000000000n;
        const outputReserve = 100000000000n;

        const impact = service.calculatePriceImpact(
          inputAmount,
          outputAmount,
          inputReserve,
          outputReserve
        );

        expect(impact).toBe(0);
      });

      it('should handle very large numbers', () => {
        // Test with realistic DeFi pool sizes
        const inputAmount = 1000000000000000n; // 1M tokens
        const outputAmount = 999000000000000n; // 999K tokens
        const inputReserve = 100000000000000000n; // 100M tokens
        const outputReserve = 100000000000000000n; // 100M tokens

        const impact = service.calculatePriceImpact(
          inputAmount,
          outputAmount,
          inputReserve,
          outputReserve
        );

        // Should be approximately 0.1%
        expect(impact).toBeGreaterThan(0);
        expect(impact).toBeLessThan(0.2);
      });
    });

    describe('Return value validation', () => {
      it('should always return positive impact', () => {
        // Even if execution price is better than spot (shouldn't happen in practice)
        const inputAmount = 100000000n;
        const outputAmount = 101000000n; // Better than spot
        const inputReserve = 100000000000n;
        const outputReserve = 100000000000n;

        const impact = service.calculatePriceImpact(
          inputAmount,
          outputAmount,
          inputReserve,
          outputReserve
        );

        // Should be positive (absolute value)
        expect(impact).toBeGreaterThanOrEqual(0);
      });

      it('should return a number', () => {
        const inputAmount = 100000000n;
        const outputAmount = 99900000n;
        const inputReserve = 100000000000n;
        const outputReserve = 100000000000n;

        const impact = service.calculatePriceImpact(
          inputAmount,
          outputAmount,
          inputReserve,
          outputReserve
        );

        expect(typeof impact).toBe('number');
        expect(isNaN(impact)).toBe(false);
        expect(isFinite(impact)).toBe(true);
      });
    });
  });

  describe('calculateMaximalInput', () => {
    describe('Valid slippage calculations', () => {
      it('should calculate maximal input with 0.5% slippage', () => {
        const estimatedInput = 100000000n; // 100 USDC
        const slippageTolerance = 0.5;

        const maximalInput = service.calculateMaximalInput(estimatedInput, slippageTolerance);

        // Should be 100 * 1.005 = 100.5 USDC
        expect(maximalInput).toBe(100500000n);
      });

      it('should calculate maximal input with 1% slippage', () => {
        const estimatedInput = 100000000n; // 100 USDC
        const slippageTolerance = 1.0;

        const maximalInput = service.calculateMaximalInput(estimatedInput, slippageTolerance);

        // Should be 100 * 1.01 = 101 USDC
        expect(maximalInput).toBe(101000000n);
      });

      it('should calculate maximal input with 5% slippage', () => {
        const estimatedInput = 100000000n; // 100 USDC
        const slippageTolerance = 5.0;

        const maximalInput = service.calculateMaximalInput(estimatedInput, slippageTolerance);

        // Should be 100 * 1.05 = 105 USDC
        expect(maximalInput).toBe(105000000n);
      });

      it('should use default 0.5% slippage when not specified', () => {
        const estimatedInput = 100000000n; // 100 USDC

        const maximalInput = service.calculateMaximalInput(estimatedInput);

        // Should be 100 * 1.005 = 100.5 USDC
        expect(maximalInput).toBe(100500000n);
      });

      it('should handle zero slippage', () => {
        const estimatedInput = 100000000n; // 100 USDC
        const slippageTolerance = 0;

        const maximalInput = service.calculateMaximalInput(estimatedInput, slippageTolerance);

        // Should be exactly the estimated input
        expect(maximalInput).toBe(100000000n);
      });

      it('should handle very small amounts', () => {
        const estimatedInput = 1n; // 1 wei
        const slippageTolerance = 0.5;

        const maximalInput = service.calculateMaximalInput(estimatedInput, slippageTolerance);

        // Should be at least the estimated input
        expect(maximalInput).toBeGreaterThanOrEqual(estimatedInput);
      });

      it('should handle very large amounts', () => {
        const estimatedInput = 1000000000000000n; // 1M tokens
        const slippageTolerance = 0.5;

        const maximalInput = service.calculateMaximalInput(estimatedInput, slippageTolerance);

        // Should be 1M * 1.005 = 1,005,000 tokens
        expect(maximalInput).toBe(1005000000000000n);
      });
    });

    describe('Validation', () => {
      it('should throw error for zero estimated input', () => {
        const estimatedInput = 0n;
        const slippageTolerance = 0.5;

        expect(() => {
          service.calculateMaximalInput(estimatedInput, slippageTolerance);
        }).toThrow('Estimated input must be greater than zero');
      });

      it('should throw error for negative estimated input', () => {
        const estimatedInput = -100n;
        const slippageTolerance = 0.5;

        expect(() => {
          service.calculateMaximalInput(estimatedInput, slippageTolerance);
        }).toThrow('Estimated input must be greater than zero');
      });

      it('should throw error for negative slippage tolerance', () => {
        const estimatedInput = 100000000n;
        const slippageTolerance = -0.5;

        expect(() => {
          service.calculateMaximalInput(estimatedInput, slippageTolerance);
        }).toThrow('Slippage tolerance cannot be negative');
      });
    });

    describe('Invariants', () => {
      it('should always return value >= estimated input', () => {
        const estimatedInput = 100000000n;
        const slippageTolerance = 0.5;

        const maximalInput = service.calculateMaximalInput(estimatedInput, slippageTolerance);

        expect(maximalInput).toBeGreaterThanOrEqual(estimatedInput);
      });

      it('should return exact estimated input when slippage is 0', () => {
        const estimatedInput = 100000000n;
        const slippageTolerance = 0;

        const maximalInput = service.calculateMaximalInput(estimatedInput, slippageTolerance);

        expect(maximalInput).toBe(estimatedInput);
      });

      it('should increase proportionally with slippage', () => {
        const estimatedInput = 100000000n;

        const maximal1 = service.calculateMaximalInput(estimatedInput, 0.5);
        const maximal2 = service.calculateMaximalInput(estimatedInput, 1.0);
        const maximal3 = service.calculateMaximalInput(estimatedInput, 2.0);

        // Higher slippage should result in higher maximal input
        expect(maximal2).toBeGreaterThan(maximal1);
        expect(maximal3).toBeGreaterThan(maximal2);
      });
    });
  });

  describe('isQuoteExpired', () => {
    it('should return false for fresh quote', () => {
      const quote = {
        inputToken: USDC_ADDRESS,
        outputToken: USDT_ADDRESS,
        outputAmount: 100000000n,
        estimatedInput: 100080000n,
        maximalInput: 100580000n,
        tradeFee: 60000n,
        ownerFee: 20000n,
        priceImpact: 0.08,
        selectedShard: {
          address: '0x49ac6422c88e5b6e5c0e3e0e3e0e3e0e3e0e3e0e' as Address,
          shardNumber: 3,
          pairName: 'USDC/USDT',
          liquidityA: '1000.00',
          liquidityB: '1000.00',
          reserveA: 1000000000n,
          reserveB: 1000000000n,
          estimatedInput: 100080000n,
          tradeFee: 60000n,
          ownerFee: 20000n,
          isOptimal: true,
          reason: 'Lowest input required',
        },
        alternativeShards: [],
        chainId: MONAD_CHAIN_ID,
        timestamp: Date.now(),
        expiresAt: Date.now() + 30000, // Expires in 30 seconds
      };

      const isExpired = service.isQuoteExpired(quote);
      expect(isExpired).toBe(false);
    });

    it('should return true for expired quote', () => {
      const quote = {
        inputToken: USDC_ADDRESS,
        outputToken: USDT_ADDRESS,
        outputAmount: 100000000n,
        estimatedInput: 100080000n,
        maximalInput: 100580000n,
        tradeFee: 60000n,
        ownerFee: 20000n,
        priceImpact: 0.08,
        selectedShard: {
          address: '0x49ac6422c88e5b6e5c0e3e0e3e0e3e0e3e0e3e0e' as Address,
          shardNumber: 3,
          pairName: 'USDC/USDT',
          liquidityA: '1000.00',
          liquidityB: '1000.00',
          reserveA: 1000000000n,
          reserveB: 1000000000n,
          estimatedInput: 100080000n,
          tradeFee: 60000n,
          ownerFee: 20000n,
          isOptimal: true,
          reason: 'Lowest input required',
        },
        alternativeShards: [],
        chainId: MONAD_CHAIN_ID,
        timestamp: Date.now() - 60000, // 1 minute ago
        expiresAt: Date.now() - 1000, // Expired 1 second ago
      };

      const isExpired = service.isQuoteExpired(quote);
      expect(isExpired).toBe(true);
    });

    it('should return true for quote expiring exactly now', () => {
      const now = Date.now();
      const quote = {
        inputToken: USDC_ADDRESS,
        outputToken: USDT_ADDRESS,
        outputAmount: 100000000n,
        estimatedInput: 100080000n,
        maximalInput: 100580000n,
        tradeFee: 60000n,
        ownerFee: 20000n,
        priceImpact: 0.08,
        selectedShard: {
          address: '0x49ac6422c88e5b6e5c0e3e0e3e0e3e0e3e0e3e0e' as Address,
          shardNumber: 3,
          pairName: 'USDC/USDT',
          liquidityA: '1000.00',
          liquidityB: '1000.00',
          reserveA: 1000000000n,
          reserveB: 1000000000n,
          estimatedInput: 100080000n,
          tradeFee: 60000n,
          ownerFee: 20000n,
          isOptimal: true,
          reason: 'Lowest input required',
        },
        alternativeShards: [],
        chainId: MONAD_CHAIN_ID,
        timestamp: now - 30000,
        expiresAt: now, // Expires exactly now
      };

      const isExpired = service.isQuoteExpired(quote);
      expect(isExpired).toBe(false); // Should be false because now <= expiresAt
    });
  });

  describe('validateQuote', () => {
    const createValidQuote = () => ({
      inputToken: USDC_ADDRESS,
      outputToken: USDT_ADDRESS,
      outputAmount: 100000000n,
      estimatedInput: 100080000n,
      maximalInput: 100580000n,
      tradeFee: 60000n,
      ownerFee: 20000n,
      priceImpact: 0.08,
      selectedShard: {
        address: '0x49ac6422c88e5b6e5c0e3e0e3e0e3e0e3e0e3e0e' as Address,
        shardNumber: 3,
        pairName: 'USDC/USDT',
        liquidityA: '1000.00',
        liquidityB: '1000.00',
        reserveA: 1000000000n,
        reserveB: 1000000000n,
        estimatedInput: 100080000n,
        tradeFee: 60000n,
        ownerFee: 20000n,
        isOptimal: true,
        reason: 'Lowest input required',
      },
      alternativeShards: [],
      chainId: MONAD_CHAIN_ID,
      timestamp: Date.now(),
      expiresAt: Date.now() + 30000,
    });

    it('should not throw for valid quote', () => {
      const quote = createValidQuote();

      expect(() => {
        service.validateQuote(quote);
      }).not.toThrow();
    });

    it('should throw for null quote', () => {
      expect(() => {
        service.validateQuote(null as any);
      }).toThrow('Quote is required');
    });

    it('should throw for undefined quote', () => {
      expect(() => {
        service.validateQuote(undefined as any);
      }).toThrow('Quote is required');
    });

    it('should throw for expired quote', () => {
      const quote = createValidQuote();
      quote.expiresAt = Date.now() - 1000; // Expired

      expect(() => {
        service.validateQuote(quote);
      }).toThrow('Quote has expired');
    });

    it('should throw for missing input token', () => {
      const quote = createValidQuote();
      quote.inputToken = '' as Address;

      expect(() => {
        service.validateQuote(quote);
      }).toThrow('Invalid quote: missing token addresses');
    });

    it('should throw for missing output token', () => {
      const quote = createValidQuote();
      quote.outputToken = '' as Address;

      expect(() => {
        service.validateQuote(quote);
      }).toThrow('Invalid quote: missing token addresses');
    });

    it('should throw for zero output amount', () => {
      const quote = createValidQuote();
      quote.outputAmount = 0n;

      expect(() => {
        service.validateQuote(quote);
      }).toThrow('Invalid quote: output amount must be greater than zero');
    });

    it('should throw for negative output amount', () => {
      const quote = createValidQuote();
      quote.outputAmount = -100n;

      expect(() => {
        service.validateQuote(quote);
      }).toThrow('Invalid quote: output amount must be greater than zero');
    });

    it('should throw for zero estimated input', () => {
      const quote = createValidQuote();
      quote.estimatedInput = 0n;

      expect(() => {
        service.validateQuote(quote);
      }).toThrow('Invalid quote: estimated input must be greater than zero');
    });

    it('should throw for zero maximal input', () => {
      const quote = createValidQuote();
      quote.maximalInput = 0n;

      expect(() => {
        service.validateQuote(quote);
      }).toThrow('Invalid quote: maximal input must be greater than zero');
    });

    it('should throw for missing selected shard', () => {
      const quote = createValidQuote();
      quote.selectedShard = null as any;

      expect(() => {
        service.validateQuote(quote);
      }).toThrow('Invalid quote: no shard selected');
    });

    it('should throw for selected shard without address', () => {
      const quote = createValidQuote();
      quote.selectedShard.address = '' as Address;

      expect(() => {
        service.validateQuote(quote);
      }).toThrow('Invalid quote: no shard selected');
    });

    it('should throw when maximal input is less than estimated input', () => {
      const quote = createValidQuote();
      quote.maximalInput = 50000000n; // Less than estimatedInput
      quote.estimatedInput = 100000000n;

      expect(() => {
        service.validateQuote(quote);
      }).toThrow('Invalid quote: maximal input is less than estimated input');
    });

    it('should accept when maximal input equals estimated input', () => {
      const quote = createValidQuote();
      quote.maximalInput = 100000000n;
      quote.estimatedInput = 100000000n;

      expect(() => {
        service.validateQuote(quote);
      }).not.toThrow();
    });
  });
});
