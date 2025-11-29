import { describe, it, expect } from 'vitest';
import {
  validatePoolCreation,
  isValidSolanaAddress,
  calculateInitialPrice,
  estimatePoolCreationCost,
  hasSufficientSolForPoolCreation,
} from '../poolValidation';
import { Token } from '@/types';

// Mock token data
const mockTokenA: Token = {
  mint: 'So11111111111111111111111111111111111111112',
  address: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  name: 'Solana',
  decimals: 9,
};

const mockTokenB: Token = {
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
};

describe('poolValidation', () => {
  describe('validatePoolCreation', () => {
    it('validates successful pool creation with valid inputs', () => {
      const result = validatePoolCreation({
        tokenA: mockTokenA,
        tokenB: mockTokenB,
        amountA: '10',
        amountB: '100',
        tokenABalance: BigInt('20000000000'), // 20 SOL
        tokenBBalance: BigInt('200000000'), // 200 USDC
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails validation when no tokens are selected', () => {
      const result = validatePoolCreation({
        tokenA: undefined,
        tokenB: undefined,
        amountA: '10',
        amountB: '100',
        tokenABalance: BigInt(0),
        tokenBBalance: BigInt(0),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('First token must be selected');
      expect(result.errors).toContain('Second token must be selected');
    });

    it('fails validation when same token is selected for both slots', () => {
      const result = validatePoolCreation({
        tokenA: mockTokenA,
        tokenB: mockTokenA, // Same token
        amountA: '10',
        amountB: '100',
        tokenABalance: BigInt('20000000000'),
        tokenBBalance: BigInt('20000000000'),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot create pool with the same token');
    });

    it('fails validation with invalid amounts', () => {
      const result = validatePoolCreation({
        tokenA: mockTokenA,
        tokenB: mockTokenB,
        amountA: '0', // Invalid amount
        amountB: '-5', // Invalid amount
        tokenABalance: BigInt('20000000000'),
        tokenBBalance: BigInt('200000000'),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('First token amount must be greater than 0');
      expect(result.errors).toContain('Second token amount must be greater than 0');
    });

    it('fails validation with non-numeric amounts', () => {
      const result = validatePoolCreation({
        tokenA: mockTokenA,
        tokenB: mockTokenB,
        amountA: 'abc', // Non-numeric
        amountB: '', // Empty
        tokenABalance: BigInt('20000000000'),
        tokenBBalance: BigInt('200000000'),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('First token amount must be greater than 0');
      expect(result.errors).toContain('Second token amount must be greater than 0');
    });

    it('fails validation when insufficient token balance', () => {
      const result = validatePoolCreation({
        tokenA: mockTokenA,
        tokenB: mockTokenB,
        amountA: '100', // Requesting 100 SOL
        amountB: '1000', // Requesting 1000 USDC
        tokenABalance: BigInt('50000000000'), // Only 50 SOL available
        tokenBBalance: BigInt('500000000'), // Only 500 USDC available
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Insufficient SOL balance');
      expect(result.errors).toContain('Insufficient USDC balance');
    });

    it('handles edge case with very small amounts', () => {
      const result = validatePoolCreation({
        tokenA: mockTokenA,
        tokenB: mockTokenB,
        amountA: '0.000000001', // 1 lamport
        amountB: '0.000001', // 1 micro USDC
        tokenABalance: BigInt('1000000000'), // 1 SOL
        tokenBBalance: BigInt('1000000'), // 1 USDC
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('handles decimal precision correctly', () => {
      const result = validatePoolCreation({
        tokenA: mockTokenA,
        tokenB: mockTokenB,
        amountA: '1.123456789', // Max SOL precision
        amountB: '1.123456', // Max USDC precision
        tokenABalance: BigInt('2000000000'), // 2 SOL
        tokenBBalance: BigInt('2000000'), // 2 USDC
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('isValidSolanaAddress', () => {
    it('validates correct Solana addresses', () => {
      const validAddresses = [
        'So11111111111111111111111111111111111111112', // Wrapped SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        '11111111111111111111111111111111', // System Program
      ];

      validAddresses.forEach(address => {
        expect(isValidSolanaAddress(address)).toBe(true);
      });
    });

    it('rejects invalid Solana addresses', () => {
      const invalidAddresses = [
        '', // Empty string
        'invalid', // Too short
        '0x1234567890123456789012345678901234567890', // Ethereum format
        'So11111111111111111111111111111111111111113', // Invalid checksum
        'not-a-valid-address-at-all', // Completely invalid
      ];

      invalidAddresses.forEach(address => {
        expect(isValidSolanaAddress(address)).toBe(false);
      });
    });
  });

  describe('calculateInitialPrice', () => {
    it('calculates correct price ratios', () => {
      const result = calculateInitialPrice('10', '100', mockTokenA, mockTokenB);

      expect(result).not.toBeNull();
      expect(result!.priceAPerB).toBeCloseTo(1000); // 10 SOL * 10^9 / (100 USDC * 10^6)
      expect(result!.priceBPerA).toBeCloseTo(0.001); // Inverse of above
    });

    it('handles different token decimals correctly', () => {
      const tokenWith18Decimals: Token = {
        ...mockTokenA,
        decimals: 18,
      };

      const result = calculateInitialPrice('1', '1', tokenWith18Decimals, mockTokenB);

      expect(result).not.toBeNull();
      expect(result!.priceAPerB).toBeCloseTo(1000000000000); // 1 * 10^18 / (1 * 10^6)
      expect(result!.priceBPerA).toBeCloseTo(0.000000000001); // Inverse
    });

    it('returns null for invalid amounts', () => {
      expect(calculateInitialPrice('0', '100', mockTokenA, mockTokenB)).toBeNull();
      expect(calculateInitialPrice('10', '0', mockTokenA, mockTokenB)).toBeNull();
      expect(calculateInitialPrice('-10', '100', mockTokenA, mockTokenB)).toBeNull();
      expect(calculateInitialPrice('abc', '100', mockTokenA, mockTokenB)).toBeNull();
    });

    it('handles very small amounts', () => {
      const result = calculateInitialPrice('0.000000001', '0.000001', mockTokenA, mockTokenB);

      expect(result).not.toBeNull();
      expect(result!.priceAPerB).toBeCloseTo(1000);
      expect(result!.priceBPerA).toBeCloseTo(0.001);
    });

    it('handles very large amounts', () => {
      const result = calculateInitialPrice('1000000', '1000000000', mockTokenA, mockTokenB);

      expect(result).not.toBeNull();
      expect(result!.priceAPerB).toBeCloseTo(1000);
      expect(result!.priceBPerA).toBeCloseTo(0.001);
    });
  });

  describe('estimatePoolCreationCost', () => {
    it('returns reasonable cost estimates', () => {
      const cost = estimatePoolCreationCost();

      expect(cost.rentExemption).toBeGreaterThan(0);
      expect(cost.transactionFee).toBeGreaterThan(0);
      expect(cost.total).toBe(cost.rentExemption + cost.transactionFee);
      
      // Sanity checks for Solana costs
      expect(cost.rentExemption).toBeLessThan(0.01); // Should be less than 0.01 SOL
      expect(cost.transactionFee).toBeLessThan(0.001); // Should be less than 0.001 SOL
      expect(cost.total).toBeLessThan(0.02); // Total should be reasonable
    });

    it('provides consistent estimates', () => {
      const cost1 = estimatePoolCreationCost();
      const cost2 = estimatePoolCreationCost();

      expect(cost1.rentExemption).toBe(cost2.rentExemption);
      expect(cost1.transactionFee).toBe(cost2.transactionFee);
      expect(cost1.total).toBe(cost2.total);
    });
  });

  describe('hasSufficientSolForPoolCreation', () => {
    it('returns true when sufficient SOL balance', () => {
      const sufficientBalance = BigInt('10000000000'); // 10 SOL
      expect(hasSufficientSolForPoolCreation(sufficientBalance)).toBe(true);
    });

    it('returns false when insufficient SOL balance', () => {
      const insufficientBalance = BigInt('1000000'); // 0.001 SOL
      expect(hasSufficientSolForPoolCreation(insufficientBalance)).toBe(false);
    });

    it('handles edge case near the threshold', () => {
      const cost = estimatePoolCreationCost();
      const requiredLamports = BigInt(Math.floor(cost.total * 1e9));
      
      // Exactly at threshold
      expect(hasSufficientSolForPoolCreation(requiredLamports)).toBe(true);
      
      // Just below threshold
      expect(hasSufficientSolForPoolCreation(requiredLamports - BigInt(1))).toBe(false);
      
      // Just above threshold
      expect(hasSufficientSolForPoolCreation(requiredLamports + BigInt(1))).toBe(true);
    });

    it('handles zero balance', () => {
      expect(hasSufficientSolForPoolCreation(BigInt(0))).toBe(false);
    });

    it('handles very large balance', () => {
      const largeBalance = BigInt('1000000000000000'); // 1 million SOL
      expect(hasSufficientSolForPoolCreation(largeBalance)).toBe(true);
    });
  });
});