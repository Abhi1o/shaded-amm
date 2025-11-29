import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SammRouterService, RouteRequest, RouteResponse } from '../sammRouterService';

// Mock fetch globally
global.fetch = vi.fn();

describe('SammRouterService', () => {
  let service: SammRouterService;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockRouteRequest: RouteRequest = {
    tokenA: 'BJYyjsX1xPbjL661mozEnU2vPf5gznbZAdGRXQh9Gufa',
    tokenB: 'F7CVt32PGjVCJo7N4PS4qUzXVMBQBj3iV4qCVFdHgseu',
    inputToken: 'BJYyjsX1xPbjL661mozEnU2vPf5gznbZAdGRXQh9Gufa',
    inputAmount: '121000000',
    trader: 'HzkaW8LY5uDaDpSvEscSEcrTnngSgwAvsQZzVzCk6TvX',
  };

  const mockSuccessResponse: RouteResponse = {
    success: true,
    data: {
      shard: {
        id: 'pool_id_123',
        address: 'PoolAddressBase58Example',
        tokenPair: {
          tokenA: 'BJYyjsX1xPbjL661mozEnU2vPf5gznbZAdGRXQh9Gufa',
          tokenB: 'F7CVt32PGjVCJo7N4PS4qUzXVMBQBj3iV4qCVFdHgseu',
        },
        reserves: {
          tokenA: '1000000000',
          tokenB: '1000000000',
        },
      },
      expectedOutput: '120500000',
      priceImpact: 0.0041,
      reason: 'Selected shard with lowest price impact',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.mocked(fetch);
    
    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use provided base URL', () => {
      const customUrl = 'http://custom-api.example.com';
      const customService = new SammRouterService(customUrl);
      
      expect(console.log).toHaveBeenCalledWith(
        '[SammRouterService] Initialized with base URL:',
        customUrl
      );
    });

    it('should use environment variable when no URL provided', () => {
      const originalEnv = process.env.NEXT_PUBLIC_SAMM_ROUTER_API_URL;
      process.env.NEXT_PUBLIC_SAMM_ROUTER_API_URL = 'http://env-api.example.com';
      
      const envService = new SammRouterService();
      
      expect(console.log).toHaveBeenCalledWith(
        '[SammRouterService] Initialized with base URL:',
        'http://env-api.example.com'
      );
      
      process.env.NEXT_PUBLIC_SAMM_ROUTER_API_URL = originalEnv;
    });

    it('should use default URL when no URL or env variable provided', () => {
      const originalEnv = process.env.NEXT_PUBLIC_SAMM_ROUTER_API_URL;
      delete process.env.NEXT_PUBLIC_SAMM_ROUTER_API_URL;
      
      const defaultService = new SammRouterService();
      
      expect(console.log).toHaveBeenCalledWith(
        '[SammRouterService] Initialized with base URL:',
        'https://saigreen.cloud:3000'
      );
      
      process.env.NEXT_PUBLIC_SAMM_ROUTER_API_URL = originalEnv;
    });
  });

  describe('getRoute', () => {
    beforeEach(() => {
      service = new SammRouterService('http://test-api.example.com');
    });

    it('should successfully fetch route with valid response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSuccessResponse),
      } as Response);

      const result = await service.getRoute(mockRouteRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.example.com/api/route',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mockRouteRequest),
        })
      );

      expect(result).toEqual(mockSuccessResponse);
      expect(result.success).toBe(true);
      expect(result.data?.shard.address).toBe('PoolAddressBase58Example');
      expect(result.data?.expectedOutput).toBe('120500000');
      expect(result.data?.priceImpact).toBe(0.0041);
    });

    it('should handle timeout with AbortController', async () => {
      mockFetch.mockImplementationOnce((url, options) => 
        new Promise((resolve, reject) => {
          // Simulate a long-running request that respects abort signal
          const timeout = setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve(mockSuccessResponse),
            } as Response);
          }, 10000); // 10 second delay
          
          // Listen for abort signal
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              const abortError = new Error('The operation was aborted.');
              abortError.name = 'AbortError';
              reject(abortError);
            });
          }
        })
      );

      await expect(service.getRoute(mockRouteRequest)).rejects.toThrow(
        'Request timed out after 5000ms'
      );

      expect(console.error).toHaveBeenCalledWith(
        '[SammRouterService] Timeout error:',
        'Request timed out after 5000ms'
      );
    }, 10000);

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(service.getRoute(mockRouteRequest)).rejects.toThrow(
        'Network error: Unable to connect to http://test-api.example.com'
      );

      expect(console.error).toHaveBeenCalledWith(
        '[SammRouterService] Network error:',
        expect.stringContaining('Network error')
      );
    });

    it('should handle HTTP error responses (4xx)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid token pair'),
      } as Response);

      await expect(service.getRoute(mockRouteRequest)).rejects.toThrow(
        'HTTP 400: Bad Request'
      );

      expect(console.error).toHaveBeenCalledWith(
        '[SammRouterService] HTTP error:',
        expect.objectContaining({
          status: 400,
          statusText: 'Bad Request',
          body: 'Invalid token pair',
        })
      );
    });

    it('should handle HTTP error responses (5xx)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error occurred'),
      } as Response);

      await expect(service.getRoute(mockRouteRequest)).rejects.toThrow(
        'HTTP 500: Internal Server Error'
      );

      expect(console.error).toHaveBeenCalledWith(
        '[SammRouterService] HTTP error:',
        expect.objectContaining({
          status: 500,
          statusText: 'Internal Server Error',
        })
      );
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Unexpected token in JSON')),
      } as Response);

      await expect(service.getRoute(mockRouteRequest)).rejects.toThrow(
        'Failed to parse response as JSON'
      );

      expect(console.error).toHaveBeenCalledWith(
        '[SammRouterService] JSON parsing error:',
        expect.any(Error)
      );
    });

    it('should validate response has success field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: {} }), // Missing success field
      } as Response);

      await expect(service.getRoute(mockRouteRequest)).rejects.toThrow(
        'Invalid response: missing or invalid "success" field'
      );
    });

    it('should validate successful response has data field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }), // Missing data field
      } as Response);

      await expect(service.getRoute(mockRouteRequest)).rejects.toThrow(
        'Invalid response: success is true but data is missing'
      );
    });

    it('should validate failed response has error field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: false }), // Missing error field
      } as Response);

      await expect(service.getRoute(mockRouteRequest)).rejects.toThrow(
        'Invalid response: success is false but error message is missing'
      );
    });

    it('should handle error response from backend', async () => {
      const errorResponse: RouteResponse = {
        success: false,
        error: 'No suitable shard found for this trade',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(errorResponse),
      } as Response);

      const result = await service.getRoute(mockRouteRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No suitable shard found for this trade');
      expect(result.data).toBeUndefined();
    });

    it('should include abort signal in fetch request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSuccessResponse),
      } as Response);

      await service.getRoute(mockRouteRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });
  });

  describe('healthCheck', () => {
    beforeEach(() => {
      service = new SammRouterService('http://test-api.example.com');
    });

    it('should return true when API is healthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      const result = await service.healthCheck();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.example.com/api/health',
        expect.objectContaining({
          method: 'GET',
        })
      );

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        '[SammRouterService] Health check result:',
        expect.objectContaining({
          url: 'http://test-api.example.com/api/health',
          status: 200,
          healthy: true,
        })
      );
    });

    it('should return false when API returns non-200 status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response);

      const result = await service.healthCheck();

      expect(result).toBe(false);
      expect(console.log).toHaveBeenCalledWith(
        '[SammRouterService] Health check result:',
        expect.objectContaining({
          status: 503,
          healthy: false,
        })
      );
    });

    it('should return false when network error occurs', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.healthCheck();

      expect(result).toBe(false);
      expect(console.log).toHaveBeenCalledWith(
        '[SammRouterService] Health check failed:',
        expect.objectContaining({
          error: 'Network error',
        })
      );
    });

    it('should return false when fetch throws TypeError', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });

    it('should not throw errors on health check failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(service.healthCheck()).resolves.toBe(false);
    });
  });
});
