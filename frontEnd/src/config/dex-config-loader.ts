/**
 * Dynamic DEX Configuration Loader
 *
 * Provides chain-specific configuration for the Sharded DEX
 * Monad Testnet only
 */

import monadConfig from './dex-config-monad.json';

export interface DexConfig {
  network: string;
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  deployer: string;
  factory: string;
  timestamp?: string;
  version?: string;
  sammCoreFeature?: string;
  tokens: Array<{
    symbol: string;
    name: string;
    address: string;
    decimals: number;
  }>;
  pools: Array<{
    name: string;
    pairName: string;
    address: string;
    tokenA: string;
    tokenB: string;
    tokenASymbol: string;
    tokenBSymbol: string;
    shardNumber: number;
    initialLiquidity: string;
    status?: string;
    chainId: number;
  }>;
  multiHopRouting?: {
    enabled: boolean;
    supportedPairs: string[];
    multiHopPaths: Array<{
      from: string;
      to: string;
      path: string[];
      pools: string[];
    }>;
  };
  multiShardStats: {
    totalShards: number;
    usdcUsdtShards: number;
    usdtDaiShards: number;
    totalLiquidity: string;
    demonstratesMultiShardArchitecture: boolean;
    demonstratesMultiHopRouting: boolean;
    decimalNormalization: boolean;
  };
}

// Supported chain IDs - Monad only
export const SUPPORTED_CHAIN_IDS = [10143] as const;
export type SupportedChainId = typeof SUPPORTED_CHAIN_IDS[number];

// Chain ID to config mapping
const CONFIG_MAP: Record<number, DexConfig> = {
  10143: monadConfig as DexConfig,
};

// Chain ID to name mapping
const CHAIN_NAMES: Record<number, string> = {
  10143: 'Monad Testnet',
};

/**
 * Get DEX configuration for a specific chain
 * Returns null for unsupported chains instead of throwing
 */
export function getDexConfig(chainId: number): DexConfig | null {
  const config = CONFIG_MAP[chainId];

  if (!config) {
    console.warn(
      `Chain ID ${chainId} is not supported for DEX operations. Supported chains: ${SUPPORTED_CHAIN_IDS.join(', ')}`
    );
    return null;
  }

  return config;
}

/**
 * Check if a chain ID is supported
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in CONFIG_MAP;
}

/**
 * Get factory address for a specific chain
 */
export function getFactoryAddress(chainId: number): string {
  const config = getDexConfig(chainId);
  return config ? config.factory : '';
}

/**
 * Get all tokens for a specific chain
 */
export function getTokensForChain(chainId: number) {
  const config = getDexConfig(chainId);
  return config ? config.tokens : [];
}

/**
 * Get all pools for a specific chain
 */
export function getPoolsForChain(chainId: number) {
  const config = getDexConfig(chainId);
  return config ? config.pools : [];
}

/**
 * Get pools for a specific token pair on a chain
 */
export function getPoolsForPair(
  chainId: number,
  tokenASymbol: string,
  tokenBSymbol: string
) {
  const config = getDexConfig(chainId);

  if (!config) {
    return [];
  }

  return config.pools.filter((pool) => {
    const matchesForward =
      pool.tokenASymbol === tokenASymbol && pool.tokenBSymbol === tokenBSymbol;
    const matchesReverse =
      pool.tokenASymbol === tokenBSymbol && pool.tokenBSymbol === tokenASymbol;
    return matchesForward || matchesReverse;
  });
}

/**
 * Get chain name
 */
export function getChainName(chainId: number): string {
  return CHAIN_NAMES[chainId] || `Unknown Chain (${chainId})`;
}

/**
 * Get all supported chains info
 */
export function getSupportedChains() {
  return SUPPORTED_CHAIN_IDS.map(chainId => ({
    chainId,
    name: getChainName(chainId),
    config: getDexConfig(chainId),
  }));
}

/**
 * Get multi-shard stats for a chain
 */
export function getMultiShardStats(chainId: number) {
  const config = getDexConfig(chainId);
  return config ? config.multiShardStats : null;
}

/**
 * Get block explorer URL for a chain
 */
export function getBlockExplorer(chainId: number): string {
  const config = getDexConfig(chainId);
  return config ? config.blockExplorer : '';
}

/**
 * Get RPC URL for a chain
 * Uses environment variable if available, otherwise falls back to config
 */
export function getRpcUrl(chainId: number): string {
  // Check for environment variable first
  if (chainId === 10143 && process.env.NEXT_PUBLIC_MONAD_RPC_URL) {
    return process.env.NEXT_PUBLIC_MONAD_RPC_URL;
  }

  // Fallback to config
  const config = getDexConfig(chainId);
  return config ? config.rpcUrl : '';
}
