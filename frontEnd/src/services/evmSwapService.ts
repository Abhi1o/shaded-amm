/**
 * EVM Swap Service - SAMM Version
 *
 * Uses SAMM-specific swap functions for accurate routing and execution
 * Integrates with backend API for optimal shard selection and multi-hop routing
 * Falls back to local calculation if backend is unavailable
 */

import { PublicClient, WalletClient, Address } from 'viem';
import { evmPoolService } from './evmPoolService';
import { sammBackendService } from './sammBackendService';
import PoolABI from '../abis/Pool.json';
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

export interface EVMSwapQuote {
  inputToken: Address;
  outputToken: Address;
  inputAmount: bigint;
  estimatedOutput: bigint;
  minimumOutput: bigint;
  maximalInput: bigint;
  priceImpact: number;
  route: EVMShardRoute | EVMMultiHopRoute;
  poolAddress: Address;
  chainId: number;
  calculation: SwapCalculation;
  isMultiHop?: boolean;
  backendOptimized?: boolean;
}

export interface EVMShardRoute {
  poolAddress: Address;
  shardNumber: number;
  inputAmount: bigint;
  outputAmount: bigint;
  reserves: {
    reserve0: bigint;
    reserve1: bigint;
  };
}

export interface SwapCalculation {
  amountIn: bigint;
  amountOut: bigint;
  tradeFee: bigint;
  ownerFee: bigint;
}

export interface EVMMultiHopRoute {
  path: string[];
  shards: string[];
  steps: Array<{
    poolAddress: Address;
    shardNumber: number;
    inputAmount: bigint;
    outputAmount: bigint;
    from: string;
    to: string;
  }>;
}

class EVMSwapService {
  /**
   * Calculate price impact as percentage
   */
  private calculatePriceImpact(
    inputAmount: bigint,
    outputAmount: bigint,
    inputReserve: bigint,
    outputReserve: bigint
  ): number {
    if (inputReserve === 0n || outputReserve === 0n) {
      return 0;
    }

    try {
      // Current price: outputReserve / inputReserve
      // Execution price: outputAmount / inputAmount
      // Price impact = (1 - executionPrice / currentPrice) * 100

      const currentPrice = Number(outputReserve) / Number(inputReserve);
      const executionPrice = Number(outputAmount) / Number(inputAmount);

      const priceImpact = (1 - executionPrice / currentPrice) * 100;
      return Math.max(0, priceImpact);
    } catch {
      return 0;
    }
  }

  /**
   * Get swap quote using backend API for optimal shard selection
   * Falls back to local calculation if backend is unavailable
   */
  async getQuote(
    client: PublicClient,
    chainId: number,
    inputTokenAddress: Address,
    outputTokenAddress: Address,
    inputAmount: bigint,
    slippageTolerance: number = 0.5
  ): Promise<EVMSwapQuote> {
    // IMPORTANT: Backend only supports Monad (chainId 10143)
    // For other chains, use local calculation directly
    const MONAD_CHAIN_ID = 10143;
    
    if (chainId !== MONAD_CHAIN_ID) {
      console.log(`Chain ${chainId} detected - using local calculation (backend only supports Monad)`);
      return await this.getQuoteLocally(
        client,
        chainId,
        inputTokenAddress,
        outputTokenAddress,
        inputAmount,
        slippageTolerance
      );
    }

    // Try backend API first for optimal routing (Monad only)
    try {
      const backendAvailable = await sammBackendService.isBackendAvailable();

      if (backendAvailable) {
        console.log('Using SAMM backend API for optimal routing...');
        return await this.getQuoteFromBackend(
          client,
          chainId,
          inputTokenAddress,
          outputTokenAddress,
          inputAmount,
          slippageTolerance
        );
      }
    } catch (error) {
      console.warn('Backend API unavailable, falling back to local calculation:', error);
    }

    // Fallback to local calculation
    console.log('Using local calculation for swap quote...');
    return await this.getQuoteLocally(
      client,
      chainId,
      inputTokenAddress,
      outputTokenAddress,
      inputAmount,
      slippageTolerance
    );
  }

