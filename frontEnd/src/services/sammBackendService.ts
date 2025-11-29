/**
 * SAMM Backend Service
 * 
 * Provides optimal shard selection and multi-hop routing for Monad Testnet DEX
 * API Documentation: https://samm-evm-production.up.railway.app/
 */

const BASE_URL = process.env.NEXT_PUBLIC_SAMM_BACKEND_URL || 'http://localhost:5009';

export interface HealthResponse {
  status: string;
  timestamp: string;
  chain: string;
  chainId: number;
  pools: Record<string, number>;
  totalShards: number;
  version: string;
}

export interface ShardInfo {
  pair: string;
  name: string;
  address: string;
  liquidity: string;
  reserves: {
    reserveA: string;
    reserveB: string;
  };
  sammParams: {
    c: string;
    beta1?: string;
    rmin?: string;
    rmax?: string;
  };
}

export interface BestShardResponse {
  chain: string;
  chainId: number;
  bestShard: {
    name: string;
    address: string;
    liquidity: string;
    c: number;
    amountIn: string;
    amountOut: string;
    tradeFee: string;
    totalCost: string;
  };
  allShards: Array<{
    name: string;
    address: string;
    liquidity: string;
    c: number;
    amountIn: string;
    amountOut: string;
    tradeFee: string;
    totalCost: string;
  }>;
  property: string;
  timestamp: string;
}

export interface MultiHopResponse {
  chain: string;
  chainId: number;
  route: string;
  path: string[];
  amountIn: string;
  amountOut: string;
  totalFee: string;
  steps: Array<{
    from: string;
    to: string;
    shard: string;
    amountIn: string;
    amountOut: string;
    tradeFee: string;
  }>;
  timestamp: string;
}

export interface DeploymentInfo {
  network: string;
  chainId: number;
  factory: string;
  tokens: Record<string, {
    address: string;
    decimals: number;
  }>;
  pools: Record<string, Array<{
    name: string;
    address: string;
    liquidity: string;
    c: number;
  }>>;
  stats: {
    totalShards: number;
    usdcUsdtShards: number;
    usdtDaiShards: number;
    totalLiquidity: string;
  };
  timestamp: string;
}

