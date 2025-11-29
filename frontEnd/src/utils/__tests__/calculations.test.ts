import { describe, it, expect } from 'vitest';
import {
  calculateSwapOutput,
  calculatePriceImpact,
  calculateLiquidityTokens,
} from '../calculations';

describe('calculations', () => {
  describe('calculateSwapOutput', () => {
    it('calculates correct swap output for basic AMM formula', () => {
      const inputAmount = BigInt('1000000000'); // 1 SOL (9 decimals)
      const inputReserve = BigInt('10000000000'); // 10 SOL
      const outputReserve = BigInt('100000000'); // 100 USDC (6 decimals)
      
      const output = calculateSwapOutput(inputAmount, inputReserve, outputReserve);
      
      // With 0.3% fee, should get approximately 9.07 USDC
      // Formula: (inputAmount * 0.997 * outputReserve) / (inputReserve + inputAmount * 0.997)
      expect(Number(output)).toBeGreaterThan(9000000); // > 9 USDC
      expect(Number(output)).toBeLessThan(10000000); // < 10 USDC
    });

    it('calculates correct swap output with custom fee', () => {
      const inputAmount = BigInt('1000000000'); // 1 SOL
      const inputReserve = BigInt('10000000000'); // 10 SOL
      const outputReserve = BigInt('100000000'); // 100 USDC
      const customFee = 0.005; // 0.5% fee
      
      const output = calculateSwapOutput(inputAmount, inputReserve, outputReserve, customFee);
      
      // With higher fee, output should be lower than default 0.3% fee
      const defaultOutput = calculateSwapOutput(inputAmount, inputReserve, outputReserve);
      expect(output).toBeLessThan(defaultOutput);
    });

    it('handles zero fee correctly', () => {
      const inputAmount = BigInt('1000000000'); // 1 SOL
      const inputReserve = BigInt('10000000000'); // 10 SOL
      const outputReserve = BigInt('100000000'); // 100 USDC
      
      const output = calculateSwapOutput(inputAmount, inputReserve, outputReserve, 0);
      
      // With no fee, should get exactly: (1 * 100) / (10 + 1) = 9.09 USDC
      const expectedOutput = (inputAmount * outputReserve) / (inputReserve + inputAmount);
      expect(output).toBe(expectedOutput);
    });

    it('handles very small amounts', () => {
      const inputAmount = BigInt('1000'); // 0.000001 SOL
      const inputReserve = BigInt('10000000000'); // 10 SOL
      const outputReserve = BigInt('100000000'); // 100 USDC
      
      const output = calculateSwapOutput(inputAmount, inputReserve, outputReserve);
      
      expect(output).toBeGreaterThan(BigInt(0));
      expect(output).toBeLessThan(BigInt('1000')); // Should be very small
    });

    it('handles very large amounts', () => {
      const inputAmount = BigInt('5000000000'); // 5 SOL (half the reserve)
      const inputReserve = BigInt('10000000000'); // 10 SOL
      const outputReserve = BigInt('100000000'); // 100 USDC
      
      const output = calculateSwapOutput(inputAmount, inputReserve, outputReserve);
      
      // Should get less than 50 USDC due to price impact
      expect(output).toBeLessThan(BigInt('50000000')); // < 50 USDC
      expect(output).toBeGreaterThan(BigInt('30000000')); // > 30 USDC
    });

    it('returns zero for zero input', () => {
      const output = calculateSwapOutput(
        BigInt(0),
        BigInt('10000000000'),
        BigInt('100000000')
      );
      
      expect(output).toBe(BigInt(0));
    });
  });

  describe('calculatePriceImpact', () => {
    it('calculates correct price impact for small trades', () => {
      const inputAmount = BigInt('100000000'); // 0.1 SOL
      const inputReserve = BigInt('10000000000'); // 10 SOL
      const outputReserve = BigInt('100000000'); // 100 USDC
      
      const priceImpact = calculatePriceImpact(inputAmount, inputReserve, outputReserve);
      
      // Small trade should have minimal price impact
      expect(priceImpact).toBeGreaterThan(0);
      expect(priceImpact).toBeLessThan(1); // < 1%
    });

    it('calculates higher price impact for large trades', () => {
      const inputAmount = BigInt('5000000000'); // 5 SOL (50% of reserve)
      const inputReserve = BigInt('10000000000'); // 10 SOL
      const outputReserve = BigInt('100000000'); // 100 USDC
      
      const priceImpact = calculatePriceImpact(inputAmount, inputReserve, outputReserve);
      
      // Large trade should have significant price impact
      expect(priceImpact).toBeGreaterThan(10); // > 10%
      expect(priceImpact).toBeLessThan(50); // < 50%
    });

    it('returns zero price impact for zero input', () => {
      const priceImpact = calculatePriceImpact(
        BigInt(0),
        BigInt('10000000000'),
        BigInt('100000000')
      );
      
      expect(priceImpact).toBe(0);
    });

    it('handles edge case where input equals reserve', () => {
      const inputAmount = BigInt('10000000000'); // 10 SOL (equals reserve)
      const inputReserve = BigInt('10000000000'); // 10 SOL
      const outputReserve = BigInt('100000000'); // 100 USDC
      
      const priceImpact = calculatePriceImpact(inputAmount, inputReserve, outputReserve);
      
      // Should have very high price impact
      expect(priceImpact).toBeGreaterThan(40); // > 40%
    });

    it('calculates consistent price impact regardless of direction', () => {
      // Test both directions of the same pool
      const amount = BigInt('1000000000'); // 1 unit
      const reserve1 = BigInt('10000000000'); // 10 units
      const reserve2 = BigInt('100000000'); // 100 units (different scale)
      
      const impact1 = calculatePriceImpact(amount, reserve1, reserve2);
      const impact2 = calculatePriceImpact(amount / BigInt(100), reserve2, reserve1);
      
      // Price impacts should be similar (accounting for scale differences)
      expect(Math.abs(impact1 - impact2)).toBeLessThan(1); // Within 1%
    });
  });

  describe('calculateLiquidityTokens', () => {
    it('calculates initial liquidity correctly (geometric mean)', () => {
      const amountA = BigInt('10000000000'); // 10 SOL
      const amountB = BigInt('100000000'); // 100 USDC
      
      const liquidity = calculateLiquidityTokens(
        amountA,
        amountB,
        BigInt(0), // No existing reserves
        BigInt(0),
        BigInt(0) // No existing supply
      );
      
      // Should be sqrt(10 * 100) = sqrt(1000) ≈ 31.6 (in appropriate units)
      const expected = BigInt(Math.floor(Math.sqrt(Number(amountA) * Number(amountB))));
      expect(liquidity).toBe(expected);
    });

    it('calculates proportional liquidity for existing pool', () => {
      const amountA = BigInt('1000000000'); // 1 SOL
      const amountB = BigInt('10000000'); // 10 USDC
      const reserveA = BigInt('10000000000'); // 10 SOL existing
      const reserveB = BigInt('100000000'); // 100 USDC existing
      const totalSupply = BigInt('1000000000'); // 1B LP tokens existing
      
      const liquidity = calculateLiquidityTokens(
        amountA,
        amountB,
        reserveA,
        reserveB,
        totalSupply
      );
      
      // Should be proportional to the smaller ratio
      // amountA/reserveA = 1/10 = 0.1
      // amountB/reserveB = 10/100 = 0.1
      // So should get 0.1 * totalSupply = 100M LP tokens
      const expectedA = (amountA * totalSupply) / reserveA;
      const expectedB = (amountB * totalSupply) / reserveB;
      const expected = expectedA < expectedB ? expectedA : expectedB;
      
      expect(liquidity).toBe(expected);
    });

    it('returns minimum of proportional calculations', () => {
      const amountA = BigInt('2000000000'); // 2 SOL (20% of reserve)
      const amountB = BigInt('10000000'); // 10 USDC (10% of reserve)
      const reserveA = BigInt('10000000000'); // 10 SOL
      const reserveB = BigInt('100000000'); // 100 USDC
      const totalSupply = BigInt('1000000000'); // 1B LP tokens
      
      const liquidity = calculateLiquidityTokens(
        amountA,
        amountB,
        reserveA,
        reserveB,
        totalSupply
      );
      
      // Should use the smaller ratio (10% from token B)
      const expectedB = (amountB * totalSupply) / reserveB;
      expect(liquidity).toBe(expectedB);
    });

    it('handles zero amounts correctly', () => {
      const liquidity = calculateLiquidityTokens(
        BigInt(0),
        BigInt('100000000'),
        BigInt('10000000000'),
        BigInt('100000000'),
        BigInt('1000000000')
      );
      
      expect(liquidity).toBe(BigInt(0));
    });

    it('handles very small amounts', () => {
      const amountA = BigInt('1'); // 1 lamport
      const amountB = BigInt('1'); // 1 smallest unit
      
      const liquidity = calculateLiquidityTokens(
        amountA,
        amountB,
        BigInt(0),
        BigInt(0),
        BigInt(0)
      );
      
      // sqrt(1 * 1) = 1
      expect(liquidity).toBe(BigInt(1));
    });

    it('handles large amounts without overflow', () => {
      const amountA = BigInt('1000000000000000000'); // Very large amount
      const amountB = BigInt('1000000000000000000');
      
      const liquidity = calculateLiquidityTokens(
        amountA,
        amountB,
        BigInt(0),
        BigInt(0),
        BigInt(0)
      );
      
      expect(liquidity).toBeGreaterThan(BigInt(0));
      expect(liquidity).toBeLessThan(amountA); // Should be reasonable
    });

    it('maintains proportionality in existing pools', () => {
      const reserveA = BigInt('10000000000'); // 10 SOL
      const reserveB = BigInt('100000000'); // 100 USDC
      const totalSupply = BigInt('1000000000'); // 1B LP tokens
      
      // Add 10% more liquidity
      const amountA = reserveA / BigInt(10); // 1 SOL
      const amountB = reserveB / BigInt(10); // 10 USDC
      
      const liquidity = calculateLiquidityTokens(
        amountA,
        amountB,
        reserveA,
        reserveB,
        totalSupply
      );
      
      // Should get 10% of existing supply
      const expected = totalSupply / BigInt(10);
      expect(liquidity).toBe(expected);
    });
  });
});