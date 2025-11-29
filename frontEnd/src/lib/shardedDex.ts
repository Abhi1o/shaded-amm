/**
 * Sharded DEX Integration - EVM Version
 * 
 * This service provides smart routing across multiple pool shards for optimal pricing on EVM chains.
 * It integrates with the SAMM Router backend API for intelligent shard selection and
 * falls back to local calculation when the backend is unavailable.
 * 
 * Key Features:
 * - Backend-first routing with automatic fallback to local calculation
 * - Real-time pool state fetching with caching
 * - Performance metrics tracking
 * - Comprehensive error handling and logging
 * 
 * Routing Flow:
 * 1. Try backend API for optimal shard selection (primary)
 * 2. On failure, fall back to local calculation (secondary)
 * 3. Cache pool states to reduce RPC calls
 * 4. Track performance metrics for monitoring
 * 
 * @module shardedDex
 */

import { PublicClient, WalletClient, Address, parseUnits, formatUnits } from 'viem';
import { evmPoolService } from '../services/evmPoolService';
import { evmSwapService } from '../services/evmSwapService';
import { evmLiquidityService } from '../services/evmLiquidityService';
import { evmApprovalService } from '../services/evmApprovalService';
import { getTokensByChainId, getTokenBySymbol } from '../config/evm-tokens';
import { getDexConfig, isChainSupported, getChainName } from '../config/dex-config-loader';

/**
 * Token configuration
 */
export interface TokenConfig {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
}

/**
 * Swap quote with routing information
 */
export interface SwapQuote {
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  estimatedOutput: number;
  priceImpact: number;
  route: ShardRoute[];
  totalFee: number;
  routingMethod: 'backend' | 'local';
  backendReason?: string;
  // Multi-hop specific fields
  isMultiHop?: boolean;
  multiHopPath?: string[];
  multiHopSteps?: MultiHopStep[];
}

export interface MultiHopStep {
  shard: string;
  from: string;
  to: string;
  amountIn: string;
  amountOut: string;
}

export interface ShardRoute {
  poolAddress: string;
  shardNumber: number;
  inputAmount: number;
  outputAmount: number;
  reserves: {
    reserve0: string;
    reserve1: string;
  };
}

/**
 * Pool data with real-time reserves
 */
export interface PoolData {
  poolAddress: string;
  tokenA: string;
  tokenB: string;
  tokenASymbol: string;
  tokenBSymbol: string;
  liquidityA: string;
  liquidityB: string;
  shardNumber: number;
  dataSource: 'blockchain' | 'cache';
}

/**
 * Sharded DEX Service for EVM chains
 */
export class ShardedDexService {
  private publicClient: PublicClient;
  private walletClient: WalletClient | null = null;
  private chainId: number;

  constructor(publicClient: PublicClient, chainId: number, walletClient?: WalletClient) {
    this.publicClient = publicClient;
    this.chainId = chainId;
    this.walletClient = walletClient || null;

    // Validate chain support
    if (!isChainSupported(chainId)) {
      console.warn(`Chain ID ${chainId} is not supported. Supported chains: 10143 (Monad), 11155931 (RiseChain)`);
    }
  }

  /**
   * Set wallet client for transactions
   */
  setWalletClient(walletClient: WalletClient) {
    this.walletClient = walletClient;
  }

  /**
   * Get pool configuration for current chain
   */
  private getPoolConfig() {
    return getDexConfig(this.chainId);
  }

  /**
   * Get current chain name
   */
  getChainName(): string {
    return getChainName(this.chainId);
  }

  /**
   * Get current chain ID
   */
  getChainId(): number {
    return this.chainId;
  }

  /**
   * Get all available tokens for current chain
   */
  getTokens(): TokenConfig[] {
    return getTokensByChainId(this.chainId).map(token => ({
      symbol: token.symbol,
      name: token.name,
      address: token.address,
      decimals: token.decimals,
    }));
  }

