import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePoolRefresh } from '../usePoolRefresh';
import { usePoolStore } from '@/stores/poolStore';
import { useSolanaConnection } from '../useSolanaConnection';

// Mock dependencies
vi.mock('@/stores/poolStore');
vi.mock('../useSolanaConnection');

describe('usePoolRefresh', () => {
  const mockConnection = {
    rpcEndpoint: 'https://api.devnet.solana.com',
  };

  const mockPoolStore = {
    pools: [
      {
        id: 'pool1',
        tokenA: { symbol: 'SOL', decimals: 9 },
        tokenB: { symbol: 'USDC', decimals: 6 },
      },
    ],
    loading: false,
    error: null,
    lastFetchTime: Date.now(),
    isStale: false,
    consecutiveFailures: 0,
    isInitialLoad: false,
    isBackgroundRefresh: false,
    fetchPools: vi.fn(),
    refreshPools: vi.fn(),
    clearCache: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(useSolanaConnection).mockReturnValue({
      connection: mockConnection as any,
      cluster: 'devnet' as any,
      endpoint: 'https://api.devnet.solana.com',
    });
    vi.mocked(usePoolStore).mockReturnValue(mockPoolStore as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Automatic Polling', () => {
    it('should perform initial fetch on mount', async () => {
      renderHook(() => usePoolRefresh({ enabled: true }));

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      expect(mockPoolStore.fetchPools).toHaveBeenCalledWith(mockConnection, true);
    });

    it('should poll at 30-second intervals by default', async () => {
      renderHook(() => usePoolRefresh({ enabled: true }));

      // Initial fetch
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(mockPoolStore.fetchPools).toHaveBeenCalledTimes(1);

      // First poll after 30 seconds (background refresh)
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await vi.runOnlyPendingTimersAsync();
      });
      expect(mockPoolStore.refreshPools).toHaveBeenCalledTimes(1);

      // Second poll after another 30 seconds
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await vi.runOnlyPendingTimersAsync();
      });
      expect(mockPoolStore.refreshPools).toHaveBeenCalledTimes(2);
    });

    it('should use custom refresh interval when provided', async () => {
      renderHook(() => usePoolRefresh({ enabled: true, refreshInterval: 5000 }));

      // Initial fetch
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(mockPoolStore.fetchPools).toHaveBeenCalledTimes(1);

      // Poll after 5 seconds (background refresh)
      await act(async () => {
        vi.advanceTimersByTime(5000);
        await vi.runOnlyPendingTimersAsync();
      });
      expect(mockPoolStore.refreshPools).toHaveBeenCalledTimes(1);
    });

    it('should not poll when disabled', async () => {
      renderHook(() => usePoolRefresh({ enabled: false }));

      await act(async () => {
        vi.advanceTimersByTime(60000);
        await vi.runOnlyPendingTimersAsync();
      });

      expect(mockPoolStore.fetchPools).not.toHaveBeenCalled();
      expect(mockPoolStore.refreshPools).not.toHaveBeenCalled();
    });

    it('should cleanup polling on unmount', async () => {
      const { unmount } = renderHook(() => usePoolRefresh({ enabled: true }));

      // Initial fetch
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(mockPoolStore.fetchPools).toHaveBeenCalledTimes(1);

      // Unmount
      unmount();

      // Advance time - should not trigger more refreshes
      await act(async () => {
        vi.advanceTimersByTime(60000);
        await vi.runOnlyPendingTimersAsync();
      });
      expect(mockPoolStore.fetchPools).toHaveBeenCalledTimes(1);
      expect(mockPoolStore.refreshPools).not.toHaveBeenCalled();
    });
  });

  describe('Manual Refresh', () => {
    it('should allow manual refresh trigger', async () => {
      const { result } = renderHook(() => usePoolRefresh({ enabled: false }));

      await act(async () => {
        await result.current.manualRefresh();
      });

      expect(mockPoolStore.refreshPools).toHaveBeenCalledWith(mockConnection);
    });

    it('should update isBackgroundRefresh state during manual refresh', async () => {
      mockPoolStore.refreshPools.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const { result } = renderHook(() => usePoolRefresh({ enabled: false }));

      expect(result.current.isBackgroundRefresh).toBe(false);

      const refreshPromise = act(async () => {
        await result.current.manualRefresh();
      });

      // Should be refreshing during the operation
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      await refreshPromise;

      // Should be done after completion
      expect(result.current.isBackgroundRefresh).toBe(false);
    });
  });

  describe('Exponential Backoff', () => {
    it('should implement exponential backoff on consecutive failures', async () => {
      mockPoolStore.fetchPools.mockRejectedValue(new Error('Network error'));
      mockPoolStore.refreshPools.mockRejectedValue(new Error('Network error'));
      vi.mocked(usePoolStore).mockReturnValue({
        ...mockPoolStore,
        consecutiveFailures: 0,
      } as any);

      const { result } = renderHook(() => usePoolRefresh({ enabled: true }));

      // First failure
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(result.current.currentBackoffDelay).toBe(2000); // 1s * 2

      // Second failure
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await vi.runOnlyPendingTimersAsync();
      });
      expect(result.current.currentBackoffDelay).toBe(4000); // 2s * 2

      // Third failure
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await vi.runOnlyPendingTimersAsync();
      });
      expect(result.current.currentBackoffDelay).toBe(8000); // 4s * 2
    });

    it('should cap backoff delay at maximum (30 seconds)', async () => {
      mockPoolStore.fetchPools.mockRejectedValue(new Error('Network error'));
      mockPoolStore.refreshPools.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => usePoolRefresh({ enabled: true }));

      // Trigger multiple failures to exceed max backoff
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          vi.advanceTimersByTime(30000);
          await vi.runOnlyPendingTimersAsync();
        });
      }

      // Should be capped at 30 seconds
      expect(result.current.currentBackoffDelay).toBeLessThanOrEqual(30000);
    });

    it('should reset backoff on successful refresh', async () => {
      // Start with failures
      mockPoolStore.fetchPools.mockRejectedValueOnce(new Error('Network error'));
      mockPoolStore.refreshPools.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => usePoolRefresh({ enabled: true }));

      // Two failures
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await vi.runOnlyPendingTimersAsync();
      });

      expect(result.current.currentBackoffDelay).toBe(4000);

      // Now succeed
      mockPoolStore.refreshPools.mockResolvedValueOnce(undefined);
      vi.mocked(usePoolStore).mockReturnValue({
        ...mockPoolStore,
        consecutiveFailures: 0,
      } as any);
      
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await vi.runOnlyPendingTimersAsync();
      });

      // Should reset
      expect(result.current.currentBackoffDelay).toBe(1000);
    });

    it('should skip polls during backoff period', async () => {
      mockPoolStore.fetchPools.mockRejectedValue(new Error('Network error'));
      mockPoolStore.refreshPools.mockRejectedValue(new Error('Network error'));

      renderHook(() => usePoolRefresh({ enabled: true }));

      // First failure - sets backoff to 2s
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(mockPoolStore.fetchPools).toHaveBeenCalledTimes(1);

      // Try to poll after 1 second (within backoff period)
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await vi.runOnlyPendingTimersAsync();
      });
      // Should still be 1 call (skipped due to backoff)
      expect(mockPoolStore.refreshPools).toHaveBeenCalledTimes(0);

      // Poll after backoff period expires (after 30s from initial)
      await act(async () => {
        vi.advanceTimersByTime(29000); // Total 30s from initial
        await vi.runOnlyPendingTimersAsync();
      });
      // Should now attempt background refresh
      expect(mockPoolStore.refreshPools).toHaveBeenCalledTimes(1);
    });
  });

  describe('Staleness Detection', () => {
    it('should detect stale data (older than 1 minute)', () => {
      const staleTime = Date.now() - 61 * 1000; // 61 seconds ago
      vi.mocked(usePoolStore).mockReturnValue({
        ...mockPoolStore,
        lastFetchTime: staleTime,
      } as any);

      const { result } = renderHook(() => usePoolRefresh({ enabled: false }));

      expect(result.current.isStale).toBe(true);
    });

    it('should not mark fresh data as stale', () => {
      const freshTime = Date.now() - 30 * 1000; // 30 seconds ago
      vi.mocked(usePoolStore).mockReturnValue({
        ...mockPoolStore,
        lastFetchTime: freshTime,
      } as any);

      const { result } = renderHook(() => usePoolRefresh({ enabled: false }));

      expect(result.current.isStale).toBe(false);
    });

    it('should update staleness as time passes', async () => {
      const initialTime = Date.now();
      vi.mocked(usePoolStore).mockReturnValue({
        ...mockPoolStore,
        lastFetchTime: initialTime,
      } as any);

      const { result, rerender } = renderHook(() => usePoolRefresh({ enabled: false }));

      // Initially fresh
      expect(result.current.isStale).toBe(false);

      // Advance time by 61 seconds
      await act(async () => {
        vi.advanceTimersByTime(61000);
      });

      // Rerender to update staleness check
      rerender();

      // Should now be stale
      expect(result.current.isStale).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should capture and expose errors', async () => {
      const testError = new Error('Test error');
      mockPoolStore.refreshPools.mockRejectedValue(testError);

      const { result } = renderHook(() => usePoolRefresh({ enabled: true }));

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      expect(result.current.error).toEqual(testError);
    });

    it('should call onError callback when refresh fails', async () => {
      const testError = new Error('Test error');
      const onError = vi.fn();
      mockPoolStore.refreshPools.mockRejectedValue(testError);

      renderHook(() => usePoolRefresh({ enabled: true, onError }));

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      expect(onError).toHaveBeenCalledWith(testError);
    });

    it('should call onSuccess callback when refresh succeeds', async () => {
      const onSuccess = vi.fn();
      mockPoolStore.refreshPools.mockResolvedValue(undefined);

      renderHook(() => usePoolRefresh({ enabled: true, onSuccess }));

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      expect(onSuccess).toHaveBeenCalled();
    });

    it('should clear error on successful refresh', async () => {
      // Start with error
      mockPoolStore.refreshPools.mockRejectedValueOnce(new Error('Test error'));

      const { result } = renderHook(() => usePoolRefresh({ enabled: true }));

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(result.current.error).toBeTruthy();

      // Now succeed
      mockPoolStore.refreshPools.mockResolvedValueOnce(undefined);
      await act(async () => {
        vi.advanceTimersByTime(10000);
        await vi.runOnlyPendingTimersAsync();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should perform initial fetch even if no pools are loaded', async () => {
      vi.mocked(usePoolStore).mockReturnValue({
        ...mockPoolStore,
        pools: [],
      } as any);

      renderHook(() => usePoolRefresh({ enabled: true }));

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      // Initial fetch should still be called
      expect(mockPoolStore.fetchPools).toHaveBeenCalledWith(mockConnection, true);
    });

    it('should not start multiple concurrent refreshes', async () => {
      vi.mocked(usePoolStore).mockReturnValue({
        ...mockPoolStore,
        loading: false,
      } as any);
      
      mockPoolStore.refreshPools.mockImplementation(
        () => {
          vi.mocked(usePoolStore).mockReturnValue({
            ...mockPoolStore,
            loading: true,
          } as any);
          return new Promise((resolve) => setTimeout(resolve, 1000));
        }
      );

      const { result } = renderHook(() => usePoolRefresh({ enabled: false }));

      // Start first refresh
      const refresh1 = act(async () => {
        await result.current.manualRefresh();
      });

      // Try to start second refresh while first is in progress
      const refresh2 = act(async () => {
        await result.current.manualRefresh();
      });

      await Promise.all([refresh1, refresh2]);

      // Should only call once (second call skipped due to loading state)
      expect(mockPoolStore.refreshPools).toHaveBeenCalledTimes(1);
    });

    it('should expose lastRefreshTime from store', () => {
      const testTime = Date.now() - 5000;
      vi.mocked(usePoolStore).mockReturnValue({
        ...mockPoolStore,
        lastFetchTime: testTime,
      } as any);

      const { result } = renderHook(() => usePoolRefresh({ enabled: false }));

      expect(result.current.lastRefreshTime).toBe(testTime);
    });
  });

  describe('Clear and Refresh', () => {
    it('should clear cache and perform initial fetch', async () => {
      const { result } = renderHook(() => usePoolRefresh({ enabled: false }));

      await act(async () => {
        await result.current.clearAndRefresh();
      });

      expect(mockPoolStore.clearCache).toHaveBeenCalled();
      expect(mockPoolStore.fetchPools).toHaveBeenCalledWith(mockConnection, true);
    });

    it('should reset error state on clearAndRefresh', async () => {
      mockPoolStore.fetchPools.mockRejectedValueOnce(new Error('Test error'));

      const { result } = renderHook(() => usePoolRefresh({ enabled: false }));

      // Trigger an error
      await act(async () => {
        await result.current.manualRefresh();
      });

      expect(result.current.error).toBeTruthy();

      // Clear and refresh
      mockPoolStore.fetchPools.mockResolvedValueOnce(undefined);
      await act(async () => {
        await result.current.clearAndRefresh();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
