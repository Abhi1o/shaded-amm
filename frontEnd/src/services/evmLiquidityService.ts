/**
 * EVM Liquidity Service
 *
 * Handles adding and removing liquidity from EVM pools
 * Updated to match SAMMPool contract signatures with slippage protection
 */

import { PublicClient, WalletClient, Address, formatUnits } from 'viem';
import { evmPoolService } from './evmPoolService';
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

export interface LPTokensCalculation {
  lpTokens: bigint;
  shareOfPool: number;
}

export interface RemoveLiquidityCalculation {
  amountA: bigint;
  amountB: bigint;
  shareOfPool: number;
}

export interface PoolState {
  tokenA: Address;
  tokenB: Address;
  reserveA: bigint;
  reserveB: bigint;
  totalSupply: bigint;
  tradeFeeNumerator: bigint;
  tradeFeeDenominator: bigint;
  ownerFeeNumerator: bigint;
  ownerFeeDenominator: bigint;
}

export interface AddLiquidityResult {
  hash: Address;
  amountA: bigint;
  amountB: bigint;
  liquidity: bigint;
}

export interface RemoveLiquidityResult {
  hash: Address;
  amountA: bigint;
  amountB: bigint;
}

/**
 * Calculate minimum amount with slippage tolerance
 * @param amount - The expected amount
 * @param slippageTolerance - Slippage tolerance as percentage (e.g., 0.5 for 0.5%)
 * @returns Minimum acceptable amount
 */
export function calculateMinAmount(amount: bigint, slippageTolerance: number): bigint {
  const slippageBps = BigInt(Math.floor(slippageTolerance * 100)); // Convert to basis points
  const minAmount = amount - (amount * slippageBps) / 10000n;
  return minAmount > 0n ? minAmount : 0n;
}

class EVMLiquidityService {
  /**
   * Calculate LP tokens to receive when adding liquidity
   */
  async calculateLPTokens(
    publicClient: PublicClient,
    poolAddress: Address,
    amountA: bigint,
    amountB: bigint
  ): Promise<LPTokensCalculation> {
    // Get current reserves and total supply
    const { reserves } = await evmPoolService.getPoolReserves(publicClient, poolAddress);
    
    const totalSupply = await publicClient.readContract({
      address: poolAddress,
      abi: PoolABI,
      functionName: 'totalSupply',
    }) as bigint;

    let lpTokens: bigint;

    if (totalSupply === 0n) {
      // First liquidity provider
      // LP tokens = sqrt(amountA * amountB)
      lpTokens = this.sqrt(amountA * amountB);
    } else {
      // Subsequent liquidity providers
      // LP tokens = min(amountA * totalSupply / reserveA, amountB * totalSupply / reserveB)
      const lpFromA = (amountA * totalSupply) / reserves.reserve0;
      const lpFromB = (amountB * totalSupply) / reserves.reserve1;
      lpTokens = lpFromA < lpFromB ? lpFromA : lpFromB;
    }

    // Calculate share of pool
    const newTotalSupply = totalSupply + lpTokens;
    const shareOfPool = Number(formatUnits(lpTokens, 18)) / Number(formatUnits(newTotalSupply, 18)) * 100;

    return {
      lpTokens,
      shareOfPool,
    };
  }

  /**
   * Calculate token amounts to receive when removing liquidity
   */
  async calculateRemoveAmounts(
    publicClient: PublicClient,
    poolAddress: Address,
    lpTokenAmount: bigint
  ): Promise<RemoveLiquidityCalculation> {
    // Get current reserves and total supply
    const { reserves } = await evmPoolService.getPoolReserves(publicClient, poolAddress);
    
    const totalSupply = await publicClient.readContract({
      address: poolAddress,
      abi: PoolABI,
      functionName: 'totalSupply',
    }) as bigint;

    // Calculate amounts: amount = (lpTokens * reserve) / totalSupply
    const amountA = (lpTokenAmount * reserves.reserve0) / totalSupply;
    const amountB = (lpTokenAmount * reserves.reserve1) / totalSupply;

    // Calculate share of pool
    const shareOfPool = Number(formatUnits(lpTokenAmount, 18)) / Number(formatUnits(totalSupply, 18)) * 100;

    return {
      amountA,
      amountB,
      shareOfPool,
    };
  }