  /**
   * Get swap quote
   */
  async getQuote(
    inputTokenSymbol: string,
    outputTokenSymbol: string,
    inputAmount: number
  ): Promise<SwapQuote> {
    const inputToken = getTokenBySymbol(this.chainId, inputTokenSymbol);
    const outputToken = getTokenBySymbol(this.chainId, outputTokenSymbol);

    if (!inputToken || !outputToken) {
      throw new Error('Token not found');
    }

    const inputAmountWei = parseUnits(inputAmount.toString(), inputToken.decimals);

    // Get quote from EVM swap service
    const evmQuote = await evmSwapService.getQuote(
      this.publicClient,
      this.chainId,
      inputToken.address as Address,
      outputToken.address as Address,
      inputAmountWei
    );

    // Check if route is single-hop or multi-hop
    const isSingleHop = 'shardNumber' in evmQuote.route;
    
    // Convert to legacy format
    if (isSingleHop) {
      // Single-hop route (EVMShardRoute)
      const singleRoute = evmQuote.route as any;
      return {
        inputToken: inputTokenSymbol,
        outputToken: outputTokenSymbol,
        inputAmount,
        estimatedOutput: Number(formatUnits(evmQuote.estimatedOutput, outputToken.decimals)),
        priceImpact: evmQuote.priceImpact,
        route: [{
          poolAddress: evmQuote.poolAddress,
          shardNumber: singleRoute.shardNumber,
          inputAmount,
          outputAmount: Number(formatUnits(evmQuote.estimatedOutput, outputToken.decimals)),
          reserves: {
            reserve0: formatUnits(singleRoute.reserves.reserve0, 18),
            reserve1: formatUnits(singleRoute.reserves.reserve1, 18),
          },
        }],
        totalFee: inputAmount * 0.003, // 0.3% fee
        routingMethod: evmQuote.backendOptimized ? 'backend' : 'local',
      };
    } else {
      // Multi-hop route (EVMMultiHopRoute)
      const multiRoute = evmQuote.route as any;
      return {
        inputToken: inputTokenSymbol,
        outputToken: outputTokenSymbol,
        inputAmount,
        estimatedOutput: Number(formatUnits(evmQuote.estimatedOutput, outputToken.decimals)),
        priceImpact: evmQuote.priceImpact,
        route: multiRoute.steps.map((step: any) => ({
          poolAddress: step.poolAddress,
          shardNumber: step.shardNumber,
          inputAmount: Number(formatUnits(step.inputAmount, inputToken.decimals)),
          outputAmount: Number(formatUnits(step.outputAmount, outputToken.decimals)),
          reserves: {
            reserve0: '0',
            reserve1: '0',
          },
        })),
        totalFee: inputAmount * 0.003, // 0.3% fee (approximate for multi-hop)
        routingMethod: evmQuote.backendOptimized ? 'backend' : 'local',
      };
    }
  }

