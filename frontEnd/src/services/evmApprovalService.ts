/**
 * EVM Approval Service
 *
 * Handles ERC-20 token approvals for DEX operations
 */

import { PublicClient, WalletClient, Address, maxUint256 } from 'viem';
import ERC20ABI from '../abis/ERC20.json';
import { MONAD_TESTNET } from '../config/evm-networks';

export type ApprovalType = 'exact' | 'unlimited';

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

class EVMApprovalService {
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
   * Check if approval is needed for a token
   */
  async checkApproval(
    publicClient: PublicClient,
    tokenAddress: Address,
    ownerAddress: Address,
    spenderAddress: Address,
    amount: bigint
  ): Promise<boolean> {
    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'allowance',
      args: [ownerAddress, spenderAddress],
    }) as bigint;

    return allowance >= amount;
  }

  /**
   * Get current allowance for a token
   */
  async getAllowance(
    publicClient: PublicClient,
    tokenAddress: Address,
    ownerAddress: Address,
    spenderAddress: Address
  ): Promise<bigint> {
    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'allowance',
      args: [ownerAddress, spenderAddress],
    }) as bigint;

    return allowance;
  }

  /**
   * Request token approval
   */
  async requestApproval(
    walletClient: WalletClient,
    publicClient: PublicClient,
    tokenAddress: Address,
    spenderAddress: Address,
    amount: bigint,
    approvalType: ApprovalType = 'exact',
    userAddress: Address
  ): Promise<Address> {
    // CRITICAL: Ensure wallet is on correct chain before executing
    await this.ensureCorrectChain();

    const approvalAmount = approvalType === 'unlimited' ? maxUint256 : amount;

    // Build transaction
    const { request } = await publicClient.simulateContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'approve',
      args: [spenderAddress, approvalAmount],
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
   * Check and request approval if needed
   */
  async ensureApproval(
    walletClient: WalletClient,
    publicClient: PublicClient,
    tokenAddress: Address,
    ownerAddress: Address,
    spenderAddress: Address,
    amount: bigint,
    approvalType: ApprovalType = 'exact'
  ): Promise<Address | null> {
    const isApproved = await this.checkApproval(
      publicClient,
      tokenAddress,
      ownerAddress,
      spenderAddress,
      amount
    );

    if (isApproved) {
      return null; // No approval needed
    }

    // Request approval
    return this.requestApproval(
      walletClient,
      publicClient,
      tokenAddress,
      spenderAddress,
      amount,
      approvalType,
      ownerAddress
    );
  }

  /**
   * Estimate gas for approval
   */
  async estimateApprovalGas(
    publicClient: PublicClient,
    tokenAddress: Address,
    spenderAddress: Address,
    amount: bigint,
    userAddress: Address
  ): Promise<bigint> {
    const gas = await publicClient.estimateContractGas({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'approve',
      args: [spenderAddress, amount],
      account: userAddress,
    });

    // Add 20% buffer
    return (gas * 120n) / 100n;
  }

  /**
   * Get token balance
   */
  async getTokenBalance(
    publicClient: PublicClient,
    tokenAddress: Address,
    userAddress: Address
  ): Promise<bigint> {
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'balanceOf',
      args: [userAddress],
    }) as bigint;

    return balance;
  }

  /**
   * Get token decimals
   */
  async getTokenDecimals(
    publicClient: PublicClient,
    tokenAddress: Address
  ): Promise<number> {
    const decimals = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'decimals',
    }) as number;

    return decimals;
  }

  /**
   * Get token symbol
   */
  async getTokenSymbol(
    publicClient: PublicClient,
    tokenAddress: Address
  ): Promise<string> {
    const symbol = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'symbol',
    }) as string;

    return symbol;
  }
}

export const evmApprovalService = new EVMApprovalService();
