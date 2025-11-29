import { Address, PublicClient, WalletClient } from 'viem';
import { evmPoolService } from './evmPoolService';
import { getDexConfig } from '../config/dex-config-loader';
import PoolABI from '../abis/Pool.json';
import ERC20ABI from '../abis/ERC20.json';
import { MONAD_TESTNET } from '../config/evm-networks';

// Monad chain configuration for viem
const monadChain = {
  id: MONAD_TESTNET.chainId,
  name: MONAD_TESTNET.name,
  nativeCurrency: MONAD_TESTNET.nativeCurrency,
  rpcUrls: {
    default: { http: MONAD_TESTNET.rpcUrls },
    public: { http: MONAD_TESTNET.rpcUrls },
  },
} as const;

/**
 * Quote result for SAMM output-based swaps
 */
export interface SAMMSwapQuote {
  inputToken: Address;
  outputToken: Address;
  outputAmount: bigint;          // Exact amount user wants
  estimatedInput: bigint;         // Calculated input needed
  maximalInput: bigint;           // With slippage protection
  tradeFee: bigint;               // SAMM dynamic fee
  ownerFee: bigint;               // Owner fee
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
 * Result of shard selection with alternatives
 */
export interface ShardSelectionResult {
  optimal: ShardInfo;
  alternatives: ShardInfo[];
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
 * Service for handling SAMM (Sharded Automated Market Maker) swaps
 * SAMM is an output-based AMM where users specify exact output amounts
 */
export class SAMMSwapService {
  /**
   * Get quote for exact output amount (SAMM style)
   * 
   * @param client - Public client for reading blockchain data
   * @param chainId - Chain ID (must be Monad testnet: 10143)
   * @param inputTokenAddress - Address of token to pay with
   * @param outputTokenAddress - Address of token to receive
   * @param outputAmount - Exact amount user wants to receive
   * @param slippageTolerance - Slippage tolerance percentage (default 0.5%)
   * @returns Quote with estimated input and shard selection
   */
  async getQuoteForOutput(
    client: PublicClient,
    chainId: number,
    inputTokenAddress: Address,
    outputTokenAddress: Address,
    outputAmount: bigint,
    slippageTolerance: number = 0.5
  ): Promise<SAMMSwapQuote> {
    // Validation: Chain must be Monad testnet (10143)
    if (chainId !== 10143) {
      throw new Error('SAMM swaps are only available on Monad testnet (Chain ID: 10143)');
    }

    // Validation: Output amount must be greater than zero
    if (outputAmount <= 0n) {
      throw new Error('Output amount must be greater than zero');
    }

    // Validation: Token addresses must be valid
    if (!inputTokenAddress || !outputTokenAddress) {
      throw new Error('Invalid token addresses');
    }

    // Validation: Tokens must be different
    if (inputTokenAddress.toLowerCase() === outputTokenAddress.toLowerCase()) {
      throw new Error('Input and output tokens must be different');
    }

    // Discover available shards for this token pair
    const availableShards = await this.discoverShards(
      client,
      chainId,
      inputTokenAddress,
      outputTokenAddress,
      outputAmount
    );

    // Select optimal shard and get alternatives
    const shardSelection = await this.selectOptimalShardWithAlternatives(
      client,
      availableShards,
      outputAmount,
      inputTokenAddress,
      outputTokenAddress
    );

    const selectedShard = shardSelection.optimal;
    const alternativeShards = shardSelection.alternatives;

    // Calculate maximal input with slippage protection
    const estimatedInput = selectedShard.estimatedInput;
    const maximalInput = this.calculateMaximalInput(estimatedInput, slippageTolerance);

    // Calculate price impact
    const priceImpact = this.calculateBasicPriceImpact(
      estimatedInput,
      outputAmount,
      selectedShard.reserveA,
      selectedShard.reserveB
    );

    // Create timestamp and expiry
    const now = Date.now();
    const expiresAt = now + 30000; // 30 seconds expiry

    // Construct the final quote
    const quote: SAMMSwapQuote = {
      inputToken: inputTokenAddress,
      outputToken: outputTokenAddress,
      outputAmount,
      estimatedInput,
      maximalInput,
      tradeFee: selectedShard.tradeFee,
      ownerFee: selectedShard.ownerFee,
      priceImpact,
      selectedShard,
      alternativeShards,
      chainId,
      timestamp: now,
      expiresAt,
    };

    return quote;
  }