export class SammBackendService {
  /**
   * Check API health and availability
   * Use case: Status indicators, monitoring
   */
  static async checkHealth(): Promise<HealthResponse> {
    try {
      const response = await fetch(`${BASE_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('SAMM Backend health check failed:', error);
      throw error;
    }
  }

  /**
   * Get all available shards
   * Use case: Pool list display, liquidity overview
   */
  static async getAllShards(): Promise<{ shards: ShardInfo[]; total: number; timestamp: string }> {
    try {
      const response = await fetch(`${BASE_URL}/api/shards`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch shards: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch shards:', error);
      throw error;
    }
  }

  /**
   * Get best shard for a swap (PRIMARY SWAP ENDPOINT)
   * Use case: Get optimal pool and accurate quote for swaps
   * 
   * @param amountOut - Amount user wants to receive (in token's smallest unit)
   * @param tokenIn - Input token address
   * @param tokenOut - Output token address
   */
  static async getBestShard(
    amountOut: string,
    tokenIn: string,
    tokenOut: string
  ): Promise<BestShardResponse> {
    try {
      const response = await fetch(`${BASE_URL}/api/swap/best-shard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountOut,
          tokenIn,
          tokenOut,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to get best shard: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get best shard:', error);
      throw error;
    }
  }

  /**
   * Get multi-hop route for tokens without direct pair
   * Use case: Swap USDC → DAI (via USDT)
   * 
   * @param amountIn - Amount user wants to swap (in token's smallest unit)
   * @param tokenIn - Input token address
   * @param tokenOut - Output token address
   */
  static async getMultiHopRoute(
    amountIn: string,
    tokenIn: string,
    tokenOut: string
  ): Promise<MultiHopResponse> {
    try {
      const response = await fetch(`${BASE_URL}/api/swap/multi-hop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountIn,
          tokenIn,
          tokenOut,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to get multi-hop route: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get multi-hop route:', error);
      throw error;
    }
  }

  /**
   * Get specific shard details
   * Use case: Pool detail pages, advanced info
   * 
   * @param address - Pool contract address
   */
  static async getShard(address: string): Promise<ShardInfo> {
    try {
      const response = await fetch(`${BASE_URL}/api/shard/${address}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch shard: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch shard:', error);
      throw error;
    }
  }

  /**
   * Get deployment information
   * Use case: Contract addresses, token info, network details
   */
  static async getDeploymentInfo(): Promise<DeploymentInfo> {
    try {
      const response = await fetch(`${BASE_URL}/api/deployment`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch deployment info: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch deployment info:', error);
      throw error;
    }
  }

  /**
   * Check if a direct pair exists between two tokens
   */
  static async hasDirectPair(tokenIn: string, tokenOut: string): Promise<boolean> {
    try {
      const shards = await this.getAllShards();
      return shards.shards.some(shard => {
        // Check if shard contains both tokens
        const tokens = shard.pair.split('/');
        return tokens.length === 2;
      });
    } catch (error) {
      console.error('Failed to check direct pair:', error);
      return false;
    }
  }
}

/**
 * Utility functions for working with SAMM Backend responses
 */
export class SammUtils {
  /**
   * Format amount from smallest unit to human-readable
   */
  static formatAmount(amount: string, decimals: number): string {
    try {
      const value = BigInt(amount);
      const divisor = BigInt(10 ** decimals);
      const whole = value / divisor;
      const remainder = value % divisor;
      
      if (remainder === BigInt(0)) {
        return whole.toString();
      }
      
      const remainderStr = remainder.toString().padStart(decimals, '0');
      return `${whole}.${remainderStr}`.replace(/\.?0+$/, '');
    } catch (error) {
      console.error('Failed to format amount:', error);
      return '0';
    }
  }

  /**
   * Calculate price impact percentage
   */
  static calculatePriceImpact(amountIn: string, amountOut: string, fee: string): number {
    try {
      const input = parseFloat(amountIn);
      const output = parseFloat(amountOut);
      const feeAmount = parseFloat(fee);
      
      const expectedOut = input - feeAmount;
      const impact = ((expectedOut - output) / expectedOut) * 100;
      
      return Math.abs(impact);
    } catch (error) {
      console.error('Failed to calculate price impact:', error);
      return 0;
    }
  }

  /**
   * Get color class for price impact
   */
  static getPriceImpactColor(impact: number): string {
    if (impact < 1) return 'text-green-400';
    if (impact < 5) return 'text-yellow-400';
    return 'text-red-400';
  }

  /**
   * Format fee as percentage
   */
  static formatFeePercentage(fee: string, amount: string): string {
    try {
      const feeNum = parseFloat(fee);
      const amountNum = parseFloat(amount);
      const percentage = (feeNum / amountNum) * 100;
      return percentage.toFixed(2);
    } catch (error) {
      return '0.00';
    }
  }

  /**
   * Convert amount to smallest unit
   */
  static toSmallestUnit(amount: string, decimals: number): string {
    try {
      const [whole, fraction = ''] = amount.split('.');
      const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
      return whole + paddedFraction;
    } catch (error) {
      console.error('Failed to convert to smallest unit:', error);
      return '0';
    }
  }
}

/**
 * Export singleton instance for convenience
 */
export const sammBackendService = {
  checkHealth: () => SammBackendService.checkHealth(),
  getAllShards: () => SammBackendService.getAllShards(),
  getBestShard: (amountOut: string, tokenIn: string, tokenOut: string) =>
    SammBackendService.getBestShard(amountOut, tokenIn, tokenOut),
  getMultiHopRoute: (amountIn: string, tokenIn: string, tokenOut: string) =>
    SammBackendService.getMultiHopRoute(amountIn, tokenIn, tokenOut),
  getShard: (address: string) => SammBackendService.getShard(address),
  getDeploymentInfo: () => SammBackendService.getDeploymentInfo(),
  hasDirectPair: (tokenIn: string, tokenOut: string) =>
    SammBackendService.hasDirectPair(tokenIn, tokenOut),
  isBackendAvailable: async (): Promise<boolean> => {
    try {
      const health = await SammBackendService.checkHealth();
      return health.status === 'healthy';
    } catch {
      return false;
    }
  },
};
