// Type definitions for Solana DEX application
import { PublicKey, Connection, Commitment } from '@solana/web3.js';

// ============================================================================
// Enums and Constants
// ============================================================================

export enum SolanaCluster {
  MAINNET = 'mainnet-beta',
  DEVNET = 'devnet',
  TESTNET = 'testnet',
  LOCALNET = 'localnet'
}

export enum TransactionType {
  SWAP = 'swap',
  ADD_LIQUIDITY = 'addLiquidity',
  REMOVE_LIQUIDITY = 'removeLiquidity',
  CREATE_POOL = 'createPool',
  SPL_TRANSFER = 'splTransfer',
  SOL_TRANSFER = 'solTransfer'
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

export enum WalletType {
  PHANTOM = 'phantom',
  SOLFLARE = 'solflare',
  BACKPACK = 'backpack',
  SOLLET = 'sollet',
  LEDGER = 'ledger'
}

// Solana Program IDs for common DEX protocols
export enum SolanaProgramId {
  TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  SYSTEM_PROGRAM = '11111111111111111111111111111111',
  RAYDIUM_AMM = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  ORCA_WHIRLPOOL = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  JUPITER_AGGREGATOR = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'
}

// ============================================================================
// Core Solana Types
// ============================================================================

export interface SolanaTokenAccount {
  address: PublicKey;
  mint: PublicKey;
  owner: PublicKey;
  amount: bigint;
  decimals: number;
  isAssociated: boolean;
}

export interface SolanaProgramDerivedAddress {
  address: PublicKey;
  bump: number;
  seeds: (Buffer | Uint8Array)[];
}

// ============================================================================
// Token Interfaces (Solana-specific)
// ============================================================================

export interface Token {
  // SPL Token mint address
  mint: string;
  address: string; // Same as mint for compatibility
  symbol: string;
  displaySymbol?: string; // Optional display symbol (e.g., "SOL" instead of "WSOL")
  name: string;
  decimals: number;
  logoURI?: string;
  // Solana-specific fields
  isNative?: boolean; // For wrapped SOL
  chainId?: number; // Solana cluster identifier
  tags?: string[]; // Token registry tags
  extensions?: {
    coingeckoId?: string;
    website?: string;
    twitter?: string;
  };
}

// ============================================================================
// Wallet State (Solana-specific)
// ============================================================================

export interface WalletState {
  // Connection state
  publicKey: PublicKey | null;
  address: string | null; // Base58 string representation
  isConnected: boolean;
  isConnecting: boolean;

  // Solana network info
  cluster: SolanaCluster;

  // Balances
  solBalance: bigint; // Native SOL balance in lamports
  tokenAccounts: SolanaTokenAccount[];

  // Wallet metadata
  walletType: WalletType | null;
  walletName: string | null;
}

// ============================================================================
// Pool Interfaces (Solana AMM-specific)
// ============================================================================

export interface Pool {
  // Pool identification
  id: string; // Pool account address
  programId: string; // AMM program ID

  // Token pair
  tokenA: Token;
  tokenB: Token;

  // Pool accounts
  tokenAAccount: PublicKey;
  tokenBAccount: PublicKey;
  lpTokenMint: PublicKey;

  // Reserves and liquidity
  reserveA: bigint;
  reserveB: bigint;
  totalLiquidity: bigint;
  lpTokenSupply: bigint;

  // Pool metrics
  volume24h: bigint;
  fees24h: bigint;
  feeRate: number; // Fee rate as percentage (e.g., 0.25 for 0.25%)

  // Pool state
  isActive: boolean;
  createdAt: number;
  lastUpdated: number;

  // AMM-specific data
  ammType: 'constant_product' | 'stable' | 'concentrated';
  curveType?: string;

  // Blockchain data tracking (for real-time pool data feature)
  dataSource?: 'config' | 'blockchain' | 'hybrid';
  lastBlockchainFetch?: number;
  blockchainFetchError?: string | null;
  isFresh?: boolean; // True if fetched within last 60 seconds
}

// ============================================================================
// Transaction Interfaces (Solana-specific)
// ============================================================================

export interface Transaction {
  // Transaction identification
  signature: string; // Solana transaction signature
  hash: string; // Same as signature for compatibility

  // Transaction metadata
  type: TransactionType;
  status: TransactionStatus;
  timestamp: number;
  blockTime?: number;
  slot?: number;

  // Transaction details
  tokenIn?: Token;
  tokenOut?: Token;
  amountIn?: bigint;
  amountOut?: bigint;

  // Solana-specific fields
  feePayer: string; // Public key of fee payer
  solFee: bigint; // SOL fee paid in lamports
  computeUnitsUsed?: number;

