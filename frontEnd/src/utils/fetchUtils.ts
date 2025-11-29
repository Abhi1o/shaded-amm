// Fetch utility functions for timeout, retry, and error handling

/**
 * Error types for pool fetch operations
 */
export enum PoolFetchErrorType {
  TIMEOUT = 'timeout',
  NETWORK = 'network',
  INVALID_DATA = 'invalid_data',
  RPC_ERROR = 'rpc_error',
  UNKNOWN = 'unknown',
}

/**
 * Extended error class for pool fetch operations
 */
export class PoolFetchError extends Error {
  type: PoolFetchErrorType;
  poolAddress?: string;
  retryable: boolean;
  timestamp: number;
  originalError?: Error;

  constructor(
    message: string,
    type: PoolFetchErrorType,
    options?: {
      poolAddress?: string;
      retryable?: boolean;
      originalError?: Error;
    }
  ) {
    super(message);
    this.name = 'PoolFetchError';
    this.type = type;
    this.poolAddress = options?.poolAddress;
    this.retryable = options?.retryable ?? true;
    this.timestamp = Date.now();
    this.originalError = options?.originalError;
  }
}

/**
 * Classify an error into a specific error type
 */
export function classifyError(error: unknown): PoolFetchErrorType {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorString = errorMessage.toLowerCase();

  // Timeout errors
  if (
    errorString.includes('timeout') ||
    errorString.includes('timed out') ||
    errorString.includes('aborted')
  ) {
    return PoolFetchErrorType.TIMEOUT;
  }

  // Network errors
  if (
    errorString.includes('network') ||
    errorString.includes('failed to fetch') ||
    errorString.includes('connection') ||
    errorString.includes('econnrefused') ||
    errorString.includes('enotfound') ||
    errorString.includes('enetunreach')
  ) {
    return PoolFetchErrorType.NETWORK;
  }

  // RPC errors
  if (
    errorString.includes('rpc') ||
    errorString.includes('429') ||
    errorString.includes('rate limit') ||
    errorString.includes('internal server error') ||
    errorString.includes('service unavailable')
  ) {
    return PoolFetchErrorType.RPC_ERROR;
  }

  // Invalid data errors
  if (
    errorString.includes('invalid') ||
    errorString.includes('parse') ||
    errorString.includes('decode') ||
    errorString.includes('account not found') ||
    errorString.includes('null') ||
    errorString.includes('undefined')
  ) {
    return PoolFetchErrorType.INVALID_DATA;
  }

  return PoolFetchErrorType.UNKNOWN;
}

/**
 * Check if an error is retryable based on its type
 */
export function isErrorRetryable(error: unknown): boolean {
  if (error instanceof PoolFetchError) {
    return error.retryable;
  }

  const errorType = classifyError(error);
  
  // Timeout, network, and RPC errors are retryable
  // Invalid data errors are typically not retryable
  return (
    errorType === PoolFetchErrorType.TIMEOUT ||
    errorType === PoolFetchErrorType.NETWORK ||
    errorType === PoolFetchErrorType.RPC_ERROR
  );
}

/**
 * Wraps a promise with a timeout
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that rejects if timeout is exceeded
 */
export async function fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new PoolFetchError(
          `Operation timed out after ${timeoutMs}ms`,
          PoolFetchErrorType.TIMEOUT,
          { retryable: true }
        )
      );
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  multiplier: number;
  timeoutMs?: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  multiplier: 2,
  timeoutMs: 10000, // 10 seconds (increased from 5)
};

/**
 * Calculate exponential backoff delay
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.baseDelay * Math.pow(config.multiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Sleep for a specified duration
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param config - Retry configuration
 * @returns Promise that resolves with the function result or rejects after max retries
 */
export async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Wrap with timeout if configured
      if (config.timeoutMs) {
        return await fetchWithTimeout(fn(), config.timeoutMs);
      }
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!isErrorRetryable(error)) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === config.maxRetries) {
        throw error;
      }

      // Calculate backoff delay and wait
      const delay = calculateBackoffDelay(attempt, config);
      console.log(
        `Retry attempt ${attempt + 1}/${config.maxRetries} failed. Retrying in ${delay}ms...`,
        error
      );
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Create a PoolFetchError from an unknown error
 * @param error - The error to convert
 * @param poolAddress - Optional pool address for context
 * @returns PoolFetchError instance
 */
export function createPoolFetchError(
  error: unknown,
  poolAddress?: string
): PoolFetchError {
  if (error instanceof PoolFetchError) {
    return error;
  }

  const errorType = classifyError(error);
  const message = error instanceof Error ? error.message : String(error);
  const retryable = isErrorRetryable(error);

  return new PoolFetchError(message, errorType, {
    poolAddress,
    retryable,
    originalError: error instanceof Error ? error : undefined,
  });
}
