import { Address } from 'viem';

/**
 * SAMM-specific error types
 */
export enum SAMMError {
  // Quote errors
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  EXCEEDS_C_THRESHOLD = 'EXCEEDS_C_THRESHOLD',
  NO_SHARDS_AVAILABLE = 'NO_SHARDS_AVAILABLE',
  QUOTE_EXPIRED = 'QUOTE_EXPIRED',
  
  // Execution errors
  EXCESSIVE_INPUT = 'EXCESSIVE_INPUT',
  INSUFFICIENT_APPROVAL = 'INSUFFICIENT_APPROVAL',
  SIMULATION_FAILED = 'SIMULATION_FAILED',
  
  // Validation errors
  INVALID_OUTPUT_AMOUNT = 'INVALID_OUTPUT_AMOUNT',
  INVALID_TOKEN_PAIR = 'INVALID_TOKEN_PAIR',
  UNSUPPORTED_CHAIN = 'UNSUPPORTED_CHAIN',
}

/**
 * User-friendly error messages for SAMM errors
 */
export const ERROR_MESSAGES: Record<SAMMError, string> = {
  [SAMMError.INSUFFICIENT_LIQUIDITY]: 
    'Not enough liquidity across all shards. Try a smaller amount.',
  
  [SAMMError.EXCEEDS_C_THRESHOLD]: 
    'This trade is too large relative to pool size. Maximum is 1.04% of pool reserves.',
  
  [SAMMError.NO_SHARDS_AVAILABLE]: 
    'No liquidity pools found for this token pair.',
  
  [SAMMError.QUOTE_EXPIRED]: 
    'Price quote is outdated. Click refresh to get a new quote.',
  
  [SAMMError.EXCESSIVE_INPUT]: 
    'Price moved unfavorably. Required input exceeds your slippage tolerance.',
  
  [SAMMError.INSUFFICIENT_APPROVAL]: 
    'Please approve the contract to spend your tokens.',
  
  [SAMMError.SIMULATION_FAILED]: 
    'Transaction would fail. Please check amounts and try again.',
  
  [SAMMError.INVALID_OUTPUT_AMOUNT]: 
    'Please enter a valid output amount.',
  
  [SAMMError.INVALID_TOKEN_PAIR]: 
    'This token pair is not supported.',
  
  [SAMMError.UNSUPPORTED_CHAIN]: 
    'SAMM swaps are only available on Monad testnet. Please switch networks.',
};

/**
 * SAMM swap quote for output-based swaps
 */
export interface SAMMSwapQuote {
  inputToken: Address;
  outputToken: Address;
  outputAmount: bigint;          // Exact amount user wants
  estimatedInput: bigint;         // Calculated input needed
  maximalInput: bigint;           // With slippage protection
  tradeFee: bigint;               // SAMM dynamic fee
  ownerFee: bigint;               // Owner fee
  totalFees: bigint;              // tradeFee + ownerFee
  priceImpact: number;            // Percentage
  selectedShard: ShardInfo;       // Which shard was chosen
  alternativeShards: ShardInfo[]; // Other options
  chainId: number;
  timestamp: number;
  expiresAt: number;              // Quote expiry
}

/**
 * Information about a specific shard/pool
 */
export interface ShardInfo {
  address: Address;
  shardNumber: number;
  pairName: string;               // e.g., "USDC/USDT"
  liquidityA: string;
  liquidityB: string;
  reserveA: bigint;
  reserveB: bigint;
  estimatedInput: bigint;
  tradeFee: bigint;
  ownerFee: bigint;
  isOptimal: boolean;
  reason?: string;                // e.g., "Lowest input required"
}

/**
 * Result of a SAMM swap execution
 */
export interface SAMMSwapResult {
  hash: Address;
  inputAmount: bigint;
  outputAmount: bigint;
  tradeFee: bigint;
  shardUsed: Address;
}

/**
 * SAMM transaction record for history
 */
export interface SAMMTransaction {
  hash: Address;
  type: 'samm-swap';
  status: 'pending' | 'confirmed' | 'failed';
  
  // Swap details
  inputToken: Address;
  outputToken: Address;
  inputAmount: bigint;
  outputAmount: bigint;
  
  // SAMM-specific
  tradeFee: bigint;
  ownerFee: bigint;
  shardUsed: Address;
  shardNumber: number;
  
  // Metadata
  timestamp: number;
  blockNumber?: number;
  gasUsed?: bigint;
}

/**
 * SAMM parameters from contract
 */
export interface SAMMParams {
  beta1: bigint;      // Fee slope parameter
  rmin: bigint;       // Minimum fee rate (0.1%)
  rmax: bigint;       // Maximum fee rate (1.2%)
  c: bigint;          // C-threshold (0.0104)
}

/**
 * Swap result tuple from calculateSwapSAMM contract call
 */
export interface SwapResultTuple {
  amountIn: bigint;
  amountOut: bigint;
  tradeFee: bigint;
  ownerFee: bigint;
}