  /**
   * Execute swap - handles both single-hop and multi-hop swaps
   */
  async executeSwap(quote: SwapQuote, slippageTolerance: number = 0.5): Promise<string> {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔄 ShardedDexService.executeSwap() CALLED');
    console.log('═══════════════════════════════════════════════════════');
    
    if (!this.walletClient) {
      console.log('❌ Wallet not connected in ShardedDexService');
      throw new Error('Wallet not connected');
    }
    console.log('✅ Wallet client available');

    console.log('🔍 Looking up tokens...');
    const inputToken = getTokenBySymbol(this.chainId, quote.inputToken);
    const outputToken = getTokenBySymbol(this.chainId, quote.outputToken);

    console.log('  - Input Token:', inputToken);
    console.log('  - Output Token:', outputToken);

    if (!inputToken || !outputToken) {
      console.log('❌ Token not found');
      throw new Error('Token not found');
    }
    console.log('✅ Tokens found');

    const userAddress = this.walletClient.account?.address;
    console.log('  - User Address:', userAddress);
    
    if (!userAddress) {
      console.log('❌ No user address');
      throw new Error('No user address');
    }
    console.log('✅ User address available');

    const inputAmountWei = parseUnits(quote.inputAmount.toString(), inputToken.decimals);

    // Check if this is a multi-hop swap
    const isMultiHop = quote.isMultiHop && quote.multiHopSteps && quote.multiHopSteps.length > 0;
    
    console.log('📊 Swap Parameters:');
    console.log('  - Input Amount (Wei):', inputAmountWei.toString());
    console.log('  - Is Multi-Hop:', isMultiHop);
    console.log('  - Slippage Tolerance:', slippageTolerance);

    if (isMultiHop) {
      console.log('  - Multi-Hop Path:', quote.multiHopPath?.join(' → '));
      console.log('  - Multi-Hop Steps:', quote.multiHopSteps?.length);
      
      // For multi-hop, approve the first pool in the path
      const firstStep = quote.multiHopSteps![0];
      const firstPoolAddress = firstStep.shard as Address;
      
      console.log('  - First Pool Address:', firstPoolAddress);
      
      // Check and request approval for the first pool
      console.log('🔄 Checking token approval for first pool...');
      try {
        const approvalHash = await evmApprovalService.ensureApproval(
          this.walletClient,
          this.publicClient,
          inputToken.address as Address,
          userAddress,
          firstPoolAddress,
          inputAmountWei,
          'exact'
        );

        if (approvalHash) {
          console.log('✅ Approval transaction:', approvalHash);
        } else {
          console.log('✅ Token already approved');
        }
      } catch (approvalError) {
        console.log('❌ Approval failed:', approvalError);
        throw approvalError;
      }
    } else {
      // Single-hop swap
      const poolAddressRaw = quote.route[0].poolAddress;
      console.log('  - Pool Address:', poolAddressRaw);
      
      if (!poolAddressRaw || poolAddressRaw.length < 10 || !poolAddressRaw.startsWith('0x')) {
        console.log('❌ Invalid pool address for single-hop swap');
        throw new Error('Invalid pool address. Please try refreshing the quote.');
      }
      
      const poolAddress = poolAddressRaw as Address;

      // Check and request approval if needed
      console.log('🔄 Checking token approval...');
      try {
        const approvalHash = await evmApprovalService.ensureApproval(
          this.walletClient,
          this.publicClient,
          inputToken.address as Address,
          userAddress,
          poolAddress,
          inputAmountWei,
          'exact'
        );

        if (approvalHash) {
          console.log('✅ Approval transaction:', approvalHash);
        } else {
          console.log('✅ Token already approved');
        }
      } catch (approvalError) {
        console.log('❌ Approval failed:', approvalError);
        throw approvalError;
      }
    }

    // For multi-hop swaps, we already have the route info - execute directly
    if (isMultiHop && quote.multiHopSteps && quote.multiHopSteps.length > 0) {
      console.log('🔀 Executing multi-hop swap directly...');
      console.log('  - Steps:', quote.multiHopSteps.length);
      
      try {
        // Build EVMSwapQuote for multi-hop execution
        const multiHopSteps = quote.multiHopSteps.map(step => ({
          poolAddress: step.shard as Address,
          shardNumber: 1,
          inputAmount: BigInt(step.amountIn),
          outputAmount: BigInt(step.amountOut),
          from: step.from,
          to: step.to,
        }));

        const evmQuote = {
          inputToken: inputToken.address as Address,
          outputToken: outputToken.address as Address,
          inputAmount: inputAmountWei,
          estimatedOutput: parseUnits(quote.estimatedOutput.toString(), outputToken.decimals),
          minimumOutput: parseUnits((quote.estimatedOutput * (1 - slippageTolerance / 100)).toString(), outputToken.decimals),
          maximalInput: inputAmountWei + (inputAmountWei * BigInt(Math.floor(slippageTolerance * 10)) / 1000n),
          priceImpact: quote.priceImpact,
          route: {
            path: quote.multiHopPath || [],
            shards: quote.multiHopSteps.map(s => s.shard),
            steps: multiHopSteps,
          },
          poolAddress: multiHopSteps[0].poolAddress,
          chainId: this.chainId,
          calculation: {
            amountIn: inputAmountWei,
            amountOut: parseUnits(quote.estimatedOutput.toString(), outputToken.decimals),
            tradeFee: parseUnits(quote.totalFee.toString(), inputToken.decimals),
            ownerFee: 0n,
          },
          isMultiHop: true,
          backendOptimized: true,
        };

        console.log('🔄 Executing multi-hop swap via evmSwapService...');
        const swapHash = await evmSwapService.executeSwap(
          this.walletClient,
          this.publicClient,
          evmQuote,
          userAddress
        );
        
        console.log('✅ Multi-hop swap executed successfully');
        console.log('  - Transaction Hash:', swapHash);
        console.log('═══════════════════════════════════════════════════════');
        
        return swapHash;
      } catch (error) {
        console.log('❌ Multi-hop swap execution failed:', error);
        throw error;
      }
    }

    // For single-hop swaps, get fresh quote from evmSwapService
    console.log('🔄 Getting fresh quote from evmSwapService...');
    try {
      const evmQuote = await evmSwapService.getQuote(
        this.publicClient,
        this.chainId,
        inputToken.address as Address,
        outputToken.address as Address,
        inputAmountWei,
        slippageTolerance
      );
      console.log('✅ Fresh quote received');
      console.log('  - Is Multi-Hop:', evmQuote.isMultiHop);
      console.log('  - Pool Address:', evmQuote.poolAddress);

      // Execute swap
      console.log('🔄 Executing swap via evmSwapService...');
      const swapHash = await evmSwapService.executeSwap(
        this.walletClient,
        this.publicClient,
        evmQuote,
        userAddress
      );
      
      console.log('✅ Swap executed successfully');
      console.log('  - Transaction Hash:', swapHash);
      console.log('═══════════════════════════════════════════════════════');
      
      return swapHash;
    } catch (error) {
      console.log('❌ Swap execution failed:', error);
      throw error;
    }
  }

