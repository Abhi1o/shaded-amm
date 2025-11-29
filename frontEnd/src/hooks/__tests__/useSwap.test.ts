import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSwap } from '../useSwap';
import { useSwapStore } from '@/stores/swapStore';

// Mock the swap store
vi.mock('@/stores/swapStore');

describe('useSwap', () => {
  const mockSwapStore = {
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
    setTokenIn: vi.fn(),
    setTokenOut: vi.fn(),
    setAmountIn: vi.fn(),
    setAmountOut: vi.fn(),
    setQuote: vi.fn(),
    setLoading: vi.fn(),
    setError: vi.fn(),
    swapTokens: vi.fn(),
    setIsSwapping: vi.fn(),
    setTransactionStatus: vi.fn(),
    setTransactionSignature: vi.fn(),
    setTransactionError: vi.fn(),
    setShowConfirmationModal: vi.fn(),
    resetTransaction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSwapStore).mockReturnValue(mockSwapStore);
  });

  it('should return all swap store properties and methods', () => {
    const { result } = renderHook(() => useSwap());

    expect(result.current).toEqual(mockSwapStore);
  });

  it('should call setTokenIn when setting input token', () => {
    const { result } = renderHook(() => useSwap());
    const mockToken = {
      mint: 'So11111111111111111111111111111111111111112',
      address: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
    };

    act(() => {
      result.current.setTokenIn(mockToken);
    });

    expect(mockSwapStore.setTokenIn).toHaveBeenCalledWith(mockToken);
  });

  it('should call setTokenOut when setting output token', () => {
    const { result } = renderHook(() => useSwap());
    const mockToken = {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    };

    act(() => {
      result.current.setTokenOut(mockToken);
    });

    expect(mockSwapStore.setTokenOut).toHaveBeenCalledWith(mockToken);
  });

  it('should call swapTokens when swapping token positions', () => {
    const { result } = renderHook(() => useSwap());

    act(() => {
      result.current.swapTokens();
    });

    expect(mockSwapStore.swapTokens).toHaveBeenCalled();
  });

  it('should call resetTransaction when resetting transaction state', () => {
    const { result } = renderHook(() => useSwap());

    act(() => {
      result.current.resetTransaction();
    });

    expect(mockSwapStore.resetTransaction).toHaveBeenCalled();
  });
});