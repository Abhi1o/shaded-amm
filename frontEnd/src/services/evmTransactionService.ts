/**
 * EVM Transaction Service
 * 
 * Handles transaction building, gas estimation, submission, and confirmation tracking
 */

import { ethers } from 'ethers';

export interface TransactionRequest {
  to: string;
  data: string;
  value?: bigint;
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

export interface TransactionReceipt {
  hash: string;
  blockNumber: number;
  blockHash: string;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  status: number;
  confirmations: number;
}

export interface TransactionStatus {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  receipt?: TransactionReceipt;
  error?: string;
}

export class EVMTransactionService {
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  private readonly GAS_BUFFER_PERCENT = 20; // 20% buffer for gas estimation
  private readonly CONFIRMATION_BLOCKS = 1; // Number of confirmations to wait for

  constructor(provider: ethers.Provider, signer: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
  }

  /**
   * Build a transaction
   */
  async buildTransaction(
    to: string,
    data: string,
    value: bigint = 0n
  ): Promise<TransactionRequest> {
    console.log('[EVMTransactionService] Building transaction...');
    console.log(`  To: ${to}`);
    console.log(`  Data length: ${data.length} bytes`);
    console.log(`  Value: ${value.toString()}`);

    const transaction: TransactionRequest = {
      to,
      data,
      value,
    };

    return transaction;
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(transaction: TransactionRequest): Promise<bigint> {
    try {
      console.log('[EVMTransactionService] Estimating gas...');

      const gasEstimate = await this.provider.estimateGas({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value || 0n,
      });

      // Add buffer to gas estimate
      const gasWithBuffer = (gasEstimate * BigInt(100 + this.GAS_BUFFER_PERCENT)) / 100n;

      console.log(`[EVMTransactionService] Gas estimated: ${gasEstimate.toString()}`);
      console.log(`[EVMTransactionService] Gas with ${this.GAS_BUFFER_PERCENT}% buffer: ${gasWithBuffer.toString()}`);

      return gasWithBuffer;
    } catch (error) {
      console.error('[EVMTransactionService] Gas estimation failed:', error);

      // Return a conservative default if estimation fails
      const defaultGas = 500000n;
      console.warn(`[EVMTransactionService] Using default gas limit: ${defaultGas.toString()}`);
      return defaultGas;
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    try {
      const feeData = await this.provider.getFeeData();

      // Use EIP-1559 if available
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        console.log('[EVMTransactionService] Using EIP-1559 gas pricing');
        console.log(`  Max Fee: ${feeData.maxFeePerGas.toString()}`);
        console.log(`  Priority Fee: ${feeData.maxPriorityFeePerGas.toString()}`);
        return feeData.maxFeePerGas;
      }

      // Fallback to legacy gas price
      if (feeData.gasPrice) {
        console.log('[EVMTransactionService] Using legacy gas pricing');
        console.log(`  Gas Price: ${feeData.gasPrice.toString()}`);
        return feeData.gasPrice;
      }

      throw new Error('Unable to fetch gas price');
    } catch (error) {
      console.error('[EVMTransactionService] Failed to get gas price:', error);
      throw error;
    }
  }

  /**
   * Estimate transaction cost in native tokens
   */
  async estimateTransactionCost(transaction: TransactionRequest): Promise<bigint> {
    const gasLimit = await this.estimateGas(transaction);
    const gasPrice = await this.getGasPrice();
    const cost = gasLimit * gasPrice;

    console.log('[EVMTransactionService] Transaction cost estimate:');
    console.log(`  Gas Limit: ${gasLimit.toString()}`);
    console.log(`  Gas Price: ${gasPrice.toString()}`);
    console.log(`  Total Cost: ${cost.toString()} wei`);
    console.log(`  Total Cost: ${ethers.formatEther(cost)} ETH`);

    return cost;
  }

  /**
   * Submit a transaction
   */
  async submitTransaction(transaction: TransactionRequest): Promise<string> {
    try {
      console.log('[EVMTransactionService] Submitting transaction...');

      // Estimate gas if not provided
      if (!transaction.gasLimit) {
        transaction.gasLimit = await this.estimateGas(transaction);
      }

      // Get gas price if not provided
      const feeData = await this.provider.getFeeData();
      if (!transaction.maxFeePerGas && !transaction.gasPrice) {
        if (feeData.maxFeePerGas) {
          transaction.maxFeePerGas = feeData.maxFeePerGas;
          transaction.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || feeData.maxFeePerGas / 10n;
        } else if (feeData.gasPrice) {
          transaction.gasPrice = feeData.gasPrice;
        }
      }

      // Send transaction
      const tx = await this.signer.sendTransaction({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
        gasLimit: transaction.gasLimit,
        ...(transaction.maxFeePerGas
          ? {
              maxFeePerGas: transaction.maxFeePerGas,
              maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
            }
          : { gasPrice: transaction.gasPrice }),
      });

      console.log('[EVMTransactionService] Transaction submitted');
      console.log(`  Hash: ${tx.hash}`);

      return tx.hash;
    } catch (error) {
      console.error('[EVMTransactionService] Transaction submission failed:', error);
      throw this.parseTransactionError(error);
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(
    txHash: string,
    confirmations: number = this.CONFIRMATION_BLOCKS
  ): Promise<TransactionReceipt> {
    try {
      console.log(`[EVMTransactionService] Waiting for ${confirmations} confirmation(s)...`);
      console.log(`  Transaction: ${txHash}`);

      const receipt = await this.provider.waitForTransaction(txHash, confirmations);

      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      if (receipt.status === 0) {
        throw new Error('Transaction failed');
      }

      const txReceipt: TransactionReceipt = {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.gasPrice,
        status: receipt.status || 0,
        confirmations: confirmations,
      };

      console.log('[EVMTransactionService] Transaction confirmed');
      console.log(`  Block: ${txReceipt.blockNumber}`);
      console.log(`  Gas Used: ${txReceipt.gasUsed.toString()}`);
      console.log(`  Status: ${txReceipt.status === 1 ? 'Success' : 'Failed'}`);

      return txReceipt;
    } catch (error) {
      console.error('[EVMTransactionService] Confirmation failed:', error);
      throw this.parseTransactionError(error);
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return {
          hash: txHash,
          status: 'pending',
          confirmations: 0,
        };
      }

      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber + 1;

      if (receipt.status === 0) {
        return {
          hash: txHash,
          status: 'failed',
          confirmations,
          error: 'Transaction reverted',
        };
      }

      return {
        hash: txHash,
        status: 'confirmed',
        confirmations,
        receipt: {
          hash: receipt.hash,
          blockNumber: receipt.blockNumber,
          blockHash: receipt.blockHash,
          gasUsed: receipt.gasUsed,
          effectiveGasPrice: receipt.gasPrice,
          status: receipt.status || 0,
          confirmations,
        },
      };
    } catch (error) {
      console.error('[EVMTransactionService] Failed to get transaction status:', error);
      throw error;
    }
  }

  /**
   * Decode revert reason from transaction
   */
  async decodeRevertReason(txHash: string): Promise<string | null> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) {
        return null;
      }

      try {
        await this.provider.call({
          to: tx.to,
          data: tx.data,
          value: tx.value,
        });
        return null; // Transaction didn't revert
      } catch (error: any) {
        // Try to decode revert reason
        if (error.data) {
          try {
            const reason = ethers.toUtf8String('0x' + error.data.slice(138));
            return reason;
          } catch {
            return error.data;
          }
        }
        return error.message || 'Unknown revert reason';
      }
    } catch (error) {
      console.error('[EVMTransactionService] Failed to decode revert reason:', error);
      return null;
    }
  }

