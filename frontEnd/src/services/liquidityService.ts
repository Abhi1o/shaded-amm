import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { Pool, TransactionStatus } from '@/types';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { calculateLiquidityTokens } from '@/utils/calculations';
import {
  createAddLiquidityInstruction,
  createRemoveLiquidityInstruction,
} from '@/lib/solana/poolInstructions';
import { findOrCreateATA } from '@/lib/swapInstructions';
import dexConfig from '@/config/dex-config.json';
import { SammRouterService } from './sammRouterService';

export interface LiquidityExecutionResult {
  signature: string;
  status: TransactionStatus;
  error?: string;
}

export interface AddLiquidityParams {
  pool: Pool;
  amountA: bigint;
  amountB: bigint;
  minLpTokens?: bigint; // Minimum LP tokens to receive (slippage protection)
}

export interface RemoveLiquidityParams {
  pool: Pool;
  lpTokenAmount: bigint;
  minTokenA?: bigint; // Minimum token A to receive
  minTokenB?: bigint; // Minimum token B to receive
}

export class LiquidityService {
  private connection: Connection;
  private programId?: PublicKey; // AMM Program ID - to be configured
  private sammRouter: SammRouterService;

  constructor(connection: Connection, programId?: string) {
    this.connection = connection;
    this.sammRouter = new SammRouterService();
    if (programId) {
      try {
        this.programId = new PublicKey(programId);
      } catch (error) {
        console.warn('Invalid program ID:', error);
      }
    }
  }

  /**
   * Get the smallest shard for liquidity addition
   * 
   * Calls the backend API to get shards sorted by size (smallest first).
   * Liquidity providers should add liquidity to the smallest shard for best trader experience.
   * This implements the "fillup strategy" from the SAMM paper.
   * 
   * @param tokenAMint - Token A mint address
   * @param tokenBMint - Token B mint address
   * @returns Promise resolving to the smallest shard pool address, or null if API fails
   */
  async getSmallestShard(
    tokenAMint: string,
    tokenBMint: string
  ): Promise<{ poolAddress: string; shardNumber: number; reserves: { tokenA: string; tokenB: string } } | null> {
    try {
      console.log('🔍 Fetching smallest shard for liquidity addition...');
      console.log(`   Token A: ${tokenAMint}`);
      console.log(`   Token B: ${tokenBMint}`);
      
      // Use tokenA as the input token for measuring shard size
      const response = await this.sammRouter.getSmallestShards(
        tokenAMint,
        tokenBMint,
        tokenAMint
      );

      if (response.success && response.data && response.data.shards.length > 0) {
        const smallestShard = response.data.shards[0];
        
        // Find the shard number from config
        const poolConfig = dexConfig.pools.find(p => p.poolAddress === smallestShard.address);
        const shardNumber = poolConfig?.shardNumber || 0;
        
        console.log('✅ Smallest shard found:');
        console.log(`   Address: ${smallestShard.address}`);
        console.log(`   Shard Number: ${shardNumber}`);
        console.log(`   Reserve A: ${smallestShard.reserves.tokenA}`);
        console.log(`   Reserve B: ${smallestShard.reserves.tokenB}`);
        
        return {
          poolAddress: smallestShard.address,
          shardNumber,
          reserves: smallestShard.reserves
        };
      }

      console.warn('⚠️  Backend API returned no shards');
      return null;
    } catch (error) {
      console.warn('⚠️  Failed to fetch smallest shard from backend:', error);
      console.log('   Will use first available pool from config as fallback');
      return null;
    }
  }

  /**
   * Calculate expected LP tokens for adding liquidity
   */
  calculateExpectedLpTokens(
    pool: Pool,
    amountA: bigint,
    amountB: bigint
  ): bigint {
    return calculateLiquidityTokens(
      amountA,
      amountB,
      pool.reserveA,
      pool.reserveB,
      pool.lpTokenSupply
    );
  }

