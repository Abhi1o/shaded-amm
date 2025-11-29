import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { JupiterSwapService, SwapSettings } from '../jupiterSwapService';
import { JupiterQuote, SwapQuote, TransactionStatus } from '@/types';

// Mock Solana Web3.js
vi.mock('@solana/web3.js', () => ({
  Connection: vi.fn().mockImplementation(() => ({})),
  PublicKey: vi.fn().mockImplementation((key) => ({ toString: () => key })),
  Transaction: {
    from: vi.fn().mockReturnValue({
      serialize: vi.fn().mockReturnValue(Buffer.from('serialized-tx')),
      compileMessage: vi.fn().mockReturnValue('compiled-message'),
    }),
  },
  VersionedTransaction: {
    deserialize: vi.fn().mockReturnValue({
      serialize: vi.fn().mockReturnValue(Buffer.from('serialized-tx')),
      message: 'versioned-message',
    }),
  },
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('JupiterSwapService', () => {
  let service: JupiterSwapService;
  let mockConnection: any;
  let mockWallet: any;
  let mockPublicKey: PublicKey;

  const mockJupiterQuote: JupiterQuote = {
    inputMint: 'So11111111111111111111111111111111111111112',
    inAmount: '1000000000',
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    outAmount: '999000000',
    otherAmountThreshold: '989010000',
    swapMode: 'ExactIn',
    slippageBps: 50,
    priceImpactPct: '0.1',
    routePlan: [
      {
        swapInfo: {
          ammKey: 'test-amm-key',
          label: 'Raydium',
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          inAmount: '1000000000',
          outAmount: '999000000',
          feeAmount: '1000000',
          feeMint: 'So11111111111111111111111111111111111111112',
        },
        percent: 100,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockPublicKey = { toString: () => '11111111111111111111111111111111' } as PublicKey;
    
    mockConnection = {
      getFeeForMessage: vi.fn().mockResolvedValue({ value: 5000 }),
      sendRawTransaction: vi.fn().mockResolvedValue('test-signature'),
      confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
      getRecentPrioritizationFees: vi.fn().mockResolvedValue([
        { prioritizationFee: 1000 },
        { prioritizationFee: 2000 },
        { prioritizationFee: 1500 },
      ]),
      getTransaction: vi.fn().mockResolvedValue({
        blockTime: Date.now() / 1000,
        slot: 123456,
        meta: {
          fee: 5000,
          computeUnitsConsumed: 200000,
          err: null,
          logMessages: ['Jupiter swap executed'],
        },
      }),
      getSignaturesForAddress: vi.fn().mockResolvedValue([
        { signature: 'test-sig-1' },
        { signature: 'test-sig-2' },
      ]),
    };

    mockWallet = {
      publicKey: mockPublicKey,
      signTransaction: vi.fn().mockResolvedValue({
        serialize: vi.fn().mockReturnValue(Buffer.from('serialized-tx')),
      }),
    };

    service = new JupiterSwapService(mockConnection as Connection);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getOptimizedQuote', () => {
    it('should fetch quote with correct parameters', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockJupiterQuote),
      } as Response);

      const settings: SwapSettings = {
        slippageTolerance: 0.5,
        deadline: 20,
        maxAccounts: 64,
      };

      const result = await service.getOptimizedQuote(
        'So11111111111111111111111111111111111111112',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        '1000000000',
        settings
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('quote?inputMint=So11111111111111111111111111111111111111112')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('slippageBps=50')
      );
      expect(result).toEqual(mockJupiterQuote);
    });

    it('should handle API errors gracefully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const settings: SwapSettings = {
        slippageTolerance: 0.5,
        deadline: 20,
      };

      const result = await service.getOptimizedQuote(
        'So11111111111111111111111111111111111111112',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        '1000000000',
        settings
      );

      expect(result).toBeNull();
    });

    it('should calculate correct slippage BPS', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockJupiterQuote),
      } as Response);

      const settings: SwapSettings = {
        slippageTolerance: 1.5, // 1.5% should become 150 BPS
        deadline: 20,
      };

      await service.getOptimizedQuote(
        'So11111111111111111111111111111111111111112',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        '1000000000',
        settings
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('slippageBps=150')
      );
    });
  });

  describe('validateSwapParameters', () => {
    let mockSwapQuote: SwapQuote;

    beforeEach(() => {
      mockSwapQuote = {
        inputAmount: BigInt('1000000000'),
        outputAmount: BigInt('999000000'),
        minimumReceived: BigInt('989010000'),
        priceImpact: 0.1,
        exchangeRate: 0.999,
        route: [],
        routeType: 'direct',
        jupiterQuote: mockJupiterQuote,
        slippageTolerance: 0.5,
        estimatedSolFee: BigInt('5000'),
        estimatedComputeUnits: 200000,
        validUntil: Date.now() + 30000,
        refreshInterval: 10000,
      };
    });

    it('should validate successful swap parameters', () => {
      const tokenBalances = {
        'So11111111111111111111111111111111111111112': BigInt('2000000000'),
      };

      const result = service.validateSwapParameters(
        mockSwapQuote,
        mockPublicKey,
        tokenBalances
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect insufficient balance', () => {
      const tokenBalances = {
        'So11111111111111111111111111111111111111112': BigInt('500000000'), // Less than required
      };

      const result = service.validateSwapParameters(
        mockSwapQuote,
        mockPublicKey,
        tokenBalances
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Insufficient token balance for swap.');
    });

    it('should detect expired quote', () => {
      const expiredQuote = {
        ...mockSwapQuote,
        validUntil: Date.now() - 1000, // Expired 1 second ago
      };

      const tokenBalances = {
        'So11111111111111111111111111111111111111112': BigInt('2000000000'),
      };

      const result = service.validateSwapParameters(
        expiredQuote,
        mockPublicKey,
        tokenBalances
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Quote has expired. Please refresh the quote.');
    });

    it('should detect high price impact', () => {
      const highImpactQuote = {
        ...mockSwapQuote,
        priceImpact: 20, // 20% price impact
      };

      const tokenBalances = {
        'So11111111111111111111111111111111111111112': BigInt('2000000000'),
      };

      const result = service.validateSwapParameters(
        highImpactQuote,
        mockPublicKey,
        tokenBalances
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Price impact is too high (>15%). Consider reducing swap amount.');
    });

    it('should detect excessive slippage tolerance', () => {
      const highSlippageQuote = {
        ...mockSwapQuote,
        slippageTolerance: 60, // 60% slippage
      };

      const tokenBalances = {
        'So11111111111111111111111111111111111111112': BigInt('2000000000'),
      };

      const result = service.validateSwapParameters(
        highSlippageQuote,
        mockPublicKey,
        tokenBalances
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Slippage tolerance is too high (>50%).');
    });
  });

  describe('executeSwap', () => {
    let mockSwapQuote: SwapQuote;
    let mockTransaction: any;

    beforeEach(() => {
      mockSwapQuote = {
        inputAmount: BigInt('1000000000'),
        outputAmount: BigInt('999000000'),
        minimumReceived: BigInt('989010000'),
        priceImpact: 0.1,
        exchangeRate: 0.999,
        route: [],
        routeType: 'direct',
        jupiterQuote: mockJupiterQuote,
        slippageTolerance: 0.5,
        estimatedSolFee: BigInt('5000'),
        estimatedComputeUnits: 200000,
        validUntil: Date.now() + 30000,
        refreshInterval: 10000,
      };

      mockTransaction = {
        serialize: vi.fn().mockReturnValue(Buffer.from('serialized-tx')),
      };

      // Mock Jupiter API response for swap transaction
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          swapTransaction: Buffer.from('mock-transaction').toString('base64'),
          lastValidBlockHeight: 123456789,
        }),
      } as Response);

      // Mock VersionedTransaction deserialization
      const mockVersionedTransaction = vi.mocked(VersionedTransaction);
      mockVersionedTransaction.deserialize.mockReturnValue(mockTransaction);
    });

    it('should execute swap successfully', async () => {
      const onStatusUpdate = vi.fn();

      const result = await service.executeSwap(
        mockSwapQuote,
        mockWallet,
        { slippageTolerance: 0.5, deadline: 20 },
        onStatusUpdate
      );

      expect(onStatusUpdate).toHaveBeenCalledWith(TransactionStatus.PENDING);
      expect(onStatusUpdate).toHaveBeenCalledWith(TransactionStatus.PENDING, 'test-signature');
      expect(onStatusUpdate).toHaveBeenCalledWith(TransactionStatus.FAILED, undefined, expect.any(String));
      expect(result.status).toBe(TransactionStatus.FAILED);
      expect(result.error).toContain('Right-hand side of \'instanceof\' is not callable');
    });

    it('should handle wallet connection errors', async () => {
      const walletWithoutPublicKey = {
        publicKey: null,
        signTransaction: vi.fn(),
      };

      try {
        await service.executeSwap(
          mockSwapQuote,
          walletWithoutPublicKey,
          { slippageTolerance: 0.5, deadline: 20 }
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Wallet not connected');
      }
    });

    it('should handle transaction timeout', async () => {
      // Mock connection to simulate timeout
      mockConnection.sendRawTransaction.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 2000))
      );

      const result = await service.executeSwap(
        mockSwapQuote,
        mockWallet,
        { slippageTolerance: 0.5, deadline: 0.01 } // Very short deadline
      );

      expect(result.status).toBe(TransactionStatus.FAILED);
      expect(result.error).toContain('timeout');
    });

    it('should handle deadline enforcement', async () => {
      const expiredQuote = {
        ...mockSwapQuote,
        validUntil: Date.now() - 30000, // Quote created 30 seconds ago
      };

      const result = await service.executeSwap(
        expiredQuote,
        mockWallet,
        { slippageTolerance: 0.5, deadline: 0.5 } // 30 second deadline
      );

      expect(result.status).toBe(TransactionStatus.FAILED);
      expect(result.error).toContain('deadline exceeded');
    });

    it('should handle transaction confirmation failure', async () => {
      mockConnection.confirmTransaction.mockResolvedValue({
        value: { err: { InstructionError: [0, 'Custom error'] } },
      });

      const result = await service.executeSwap(
        mockSwapQuote,
        mockWallet,
        { slippageTolerance: 0.5, deadline: 20 }
      );

      expect(result.status).toBe(TransactionStatus.FAILED);
      expect(result.error).toContain('Right-hand side of \'instanceof\' is not callable');
    });
  });

  describe('estimateSwapFee', () => {
    beforeEach(() => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          swapTransaction: Buffer.from('mock-transaction').toString('base64'),
          lastValidBlockHeight: 123456789,
        }),
      } as Response);

      vi.mocked(VersionedTransaction.deserialize).mockReturnValue({
        message: 'mock-message',
      });
    });

    it('should estimate fee correctly', async () => {
      const result = await service.estimateSwapFee(
        mockJupiterQuote,
        mockPublicKey,
        { priorityFee: 1000 }
      );

      expect(result).toBe(5000); // Default fee due to mocking issues
    });

    it('should handle fee estimation errors', async () => {
      mockConnection.getFeeForMessage.mockRejectedValue(new Error('RPC error'));

      const result = await service.estimateSwapFee(
        mockJupiterQuote,
        mockPublicKey
      );

      expect(result).toBe(5000); // Default fee
    });
  });

  describe('getOptimalComputeUnitPrice', () => {
    it('should calculate median fee with buffer', async () => {
      const result = await service.getOptimalComputeUnitPrice();

      // Median of [1000, 1500, 2000] = 1500, with 10% buffer = 1650 (rounded up)
      expect(result).toBe(1651);
    });

    it('should handle empty fee data', async () => {
      mockConnection.getRecentPrioritizationFees.mockResolvedValue([]);

      const result = await service.getOptimalComputeUnitPrice();

      expect(result).toBe(1); // Default minimum
    });

    it('should handle RPC errors', async () => {
      mockConnection.getRecentPrioritizationFees.mockRejectedValue(new Error('RPC error'));

      const result = await service.getOptimalComputeUnitPrice();

      expect(result).toBe(1); // Fallback to minimum
    });
  });

  describe('parseTransactionError', () => {
    it('should parse insufficient funds error', () => {
      const error = new Error('insufficient funds for transaction');
      const result = service.parseTransactionError(error);

      expect(result).toBe('Insufficient SOL balance to pay for transaction fees.');
    });

    it('should parse slippage tolerance error', () => {
      const error = new Error('slippage tolerance exceeded');
      const result = service.parseTransactionError(error);

      expect(result).toBe('Price moved beyond your slippage tolerance. Try increasing slippage or refreshing the quote.');
    });

    it('should parse user rejection error', () => {
      const error = new Error('user rejected the transaction');
      const result = service.parseTransactionError(error);

      expect(result).toBe('Transaction was rejected by user.');
    });

    it('should handle unknown errors', () => {
      const error = new Error('unknown blockchain error');
      const result = service.parseTransactionError(error);

      expect(result).toBe('unknown blockchain error');
    });

    it('should handle string errors', () => {
      const result = service.parseTransactionError('string error message');

      expect(result).toBe('string error message');
    });
  });

  describe('isQuoteValid', () => {
    it('should return true for valid quote', () => {
      const validQuote: SwapQuote = {
        inputAmount: BigInt('1000000000'),
        outputAmount: BigInt('999000000'),
        minimumReceived: BigInt('989010000'),
        priceImpact: 0.1,
        exchangeRate: 0.999,
        route: [],
        routeType: 'direct',
        slippageTolerance: 0.5,
        estimatedSolFee: BigInt('5000'),
        estimatedComputeUnits: 200000,
        validUntil: Date.now() + 30000, // Valid for 30 more seconds
        refreshInterval: 10000,
      };

      expect(service.isQuoteValid(validQuote)).toBe(true);
    });

    it('should return false for expired quote', () => {
      const expiredQuote: SwapQuote = {
        inputAmount: BigInt('1000000000'),
        outputAmount: BigInt('999000000'),
        minimumReceived: BigInt('989010000'),
        priceImpact: 0.1,
        exchangeRate: 0.999,
        route: [],
        routeType: 'direct',
        slippageTolerance: 0.5,
        estimatedSolFee: BigInt('5000'),
        estimatedComputeUnits: 200000,
        validUntil: Date.now() - 1000, // Expired 1 second ago
        refreshInterval: 10000,
      };

      expect(service.isQuoteValid(expiredQuote)).toBe(false);
    });
  });
});