  /**
   * Get quote from backend API (preferred method)
   * Uses backend's optimal shard selection and multi-hop routing
   */
  private async getQuoteFromBackend(
    client: PublicClient,
    chainId: number,
    inputTokenAddress: Address,
    outputTokenAddress: Address,
    inputAmount: bigint,
    slippageTolerance: number
  ): Promise<EVMSwapQuote> {
    // Estimate output amount for best-shard calculation
    // Use rough constant product formula: amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
    // For 1:1 stableswaps, use 0.997 to account for 0.3% fee
    // Also apply a 0.5% safety margin to stay within c-threshold
    const estimatedOutput = (inputAmount * 992n) / 1000n;

    try {
      // Try direct pair first using getBestShard
      const bestShardResult = await sammBackendService.getBestShard(
        estimatedOutput.toString(),
        inputTokenAddress,
        outputTokenAddress
      );

      const outputAmount = BigInt(bestShardResult.bestShard.amountOut);
      const actualInputAmount = BigInt(bestShardResult.bestShard.amountIn);
      const totalFee = BigInt(bestShardResult.bestShard.tradeFee);
      const poolAddress = bestShardResult.bestShard.address;

      // Calculate minimum output with slippage
      const slippageMultiplier = BigInt(Math.floor((100 - slippageTolerance) * 100));
      const minimumOutput = (outputAmount * slippageMultiplier) / 10000n;

      // Calculate maximal input with slippage (10% buffer)
      const maximalInput = actualInputAmount + (actualInputAmount * 10n / 100n);

      // Get pool reserves for price impact calculation
      const { reserves } = await evmPoolService.getPoolReserves(
        client,
        poolAddress as Address
      );

      const priceImpact = reserves ? this.calculatePriceImpact(
        actualInputAmount,
        outputAmount,
        reserves.reserve0,
        reserves.reserve1
      ) : 0;

      return {
        inputToken: inputTokenAddress,
        outputToken: outputTokenAddress,
        inputAmount: actualInputAmount,
        estimatedOutput: outputAmount,
        minimumOutput,
        maximalInput,
        priceImpact,
        route: {
          poolAddress: poolAddress as Address,
          shardNumber: parseInt(bestShardResult.bestShard.name.split('-')[1] || '1'),
          inputAmount: actualInputAmount,
          outputAmount,
          reserves: reserves || { reserve0: 0n, reserve1: 0n },
        },
        poolAddress: poolAddress as Address,
        chainId,
        calculation: {
          amountIn: actualInputAmount,
          amountOut: outputAmount,
          tradeFee: totalFee,
          ownerFee: 0n,
        },
        isMultiHop: false,
        backendOptimized: true,
      };
    } catch (directError: any) {
      // If direct pair fails, try multi-hop routing
      if (directError.message?.includes('No direct pair') ||
          directError.message?.includes('not found')) {
        console.log('No direct pair found, trying multi-hop routing...');

        const multiHopResult = await sammBackendService.getMultiHopRoute(
          inputAmount.toString(),
          inputTokenAddress,
          outputTokenAddress
        );

        const outputAmount = BigInt(multiHopResult.amountOut);
        const actualInputAmount = BigInt(multiHopResult.amountIn);
        const totalFee = BigInt(multiHopResult.totalFee);

        // Calculate minimum output with slippage
        const slippageMultiplier = BigInt(Math.floor((100 - slippageTolerance) * 100));
        const minimumOutput = (outputAmount * slippageMultiplier) / 10000n;

        // Calculate maximal input with slippage (10% buffer)
        const maximalInput = actualInputAmount + (actualInputAmount * 10n / 100n);

        // Multi-hop routing
        const steps = multiHopResult.steps.map(step => ({
          poolAddress: step.shard as Address,
          shardNumber: 1,
          inputAmount: BigInt(step.amountIn),
          outputAmount: BigInt(step.amountOut),
          from: step.from,
          to: step.to,
        }));

        return {
          inputToken: inputTokenAddress,
          outputToken: outputTokenAddress,
          inputAmount: actualInputAmount,
          estimatedOutput: outputAmount,
          minimumOutput,
          maximalInput,
          priceImpact: 0, // TODO: Calculate for multi-hop
          route: {
            path: multiHopResult.path,
            shards: multiHopResult.steps.map(s => s.shard),
            steps,
          },
          poolAddress: steps[0].poolAddress, // First pool address
          chainId,
          calculation: {
            amountIn: actualInputAmount,
            amountOut: outputAmount,
            tradeFee: totalFee,
            ownerFee: 0n,
          },
          isMultiHop: true,
          backendOptimized: true,
        };
      }

      // If not a "no direct pair" error, throw it
      throw directError;
    }
  }