  // Error information
  error?: string;
  logs?: string[];

  // Pool information (for AMM transactions)
  poolId?: string;
  priceImpact?: number;
  slippage?: number;
}

// ============================================================================
// Swap Quote Interface (Solana-specific)
// ============================================================================

export interface SwapQuote {
  // Input/Output amounts
  inputAmount: bigint;
  outputAmount: bigint;
  minimumReceived: bigint;

  // Price information
  priceImpact: number;
  exchangeRate: number;

  // Route information
  route: Pool[];
  routeType: 'direct' | 'multi_hop';

  // Solana-specific fields
  jupiterQuote?: JupiterQuote; // Jupiter aggregator quote
  slippageTolerance: number;

  // Transaction estimates
  estimatedSolFee: bigint;
  estimatedComputeUnits: number;

  // Timing
  validUntil: number; // Timestamp when quote expires
  refreshInterval: number; // Milliseconds between quote updates
}

// Jupiter aggregator quote interface
export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

// ============================================================================
// User Portfolio (Solana-specific)
// ============================================================================

export interface UserPortfolio {
  // Portfolio overview
  totalValue: bigint; // Total value in lamports (SOL equivalent)
  totalValueUsd?: number; // USD value if price data available

  // SOL balance
  solBalance: bigint;
  solValueUsd?: number;

  // SPL Token holdings
  tokens: Array<{
    token: Token;
    balance: bigint;
    tokenAccount: PublicKey;
    value: bigint; // Value in lamports
    valueUsd?: number;
    priceChange24h?: number;
  }>;

  // Liquidity positions
  liquidityPositions: Array<{
    pool: Pool;
    lpTokenBalance: bigint;
    lpTokenAccount: PublicKey;
    shareOfPool: number; // Percentage of pool owned
    tokenAAmount: bigint;
    tokenBAmount: bigint;
    value: bigint; // Total position value in lamports
    valueUsd?: number;
    feesEarned24h?: bigint;
  }>;

  // Portfolio performance
  performance?: {
    change24h: bigint;
    change24hPercent: number;
    change7d: bigint;
    change7dPercent: number;
  };

  // Last update timestamp
  lastUpdated: number;
}

// ============================================================================
// Utility Types for Solana Web3 Interactions
// ============================================================================

export interface SolanaConnectionConfig {
  endpoint: string;
  commitment: Commitment;
  wsEndpoint?: string;
  confirmTransactionInitialTimeout?: number;
}

export interface SolanaTransactionConfig {
  skipPreflight?: boolean;
  preflightCommitment?: Commitment;
  maxRetries?: number;
  minContextSlot?: number;
}

export interface TokenAccountInfo {
  mint: PublicKey;
  owner: PublicKey;
  amount: bigint;
  decimals: number;
  isInitialized: boolean;
  isFrozen: boolean;
  isNative: boolean;
  rentExemptReserve?: bigint;
  closeAuthority?: PublicKey;
}

// ============================================================================
// State Management Types
// ============================================================================

export interface AppState {
  wallet: WalletState;
  pools: Pool[];
  transactions: Transaction[];
  portfolio: UserPortfolio;
  ui: UIState;
  settings: AppSettings;
}

export interface UIState {
  loading: boolean;
  error: string | null;
  notifications: Notification[];
  modals: {
    walletSelector: boolean;
    poolCreator: boolean;
    swapConfirmation: boolean;
    transactionStatus: boolean;
  };
}

export interface AppSettings {
  cluster: SolanaCluster;
  rpcEndpoint: string;
  slippageTolerance: number;
  transactionDeadline: number; // Minutes
  autoRefreshInterval: number; // Milliseconds
  theme: 'light' | 'dark' | 'system';
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  autoClose?: boolean;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

export interface SolanaRpcResponse<T> {
  jsonrpc: string;
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface TokenListResponse {
  name: string;
  logoURI: string;
  keywords: string[];
  tokens: Token[];
  version: {
    major: number;
    minor: number;
    patch: number;
  };
}

// ============================================================================
// Event Types for Real-time Updates
// ============================================================================

export interface SolanaAccountChangeEvent {
  accountId: PublicKey;
  accountInfo: {
    data: Buffer;
    executable: boolean;
    lamports: number;
    owner: PublicKey;
    rentEpoch: number;
  };
}

export interface PoolUpdateEvent {
  poolId: string;
  reserveA: bigint;
  reserveB: bigint;
  timestamp: number;
}

export interface TransactionUpdateEvent {
  signature: string;
  status: TransactionStatus;
  timestamp: number;
  error?: string;
}