  /**
   * Execute SAMM swap with exact output
   * 
   * @param walletClient - Wallet client for signing transactions
   * @param publicClient - Public client for reading blockchain data
   * @param quote - Quote from getQuoteForOutput
   * @param userAddress - User's wallet address
   * @returns Swap result with actual amounts
   */
  async executeSwapSAMM(
    walletClient: WalletClient,
    publicClient: PublicClient,
    quote: SAMMSwapQuote,
    userAddress: Address
  ): Promise<SAMMSwapResult> {
    // Step 1: Validate quote (expiration and integrity)
    this.validateQuote(quote);

    // Step 2: Validate user has sufficient balance
    const userBalance = await this.checkUserBalance(
      publicClient,
      quote.inputToken,
      userAddress
    );

    if (userBalance < quote.maximalInput) {
      throw new Error(
        `Insufficient balance. You need ${quote.maximalInput} but only have ${userBalance}`
      );
    }

    // Step 3: Check and handle token approvals (implemented in subtask 5.2)
    await this.ensureTokenApproval(
      walletClient,
      publicClient,
      quote.inputToken,
      quote.selectedShard.address,
      quote.maximalInput,
      userAddress
    );

    // Step 4: Simulate transaction (implemented in subtask 5.3)
    const simulationResult = await this.simulateSwapSAMM(
      publicClient,
      quote,
      userAddress
    );

    // Step 5: Execute swapSAMM transaction (implemented in subtask 5.4)
    const hash = await this.executeSwapTransaction(
      walletClient,
      quote,
      userAddress
    );

    // Step 6: Wait for confirmation and parse results (implemented in subtask 5.5)
    const result = await this.waitForSwapConfirmation(
      publicClient,
      hash,
      quote
    );

    return result;
  }

  /**
   * Select optimal shard from multiple options
   * 
   * This method implements the core shard selection logic:
   * - Queries all shards for swap quotes
   * - Compares amountIn from each shard
   * - Selects the shard with the lowest input requirement
   * - Handles insufficient liquidity scenarios
   * - Tracks alternative shards for comparison
   * 
   * @param client - Public client for reading blockchain data
   * @param shards - Array of available pools/shards
   * @param outputAmount - Desired output amount
   * @param inputToken - Input token address
   * @param outputToken - Output token address
   * @returns Information about the optimal shard
   * @throws Error if no valid shards are available
   */
  async selectOptimalShard(
    client: PublicClient,
    shards: any[], // Pool type from existing codebase
    outputAmount: bigint,
    inputToken: Address,
    outputToken: Address
  ): Promise<ShardInfo> {
    const result = await this.selectOptimalShardWithAlternatives(
      client,
      shards,
      outputAmount,
      inputToken,
      outputToken
    );
    return result.optimal;
  }

  /**
   * Select optimal shard and return alternatives for comparison
   * 
   * This method provides comprehensive shard selection with full tracking:
   * - Filters shards by liquidity (outputAmount < reserveB)
   * - Queries all valid shards for swap quotes
   * - Compares amountIn from each shard
   * - Selects the shard with the lowest input requirement
   * - Returns all shards sorted by input amount (best to worst)
   * - Includes reasons for selection/rejection
   * 
   * @param client - Public client for reading blockchain data
   * @param shards - Array of available pools/shards
   * @param outputAmount - Desired output amount
   * @param inputToken - Input token address
   * @param outputToken - Output token address
   * @returns Object with optimal shard and sorted alternatives
   * @throws Error if no valid shards are available
   */
  async selectOptimalShardWithAlternatives(
    client: PublicClient,
    shards: any[], // Pool type from existing codebase
    outputAmount: bigint,
    inputToken: Address,
    outputToken: Address
  ): Promise<ShardSelectionResult> {
    // Validate inputs
    if (!shards || shards.length === 0) {
      throw new Error('No shards available for selection');
    }

    if (outputAmount <= 0n) {
      throw new Error('Output amount must be greater than zero');
    }

    // Filter shards with sufficient liquidity
    // A shard has sufficient liquidity if outputAmount < reserveB
    const validShards: any[] = [];
    const insufficientLiquidityShards: any[] = [];

    for (const shard of shards) {
      // Determine which reserve is the output token
      const isTokenAOutput = shard.tokenA.toLowerCase() === outputToken.toLowerCase();
      const outputReserve = isTokenAOutput ? shard.reserves.reserve0 : shard.reserves.reserve1;

      // Check if shard has sufficient liquidity
      // We need outputAmount < outputReserve for the swap to be possible
      if (outputAmount < outputReserve) {
        validShards.push(shard);
      } else {
        insufficientLiquidityShards.push(shard);
      }
    }

    // If no shards have sufficient liquidity, throw error
    if (validShards.length === 0) {
      throw new Error('Insufficient liquidity across all shards for this output amount');
    }

    // Query all valid shards for swap quotes
    const shardQuotes = await this.queryAllShards(
      client,
      validShards,
      outputAmount,
      inputToken,
      outputToken
    );

    // If all queries failed, throw error
    if (shardQuotes.length === 0) {
      throw new Error('All shards failed to provide quotes');
    }

    // Compare quotes and find the shard with the lowest amountIn
    let optimalIndex = 0;
    let lowestInput = shardQuotes[0].swapResult.amountIn;

    for (let i = 1; i < shardQuotes.length; i++) {
      const currentInput = shardQuotes[i].swapResult.amountIn;
      
      // Select shard with lower input requirement
      if (currentInput < lowestInput) {
        lowestInput = currentInput;
        optimalIndex = i;
      }
    }

    // Format all shard info with optimal marking
    const allShardInfo: ShardInfo[] = shardQuotes.map((quote, index) => {
      const isOptimal = index === optimalIndex;
      const shardInfo = this.formatShardInfo(
        quote.pool,
        quote.swapResult,
        isOptimal,
        inputToken,
        outputToken
      );

      // Add specific reason based on comparison
      if (isOptimal) {
        shardInfo.reason = 'Lowest input required';
      } else {
        const inputDiff = quote.swapResult.amountIn - lowestInput;
        const percentDiff = Number((inputDiff * 10000n) / lowestInput) / 100;
        shardInfo.reason = `Higher input required (+${percentDiff.toFixed(2)}%)`;
      }

      return shardInfo;
    });

    // Get the optimal shard
    const optimal = allShardInfo[optimalIndex];

    // Get alternative shards (all except optimal), sorted by input amount (best to worst)
    const alternatives = allShardInfo
      .filter((_, index) => index !== optimalIndex)
      .sort((a, b) => {
        if (a.estimatedInput < b.estimatedInput) return -1;
        if (a.estimatedInput > b.estimatedInput) return 1;
        return 0;
      });

    return {
      optimal,
      alternatives,
    };
  }