  /**
   * Get quote using local calculation (fallback method)
   * Manually checks all shards and selects best one
   */
  private async getQuoteLocally(
    client: PublicClient,
    chainId: number,
    inputTokenAddress: Address,
    outputTokenAddress: Address,
    inputAmount: bigint,
    slippageTolerance: number
  ): Promise<EVMSwapQuote> {
    // Get all pools for this pair
    const pools = await evmPoolService.fetchAllShards(
      client,
      chainId,
      'USDC', // TODO: Get symbol from address
      'USDT'  // TODO: Get symbol from address
    );

    if (pools.length === 0) {
      throw new Error('No pools found for this token pair');
    }

    // Calculate quotes from each pool using calculateSwapSAMM and find the best one
    let bestQuote: EVMSwapQuote | null = null;
    let bestOutput = 0n;

    for (const pool of pools) {
      try {
        const { reserves } = await evmPoolService.getPoolReserves(
          client,
          pool.poolAddress as Address
        );

        if (!reserves) continue;

        // Determine which reserve is input and which is output
        const isToken0Input = pool.tokenA.toLowerCase() === inputTokenAddress.toLowerCase();
        const inputReserve = isToken0Input ? reserves.reserve0 : reserves.reserve1;
        const outputReserve = isToken0Input ? reserves.reserve1 : reserves.reserve0;

        // Use calculateSwapSAMM to get accurate quote (reverse calculation)
        // Since we have inputAmount, we need to estimate outputAmount first
        // For now, use a rough estimate and let calculateSwapSAMM refine it
        const estimatedOutput = (inputAmount * outputReserve * 997n) / ((inputReserve * 1000n) + (inputAmount * 997n));

        // Now use calculateSwapSAMM with the estimated output to get exact calculation
        const calculation = await client.readContract({
          address: pool.poolAddress as Address,
          abi: PoolABI,
          functionName: 'calculateSwapSAMM',
          args: [estimatedOutput, inputTokenAddress, outputTokenAddress],
        }) as unknown as { amountIn: bigint; amountOut: bigint; tradeFee: bigint; ownerFee: bigint };

        const outputAmount = calculation.amountOut;

        if (outputAmount > bestOutput) {
          bestOutput = outputAmount;

          // Calculate minimum output with slippage
          const slippageMultiplier = BigInt(Math.floor((100 - slippageTolerance) * 100));
          const minimumOutput = (outputAmount * slippageMultiplier) / 10000n;

          // Calculate maximal input with slippage (10% buffer like backend)
          const maximalInput = calculation.amountIn + (calculation.amountIn * 10n / 100n);

          // Calculate price impact
          const priceImpact = this.calculatePriceImpact(
            calculation.amountIn,
            outputAmount,
            inputReserve,
            outputReserve
          );

          bestQuote = {
            inputToken: inputTokenAddress,
            outputToken: outputTokenAddress,
            inputAmount,
            estimatedOutput: outputAmount,
            minimumOutput,
            maximalInput,
            priceImpact,
            route: {
              poolAddress: pool.poolAddress as Address,
              shardNumber: pool.shardNumber,
              inputAmount: calculation.amountIn,
              outputAmount,
              reserves: {
                reserve0: reserves.reserve0,
                reserve1: reserves.reserve1,
              },
            },
            poolAddress: pool.poolAddress as Address,
            chainId,
            calculation: {
              amountIn: calculation.amountIn,
              amountOut: calculation.amountOut,
              tradeFee: calculation.tradeFee,
              ownerFee: calculation.ownerFee,
            },
            backendOptimized: false,
          };
        }
      } catch (error) {
        console.error(`Failed to get quote from pool ${pool.poolAddress}:`, error);
        continue;
      }
    }

    if (!bestQuote) {
      throw new Error('Failed to get quote from any pool');
    }

    return bestQuote;
  }