  /**
   * Get pools for a token pair with real-time data
   */
  async getPoolsForPairRealTime(
    tokenASymbol: string,
    tokenBSymbol: string
  ): Promise<PoolData[]> {
    return evmPoolService.fetchAllShards(
      this.publicClient,
      this.chainId,
      tokenASymbol,
      tokenBSymbol
    );
  }

  /**
   * Get pools for a token pair from config
   */
  getPoolsForPair(tokenASymbol: string, tokenBSymbol: string): any[] {
    return evmPoolService.getPoolsForPair(this.chainId, tokenASymbol, tokenBSymbol);
  }

  /**
   * Get all trading pairs
   */
  getTradingPairs(): { pair: string; shards: number }[] {
    const config = this.getPoolConfig();

    // Return empty array for unsupported chains
    if (!config) {
      return [];
    }

    const pairMap = new Map<string, number>();

    config.pools.forEach((pool: any) => {
      const pair = `${pool.tokenASymbol}/${pool.tokenBSymbol}`;
      pairMap.set(pair, (pairMap.get(pair) || 0) + 1);
    });

    return Array.from(pairMap.entries()).map(([pair, shards]) => ({
      pair,
      shards,
    }));
  }

  /**
   * Add liquidity to a pool
   */
  async addLiquidity(
    poolAddress: string,
    tokenASymbol: string,
    tokenBSymbol: string,
    amountA: number,
    amountB: number
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error('Wallet not connected');
    }

    const tokenA = getTokenBySymbol(this.chainId, tokenASymbol);
    const tokenB = getTokenBySymbol(this.chainId, tokenBSymbol);

    if (!tokenA || !tokenB) {
      throw new Error('Token not found');
    }

    const userAddress = this.walletClient.account?.address;
    if (!userAddress) {
      throw new Error('No user address');
    }

    const amountAWei = parseUnits(amountA.toString(), tokenA.decimals);
    const amountBWei = parseUnits(amountB.toString(), tokenB.decimals);

    // Approve both tokens
    await evmApprovalService.ensureApproval(
      this.walletClient,
      this.publicClient,
      tokenA.address as Address,
      userAddress,
      poolAddress as Address,
      amountAWei
    );

    await evmApprovalService.ensureApproval(
      this.walletClient,
      this.publicClient,
      tokenB.address as Address,
      userAddress,
      poolAddress as Address,
      amountBWei
    );

    // Add liquidity with default 0.5% slippage tolerance
    const hash = await evmLiquidityService.addLiquidity(
      this.walletClient,
      this.publicClient,
      poolAddress as Address,
      amountAWei,
      amountBWei,
      0.5, // slippage tolerance
      userAddress
    );

    return hash;
  }

  /**
   * Remove liquidity from a pool
   */
  async removeLiquidity(
    poolAddress: string,
    lpTokenAmount: number
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error('Wallet not connected');
    }

    const userAddress = this.walletClient.account?.address;
    if (!userAddress) {
      throw new Error('No user address');
    }

    const lpTokenAmountWei = parseUnits(lpTokenAmount.toString(), 18);

    // Remove liquidity with default 0.5% slippage tolerance
    const hash = await evmLiquidityService.removeLiquidity(
      this.walletClient,
      this.publicClient,
      poolAddress as Address,
      lpTokenAmountWei,
      0.5, // slippage tolerance
      userAddress
    );

    return hash;
  }
}
