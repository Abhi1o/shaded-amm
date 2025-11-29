/**
 * Request Throttling Utility
 * 
 * Helps prevent 429 rate limit errors by throttling RPC requests
 * and implementing intelligent backoff strategies.
 */

interface ThrottleConfig {
  maxRequestsPerSecond: number;
  burstLimit: number;
  cooldownMs: number;
}

interface RequestQueue {
  timestamp: number;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  operation: () => Promise<any>;
}

export class RequestThrottler {
  private requestTimes: number[] = [];
  private queue: RequestQueue[] = [];
  private processing = false;
  private config: ThrottleConfig;

  constructor(config: Partial<ThrottleConfig> = {}) {
    this.config = {
      maxRequestsPerSecond: 10, // Conservative default
      burstLimit: 20,
      cooldownMs: 1000,
      ...config,
    };
  }

  /**
   * Execute a request with throttling
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        timestamp: Date.now(),
        resolve,
        reject,
        operation,
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      
      // Clean old request times (older than 1 second)
      this.requestTimes = this.requestTimes.filter(
        time => now - time < 1000
      );

      // Check if we can make a request
      if (this.canMakeRequest()) {
        const request = this.queue.shift()!;
        this.requestTimes.push(now);

        try {
          const result = await request.operation();
          request.resolve(result);
        } catch (error) {
          // Check if it's a rate limit error
          if (this.isRateLimitError(error)) {
            console.warn('⚠️ Rate limit detected, applying backoff');
            await this.applyBackoff();
            // Re-queue the request
            this.queue.unshift(request);
          } else {
            request.reject(error);
          }
        }
      } else {
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.processing = false;
  }

  private canMakeRequest(): boolean {
    const now = Date.now();
    const recentRequests = this.requestTimes.filter(
      time => now - time < 1000
    );

    return recentRequests.length < this.config.maxRequestsPerSecond;
  }

  private isRateLimitError(error: any): boolean {
    return (
      error?.message?.includes('429') ||
      error?.status === 429 ||
      error?.code === 429 ||
      error?.message?.toLowerCase().includes('rate limit') ||
      error?.message?.toLowerCase().includes('too many requests')
    );
  }

  private async applyBackoff(): Promise<void> {
    // Exponential backoff with jitter
    const baseDelay = this.config.cooldownMs;
    const jitter = Math.random() * 500;
    const delay = baseDelay + jitter;
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Clear request times to reset rate limiting
    this.requestTimes = [];
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      recentRequests: this.requestTimes.length,
      processing: this.processing,
    };
  }
}

// Global throttler instances for different types of requests
export const rpcThrottler = new RequestThrottler({
  maxRequestsPerSecond: 8, // Conservative for RPC calls
  burstLimit: 15,
  cooldownMs: 2000,
});

export const priceThrottler = new RequestThrottler({
  maxRequestsPerSecond: 5, // Even more conservative for price APIs
  burstLimit: 10,
  cooldownMs: 3000,
});

/**
 * Utility function to throttle RPC calls
 */
export async function throttledRpcCall<T>(
  operation: () => Promise<T>
): Promise<T> {
  return rpcThrottler.execute(operation);
}

/**
 * Utility function to throttle price API calls
 */
export async function throttledPriceCall<T>(
  operation: () => Promise<T>
): Promise<T> {
  return priceThrottler.execute(operation);
}