  /**
   * Calculate expected tokens for removing liquidity
   */
  calculateRemoveAmounts(
    pool: Pool,
    lpTokenAmount: bigint
  ): { tokenA: bigint; tokenB: bigint } {
    if (pool.lpTokenSupply === BigInt(0)) {
      return { tokenA: BigInt(0), tokenB: BigInt(0) };
    }

    const share = Number(lpTokenAmount) / Number(pool.lpTokenSupply);
    const tokenA = BigInt(Math.floor(Number(pool.reserveA) * share));
    const tokenB = BigInt(Math.floor(Number(pool.reserveB) * share));

    return { tokenA, tokenB };
  }

  /**
   * Build add liquidity transaction
   * Uses pool config directly (same pattern as swap)
   */
  async buildAddLiquidityTransaction(
    params: AddLiquidityParams,
    userPublicKey: PublicKey
  ): Promise<Transaction> {
    const { pool, amountA, amountB, minLpTokens = BigInt(0) } = params;
    
    if (!this.programId) {
      throw new Error('Program ID not configured. Use getLiquidityService(connection, programId).');
    }

    // Find pool config from dex-config.json (same as swap does)
    const poolConfig = dexConfig.pools.find(p => p.poolAddress === pool.id);
    if (!poolConfig) {
      throw new Error(`Pool config not found for ${pool.id}`);
    }

    const transaction = new Transaction();
    const poolAddress = new PublicKey(poolConfig.poolAddress);
    const poolAuthority = new PublicKey(poolConfig.authority);
    const poolTokenAccountA = new PublicKey(poolConfig.tokenAccountA);
    const poolTokenAccountB = new PublicKey(poolConfig.tokenAccountB);
    const lpTokenMint = new PublicKey(poolConfig.poolTokenMint);
    const feeAccount = new PublicKey(poolConfig.feeAccount);
    const tokenAMint = new PublicKey(poolConfig.tokenA);
    const tokenBMint = new PublicKey(poolConfig.tokenB);
    
    // Get or create user's token accounts (same pattern as swap)
    const userTokenAAccount = await findOrCreateATA(
      this.connection,
      userPublicKey,
      tokenAMint,
      userPublicKey,
      transaction
    );
    
    const userTokenBAccount = await findOrCreateATA(
      this.connection,
      userPublicKey,
      tokenBMint,
      userPublicKey,
      transaction
    );

    const userLpTokenAccount = await findOrCreateATA(
      this.connection,
      userPublicKey,
      lpTokenMint,
      userPublicKey,
      transaction
    );

    // ✅ CRITICAL: Fetch FRESH pool state from blockchain right before transaction
    // This ensures we use the most up-to-date reserves for calculation
    console.log('🔄 Fetching FRESH pool state from blockchain...');
    const [poolTokenAInfo, poolTokenBInfo] = await Promise.all([
      this.connection.getTokenAccountBalance(poolTokenAccountA),
      this.connection.getTokenAccountBalance(poolTokenAccountB)
    ]);
    
    const freshReserveA = BigInt(poolTokenAInfo.value.amount);
    const freshReserveB = BigInt(poolTokenBInfo.value.amount);
    // Use the pool's LP supply from the pool object (already correct)
    const freshLpSupply = pool.lpTokenSupply;
    
    console.log('📊 FRESH Pool State from blockchain:', {
      reserveA: freshReserveA.toString(),
      reserveB: freshReserveB.toString(),
      lpSupply: freshLpSupply.toString(),
      lpSupplySource: 'pool.lpTokenSupply (correct)',
      timestamp: new Date().toISOString()
    });
    
    // Recalculate LP tokens with FRESH reserves
    const lpFromA = (amountA * freshLpSupply) / freshReserveA;
    const lpFromB = (amountB * freshLpSupply) / freshReserveB;
    const recalculatedLpTokens = lpFromA < lpFromB ? lpFromA : lpFromB;
    
    console.log('🔄 Recalculated LP tokens with fresh reserves:', {
      lpFromA: lpFromA.toString(),
      lpFromB: lpFromB.toString(),
      recalculatedLpTokens: recalculatedLpTokens.toString(),
      originalLpTokens: minLpTokens.toString(),
      difference: (Number(recalculatedLpTokens) - Number(minLpTokens)).toString()
    });
    
    // Use the recalculated LP tokens (based on fresh reserves)
    const targetLpTokens = recalculatedLpTokens;

    // Add the add liquidity instruction with all required accounts
    // CRITICAL: maxTokenA and maxTokenB need slippage ADDED (not subtracted!)
    // The smart contract checks: actual_amount_needed <= max_amount
    // So we need to provide MORE than the exact amount to account for slippage
    
    // Use 2x buffer (100% slippage) - MATCHES WORKING NODE.JS SCRIPT EXACTLY
    // This is what the working script uses successfully
    // Note: User still only deposits the calculated amount, this is just the maximum allowed
    const maxTokenA = amountA * BigInt(2);
    const maxTokenB = amountB * BigInt(2);
    
    console.log('🔧 Slippage-adjusted amounts (2x buffer like working script):');
    console.log('  Exact Amount A:', amountA.toString());
    console.log('  Max Amount A (2x buffer):', maxTokenA.toString());
    console.log('  Exact Amount B:', amountB.toString());
    console.log('  Max Amount B (2x buffer):', maxTokenB.toString());
    
    // ✅ CRITICAL: poolTokenAmount is EXPECTED LP tokens, NOT minimum!
    // The smart contract interprets this as "I want to receive THIS MANY LP tokens"
    // Slippage protection is handled by maxTokenA and maxTokenB (2x buffer)
    const addLiquidityIx = createAddLiquidityInstruction(
      this.programId,
      poolAddress,
      poolAuthority,
      poolTokenAccountA,
      poolTokenAccountB,
      lpTokenMint,
      feeAccount,
      tokenAMint,
      tokenBMint,
      userPublicKey,
      userTokenAAccount,
      userTokenBAccount,
      userLpTokenAccount,
      maxTokenA,        // maxTokenA - maximum token A to deposit (WITH 2x slippage buffer)
      maxTokenB,        // maxTokenB - maximum token B to deposit (WITH 2x slippage buffer)
      targetLpTokens    // poolTokenAmount - EXPECTED LP tokens based on FRESH reserves
    );

    transaction.add(addLiquidityIx);

    // Set recent blockhash and fee payer
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;
    transaction.lastValidBlockHeight = lastValidBlockHeight;

    return transaction;
  }

