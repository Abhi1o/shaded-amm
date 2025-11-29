/**
 * Mint test tokens directly from the UI - EVM Version
 * This allows users to get test tokens on EVM chains
 * 
 * Note: For EVM testnets, users typically get test tokens from faucets.
 * This file provides utilities for checking balances and directing users to faucets.
 */

import { PublicClient, Address, formatUnits } from 'viem';
import { getTokenBySymbol } from '../config/evm-tokens';

/**
 * Get faucet URL for a token on a specific chain
 */
export function getFaucetUrl(chainId: number, tokenSymbol: string): string | null {
  // Monad Testnet faucets
  if (chainId === 10143) {
    const faucets: Record<string, string> = {
      'MON': 'https://faucet.monad.xyz',
      'USDC': 'https://faucet.monad.xyz', // Placeholder - update with actual faucet
      'USDT': 'https://faucet.monad.xyz', // Placeholder - update with actual faucet
      'WETH': 'https://faucet.monad.xyz', // Placeholder - update with actual faucet
    };
    return faucets[tokenSymbol] || 'https://faucet.monad.xyz';
  }

  // Add other chains as needed
  return null;
}

/**
 * Check if user has sufficient token balance for a transaction
 */
export async function checkTokenBalance(
  publicClient: PublicClient,
  chainId: number,
  walletAddress: Address,
  tokenSymbol: string,
  requiredAmount: number
): Promise<{ 
  hasBalance: boolean; 
  currentBalance: number; 
  tokenAddress: Address;
  faucetUrl: string | null;
}> {
  try {
    const token = getTokenBySymbol(chainId, tokenSymbol);
    
    if (!token) {
      throw new Error(`Token ${tokenSymbol} not found on chain ${chainId}`);
    }

    // Read token balance
    const balance = await publicClient.readContract({
      address: token.address as Address,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: 'balance', type: 'uint256' }],
        },
      ],
      functionName: 'balanceOf',
      args: [walletAddress],
    }) as bigint;

    const currentBalance = Number(formatUnits(balance, token.decimals));
    const hasBalance = currentBalance >= requiredAmount;

    return {
      hasBalance,
      currentBalance,
      tokenAddress: token.address as Address,
      faucetUrl: getFaucetUrl(chainId, tokenSymbol),
    };
  } catch (error) {
    console.error('Error checking token balance:', error);
    return {
      hasBalance: false,
      currentBalance: 0,
      tokenAddress: '0x0' as Address,
      faucetUrl: getFaucetUrl(chainId, tokenSymbol),
    };
  }
}

/**
 * Get native token (ETH/MON) balance
 */
export async function checkNativeBalance(
  publicClient: PublicClient,
  walletAddress: Address,
  requiredAmount: number
): Promise<{ hasBalance: boolean; currentBalance: number }> {
  try {
    const balance = await publicClient.getBalance({ address: walletAddress });
    const currentBalance = Number(formatUnits(balance, 18));
    
    return {
      hasBalance: currentBalance >= requiredAmount,
      currentBalance,
    };
  } catch (error) {
    console.error('Error checking native balance:', error);
    return {
      hasBalance: false,
      currentBalance: 0,
    };
  }
}

/**
 * Display helpful message to user about getting test tokens
 */
export function getTestTokensMessage(
  chainId: number,
  tokenSymbol: string,
  requiredAmount: number,
  currentBalance: number
): string {
  const faucetUrl = getFaucetUrl(chainId, tokenSymbol);
  const shortfall = requiredAmount - currentBalance;

  let message = `You need ${shortfall.toFixed(4)} more ${tokenSymbol} for this transaction.\n`;
  message += `Current balance: ${currentBalance.toFixed(4)} ${tokenSymbol}\n`;
  message += `Required: ${requiredAmount.toFixed(4)} ${tokenSymbol}\n\n`;

  if (faucetUrl) {
    message += `Get test tokens from the faucet:\n${faucetUrl}`;
  } else {
    message += `Please obtain test ${tokenSymbol} tokens for this network.`;
  }

  return message;
}