  /**
   * Validate c-threshold for SAMM properties
   * C-threshold ensures trade size doesn't exceed pool capacity
   * 
   * The c-threshold is a critical SAMM parameter that limits trade size
   * relative to pool reserves. It ensures that OA/RA ≤ c (0.0104 or 1.04%).
   * 
   * This validation prevents trades that would:
   * - Break SAMM mathematical properties
   * - Cause excessive price impact
   * - Deplete pool reserves beyond safe limits
   * 
   * @param outputAmount - Desired output amount (OA)
   * @param inputReserve - Pool's input token reserve (RA)
   * @param cThreshold - Maximum ratio (default 10400n = 0.0104 * 1e6)
   * @returns True if within threshold (valid trade), false if exceeded (invalid trade)
   */
  validateCThreshold(
    outputAmount: bigint,
    inputReserve: bigint,
    cThreshold: bigint = 10400n // 0.0104 * 1e6 (scaled for precision)
  ): boolean {
    // Validate inputs
    if (inputReserve <= 0n) {
      // If reserve is zero or negative, trade cannot proceed
      return false;
    }

    if (outputAmount <= 0n) {
      // If output amount is zero or negative, it's invalid
      return false;
    }

    // Calculate OA/RA ratio with precision scaling
    // We scale by 1e6 to match the cThreshold scaling
    // Formula: (OA * 1e6) / RA
    const ratio = (outputAmount * 1000000n) / inputReserve;

    // Check if ratio exceeds c-threshold
    // Returns true if ratio <= cThreshold (valid trade)
    // Returns false if ratio > cThreshold (trade too large)
    return ratio <= cThreshold;
  }

  /**
   * Calculate price impact of a swap
   * 
   * Price impact measures how much the trade affects the pool's price.
   * It compares the execution price (what you actually get) to the spot price
   * (the current pool ratio before the trade).
   * 
   * Formula:
   * - Spot price = reserveB / reserveA (current pool ratio)
   * - Execution price = amountOut / amountIn (your trade ratio)
   * - Price impact = ((executionPrice - spotPrice) / spotPrice) × 100
   * 
   * A positive impact means you're getting a worse price than the spot price,
   * which is expected for any trade due to slippage.
   * 
   * @param inputAmount - Amount of input tokens
   * @param outputAmount - Amount of output tokens
   * @param inputReserve - Pool's input token reserve (before trade)
   * @param outputReserve - Pool's output token reserve (before trade)
   * @returns Price impact as percentage (always positive)
   */
  calculatePriceImpact(
    inputAmount: bigint,
    outputAmount: bigint,
    inputReserve: bigint,
    outputReserve: bigint
  ): number {
    // Validate inputs to prevent division by zero
    if (inputReserve <= 0n || outputReserve <= 0n || inputAmount <= 0n) {
      return 0;
    }

    // Calculate spot price (reserveB / reserveA)
    // We use high precision by multiplying by 1e18 before division
    const spotPrice = (outputReserve * 1000000000000000000n) / inputReserve;

    // Calculate execution price (amountOut / amountIn)
    // Same precision scaling
    const executionPrice = (outputAmount * 1000000000000000000n) / inputAmount;

    // Calculate price impact percentage
    // Impact = ((executionPrice - spotPrice) / spotPrice) × 100
    // We multiply by 10000 to get 2 decimal places precision
    const impactBigInt = ((executionPrice - spotPrice) * 10000n) / spotPrice;
    
    // Convert to number and divide by 100 to get percentage
    const impact = Number(impactBigInt) / 100;

    // Return absolute value (price impact is always positive)
    return Math.abs(impact);
  }

