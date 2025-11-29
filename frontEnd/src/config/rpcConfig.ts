/**
 * Production-Ready RPC Configuration
 * 
 * This file contains optimized polling intervals and RPC settings
 * designed to minimize 429 rate limit errors while maintaining
 * good user experience.
 */

export interface RpcPollingConfig {
  /** Transaction tracking interval (ms) */
  transactionTracking: number;
  /** Token account refresh interval (ms) */
  tokenAccounts: number;
  /** Portfolio data refresh interval (ms) */
  portfolio: number;
  /** SOL balance update interval (ms) */
  walletBalance: number;
  /** Pool data update interval (ms) */
  poolUpdates: number;
  /** Transaction history batch size */
  transactionHistoryBatchSize: number;
}

/**
 * Production configuration - optimized for minimal RPC usage
 */
export const PRODUCTION_RPC_CONFIG: RpcPollingConfig = {
  transactionTracking: 15000,    // 15 seconds (reduced from 5s)
  tokenAccounts: 60000,          // 60 seconds (reduced from 30s)
  portfolio: 45000,              // 45 seconds (reduced from 30s)
  walletBalance: 45000,          // 45 seconds (reduced from 30s)
  poolUpdates: 60000,            // 60 seconds (reduced from 30s)
  transactionHistoryBatchSize: 10, // Smaller batches to avoid rate limits
};

/**
 * Development configuration - more frequent updates for testing
 */
export const DEVELOPMENT_RPC_CONFIG: RpcPollingConfig = {
  transactionTracking: 10000,    // 10 seconds
  tokenAccounts: 30000,          // 30 seconds
  portfolio: 30000,              // 30 seconds
  walletBalance: 30000,          // 30 seconds
  poolUpdates: 30000,            // 30 seconds
  transactionHistoryBatchSize: 20,
};

/**
 * Conservative configuration - for high-traffic or rate-limited environments
 */
export const CONSERVATIVE_RPC_CONFIG: RpcPollingConfig = {
  transactionTracking: 30000,    // 30 seconds
  tokenAccounts: 120000,         // 2 minutes
  portfolio: 90000,              // 1.5 minutes
  walletBalance: 90000,          // 1.5 minutes
  poolUpdates: 120000,           // 2 minutes
  transactionHistoryBatchSize: 5,
};

/**
 * Get the appropriate RPC configuration based on environment
 */
export function getRpcConfig(): RpcPollingConfig {
  const rpcMode = process.env.NEXT_PUBLIC_RPC_MODE;

  // Allow manual override via environment variable
  if (rpcMode === 'conservative') {
    return CONSERVATIVE_RPC_CONFIG;
  }
  
  if (rpcMode === 'development') {
    return DEVELOPMENT_RPC_CONFIG;
  }

  // Default to production config (rpcMode === 'production' or not set)
  if (rpcMode === 'production' || !rpcMode) {
    return PRODUCTION_RPC_CONFIG;
  }

  // Fallback to development
  return DEVELOPMENT_RPC_CONFIG;
}

/**
 * RPC Request Batching Configuration
 */
export const RPC_BATCH_CONFIG = {
  /** Maximum requests per batch */
  maxBatchSize: 10,
  /** Delay between batches (ms) */
  batchDelay: 100,
  /** Maximum concurrent requests */
  maxConcurrent: 3,
};

/**
 * Rate Limiting Configuration
 */
export const RATE_LIMIT_CONFIG = {
  /** Requests per minute per endpoint */
  requestsPerMinute: 100,
  /** Burst allowance */
  burstLimit: 20,
  /** Cooldown period after rate limit (ms) */
  cooldownPeriod: 60000, // 1 minute
};

/**
 * Connection Pool Health Configuration
 */
export const HEALTH_CONFIG = {
  /** Health check interval (ms) */
  healthCheckInterval: 300000, // 5 minutes
  /** Failure threshold before marking unhealthy */
  failureThreshold: 3,
  /** Recovery time for failed endpoints (ms) */
  recoveryTime: 60000, // 1 minute
  /** Request timeout (ms) */
  requestTimeout: 30000, // 30 seconds
};