  /**
   * Parse transaction errors into user-friendly messages
   */
  private parseTransactionError(error: any): Error {
    const message = error?.message || String(error);
    const code = error?.code;

    // User rejected
    if (code === 'ACTION_REJECTED' || code === 4001 || message.includes('user rejected')) {
      return new Error('Transaction rejected by user');
    }

    // Insufficient funds
    if (message.includes('insufficient funds') || message.includes('insufficient balance')) {
      return new Error('Insufficient funds for transaction');
    }

    // Gas too low
    if (message.includes('gas too low') || message.includes('intrinsic gas')) {
      return new Error('Gas limit too low for transaction');
    }

    // Nonce too low
    if (message.includes('nonce too low')) {
      return new Error('Transaction nonce error. Please try again.');
    }

    // Replacement underpriced
    if (message.includes('replacement transaction underpriced')) {
      return new Error('Transaction replacement underpriced. Increase gas price.');
    }

    // Transaction reverted
    if (message.includes('reverted') || message.includes('revert')) {
      return new Error('Transaction reverted by contract');
    }

    // Timeout
    if (message.includes('timeout')) {
      return new Error('Transaction timeout. Please check transaction status.');
    }

    // Generic error
    return new Error(message);
  }

  /**
   * Update signer (useful when switching accounts)
   */
  updateSigner(signer: ethers.Signer): void {
    this.signer = signer;
    console.log('[EVMTransactionService] Signer updated');
  }
}

// Factory function
export function createEVMTransactionService(
  provider: ethers.Provider,
  signer: ethers.Signer
): EVMTransactionService {
  return new EVMTransactionService(provider, signer);
}