  /**
   * Calculate maximal input amount with slippage protection
   * 
   * Slippage protection ensures that if the price moves unfavorably between
   * quote calculation and execution, the transaction will revert rather than
   * executing at a worse price than expected.
   * 
   * For output-based swaps (SAMM), we protect the user by setting a maximum
   * input amount they're willing to pay. If the actual required input exceeds
   * this maximum, the transaction reverts.
   * 
   * Formula:
   * maximalAmountIn = estimatedInput × (1 + slippageTolerance / 100)
   * 
   * Example:
   * - Estimated input: 100 USDC
   * - Slippage tolerance: 0.5%
   * - Maximal input: 100 × 1.005 = 100.5 USDC
   * 
   * If the actual required input is 100.6 USDC, the transaction will revert.
   * 
   * @param estimatedInput - Estimated input amount from quote
   * @param slippageTolerance - Slippage tolerance percentage (e.g., 0.5 for 0.5%)
   * @returns Maximal input amount with slippage protection
   */
  calculateMaximalInput(
    estimatedInput: bigint,
    slippageTolerance: number = 0.5
  ): bigint {
    // Validate inputs
    if (estimatedInput <= 0n) {
      throw new Error('Estimated input must be greater than zero');
    }

    if (slippageTolerance < 0) {
      throw new Error('Slippage tolerance cannot be negative');
    }

    // Calculate slippage multiplier with precision
    // We use 10000 as the base for 2 decimal places precision
    // Example: 0.5% = (1 + 0.5/100) = 1.005 = 10050/10000
    const slippageMultiplier = BigInt(Math.round((1 + slippageTolerance / 100) * 10000));

    // Calculate maximal input
    // maximalInput = estimatedInput × slippageMultiplier / 10000
    const maximalInput = (estimatedInput * slippageMultiplier) / 10000n;

    // Ensure maximal input is greater than estimated input
    // This should always be true unless slippage tolerance is 0
    if (maximalInput < estimatedInput && slippageTolerance > 0) {
      throw new Error('Maximal input calculation error: result is less than estimated input');
    }

    return maximalInput;
  }

  /**
   * Check if a quote has expired
   * 
   * Quotes have a limited validity period (default 30 seconds) to ensure
   * that the price information is fresh. After expiration, the quote should
   * not be used for execution as the pool state may have changed significantly.
   * 
   * This validation prevents users from executing swaps with stale quotes that
   * may no longer reflect current market conditions.
   * 
   * @param quote - The swap quote to check
   * @returns True if quote is expired, false if still valid
   */
  isQuoteExpired(quote: SAMMSwapQuote): boolean {
    const now = Date.now();
    return now > quote.expiresAt;
  }

  /**
   * Validate quote before execution
   * 
   * This method performs comprehensive validation of a quote before allowing
   * execution. It checks:
   * - Quote expiration
   * - Quote integrity (all required fields present)
   * 
   * @param quote - The swap quote to validate
   * @throws Error if quote is invalid or expired
   */
  validateQuote(quote: SAMMSwapQuote): void {
    // Check if quote exists
    if (!quote) {
      throw new Error('Quote is required');
    }

    // Check if quote has expired
    if (this.isQuoteExpired(quote)) {
      throw new Error('Quote has expired. Please refresh to get a new quote.');
    }

    // Validate required fields
    if (!quote.inputToken || !quote.outputToken) {
      throw new Error('Invalid quote: missing token addresses');
    }

    if (quote.outputAmount <= 0n) {
      throw new Error('Invalid quote: output amount must be greater than zero');
    }

    if (quote.estimatedInput <= 0n) {
      throw new Error('Invalid quote: estimated input must be greater than zero');
    }

    if (quote.maximalInput <= 0n) {
      throw new Error('Invalid quote: maximal input must be greater than zero');
    }

    if (!quote.selectedShard || !quote.selectedShard.address) {
      throw new Error('Invalid quote: no shard selected');
    }

    // Ensure maximal input is greater than or equal to estimated input
    if (quote.maximalInput < quote.estimatedInput) {
      throw new Error('Invalid quote: maximal input is less than estimated input');
    }
  }