  /**
   * Build remove liquidity transaction
   * Uses pool config directly (same pattern as swap)
   */
  async buildRemoveLiquidityTransaction(
    params: RemoveLiquidityParams,
    userPublicKey: PublicKey
  ): Promise<Transaction> {
    const { pool, lpTokenAmount, minTokenA = BigInt(0), minTokenB = BigInt(0) } = params;
    
    if (!this.programId) {
      throw new Error('Program ID not configured. Use getLiquidityService(connection, programId).');
    }

    // Find pool config from dex-config.json (same as swap does)
    const poolConfig = dexConfig.pools.find(p => p.poolAddress === pool.id);
    if (!poolConfig) {
      throw new Error(`Pool config not found for ${pool.id}`);
    }

    const transaction = new Transaction();
    const poolAddress = new PublicKey(poolConfig.poolAddress);
    const poolAuthority = new PublicKey(poolConfig.authority);
    const poolTokenAccountA = new PublicKey(poolConfig.tokenAccountA);
    const poolTokenAccountB = new PublicKey(poolConfig.tokenAccountB);
    const lpTokenMint = new PublicKey(poolConfig.poolTokenMint);
    const feeAccount = new PublicKey(poolConfig.feeAccount);
    const tokenAMint = new PublicKey(poolConfig.tokenA);
    const tokenBMint = new PublicKey(poolConfig.tokenB);
    
    // Get user's token accounts (they should exist if removing liquidity)
    const userTokenAAccount = await getAssociatedTokenAddress(
      tokenAMint,
      userPublicKey
    );
    
    const userTokenBAccount = await getAssociatedTokenAddress(
      tokenBMint,
      userPublicKey
    );
    
    const userLpTokenAccount = await getAssociatedTokenAddress(
      lpTokenMint,
      userPublicKey
    );

    // Add the remove liquidity instruction with all required accounts
    // Parameter order: poolTokenAmount (lpTokenAmount), minTokenA, minTokenB
    const removeLiquidityIx = createRemoveLiquidityInstruction(
      this.programId,
      poolAddress,
      poolAuthority,
      poolTokenAccountA,
      poolTokenAccountB,
      lpTokenMint,
      feeAccount,
      tokenAMint,
      tokenBMint,
      userPublicKey,
      userTokenAAccount,
      userTokenBAccount,
      userLpTokenAccount,
      lpTokenAmount,  // poolTokenAmount - LP tokens to burn
      minTokenA,      // minTokenA - minimum token A to receive
      minTokenB       // minTokenB - minimum token B to receive
    );

    transaction.add(removeLiquidityIx);

    // Set recent blockhash and fee payer
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;
    transaction.lastValidBlockHeight = lastValidBlockHeight;

    return transaction;
  }