  /**
   * Switch wallet to Monad chain if needed
   */
  private async ensureCorrectChain(): Promise<void> {
    if (typeof window === 'undefined' || !window.ethereum) {
      return;
    }

    try {
      // Get current chain ID from wallet
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      const currentChainIdNumber = parseInt(currentChainId, 16);

      // If already on Monad, we're good
      if (currentChainIdNumber === MONAD_TESTNET.chainId) {
        console.log('✅ Wallet already on Monad Testnet');
        return;
      }

      console.log(`⚠️  Wallet on chain ${currentChainIdNumber}, switching to Monad (${MONAD_TESTNET.chainId})...`);

      // Try to switch to Monad
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${MONAD_TESTNET.chainId.toString(16)}` }],
        });
        console.log('✅ Switched to Monad Testnet');
      } catch (switchError: any) {
        // Chain not added to wallet, try to add it
        if (switchError.code === 4902) {
          console.log('⚠️  Monad not in wallet, adding it...');
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${MONAD_TESTNET.chainId.toString(16)}`,
              chainName: MONAD_TESTNET.name,
              nativeCurrency: MONAD_TESTNET.nativeCurrency,
              rpcUrls: MONAD_TESTNET.rpcUrls,
              blockExplorerUrls: MONAD_TESTNET.blockExplorerUrls,
            }],
          });
          console.log('✅ Added and switched to Monad Testnet');
        } else {
          throw switchError;
        }
      }
    } catch (error) {
      console.error('Failed to switch chain:', error);
      throw new Error(
        'Please manually switch your wallet to Monad Testnet. ' +
        'Chain ID: 10143'
      );
    }
  }

  /**
   * Execute a swap transaction - handles both single-hop and multi-hop swaps
   * This matches the backend implementation exactly
   */
  async executeSwap(
    walletClient: WalletClient,
    publicClient: PublicClient,
    quote: EVMSwapQuote,
    userAddress: Address
  ): Promise<Address> {
    // CRITICAL: Ensure wallet is on correct chain before executing
    await this.ensureCorrectChain();

    // Check if this is a multi-hop swap
    if (quote.isMultiHop && 'steps' in quote.route) {
      console.log('🔀 Executing multi-hop swap...');
      return await this.executeMultiHopSwap(
        walletClient,
        publicClient,
        quote,
        userAddress
      );
    }

    // Single-hop swap execution (original logic)
    return await this.executeSingleHopSwap(
      walletClient,
      publicClient,
      quote,
      userAddress
    );
  }

  /**
   * Execute a single-hop swap using swapSAMM
   */
  private async executeSingleHopSwap(
    walletClient: WalletClient,
    publicClient: PublicClient,
    quote: EVMSwapQuote,
    userAddress: Address
  ): Promise<Address> {
    // CRITICAL: Ensure wallet is on correct chain before executing
    await this.ensureCorrectChain();

    // Verify pool exists on current chain before attempting swap
    try {
      const code = await publicClient.getBytecode({ address: quote.poolAddress });
      if (!code || code === '0x') {
        throw new Error(
          `Pool ${quote.poolAddress} does not exist on this chain. ` +
          `Please ensure you are connected to the correct network (chainId: ${quote.chainId}).`
        );
      }
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        throw error;
      }
      console.warn('Could not verify pool existence:', error);
    }

    // Build transaction using swapSAMM
    try {
      const { request } = await publicClient.simulateContract({
        address: quote.poolAddress,
        abi: PoolABI,
        functionName: 'swapSAMM',
        args: [
          quote.estimatedOutput,  // amountOut - exact amount we want
          quote.maximalInput,     // maximalAmountIn - max we're willing to pay
          quote.inputToken,       // tokenIn
          quote.outputToken,      // tokenOut
          userAddress,            // recipient
        ],
        account: userAddress,
        chain: monadChain,
      });

      // Execute transaction
      const hash = await walletClient.writeContract({
        ...request,
        chain: monadChain,
      });

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash });

      return hash;
    } catch (error: any) {
      // Handle specific error cases with better messages
      const errorMsg = error.message || '';
      
      // C-threshold exceeded (0xfb8f41b2)
      if (errorMsg.includes('0xfb8f41b2') || errorMsg.includes('ExceedsCThreshold')) {
        throw new Error(
          'Swap amount exceeds pool safety threshold. Please try a smaller amount or use a different pool.'
        );
      }
      
      // Insufficient liquidity
      if (errorMsg.includes('insufficient liquidity')) {
        throw new Error(
          'Insufficient liquidity in pool. Please try a smaller amount.'
        );
      }
      
      // Slippage exceeded
      if (errorMsg.includes('excessive input amount')) {
        throw new Error(
          'Price moved unfavorably. Please try again with higher slippage tolerance.'
        );
      }
      
      // Re-throw original error if not a known case
      throw error;
    }
  }

  /**
   * Execute a multi-hop swap (e.g., USDC → USDT → DAI)
   * Executes sequential swaps through intermediate tokens
   */
  private async executeMultiHopSwap(
    walletClient: WalletClient,
    publicClient: PublicClient,
    quote: EVMSwapQuote,
    userAddress: Address
  ): Promise<Address> {
    if (!('steps' in quote.route)) {
      throw new Error('Invalid multi-hop quote: missing steps');
    }

    const route = quote.route as EVMMultiHopRoute;
    const steps = route.steps;

    console.log(`🔀 Executing ${steps.length}-hop swap: ${route.path.join(' → ')}`);

    // Get token addresses from deployment info
    const deploymentInfo = await sammBackendService.getDeploymentInfo();
    const tokenAddresses: Record<string, Address> = {};

    for (const [symbol, info] of Object.entries(deploymentInfo.tokens)) {
      tokenAddresses[symbol] = info.address as Address;
    }

    console.log('📋 Token addresses:', tokenAddresses);

    let lastTxHash: Address | null = null;

    // Execute each swap step sequentially
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const isFirstStep = i === 0;
      const isLastStep = i === steps.length - 1;

      console.log(`\n📍 Step ${i + 1}/${steps.length}: ${step.from} → ${step.to}`);
      console.log(`   Pool: ${step.poolAddress}`);
      console.log(`   Amount In: ${step.inputAmount.toString()}`);
      console.log(`   Amount Out: ${step.outputAmount.toString()}`);

      // Get token addresses for this step
      const tokenInAddress = tokenAddresses[route.path[i]];
      const tokenOutAddress = tokenAddresses[route.path[i + 1]];

      if (!tokenInAddress || !tokenOutAddress) {
        throw new Error(
          `Cannot find token addresses for ${route.path[i]} or ${route.path[i + 1]}`
        );
      }

      // For intermediate steps, we need to approve the pool to spend the intermediate token
      if (!isFirstStep) {
        console.log(`   ℹ️  Intermediate step - checking approval for ${step.from}...`);
        // Import evmApprovalService to handle approvals
        const { evmApprovalService } = await import('./evmApprovalService');

        // Check if we have enough approval
        const currentAllowance = await evmApprovalService.checkApproval(
          publicClient,
          tokenInAddress,
          userAddress,
          step.poolAddress,
          step.inputAmount
        );

        if (!currentAllowance) {
          console.log(`   🔓 Approving ${step.from} for pool ${step.poolAddress}...`);
          await evmApprovalService.requestApproval(
            walletClient,
            publicClient,
            tokenInAddress,
            step.poolAddress,
            step.inputAmount,
            'exact',
            userAddress
          );
          console.log(`   ✅ Approval confirmed`);
        }
      }

      // Execute the swap for this step
      try {
        console.log(`   🔄 Executing swap on pool ${step.poolAddress}...`);

        // Calculate max input with slippage for this step (10% buffer)
        const maxInput = step.inputAmount + (step.inputAmount * 10n / 100n);

        const { request } = await publicClient.simulateContract({
          address: step.poolAddress,
          abi: PoolABI,
          functionName: 'swapSAMM',
          args: [
            step.outputAmount,      // amountOut - exact amount we want
            maxInput,               // maximalAmountIn - max we're willing to pay
            tokenInAddress,         // tokenIn (address)
            tokenOutAddress,        // tokenOut (address)
            userAddress,            // recipient
          ],
          account: userAddress,
          chain: monadChain,
        });

        // Execute the swap
        const hash = await walletClient.writeContract({
          ...request,
          chain: monadChain,
        });

        console.log(`   ⏳ Waiting for confirmation... (tx: ${hash})`);

        // Wait for confirmation
        await publicClient.waitForTransactionReceipt({ hash });

        console.log(`   ✅ Step ${i + 1} completed`);
        lastTxHash = hash;

      } catch (error: any) {
        console.error(`   ❌ Step ${i + 1} failed:`, error);
        throw new Error(
          `Multi-hop swap failed at step ${i + 1} (${step.from} → ${step.to}): ${error.message}`
        );
      }
    }

    if (!lastTxHash) {
      throw new Error('Multi-hop swap failed: no transactions executed');
    }

    console.log(`\n✅ Multi-hop swap completed! Final tx: ${lastTxHash}`);
    return lastTxHash;
  }

  /**
   * Estimate gas for a swap using swapSAMM
   */
  async estimateSwapGas(
    publicClient: PublicClient,
    quote: EVMSwapQuote,
    userAddress: Address
  ): Promise<bigint> {
    const gas = await publicClient.estimateContractGas({
      address: quote.poolAddress,
      abi: PoolABI,
      functionName: 'swapSAMM',
      args: [
        quote.estimatedOutput,  // amountOut
        quote.maximalInput,     // maximalAmountIn
        quote.inputToken,       // tokenIn
        quote.outputToken,      // tokenOut
        userAddress,            // recipient
      ],
      account: userAddress,
    });

    // Add 20% buffer
    return (gas * 120n) / 100n;
  }
}

export const evmSwapService = new EVMSwapService();