  /**
   * Format shard info from pool and swap result
   * 
   * @param pool - Pool configuration
   * @param swapResult - Swap calculation result
   * @param isOptimal - Whether this is the optimal shard
   * @param inputToken - Input token address
   * @param outputToken - Output token address
   * @returns Formatted ShardInfo
   */
  private formatShardInfo(
    pool: any,
    swapResult: {
      amountIn: bigint;
      amountOut: bigint;
      tradeFee: bigint;
      ownerFee: bigint;
    },
    isOptimal: boolean,
    inputToken: Address,
    outputToken: Address
  ): ShardInfo {
    // Determine which token is which in the pool
    const isTokenAInput = pool.tokenA.toLowerCase() === inputToken.toLowerCase();
    const reserveA = isTokenAInput ? pool.reserves.reserve0 : pool.reserves.reserve1;
    const reserveB = isTokenAInput ? pool.reserves.reserve1 : pool.reserves.reserve0;

    // Format liquidity values (convert from wei to human-readable)
    const liquidityA = (Number(reserveA) / 1e18).toFixed(2);
    const liquidityB = (Number(reserveB) / 1e18).toFixed(2);

    return {
      address: pool.address as Address,
      shardNumber: pool.shardNumber,
      pairName: pool.pairName,
      liquidityA,
      liquidityB,
      reserveA,
      reserveB,
      estimatedInput: swapResult.amountIn,
      tradeFee: swapResult.tradeFee,
      ownerFee: swapResult.ownerFee,
      isOptimal,
      reason: isOptimal ? 'Lowest input required' : 'Higher input required',
    };
  }

  /**
   * Calculate basic price impact (will be enhanced in task 4)
   * 
   * @param inputAmount - Amount of input tokens
   * @param outputAmount - Amount of output tokens
   * @param inputReserve - Pool's input token reserve
   * @param outputReserve - Pool's output token reserve
   * @returns Price impact as percentage (simplified calculation)
   */
  private calculateBasicPriceImpact(
    inputAmount: bigint,
    outputAmount: bigint,
    inputReserve: bigint,
    outputReserve: bigint
  ): number {
    // Simplified price impact calculation
    // Spot price = reserveB / reserveA
    // Execution price = outputAmount / inputAmount
    // Impact = ((executionPrice - spotPrice) / spotPrice) * 100
    
    if (inputReserve === 0n || outputReserve === 0n || inputAmount === 0n) {
      return 0;
    }

    // Calculate prices with high precision (multiply by 1e18 for precision)
    const spotPrice = (outputReserve * 1000000n) / inputReserve;
    const executionPrice = (outputAmount * 1000000n) / inputAmount;

    // Calculate impact percentage
    const impactBigInt = ((executionPrice - spotPrice) * 10000n) / spotPrice;
    const impact = Number(impactBigInt) / 100;

    return Math.abs(impact);
  }