  /**
   * Add liquidity to a pool with slippage protection
   * Contract signature: addLiquidity(amountADesired, amountBDesired, amountAMin, amountBMin, to)
   * 
   * @param walletClient - Wallet client for signing transactions
   * @param publicClient - Public client for reading blockchain state
   * @param poolAddress - Address of the pool contract
   * @param amountADesired - Desired amount of token A to add
   * @param amountBDesired - Desired amount of token B to add
   * @param slippageTolerance - Slippage tolerance as percentage (e.g., 0.5 for 0.5%)
   * @param userAddress - Address of the user adding liquidity
   * @returns Transaction hash
   */
  async addLiquidity(
    walletClient: WalletClient,
    publicClient: PublicClient,
    poolAddress: Address,
    amountADesired: bigint,
    amountBDesired: bigint,
    slippageTolerance: number,
    userAddress: Address
  ): Promise<Address> {
    // Calculate minimum amounts with slippage protection
    const amountAMin = calculateMinAmount(amountADesired, slippageTolerance);
    const amountBMin = calculateMinAmount(amountBDesired, slippageTolerance);

    console.log('📊 Add Liquidity Parameters:');
    console.log('  - Pool:', poolAddress);
    console.log('  - Amount A Desired:', amountADesired.toString());
    console.log('  - Amount B Desired:', amountBDesired.toString());
    console.log('  - Amount A Min:', amountAMin.toString());
    console.log('  - Amount B Min:', amountBMin.toString());
    console.log('  - Slippage:', slippageTolerance, '%');

    // Build transaction
    const { request } = await publicClient.simulateContract({
      address: poolAddress,
      abi: PoolABI,
      functionName: 'addLiquidity',
      args: [amountADesired, amountBDesired, amountAMin, amountBMin, userAddress],
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
  }

  /**
   * Remove liquidity from a pool with slippage protection
   * Contract signature: removeLiquidity(liquidity, amountAMin, amountBMin, to)
   * 
   * @param walletClient - Wallet client for signing transactions
   * @param publicClient - Public client for reading blockchain state
   * @param poolAddress - Address of the pool contract
   * @param lpTokenAmount - Amount of LP tokens to burn
   * @param slippageTolerance - Slippage tolerance as percentage (e.g., 0.5 for 0.5%)
   * @param userAddress - Address of the user removing liquidity
   * @returns Transaction hash
   */
  async removeLiquidity(
    walletClient: WalletClient,
    publicClient: PublicClient,
    poolAddress: Address,
    lpTokenAmount: bigint,
    slippageTolerance: number,
    userAddress: Address
  ): Promise<Address> {
    // First calculate expected amounts
    const { amountA, amountB } = await this.calculateRemoveAmounts(
      publicClient,
      poolAddress,
      lpTokenAmount
    );

    // Calculate minimum amounts with slippage protection
    const amountAMin = calculateMinAmount(amountA, slippageTolerance);
    const amountBMin = calculateMinAmount(amountB, slippageTolerance);

    console.log('📊 Remove Liquidity Parameters:');
    console.log('  - Pool:', poolAddress);
    console.log('  - LP Tokens:', lpTokenAmount.toString());
    console.log('  - Expected Amount A:', amountA.toString());
    console.log('  - Expected Amount B:', amountB.toString());
    console.log('  - Amount A Min:', amountAMin.toString());
    console.log('  - Amount B Min:', amountBMin.toString());
    console.log('  - Slippage:', slippageTolerance, '%');

    // Build transaction
    const { request } = await publicClient.simulateContract({
      address: poolAddress,
      abi: PoolABI,
      functionName: 'removeLiquidity',
      args: [lpTokenAmount, amountAMin, amountBMin, userAddress],
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
  }

  /**
   * Get user's LP token balance for a pool
   */
  async getLPTokenBalance(
    publicClient: PublicClient,
    poolAddress: Address,
    userAddress: Address
  ): Promise<bigint> {
    const balance = await publicClient.readContract({
      address: poolAddress,
      abi: PoolABI,
      functionName: 'balanceOf',
      args: [userAddress],
    }) as bigint;

    return balance;
  }

  /**
   * Get complete pool state from contract
   */
  async getPoolState(
    publicClient: PublicClient,
    poolAddress: Address
  ): Promise<PoolState> {
    const state = await publicClient.readContract({
      address: poolAddress,
      abi: PoolABI,
      functionName: 'getPoolState',
    }) as {
      tokenA: Address;
      tokenB: Address;
      reserveA: bigint;
      reserveB: bigint;
      totalSupply: bigint;
      tradeFeeNumerator: bigint;
      tradeFeeDenominator: bigint;
      ownerFeeNumerator: bigint;
      ownerFeeDenominator: bigint;
    };

    return {
      tokenA: state.tokenA,
      tokenB: state.tokenB,
      reserveA: state.reserveA,
      reserveB: state.reserveB,
      totalSupply: state.totalSupply,
      tradeFeeNumerator: state.tradeFeeNumerator,
      tradeFeeDenominator: state.tradeFeeDenominator,
      ownerFeeNumerator: state.ownerFeeNumerator,
      ownerFeeDenominator: state.ownerFeeDenominator,
    };
  }

  /**
   * Estimate gas for adding liquidity
   */
  async estimateAddLiquidityGas(
    publicClient: PublicClient,
    poolAddress: Address,
    amountADesired: bigint,
    amountBDesired: bigint,
    slippageTolerance: number,
    userAddress: Address
  ): Promise<bigint> {
    const amountAMin = calculateMinAmount(amountADesired, slippageTolerance);
    const amountBMin = calculateMinAmount(amountBDesired, slippageTolerance);

    const gas = await publicClient.estimateContractGas({
      address: poolAddress,
      abi: PoolABI,
      functionName: 'addLiquidity',
      args: [amountADesired, amountBDesired, amountAMin, amountBMin, userAddress],
      account: userAddress,
    });

    // Add 20% buffer
    return (gas * 120n) / 100n;
  }

  /**
   * Estimate gas for removing liquidity
   */
  async estimateRemoveLiquidityGas(
    publicClient: PublicClient,
    poolAddress: Address,
    lpTokenAmount: bigint,
    slippageTolerance: number,
    userAddress: Address
  ): Promise<bigint> {
    // Calculate expected amounts for min calculation
    const { amountA, amountB } = await this.calculateRemoveAmounts(
      publicClient,
      poolAddress,
      lpTokenAmount
    );
    const amountAMin = calculateMinAmount(amountA, slippageTolerance);
    const amountBMin = calculateMinAmount(amountB, slippageTolerance);

    const gas = await publicClient.estimateContractGas({
      address: poolAddress,
      abi: PoolABI,
      functionName: 'removeLiquidity',
      args: [lpTokenAmount, amountAMin, amountBMin, userAddress],
      account: userAddress,
    });

    // Add 20% buffer
    return (gas * 120n) / 100n;
  }

  /**
   * Integer square root using Newton's method
   */
  private sqrt(value: bigint): bigint {
    if (value < 0n) {
      throw new Error('Square root of negative numbers is not supported');
    }
    if (value < 2n) {
      return value;
    }

    let x = value;
    let y = (x + 1n) / 2n;

    while (y < x) {
      x = y;
      y = (x + value / x) / 2n;
    }

    return x;
  }
}

export const evmLiquidityService = new EVMLiquidityService();