  /**
   * Execute add liquidity transaction
   */
  async addLiquidity(
    params: AddLiquidityParams,
    wallet: WalletContextState,
    onStatusUpdate?: (status: TransactionStatus, signature?: string, error?: string) => void
  ): Promise<LiquidityExecutionResult> {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected or does not support transaction signing');
    }

    try {
      onStatusUpdate?.(TransactionStatus.PENDING);

      // Build transaction
      const transaction = await this.buildAddLiquidityTransaction(
        params,
        wallet.publicKey
      );

      // ✅ CRITICAL: Get fresh blockhash to prevent "already processed" errors
      // Using 'finalized' commitment for more unique blockhashes
      console.log('🔄 Fetching fresh blockhash for transaction...');
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
      console.log('✅ Got blockhash:', blockhash.slice(0, 8) + '...');

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Log transaction details for debugging
      console.log('🔍 Add Liquidity Transaction Details:');
      console.log('  Pool:', params.pool.id);
      console.log('  Amount A:', params.amountA.toString());
      console.log('  Amount B:', params.amountB.toString());
      console.log('  Min LP Tokens:', params.minLpTokens.toString());
      console.log('  Program ID:', this.programId);
      console.log('  Instructions:', transaction.instructions.length);
      
      // Validate instruction data before sending
      if (transaction.instructions.length > 0) {
        const lastIx = transaction.instructions[transaction.instructions.length - 1];
        console.log('  Last instruction data:', lastIx.data.toString('hex'));
        console.log('  Last instruction accounts:', lastIx.keys.length);
        console.log('  Last instruction program:', lastIx.programId.toString());
        
        // Validate the add liquidity instruction (discriminator 2)
        this.validateInstructionData(lastIx.data, 2, 'Add Liquidity');
      }

      // Sign transaction
      const signedTransaction = await wallet.signTransaction(transaction);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        }
      );

      onStatusUpdate?.(TransactionStatus.PENDING, signature);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        'confirmed'
      );

      if (confirmation.value.err) {
        const error = `Transaction failed: ${JSON.stringify(confirmation.value.err)}`;
        onStatusUpdate?.(TransactionStatus.FAILED, signature, error);
        return {
          signature,
          status: TransactionStatus.FAILED,
          error,
        };
      }

      onStatusUpdate?.(TransactionStatus.CONFIRMED, signature);
      return {
        signature,
        status: TransactionStatus.CONFIRMED,
      };

    } catch (error) {
      let errorMessage = this.parseTransactionError(error);

      // ✅ Special handling for "already processed" error
      if (errorMessage.includes('already been processed')) {
        console.error('❌ Duplicate transaction detected!');
        console.error('   This usually happens when:');
        console.error('   1. Button was clicked multiple times quickly');
        console.error('   2. Same blockhash was used for two transactions');
        console.error('   3. Transaction was retried too quickly');
        errorMessage = 'Transaction was already submitted. Please wait a few seconds before trying again.';
      }

      console.error('Add liquidity failed:', error);
      onStatusUpdate?.(TransactionStatus.FAILED, undefined, errorMessage);

      return {
        signature: '',
        status: TransactionStatus.FAILED,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute remove liquidity transaction
   */
  async removeLiquidity(
    params: RemoveLiquidityParams,
    wallet: WalletContextState,
    onStatusUpdate?: (status: TransactionStatus, signature?: string, error?: string) => void
  ): Promise<LiquidityExecutionResult> {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected or does not support transaction signing');
    }

    try {
      onStatusUpdate?.(TransactionStatus.PENDING);

      // Build transaction
      const transaction = await this.buildRemoveLiquidityTransaction(
        params,
        wallet.publicKey
      );

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Log transaction details for debugging
      console.log('🔍 Remove Liquidity Transaction Details:');
      console.log('  Pool:', params.pool.id);
      console.log('  LP Token Amount:', params.lpTokenAmount.toString());
      console.log('  Min Token A:', params.minTokenA?.toString() || '0');
      console.log('  Min Token B:', params.minTokenB?.toString() || '0');
      console.log('  Program ID:', this.programId);
      console.log('  Instructions:', transaction.instructions.length);
      
      // Validate instruction data before sending
      if (transaction.instructions.length > 0) {
        const lastIx = transaction.instructions[transaction.instructions.length - 1];
        console.log('  Last instruction data:', lastIx.data.toString('hex'));
        console.log('  Last instruction accounts:', lastIx.keys.length);
        console.log('  Last instruction program:', lastIx.programId.toString());
        
        // Validate the remove liquidity instruction (discriminator 3)
        this.validateInstructionData(lastIx.data, 3, 'Remove Liquidity');
      }

      // Sign transaction
      const signedTransaction = await wallet.signTransaction(transaction);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        }
      );

      onStatusUpdate?.(TransactionStatus.PENDING, signature);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        'confirmed'
      );

      if (confirmation.value.err) {
        const error = `Transaction failed: ${JSON.stringify(confirmation.value.err)}`;
        onStatusUpdate?.(TransactionStatus.FAILED, signature, error);
        return {
          signature,
          status: TransactionStatus.FAILED,
          error,
        };
      }

      onStatusUpdate?.(TransactionStatus.CONFIRMED, signature);
      return {
        signature,
        status: TransactionStatus.CONFIRMED,
      };

    } catch (error) {
      const errorMessage = this.parseTransactionError(error);
      console.error('Remove liquidity failed:', error);
      onStatusUpdate?.(TransactionStatus.FAILED, undefined, errorMessage);
      
      return {
        signature: '',
        status: TransactionStatus.FAILED,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate instruction data before sending transaction
   * @private
   */
  private validateInstructionData(
    data: Buffer,
    expectedDiscriminator: number,
    operationName: string
  ): void {
    // Validate instruction data length
    if (data.length !== 25) {
      console.error(`❌ Invalid instruction data length for ${operationName}:`, data.length);
      throw new Error(`Invalid instruction data length: expected 25 bytes, got ${data.length}`);
    }
    
    // Validate discriminator value
    const discriminator = data.readUInt8(0);
    if (discriminator !== expectedDiscriminator) {
      console.error(`❌ Invalid discriminator for ${operationName}:`, discriminator, 'expected:', expectedDiscriminator);
      throw new Error(`Invalid discriminator: expected ${expectedDiscriminator}, got ${discriminator}`);
    }
    
    // Validate amounts are positive
    const poolTokenAmount = data.readBigUInt64LE(1);
    const tokenA = data.readBigUInt64LE(9);
    const tokenB = data.readBigUInt64LE(17);
    
    if (poolTokenAmount <= BigInt(0)) {
      console.error(`❌ Invalid pool token amount for ${operationName}:`, poolTokenAmount.toString());
      throw new Error('Pool token amount must be positive');
    }
    
    if (tokenA < BigInt(0) || tokenB < BigInt(0)) {
      console.error(`❌ Invalid token amounts for ${operationName}:`, tokenA.toString(), tokenB.toString());
      throw new Error('Token amounts must be non-negative');
    }
    
    // Log validation success
    console.log(`✅ Instruction data validation passed for ${operationName}:`);
    console.log('  Data length:', data.length, 'bytes');
    console.log('  Discriminator:', discriminator);
    console.log('  Pool token amount:', poolTokenAmount.toString());
    console.log('  Token A amount:', tokenA.toString());
    console.log('  Token B amount:', tokenB.toString());
    console.log('  Instruction data (hex):', data.toString('hex'));
  }

  /**
   * Parse transaction error for user-friendly message
   */
  parseTransactionError(error: any): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error?.message) {
      const message = error.message.toLowerCase();
      
      // Check for InvalidInstruction errors (error code 0xe)
      if (message.includes('invalid instruction') || message.includes('0xe') || message.includes('custom program error: 0xe')) {
        return 'Invalid instruction format detected. This may be due to incorrect discriminator or account order. Please contact support if this persists.';
      }
      
      // Check for discriminator-related errors
      if (message.includes('feature not supported') || message.includes('not supported')) {
        return 'Operation not supported by the smart contract. This may indicate an incorrect instruction discriminator. Please contact support.';
      }
      
      if (message.includes('insufficient funds') || message.includes('insufficient lamports')) {
        return 'Insufficient SOL balance to pay for transaction fees. Please add more SOL to your wallet.';
      }
      
      if (message.includes('slippage tolerance exceeded') || message.includes('slippage')) {
        return 'Price moved beyond your slippage tolerance. Try increasing slippage tolerance in settings or reducing the amount.';
      }
      
      if (message.includes('blockhash not found')) {
        return 'Transaction expired before confirmation. Please try again.';
      }
      
      if (message.includes('user rejected')) {
        return 'Transaction was rejected by user.';
      }
      
      // Check for token account errors
      if (message.includes('account not found') || message.includes('invalid account')) {
        return 'Token account not found. The required token accounts may not exist yet.';
      }
      
      // Check for calculation errors
      if (message.includes('calculation failure') || message.includes('overflow')) {
        return 'Calculation error occurred. Try reducing the amount or adjusting the ratio.';
      }

      return error.message;
    }

    return 'An unknown error occurred during the liquidity operation.';
  }

  /**
   * Validate add liquidity parameters
   */
  validateAddLiquidity(
    pool: Pool,
    amountA: bigint,
    amountB: bigint,
    userTokenABalance: bigint,
    userTokenBBalance: bigint
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (amountA <= BigInt(0)) {
      errors.push(`${pool.tokenA.symbol} amount must be greater than 0`);
    }

    if (amountB <= BigInt(0)) {
      errors.push(`${pool.tokenB.symbol} amount must be greater than 0`);
    }

    if (amountA > userTokenABalance) {
      errors.push(`Insufficient ${pool.tokenA.symbol} balance`);
    }

    if (amountB > userTokenBBalance) {
      errors.push(`Insufficient ${pool.tokenB.symbol} balance`);
    }

    // Check if pool ratio is maintained (within tolerance)
    if (pool.reserveA > BigInt(0) && pool.reserveB > BigInt(0)) {
      const currentRatio = Number(pool.reserveA) / Number(pool.reserveB);
      const newRatio = Number(amountA) / Number(amountB);
      const ratioDiff = Math.abs(newRatio - currentRatio) / currentRatio;

      if (ratioDiff > 0.05) { // 5% tolerance
        errors.push('Amount ratio does not match pool ratio. Please adjust your amounts.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate remove liquidity parameters
   */
  validateRemoveLiquidity(
    pool: Pool,
    lpTokenAmount: bigint,
    userLpTokenBalance: bigint
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (lpTokenAmount <= BigInt(0)) {
      errors.push('LP token amount must be greater than 0');
    }

    if (lpTokenAmount > userLpTokenBalance) {
      errors.push('Insufficient LP token balance');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
let liquidityService: LiquidityService | null = null;

export const getLiquidityService = (connection: Connection, programId?: string): LiquidityService => {
  if (!liquidityService || liquidityService['connection'] !== connection) {
    liquidityService = new LiquidityService(connection, programId);
  }
  return liquidityService;
};

