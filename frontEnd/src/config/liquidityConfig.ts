/**
 * Liquidity Page Configuration
 * 
 * Production-optimized settings for the liquidity pools page
 * to minimize RPC requests and prevent 429 errors.
 */

export interface LiquidityPageConfig {
  /** Pool refresh interval in milliseconds */
  refreshInterval: number;
  /** Batch size for processing pools */
  batchSize: number;
  /** Delay between batches in milliseconds */
  batchDelay: number;
  /** Maximum concurrent RPC requests */
  maxConcurrentRequests: number;
  /** Enable smart refresh (only refresh stale data) */
  smartRefresh: boolean;
  /** Stale threshold in milliseconds */
  staleThreshold: number;
}

/**
 * Production configuration - optimized for minimal RPC usage
 */
export const PRODUCTION_LIQUIDITY_CONFIG: LiquidityPageConfig = {
  refreshInterval: 60000,        // 60 seconds (reduced from 30s)
  batchSize: 5,                  // Process 5 pools at a time
  batchDelay: 200,               // 200ms between batches
  maxConcurrentRequests: 3,      // Max 3 concurrent RPC calls
  smartRefresh: true,            // Only refresh stale data
  staleThreshold: 90000,         // 90 seconds stale threshold
};

/**
 * Development configuration - faster updates for testing
 */
export const DEVELOPMENT_LIQUIDITY_CONFIG: LiquidityPageConfig = {
  refreshInterval: 30000,        // 30 seconds
  batchSize: 8,                  // Larger batches for faster dev
  batchDelay: 100,               // Shorter delay
  maxConcurrentRequests: 5,      // More concurrent requests
  smartRefresh: false,           // Always refresh in dev
  staleThreshold: 60000,         // 60 seconds stale threshold
};

/**
 * Conservative configuration - for high-traffic environments
 */
export const CONSERVATIVE_LIQUIDITY_CONFIG: LiquidityPageConfig = {
  refreshInterval: 120000,       // 2 minutes
  batchSize: 3,                  // Small batches
  batchDelay: 500,               // Longer delay between batches
  maxConcurrentRequests: 2,      // Very limited concurrent requests
  smartRefresh: true,            // Smart refresh enabled
  staleThreshold: 180000,        // 3 minutes stale threshold
};

/**
 * Get liquidity page configuration based on environment
 */
export function getLiquidityConfig(): LiquidityPageConfig {
  const rpcMode = process.env.NEXT_PUBLIC_RPC_MODE;

  // Allow manual override via environment variable
  if (rpcMode === 'conservative') {
    return CONSERVATIVE_LIQUIDITY_CONFIG;
  }
  
  if (rpcMode === 'development') {
    return DEVELOPMENT_LIQUIDITY_CONFIG;
  }

  // Default to production config (rpcMode === 'production' or not set)
  if (rpcMode === 'production' || !rpcMode) {
    return PRODUCTION_LIQUIDITY_CONFIG;
  }

  // Fallback to development
  return DEVELOPMENT_LIQUIDITY_CONFIG;
}

/**
 * Calculate estimated RPC usage for liquidity page
 */
export function calculateRpcUsage(
  poolCount: number, 
  config: LiquidityPageConfig
): {
  rpcCallsPerRefresh: number;
  rpcCallsPerMinute: number;
  rpcCallsPerHour: number;
  estimatedBatchTime: number;
} {
  const rpcCallsPerPool = 3; // Token A balance + Token B balance + LP supply
  const rpcCallsPerRefresh = poolCount * rpcCallsPerPool;
  const refreshesPerMinute = 60000 / config.refreshInterval;
  const rpcCallsPerMinute = rpcCallsPerRefresh * refreshesPerMinute;
  const rpcCallsPerHour = rpcCallsPerMinute * 60;
  
  const totalBatches = Math.ceil(poolCount / config.batchSize);
  const estimatedBatchTime = (totalBatches - 1) * config.batchDelay;

  return {
    rpcCallsPerRefresh,
    rpcCallsPerMinute: Math.round(rpcCallsPerMinute * 100) / 100,
    rpcCallsPerHour: Math.round(rpcCallsPerHour),
    estimatedBatchTime
  };
}