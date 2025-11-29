/**
 * SAMM Router Service
 * 
 * Service for communicating with the SAMM Router backend API to get optimal
 * shard routing recommendations for token swaps.
 */

/**
 * Request payload for the route API endpoint
 */
export interface RouteRequest {
  /** Token A mint address (base-58 encoded) */
  tokenA: string;
  /** Token B mint address (base-58 encoded) */
  tokenB: string;
  /** Which token is being input (must be tokenA or tokenB) */
  inputToken: string;
  /** Input amount in base units (string to handle large numbers) */
  inputAmount: string;
  /** Trader wallet address (base-58 encoded) */
  trader: string;
}

/**
 * Shard information returned by the backend
 */
export interface ShardData {
  /** Unique identifier for the shard */
  id: string;
  /** Shard pool address (base-58 encoded) */
  address: string;
  /** Token pair information */
  tokenPair: {
    tokenA: string;
    tokenB: string;
  };
  /** Current reserve balances */
  reserves: {
    tokenA: string;
    tokenB: string;
  };
}

/**
 * Response from the route API endpoint
 */
export interface RouteResponse {
  /** Whether the request was successful */
  success: boolean;
  /** Route data (present when success is true) */
  data?: {
    /** Selected shard information */
    shard: ShardData;
    /** Expected output amount in base units */
    expectedOutput: string;
    /** Price impact as decimal (e.g., 0.05 for 5%) */
    priceImpact: number;
    /** Explanation of why this shard was selected */
    reason: string;
  };
  /** Error message (present when success is false) */
  error?: string;
}

/**
 * Shard information for liquidity routing
 */
export interface LiquidityShardData {
  /** Unique identifier for the shard */
  id: string;
  /** Shard pool address (base-58 encoded) */
  address: string;
  /** Current reserve balances */
  reserves: {
    tokenA: string;
    tokenB: string;
  };
}

/**
 * Response from the smallest shards API endpoint
 */
export interface SmallestShardsResponse {
  /** Whether the request was successful */
  success: boolean;
  /** Shard data (present when success is true) */
  data?: {
    /** Token pair information */
    tokenPair: {
      tokenA: string;
      tokenB: string;
    };
    /** Input token mint address */
    inputToken: string;
    /** Array of shards sorted by size (smallest first) */
    shards: LiquidityShardData[];
    /** Total number of shards */
    count: number;
  };
  /** Error message (present when success is false) */
  error?: string;
}

/**
 * Service for interacting with the SAMM Router backend API
 */
export class SammRouterService {
  private baseUrl: string;
  private timeout: number = 5000; // 5 second timeout

  /**
   * Normalizes a URL to use HTTPS when in a secure (HTTPS) context
   * This prevents mixed content errors in production environments
   * @param url - The URL to normalize
   * @returns The normalized URL with HTTPS if needed
   */
  private normalizeUrl(url: string): string {
    // Check if we're in a browser environment and the current page is HTTPS
    const isSecureContext = typeof window !== 'undefined' && window.location.protocol === 'https:';
    
    // If we're in a secure context and the URL is HTTP, convert it to HTTPS
    if (isSecureContext && url.startsWith('http://')) {
      const normalizedUrl = url.replace('http://', 'https://');
      console.warn(
        '[SammRouterService] Detected HTTP URL in HTTPS context. ' +
        `Converting ${url} to ${normalizedUrl} to prevent mixed content errors.`
      );
      return normalizedUrl;
    }
    
    return url;
  }

