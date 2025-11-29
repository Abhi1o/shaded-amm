'use client';

import { useState, useCallback } from 'react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { 
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
} from '@solana/spl-token';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Token, Pool } from '@/types';
import { usePoolStore } from '@/stores/poolStore';

interface CreatePoolParams {
  tokenA: Token;
  tokenB: Token;
  amountA: bigint;
  amountB: bigint;
  feeRate?: number; // Fee rate as percentage (default: 0.25%)
}

interface UsePoolCreationReturn {
  createPool: (params: CreatePoolParams) => Promise<string>;
  isCreating: boolean;
  error: string | null;
  clearError: () => void;
}

export function usePoolCreation(): UsePoolCreationReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { addPool } = usePoolStore();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const createPool = useCallback(async (params: CreatePoolParams): Promise<string> => {
    if (!publicKey || !sendTransaction) {
      throw new Error('Wallet not connected');
    }

    setIsCreating(true);
    setError(null);

    try {
      const { tokenA, tokenB, amountA, amountB, feeRate = 0.25 } = params;

      // Generate keypairs for pool accounts
      const poolKeypair = new PublicKey(Math.random().toString()); // Mock for now
      const lpTokenMintKeypair = new PublicKey(Math.random().toString()); // Mock for now

      // Get associated token addresses
      const tokenAMint = new PublicKey(tokenA.mint);
      const tokenBMint = new PublicKey(tokenB.mint);

      const userTokenAAccount = await getAssociatedTokenAddress(tokenAMint, publicKey);
      const userTokenBAccount = await getAssociatedTokenAddress(tokenBMint, publicKey);

      const poolTokenAAccount = await getAssociatedTokenAddress(tokenAMint, poolKeypair);
      const poolTokenBAccount = await getAssociatedTokenAddress(tokenBMint, poolKeypair);

      const userLpTokenAccount = await getAssociatedTokenAddress(lpTokenMintKeypair, publicKey);

      // Create transaction
      const transaction = new Transaction();

      // Get rent exemption amount for mint
      const mintRentExemption = await getMinimumBalanceForRentExemptMint(connection);

      // Create LP token mint account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: lpTokenMintKeypair,
          lamports: mintRentExemption,
          space: 82, // Mint account size
          programId: TOKEN_PROGRAM_ID,
        })
      );

      // Initialize LP token mint
      transaction.add(
        createInitializeMintInstruction(
          lpTokenMintKeypair,
          6, // LP token decimals
          poolKeypair, // Mint authority (pool)
          poolKeypair, // Freeze authority (pool)
          TOKEN_PROGRAM_ID
        )
      );

      // Create associated token accounts for pool
      transaction.add(
        createAssociatedTokenAccountInstruction(
          publicKey, // Payer
          poolTokenAAccount,
          poolKeypair, // Owner
          tokenAMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      transaction.add(
        createAssociatedTokenAccountInstruction(
          publicKey, // Payer
          poolTokenBAccount,
          poolKeypair, // Owner
          tokenBMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      // Create user LP token account
      transaction.add(
        createAssociatedTokenAccountInstruction(
          publicKey, // Payer
          userLpTokenAccount,
          publicKey, // Owner
          lpTokenMintKeypair,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      // TODO: Add actual AMM program instructions for pool creation
      // This would include:
      // 1. Initialize pool account with AMM program
      // 2. Transfer tokens from user to pool
      // 3. Mint LP tokens to user
      // 4. Set initial pool state

      // For now, we'll simulate the transaction
      console.log('Pool creation transaction prepared:', {
        poolAccount: poolKeypair.toString(),
        lpTokenMint: lpTokenMintKeypair.toString(),
        tokenAAccount: poolTokenAAccount.toString(),
        tokenBAccount: poolTokenBAccount.toString(),
        userLpAccount: userLpTokenAccount.toString(),
        amountA: amountA.toString(),
        amountB: amountB.toString(),
        feeRate,
      });

      // Simulate transaction sending (in real implementation, uncomment below)
      // const signature = await sendTransaction(transaction, connection);
      // await connection.confirmTransaction(signature, 'confirmed');

      // Mock transaction signature for development
      const mockSignature = `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Calculate initial LP token supply (geometric mean of amounts)
      const lpTokenSupply = BigInt(Math.floor(Math.sqrt(Number(amountA) * Number(amountB))));

      // Create pool object
      const newPool: Pool = {
        id: poolKeypair.toString(),
        programId: 'mock_amm_program', // In real implementation, use actual AMM program ID
        tokenA,
        tokenB,
        tokenAAccount: poolTokenAAccount,
        tokenBAccount: poolTokenBAccount,
        lpTokenMint: lpTokenMintKeypair,
        reserveA: amountA,
        reserveB: amountB,
        totalLiquidity: lpTokenSupply,
        lpTokenSupply,
        volume24h: BigInt(0),
        fees24h: BigInt(0),
        feeRate,
        isActive: true,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        ammType: 'constant_product',
      };

      // Add pool to store
      addPool(newPool);

      return mockSignature;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create pool';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  }, [publicKey, sendTransaction, connection, addPool]);

  return {
    createPool,
    isCreating,
    error,
    clearError,
  };
}