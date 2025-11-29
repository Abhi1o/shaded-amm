import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchWithTimeout,
  fetchWithRetry,
  classifyError,
  isErrorRetryable,
  calculateBackoffDelay,
  PoolFetchError,
  PoolFetchErrorType,
  createPoolFetchError,
  DEFAULT_RETRY_CONFIG,
} from '../fetchUtils';

describe('fetchUtils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('classifyError', () => {
    it('classifies timeout errors correctly', () => {
      const error = new Error('Request timed out');
      expect(classifyError(error)).toBe(PoolFetchErrorType.TIMEOUT);
    });

    it('classifies network errors correctly', () => {
      const error = new Error('Failed to fetch');
      expect(classifyError(error)).toBe(PoolFetchErrorType.NETWORK);
    });

    it('classifies RPC errors correctly', () => {
      const error = new Error('RPC rate limit exceeded');
      expect(classifyError(error)).toBe(PoolFetchErrorType.RPC_ERROR);
    });

    it('classifies invalid data errors correctly', () => {
      const error = new Error('Invalid account data');
      expect(classifyError(error)).toBe(PoolFetchErrorType.INVALID_DATA);
    });

    it('classifies unknown errors as UNKNOWN', () => {
      const error = new Error('Something went wrong');
      expect(classifyError(error)).toBe(PoolFetchErrorType.UNKNOWN);
    });
  });

  describe('isErrorRetryable', () => {
    it('returns true for timeout errors', () => {
      const error = new Error('Request timed out');
      expect(isErrorRetryable(error)).toBe(true);
    });

    it('returns true for network errors', () => {
      const error = new Error('Network connection failed');
      expect(isErrorRetryable(error)).toBe(true);
    });

    it('returns false for invalid data errors', () => {
      const error = new Error('Invalid data format');
      expect(isErrorRetryable(error)).toBe(false);
    });

    it('respects PoolFetchError retryable flag', () => {
      const error = new PoolFetchError('Test error', PoolFetchErrorType.TIMEOUT, {
        retryable: false,
      });
      expect(isErrorRetryable(error)).toBe(false);
    });
  });

  describe('fetchWithTimeout', () => {
    it('resolves when promise completes before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await fetchWithTimeout(promise, 1000);
      expect(result).toBe('success');
    });

    it('rejects with timeout error when promise exceeds timeout', async () => {
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve('too late'), 2000);
      });

      const timeoutPromise = fetchWithTimeout(promise, 1000);
      
      // Advance timers to trigger timeout
      vi.advanceTimersByTime(1000);

      await expect(timeoutPromise).rejects.toThrow('Operation timed out after 1000ms');
    });

    it('creates PoolFetchError with TIMEOUT type', async () => {
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve('too late'), 2000);
      });

      const timeoutPromise = fetchWithTimeout(promise, 1000);
      vi.advanceTimersByTime(1000);

      try {
        await timeoutPromise;
      } catch (error) {
        expect(error).toBeInstanceOf(PoolFetchError);
        expect((error as PoolFetchError).type).toBe(PoolFetchErrorType.TIMEOUT);
      }
    });
  });

  describe('calculateBackoffDelay', () => {
    it('calculates exponential backoff correctly', () => {
      const config = DEFAULT_RETRY_CONFIG;
      
      expect(calculateBackoffDelay(0, config)).toBe(1000); // 1s
      expect(calculateBackoffDelay(1, config)).toBe(2000); // 2s
      expect(calculateBackoffDelay(2, config)).toBe(4000); // 4s
      expect(calculateBackoffDelay(3, config)).toBe(8000); // 8s
      expect(calculateBackoffDelay(4, config)).toBe(16000); // 16s
    });

    it('caps delay at maxDelay', () => {
      const config = DEFAULT_RETRY_CONFIG;
      
      expect(calculateBackoffDelay(5, config)).toBe(30000); // Capped at 30s
      expect(calculateBackoffDelay(10, config)).toBe(30000); // Still capped
    });
  });

  describe('fetchWithRetry', () => {
    it('returns result on first successful attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await fetchWithRetry(fn, { ...DEFAULT_RETRY_CONFIG, maxRetries: 3 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throws error for non-retryable errors', async () => {
      const error = new Error('Invalid data format');
      const fn = vi.fn().mockRejectedValue(error);
      
      await expect(
        fetchWithRetry(fn, { ...DEFAULT_RETRY_CONFIG, maxRetries: 3 })
      ).rejects.toThrow('Invalid data format');
      
      expect(fn).toHaveBeenCalledTimes(1); // Should not retry
    });
  });

  describe('createPoolFetchError', () => {
    it('returns PoolFetchError as-is', () => {
      const error = new PoolFetchError('Test', PoolFetchErrorType.TIMEOUT);
      const result = createPoolFetchError(error);
      expect(result).toBe(error);
    });

    it('converts regular Error to PoolFetchError', () => {
      const error = new Error('Network failed');
      const result = createPoolFetchError(error, 'pool123');
      
      expect(result).toBeInstanceOf(PoolFetchError);
      expect(result.type).toBe(PoolFetchErrorType.NETWORK);
      expect(result.poolAddress).toBe('pool123');
      expect(result.retryable).toBe(true);
    });

    it('converts string to PoolFetchError', () => {
      const result = createPoolFetchError('Something went wrong');
      
      expect(result).toBeInstanceOf(PoolFetchError);
      expect(result.message).toBe('Something went wrong');
    });
  });
});
