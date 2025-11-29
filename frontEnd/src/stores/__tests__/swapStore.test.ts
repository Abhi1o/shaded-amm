import { describe, it, expect, beforeEach } from 'vitest';
import { useSwapStore } from '../swapStore';
import { Token, SwapQuote, TransactionStatus } from '@/types';

describe('swapStore', () => {
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

  const mockSwapQuote: SwapQuote = {
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
    validUntil: Date.now() + 30000,
    refreshInterval: 10000,
  };

  beforeEach(() => {
    // Reset store state before each test
    useSwapStore.setState({
      tokenIn: null,
      tokenOut: null,
      amountIn: '',
      amountOut: '',
      quote: null,
      loading: false,
      error: null,
      isSwapping: false,
      transactionStatus: null,
      transactionSignature: null,
      transactionError: null,
      showConfirmationModal: false,
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useSwapStore.getState();

      expect(state.tokenIn).toBeNull();
      expect(state.tokenOut).toBeNull();
      expect(state.amountIn).toBe('');
      expect(state.amountOut).toBe('');
      expect(state.quote).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.isSwapping).toBe(false);
      expect(state.transactionStatus).toBeNull();
      expect(state.transactionSignature).toBeNull();
      expect(state.transactionError).toBeNull();
      expect(state.showConfirmationModal).toBe(false);
    });
  });

  describe('token selection', () => {
    it('should set input token', () => {
      const { setTokenIn } = useSwapStore.getState();
      
      setTokenIn(mockTokenSOL);
      
      const state = useSwapStore.getState();
      expect(state.tokenIn).toEqual(mockTokenSOL);
    });

    it('should set output token', () => {
      const { setTokenOut } = useSwapStore.getState();
      
      setTokenOut(mockTokenUSDC);
      
      const state = useSwapStore.getState();
      expect(state.tokenOut).toEqual(mockTokenUSDC);
    });

    it('should swap tokens correctly', () => {
      const { setTokenIn, setTokenOut, swapTokens } = useSwapStore.getState();
      
      // Set initial tokens
      setTokenIn(mockTokenSOL);
      setTokenOut(mockTokenUSDC);
      
      // Swap tokens
      swapTokens();
      
      const state = useSwapStore.getState();
      expect(state.tokenIn).toEqual(mockTokenUSDC);
      expect(state.tokenOut).toEqual(mockTokenSOL);
      expect(state.amountIn).toBe('');
      expect(state.amountOut).toBe('');
      expect(state.quote).toBeNull();
    });
  });

  describe('amount management', () => {
    it('should set input amount', () => {
      const { setAmountIn } = useSwapStore.getState();
      
      setAmountIn('1.5');
      
      const state = useSwapStore.getState();
      expect(state.amountIn).toBe('1.5');
    });

    it('should set output amount', () => {
      const { setAmountOut } = useSwapStore.getState();
      
      setAmountOut('1.495');
      
      const state = useSwapStore.getState();
      expect(state.amountOut).toBe('1.495');
    });
  });

  describe('quote management', () => {
    it('should set swap quote', () => {
      const { setQuote } = useSwapStore.getState();
      
      setQuote(mockSwapQuote);
      
      const state = useSwapStore.getState();
      expect(state.quote).toEqual(mockSwapQuote);
    });

    it('should clear quote', () => {
      const { setQuote } = useSwapStore.getState();
      
      // Set quote first
      setQuote(mockSwapQuote);
      expect(useSwapStore.getState().quote).toEqual(mockSwapQuote);
      
      // Clear quote
      setQuote(null);
      expect(useSwapStore.getState().quote).toBeNull();
    });
  });

  describe('loading and error states', () => {
    it('should set loading state', () => {
      const { setLoading } = useSwapStore.getState();
      
      setLoading(true);
      expect(useSwapStore.getState().loading).toBe(true);
      
      setLoading(false);
      expect(useSwapStore.getState().loading).toBe(false);
    });

    it('should set error state', () => {
      const { setError } = useSwapStore.getState();
      
      setError('Test error message');
      expect(useSwapStore.getState().error).toBe('Test error message');
      
      setError(null);
      expect(useSwapStore.getState().error).toBeNull();
    });
  });

  describe('transaction state management', () => {
    it('should set swapping state', () => {
      const { setIsSwapping } = useSwapStore.getState();
      
      setIsSwapping(true);
      expect(useSwapStore.getState().isSwapping).toBe(true);
      
      setIsSwapping(false);
      expect(useSwapStore.getState().isSwapping).toBe(false);
    });

    it('should set transaction status', () => {
      const { setTransactionStatus } = useSwapStore.getState();
      
      setTransactionStatus(TransactionStatus.PENDING);
      expect(useSwapStore.getState().transactionStatus).toBe(TransactionStatus.PENDING);
      
      setTransactionStatus(TransactionStatus.CONFIRMED);
      expect(useSwapStore.getState().transactionStatus).toBe(TransactionStatus.CONFIRMED);
    });

    it('should set transaction signature', () => {
      const { setTransactionSignature } = useSwapStore.getState();
      
      setTransactionSignature('test-signature-123');
      expect(useSwapStore.getState().transactionSignature).toBe('test-signature-123');
    });

    it('should set transaction error', () => {
      const { setTransactionError } = useSwapStore.getState();
      
      setTransactionError('Transaction failed');
      expect(useSwapStore.getState().transactionError).toBe('Transaction failed');
    });

    it('should set confirmation modal visibility', () => {
      const { setShowConfirmationModal } = useSwapStore.getState();
      
      setShowConfirmationModal(true);
      expect(useSwapStore.getState().showConfirmationModal).toBe(true);
      
      setShowConfirmationModal(false);
      expect(useSwapStore.getState().showConfirmationModal).toBe(false);
    });

    it('should reset transaction state', () => {
      const { 
        setIsSwapping, 
        setTransactionStatus, 
        setTransactionSignature, 
        setTransactionError, 
        setShowConfirmationModal,
        resetTransaction 
      } = useSwapStore.getState();
      
      // Set some transaction state
      setIsSwapping(true);
      setTransactionStatus(TransactionStatus.PENDING);
      setTransactionSignature('test-signature');
      setTransactionError('Some error');
      setShowConfirmationModal(true);
      
      // Reset transaction state
      resetTransaction();
      
      const state = useSwapStore.getState();
      expect(state.isSwapping).toBe(false);
      expect(state.transactionStatus).toBeNull();
      expect(state.transactionSignature).toBeNull();
      expect(state.transactionError).toBeNull();
      expect(state.showConfirmationModal).toBe(false);
    });
  });

  describe('complex state interactions', () => {
    it('should handle complete swap flow state changes', () => {
      const {
        setTokenIn,
        setTokenOut,
        setAmountIn,
        setQuote,
        setIsSwapping,
        setTransactionStatus,
        setTransactionSignature,
        resetTransaction
      } = useSwapStore.getState();

      // Setup swap
      setTokenIn(mockTokenSOL);
      setTokenOut(mockTokenUSDC);
      setAmountIn('1.0');
      setQuote(mockSwapQuote);

      let state = useSwapStore.getState();
      expect(state.tokenIn).toEqual(mockTokenSOL);
      expect(state.tokenOut).toEqual(mockTokenUSDC);
      expect(state.amountIn).toBe('1.0');
      expect(state.quote).toEqual(mockSwapQuote);

      // Start swap
      setIsSwapping(true);
      setTransactionStatus(TransactionStatus.PENDING);

      state = useSwapStore.getState();
      expect(state.isSwapping).toBe(true);
      expect(state.transactionStatus).toBe(TransactionStatus.PENDING);

      // Complete swap
      setTransactionSignature('success-signature');
      setTransactionStatus(TransactionStatus.CONFIRMED);

      state = useSwapStore.getState();
      expect(state.transactionSignature).toBe('success-signature');
      expect(state.transactionStatus).toBe(TransactionStatus.CONFIRMED);

      // Reset after completion
      resetTransaction();

      state = useSwapStore.getState();
      expect(state.isSwapping).toBe(false);
      expect(state.transactionStatus).toBeNull();
      expect(state.transactionSignature).toBeNull();
      // Original swap data should remain
      expect(state.tokenIn).toEqual(mockTokenSOL);
      expect(state.tokenOut).toEqual(mockTokenUSDC);
      expect(state.amountIn).toBe('1.0');
    });
  });
});