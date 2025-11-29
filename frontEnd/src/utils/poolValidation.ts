import { Token } from '@/types';
import { PublicKey } from '@solana/web3.js';

export interface PoolValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PoolCreationParams {
  tokenA?: Token;
  tokenB?: Token;
  amountA: string;
  amountB: string;
  tokenABalance: bigint;
  tokenBBalance: bigint;
}

/**
 * Validates pool creation parameters
 */
export function validatePoolCreation(params: PoolCreationParams): PoolValidationResult {
  const errors: string[] = [];
  const { tokenA, tokenB, amountA, amountB, tokenABalance, tokenBBalance } = params;

  // Token validation
  if (!tokenA) {
    errors.push('First token must be selected');
  }

  if (!tokenB) {
    errors.push('Second token must be selected');
  }

  if (tokenA && tokenB && tokenA.mint === tokenB.mint) {
    errors.push('Cannot create pool with the same token');
  }

  // Amount validation
  if (!amountA || isNaN(parseFloat(amountA)) || parseFloat(amountA) <= 0) {
    errors.push('First token amount must be greater than 0');
  }

  if (!amountB || isNaN(parseFloat(amountB)) || parseFloat(amountB) <= 0) {
    errors.push('Second token amount must be greater than 0');
  }

  // Balance validation
  if (tokenA && amountA) {
    try {
      const amountABigInt = BigInt(Math.floor(parseFloat(amountA) * Math.pow(10, tokenA.decimals)));
      if (amountABigInt > tokenABalance) {
        errors.push(`Insufficient ${tokenA.symbol} balance`);
      }
    } catch (e) {
      errors.push('Invalid first token amount');
    }
  }

  if (tokenB && amountB) {
    try {
      const amountBBigInt = BigInt(Math.floor(parseFloat(amountB) * Math.pow(10, tokenB.decimals)));
      if (amountBBigInt > tokenBBalance) {
        errors.push(`Insufficient ${tokenB.symbol} balance`);
      }
    } catch (e) {
      errors.push('Invalid second token amount');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates if a string is a valid Solana public key
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculates the initial price ratio for a pool
 */
export function calculateInitialPrice(
  amountA: string,
  amountB: string,
  tokenA: Token,
  tokenB: Token
): { priceAPerB: number; priceBPerA: number } | null {
  try {
    const amountANum = parseFloat(amountA);
    const amountBNum = parseFloat(amountB);

    if (amountANum <= 0 || amountBNum <= 0) {
      return null;
    }

    // Adjust for token decimals
    const adjustedAmountA = amountANum * Math.pow(10, tokenA.decimals);
    const adjustedAmountB = amountBNum * Math.pow(10, tokenB.decimals);

    const priceAPerB = adjustedAmountA / adjustedAmountB;
    const priceBPerA = adjustedAmountB / adjustedAmountA;

    return { priceAPerB, priceBPerA };
  } catch {
    return null;
  }
}

/**
 * Estimates the minimum SOL required for pool creation transaction
 */
export function estimatePoolCreationCost(): {
  rentExemption: number; // SOL
  transactionFee: number; // SOL
  total: number; // SOL
} {
  // Rough estimates for Solana
  const rentExemption = 0.002; // ~2000 lamports for mint account
  const transactionFee = 0.0001; // ~100 lamports for transaction
  
  return {
    rentExemption,
    transactionFee,
    total: rentExemption + transactionFee,
  };
}

/**
 * Checks if the user has sufficient SOL for pool creation
 */
export function hasSufficientSolForPoolCreation(solBalance: bigint): boolean {
  const { total } = estimatePoolCreationCost();
  const requiredLamports = BigInt(Math.floor(total * 1e9)); // Convert SOL to lamports
  return solBalance >= requiredLamports;
}