  /**
   * Query calculateSwapSAMM for a specific shard
   * 
   * @param client - Public client for reading blockchain data
   * @param poolAddress - Address of the pool/shard
   * @param outputAmount - Desired output amount
   * @param inputToken - Input token address
   * @param outputToken - Output token address
   * @returns Swap result with amounts and fees, or null if call fails
   */
  private async queryShardSwapSAMM(
    client: PublicClient,
    poolAddress: Address,
    outputAmount: bigint,
    inputToken: Address,
    outputToken: Address
  ): Promise<{
    amountIn: bigint;
    amountOut: bigint;
    tradeFee: bigint;
    ownerFee: bigint;
  } | null> {
    try {
      // Call calculateSwapSAMM on the pool contract
      const result = await client.readContract({
        address: poolAddress,
        abi: PoolABI,
        functionName: 'calculateSwapSAMM',
        args: [outputAmount, inputToken, outputToken],
      }) as any;

      // Parse the SwapResult tuple
      // The result is a tuple with structure: { amountIn, amountOut, tradeFee, ownerFee }
      return {
        amountIn: result.amountIn || result[0],
        amountOut: result.amountOut || result[1],
        tradeFee: result.tradeFee || result[2],
        ownerFee: result.ownerFee || result[3],
      };
    } catch (error: any) {
      // Log error but don't throw - we want to try other shards
      console.warn(`Failed to calculate swap for pool ${poolAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Query all shards and collect swap quotes
   * 
   * @param client - Public client for reading blockchain data
   * @param shards - Array of available shards
   * @param outputAmount - Desired output amount
   * @param inputToken - Input token address
   * @param outputToken - Output token address
   * @returns Array of shard quotes with swap results
   */
  private async queryAllShards(
    client: PublicClient,
    shards: any[],
    outputAmount: bigint,
    inputToken: Address,
    outputToken: Address
  ): Promise<Array<{
    pool: any;
    swapResult: {
      amountIn: bigint;
      amountOut: bigint;
      tradeFee: bigint;
      ownerFee: bigint;
    };
  }>> {
    const shardQuotes: Array<{
      pool: any;
      swapResult: {
        amountIn: bigint;
        amountOut: bigint;
        tradeFee: bigint;
        ownerFee: bigint;
      };
    }> = [];

    // Query all shards in parallel for better performance
    const queryPromises = shards.map(async (pool) => {
      const swapResult = await this.queryShardSwapSAMM(
        client,
        pool.address as Address,
        outputAmount,
        inputToken,
        outputToken
      );

      if (swapResult) {
        return { pool, swapResult };
      }
      return null;
    });

    const results = await Promise.all(queryPromises);

    // Filter out failed queries
    for (const result of results) {
      if (result !== null) {
        shardQuotes.push(result);
      }
    }

    if (shardQuotes.length === 0) {
      throw new Error('All shards failed to provide quotes');
    }

    return shardQuotes;
  }

  /**
   * Discover available shards for a token pair
   * 
   * @param client - Public client for reading blockchain data
   * @param chainId - Chain ID (must be Monad: 10143)
   * @param inputToken - Input token address
   * @param outputToken - Output token address
   * @param outputAmount - Desired output amount (for liquidity validation)
   * @returns Array of available pool configurations
   */
  private async discoverShards(
    client: PublicClient,
    chainId: number,
    inputToken: Address,
    outputToken: Address,
    outputAmount: bigint
  ): Promise<any[]> {
    // Get DEX config for the chain
    const config = getDexConfig(chainId);
    if (!config) {
      throw new Error(`No DEX configuration found for chain ${chainId}`);
    }

    // Find token symbols from config
    const inputTokenInfo = config.tokens.find(
      (t: any) => t.address.toLowerCase() === inputToken.toLowerCase()
    );
    const outputTokenInfo = config.tokens.find(
      (t: any) => t.address.toLowerCase() === outputToken.toLowerCase()
    );

    if (!inputTokenInfo || !outputTokenInfo) {
      throw new Error('Token pair not found in DEX configuration');
    }

    // Get all pools for this token pair
    const pools = evmPoolService.getPoolsForPair(
      chainId,
      inputTokenInfo.symbol,
      outputTokenInfo.symbol
    );

    if (pools.length === 0) {
      throw new Error(`No shards available for ${inputTokenInfo.symbol}/${outputTokenInfo.symbol}`);
    }

    // Filter pools by chainId and validate they have sufficient liquidity
    const validPools: any[] = [];

    for (const pool of pools) {
      // Ensure pool is on the correct chain
      if (pool.chainId !== chainId) {
        continue;
      }

      // Fetch current reserves from blockchain
      const { reserves } = await evmPoolService.getPoolReserves(
        client,
        pool.address as Address,
        true, // use cache
        true  // silent mode
      );

      // Skip if pool doesn't exist or has no reserves
      if (!reserves || (reserves.reserve0 === 0n && reserves.reserve1 === 0n)) {
        continue;
      }

      // Determine which reserve is the output token
      const isTokenAOutput = pool.tokenA.toLowerCase() === outputToken.toLowerCase();
      const outputReserve = isTokenAOutput ? reserves.reserve0 : reserves.reserve1;

      // Validate pool has sufficient liquidity for the output amount
      // We need outputAmount < outputReserve for the swap to be possible
      if (outputAmount >= outputReserve) {
        continue; // Skip this shard - insufficient liquidity
      }

      // Add reserves to pool object for later use
      validPools.push({
        ...pool,
        reserves: {
          reserve0: reserves.reserve0,
          reserve1: reserves.reserve1,
        },
      });
    }

    if (validPools.length === 0) {
      throw new Error('Insufficient liquidity across all shards for this output amount');
    }

    return validPools;
  }

  /**
   * Check user's token balance
   * 
   * @param client - Public client for reading blockchain data
   * @param tokenAddress - Token contract address
   * @param userAddress - User's wallet address
   * @returns User's token balance
   */
  private async checkUserBalance(
    client: PublicClient,
    tokenAddress: Address,
    userAddress: Address
  ): Promise<bigint> {
    try {
      const balance = await client.readContract({
        address: tokenAddress,
        abi: ERC20ABI,
        functionName: 'balanceOf',
        args: [userAddress],
      }) as bigint;

      return balance;
    } catch (error: any) {
      console.error('Failed to check user balance:', error);
      throw new Error(`Failed to check balance for token ${tokenAddress}`);
    }
  }

  /**
   * Ensure token approval for swap
   * 
   * This method checks if the pool has sufficient allowance to spend the user's tokens.
   * If not, it requests approval from the user and waits for the approval transaction.
   * 
   * @param walletClient - Wallet client for signing transactions
   * @param publicClient - Public client for reading blockchain data
   * @param tokenAddress - Token to approve
   * @param spenderAddress - Address to approve (pool address)
   * @param amount - Amount to approve
   * @param userAddress - User's wallet address
   */
  private async ensureTokenApproval(
    walletClient: WalletClient,
    publicClient: PublicClient,
    tokenAddress: Address,
    spenderAddress: Address,
    amount: bigint,
    userAddress: Address
  ): Promise<void> {
    // Step 1: Check current allowance
    const currentAllowance = await this.checkTokenAllowance(
      publicClient,
      tokenAddress,
      userAddress,
      spenderAddress
    );

    // Step 2: If allowance is sufficient, no approval needed
    if (currentAllowance >= amount) {
      console.log('Sufficient allowance already exists');
      return;
    }

    // Step 3: Request approval for the required amount
    console.log(`Requesting approval for ${amount} tokens...`);
    
    try {
      // Request approval transaction
      const approvalHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20ABI,
        functionName: 'approve',
        args: [spenderAddress, amount],
        account: userAddress,
        chain: monadChain,
      });

      console.log(`Approval transaction submitted: ${approvalHash}`);

      // Step 4: Wait for approval transaction to be confirmed
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: approvalHash,
      });

      // Step 5: Verify approval succeeded
      if (receipt.status !== 'success') {
        throw new Error('Approval transaction failed');
      }

      console.log('Approval transaction confirmed');

      // Step 6: Verify the new allowance is sufficient
      const newAllowance = await this.checkTokenAllowance(
        publicClient,
        tokenAddress,
        userAddress,
        spenderAddress
      );

      if (newAllowance < amount) {
        throw new Error('Approval succeeded but allowance is still insufficient');
      }

      console.log('Token approval verified successfully');
    } catch (error: any) {
      console.error('Failed to approve token:', error);
      throw new Error(`Failed to approve token: ${error.message}`);
    }
  }

  /**
   * Check token allowance
   * 
   * @param client - Public client for reading blockchain data
   * @param tokenAddress - Token contract address
   * @param ownerAddress - Token owner address
   * @param spenderAddress - Spender address (pool)
   * @returns Current allowance amount
   */
  private async checkTokenAllowance(
    client: PublicClient,
    tokenAddress: Address,
    ownerAddress: Address,
    spenderAddress: Address
  ): Promise<bigint> {
    try {
      const allowance = await client.readContract({
        address: tokenAddress,
        abi: ERC20ABI,
        functionName: 'allowance',
        args: [ownerAddress, spenderAddress],
      }) as bigint;

      return allowance;
    } catch (error: any) {
      console.error('Failed to check allowance:', error);
      throw new Error(`Failed to check allowance for token ${tokenAddress}`);
    }
  }

  /**
   * Simulate swapSAMM transaction
   * 
   * This method simulates the swap transaction before execution to:
   * - Verify the transaction will succeed
   * - Catch any errors before spending gas
   * - Validate the swap parameters are correct
   * 
   * @param client - Public client for reading blockchain data
   * @param quote - Swap quote
   * @param userAddress - User's wallet address
   * @returns Simulation result
   */
  private async simulateSwapSAMM(
    client: PublicClient,
    quote: SAMMSwapQuote,
    userAddress: Address
  ): Promise<any> {
    try {
      console.log('Simulating swapSAMM transaction...');
      
      // Simulate the swapSAMM contract call
      const { request } = await client.simulateContract({
        address: quote.selectedShard.address,
        abi: PoolABI,
        functionName: 'swapSAMM',
        args: [
          quote.outputAmount,      // amountOut - exact amount user wants
          quote.maximalInput,      // maximalAmountIn - slippage protection
          quote.inputToken,        // tokenIn
          quote.outputToken,       // tokenOut
          userAddress,             // recipient
        ],
        account: userAddress,
      });

      console.log('Simulation successful');
      return request;
    } catch (error: any) {
      console.error('Simulation failed:', error);
      
      // Parse error message to provide user-friendly feedback
      let errorMessage = 'Transaction simulation failed';
      
      if (error.message) {
        if (error.message.includes('excessive input amount')) {
          errorMessage = 'Price moved unfavorably. Required input exceeds your slippage tolerance.';
        } else if (error.message.includes('exceeds c-threshold')) {
          errorMessage = 'Trade size exceeds pool capacity (c-threshold). Try a smaller amount.';
        } else if (error.message.includes('insufficient liquidity')) {
          errorMessage = 'Insufficient liquidity in the pool. Try a smaller amount.';
        } else if (error.message.includes('insufficient balance')) {
          errorMessage = 'Insufficient token balance for this swap.';
        } else {
          errorMessage = `Transaction would fail: ${error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Execute swapSAMM transaction
   * 
   * This method executes the actual swap transaction on the blockchain.
   * It uses the wallet client to sign and submit the transaction.
   * 
   * @param walletClient - Wallet client for signing transactions
   * @param quote - Swap quote
   * @param userAddress - User's wallet address
   * @returns Transaction hash
   */
  private async executeSwapTransaction(
    walletClient: WalletClient,
    quote: SAMMSwapQuote,
    userAddress: Address
  ): Promise<Address> {
    try {
      console.log('Executing swapSAMM transaction...');
      
      // Execute the swapSAMM contract call
      const hash = await walletClient.writeContract({
        address: quote.selectedShard.address,
        abi: PoolABI,
        functionName: 'swapSAMM',
        args: [
          quote.outputAmount,      // amountOut - exact amount user wants
          quote.maximalInput,      // maximalAmountIn - slippage protection
          quote.inputToken,        // tokenIn
          quote.outputToken,       // tokenOut
          userAddress,             // recipient
        ],
        account: userAddress,
        chain: monadChain,
      });

      console.log(`Transaction submitted: ${hash}`);
      return hash;
    } catch (error: any) {
      console.error('Transaction execution failed:', error);
      
      // Parse error message to provide user-friendly feedback
      let errorMessage = 'Failed to execute swap transaction';
      
      if (error.message) {
        if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected by user';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for gas fees';
        } else {
          errorMessage = `Transaction failed: ${error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Wait for swap confirmation and parse results
   * 
   * This method waits for the transaction to be confirmed on the blockchain,
   * then parses the transaction logs to extract the actual swap amounts.
   * 
   * @param client - Public client for reading blockchain data
   * @param hash - Transaction hash
   * @param quote - Original swap quote
   * @returns Swap result with actual amounts
   */
  private async waitForSwapConfirmation(
    client: PublicClient,
    hash: Address,
    quote: SAMMSwapQuote
  ): Promise<SAMMSwapResult> {
    try {
      console.log('Waiting for transaction confirmation...');
      
      // Wait for transaction receipt
      const receipt = await client.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });

      // Check if transaction was successful
      if (receipt.status !== 'success') {
        throw new Error('Transaction failed on-chain');
      }

      console.log('Transaction confirmed successfully');

      // Parse transaction logs to extract actual amounts
      // The swapSAMM function returns the actual amountIn used
      // We can get this from the transaction receipt or use the quote values
      
      // For now, we'll use the quote values as the actual amounts
      // In a production system, you might want to parse the logs more carefully
      // to extract the exact amounts from Transfer events
      
      const result: SAMMSwapResult = {
        hash,
        inputAmount: quote.estimatedInput,  // Actual input used
        outputAmount: quote.outputAmount,   // Exact output received (guaranteed by SAMM)
        tradeFee: quote.tradeFee,           // Dynamic fee charged
        shardUsed: quote.selectedShard.address, // Shard that executed the swap
      };

      // Try to extract actual input amount from logs if available
      try {
        const actualInputAmount = await this.extractActualInputFromLogs(
          client,
          receipt,
          quote
        );
        
        if (actualInputAmount !== null) {
          result.inputAmount = actualInputAmount;
        }
      } catch (error) {
        // If we can't extract from logs, use the estimated amount
        console.warn('Could not extract actual input from logs, using estimate');
      }

      return result;
    } catch (error: any) {
      console.error('Failed to confirm transaction:', error);
      throw new Error(`Transaction confirmation failed: ${error.message}`);
    }
  }

  /**
   * Extract actual input amount from transaction logs
   * 
   * This method attempts to parse the transaction logs to find the actual
   * input amount used in the swap. This is more accurate than using the estimate.
   * 
   * @param client - Public client for reading blockchain data
   * @param receipt - Transaction receipt
   * @param quote - Original swap quote
   * @returns Actual input amount, or null if not found
   */
  private async extractActualInputFromLogs(
    client: PublicClient,
    receipt: any,
    quote: SAMMSwapQuote
  ): Promise<bigint | null> {
    try {
      // Look for Transfer events from the input token
      // The Transfer event will show the actual amount transferred from user to pool
      
      // Transfer event signature: Transfer(address indexed from, address indexed to, uint256 value)
      const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      
      // Find Transfer events from the input token contract
      for (const log of receipt.logs) {
        // Check if this is a Transfer event from the input token
        if (
          log.address.toLowerCase() === quote.inputToken.toLowerCase() &&
          log.topics[0] === transferEventSignature
        ) {
          // Decode the transfer amount (third parameter, in data field)
          const amount = BigInt(log.data);
          
          // Verify this is a transfer from the user to the pool
          const from = '0x' + log.topics[1].slice(26); // Remove padding
          const to = '0x' + log.topics[2].slice(26);   // Remove padding
          
          if (to.toLowerCase() === quote.selectedShard.address.toLowerCase()) {
            console.log(`Extracted actual input amount from logs: ${amount}`);
            return amount;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to extract input amount from logs:', error);
      return null;
    }
  }
}