  /**
   * Creates a new SammRouterService instance
   * @param baseUrl - Optional base URL for the API. Falls back to environment variable or default.
   */
  constructor(baseUrl?: string) {
    const rawUrl = 
      baseUrl || 
      process.env.NEXT_PUBLIC_SAMM_ROUTER_API_URL || 
      'https://saigreen.cloud:3000';
    
    // Normalize the URL to use HTTPS in production/secure contexts
    this.baseUrl = this.normalizeUrl(rawUrl);
    
    console.log('[SammRouterService] Initialized with base URL:', this.baseUrl);
    
    // Warn if we detect HTTP in production (should be caught by normalizeUrl, but extra safety)
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && this.baseUrl.startsWith('http://')) {
      console.error(
        '[SammRouterService] WARNING: HTTP URL detected in HTTPS context. ' +
        'This will cause mixed content errors. Please use HTTPS URL or set NEXT_PUBLIC_SAMM_ROUTER_API_URL to HTTPS.'
      );
    }
  }

  /**
   * Get optimal route for a token swap
   * @param request - Route request parameters
   * @returns Promise resolving to route response
   * @throws Error if request fails or times out
   */
  async getRoute(request: RouteRequest): Promise<RouteResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const startTime = performance.now();
    const timestamp = new Date().toISOString();

    try {
      const url = `${this.baseUrl}/api/route`;
      
      // Log backend API request details
      console.log('[SammRouterService] Backend API Request:', {
        timestamp,
        url,
        tokens: {
          tokenA: request.tokenA,
          tokenB: request.tokenB,
          inputToken: request.inputToken
        },
        amount: request.inputAmount,
        trader: request.trader
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = performance.now() - startTime;

      // Handle HTTP error responses
      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error body');
        console.error('[SammRouterService] HTTP error:', {
          timestamp: new Date().toISOString(),
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
          responseTime: `${responseTime.toFixed(2)}ms`
        });
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}. Body: ${errorBody}`
        );
      }

      // Parse JSON response
      let data: RouteResponse;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('[SammRouterService] JSON parsing error:', {
          timestamp: new Date().toISOString(),
          error: parseError,
          responseTime: `${responseTime.toFixed(2)}ms`
        });
        throw new Error(
          `Failed to parse response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
      }

      // Validate response structure
      if (typeof data.success !== 'boolean') {
        throw new Error('Invalid response: missing or invalid "success" field');
      }

      if (data.success && !data.data) {
        throw new Error('Invalid response: success is true but data is missing');
      }

      if (!data.success && !data.error) {
        throw new Error('Invalid response: success is false but error message is missing');
      }

      // Log successful backend API response with response time
      console.log('[SammRouterService] Backend API Response:', {
        timestamp: new Date().toISOString(),
        success: data.success,
        responseTime: `${responseTime.toFixed(2)}ms`,
        selectedShard: data.data?.shard.address,
        shardId: data.data?.shard.id,
        reason: data.data?.reason,
        expectedOutput: data.data?.expectedOutput,
        priceImpact: data.data?.priceImpact
      });

      return data;

    } catch (error) {
      clearTimeout(timeoutId);
      const responseTime = performance.now() - startTime;

      // Handle timeout errors
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(
          `Request timed out after ${this.timeout}ms`
        );
        console.error('[SammRouterService] Timeout error:', {
          timestamp: new Date().toISOString(),
          error: timeoutError.message,
          timeout: `${this.timeout}ms`,
          responseTime: `${responseTime.toFixed(2)}ms`
        });
        throw timeoutError;
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError = new Error(
          `Network error: Unable to connect to ${this.baseUrl}. ${error.message}`
        );
        console.error('[SammRouterService] Network error:', {
          timestamp: new Date().toISOString(),
          error: networkError.message,
          baseUrl: this.baseUrl,
          responseTime: `${responseTime.toFixed(2)}ms`
        });
        throw networkError;
      }

      // Re-throw other errors with timestamp
      console.error('[SammRouterService] Request failed:', {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        responseTime: `${responseTime.toFixed(2)}ms`
      });
      throw error;
    }
  }

  /**
   * Get smallest shards for liquidity routing
   * 
   * Returns shards sorted by size (smallest first) for optimal liquidity addition.
   * Liquidity providers should add liquidity to the smallest shard for best trader experience.
   * This implements the "fillup strategy" from the SAMM paper.
   * 
   * @param tokenA - Token A mint address
   * @param tokenB - Token B mint address
   * @param inputToken - Which token you're measuring (usually tokenA)
   * @returns Promise resolving to smallest shards response
   * @throws Error if request fails or times out
   */
  async getSmallestShards(
    tokenA: string,
    tokenB: string,
    inputToken: string
  ): Promise<SmallestShardsResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const startTime = performance.now();
    const timestamp = new Date().toISOString();

    try {
      const url = `${this.baseUrl}/api/shards/smallest/${tokenA}/${tokenB}/${inputToken}`;
      
      // Log backend API request details
      console.log('[SammRouterService] Smallest Shards Request:', {
        timestamp,
        url,
        tokenA,
        tokenB,
        inputToken
      });

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = performance.now() - startTime;

      // Handle HTTP error responses
      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error body');
        console.error('[SammRouterService] HTTP error:', {
          timestamp: new Date().toISOString(),
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
          responseTime: `${responseTime.toFixed(2)}ms`
        });
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}. Body: ${errorBody}`
        );
      }

      // Parse JSON response
      let data: SmallestShardsResponse;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('[SammRouterService] JSON parsing error:', {
          timestamp: new Date().toISOString(),
          error: parseError,
          responseTime: `${responseTime.toFixed(2)}ms`
        });
        throw new Error(
          `Failed to parse response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
      }

      // Validate response structure
      if (typeof data.success !== 'boolean') {
        throw new Error('Invalid response: missing or invalid "success" field');
      }

      if (data.success && !data.data) {
        throw new Error('Invalid response: success is true but data is missing');
      }

      if (!data.success && !data.error) {
        throw new Error('Invalid response: success is false but error message is missing');
      }

      // Log successful backend API response
      console.log('[SammRouterService] Smallest Shards Response:', {
        timestamp: new Date().toISOString(),
        success: data.success,
        responseTime: `${responseTime.toFixed(2)}ms`,
        shardCount: data.data?.count,
        smallestShard: data.data?.shards[0]?.address
      });

      return data;

    } catch (error) {
      clearTimeout(timeoutId);
      const responseTime = performance.now() - startTime;

      // Handle timeout errors
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(
          `Request timed out after ${this.timeout}ms`
        );
        console.error('[SammRouterService] Timeout error:', {
          timestamp: new Date().toISOString(),
          error: timeoutError.message,
          timeout: `${this.timeout}ms`,
          responseTime: `${responseTime.toFixed(2)}ms`
        });
        throw timeoutError;
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError = new Error(
          `Network error: Unable to connect to ${this.baseUrl}. ${error.message}`
        );
        console.error('[SammRouterService] Network error:', {
          timestamp: new Date().toISOString(),
          error: networkError.message,
          baseUrl: this.baseUrl,
          responseTime: `${responseTime.toFixed(2)}ms`
        });
        throw networkError;
      }

      // Re-throw other errors with timestamp
      console.error('[SammRouterService] Request failed:', {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        responseTime: `${responseTime.toFixed(2)}ms`
      });
      throw error;
    }
  }

  /**
   * Check if the backend API is available and healthy
   * @returns Promise resolving to true if healthy, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/api/health`;
      
      console.log('[SammRouterService] Health check:', url);

      const response = await fetch(url, {
        method: 'GET',
      });

      const isHealthy = response.ok && response.status === 200;
      
      console.log('[SammRouterService] Health check result:', {
        url,
        status: response.status,
        healthy: isHealthy,
        timestamp: new Date().toISOString()
      });

      return isHealthy;

    } catch (error) {
      console.log('[SammRouterService] Health check failed:', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }
}
