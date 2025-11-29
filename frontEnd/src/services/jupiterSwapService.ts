import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { JupiterQuote, SwapQuote, TransactionStatus } from '@/types';

export interface SwapExecutionResult {
  signature: string;
  status: TransactionStatus;
  error?: string;
}

export interface SwapTransactionData {
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
}

export interface SwapSettings {
  slippageTolerance: number;
  deadline: number; // Minutes from now
  computeUnitPriceMicroLamports?: number;
  priorityFee?: number; // Additional priority fee in lamports
  maxAccounts?: number; // Limit for multi-hop routes
}

export class JupiterSwapService {
  private connection: Connection;
  private jupiterApiUrl: string;

  constructor(connection: Connection, jupiterApiUrl?: string) {
    this.connection = connection;
    this.jupiterApiUrl = jupiterApiUrl || 'https://quote-api.jup.ag/v6';
  }

  /**
   * Get optimized quote with multi-hop routing
   */
  async getOptimizedQuote(
    inputMint: string,
    outputMint: string,
    amount: string,
    settings: SwapSettings
  ): Promise<JupiterQuote | null> {
    try {
      const slippageBps = Math.floor(settings.slippageTolerance * 100);
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount,
        slippageBps: slippageBps.toString(),
        onlyDirectRoutes: 'false', // Enable multi-hop routing
        asLegacyTransaction: 'false', // Use versioned transactions for better performance
      });

      // Add optional parameters
      if (settings.maxAccounts) {
        params.append('maxAccounts', settings.maxAccounts.toString());
      }

      const url = `${this.jupiterApiUrl}/quote?${params.toString()}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch optimized Jupiter quote:', error);
      return null;
    }
  }

  /**
   * Get swap transaction from Jupiter API
   */
  async getSwapTransaction(
    quote: JupiterQuote,
    userPublicKey: PublicKey,
    settings?: SwapSettings,
    wrapAndUnwrapSol: boolean = true,
    feeAccount?: PublicKey
  ): Promise<SwapTransactionData> {
    try {
      const response = await fetch(`${this.jupiterApiUrl}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: userPublicKey.toString(),
          wrapAndUnwrapSol,
          feeAccount: feeAccount?.toString(),
          computeUnitPriceMicroLamports: settings?.computeUnitPriceMicroLamports,
          prioritizationFeeLamports: settings?.priorityFee,
          asLegacyTransaction: false, // Use versioned transactions
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Jupiter swap API error: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const data = await response.json();
      return {
        swapTransaction: data.swapTransaction,
        lastValidBlockHeight: data.lastValidBlockHeight,
      };
    } catch (error) {
      console.error('Failed to get swap transaction:', error);
      throw error;
    }
  }

  /**
   * Execute swap transaction with deadline and timeout handling
   */
  async executeSwap(
    quote: SwapQuote,
    wallet: WalletContextState,
    settings?: SwapSettings,
    onStatusUpdate?: (status: TransactionStatus, signature?: string, error?: string) => void
  ): Promise<SwapExecutionResult> {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected or does not support transaction signing');
    }

    if (!quote.jupiterQuote) {
      throw new Error('Jupiter quote not available');
    }

    try {
      onStatusUpdate?.(TransactionStatus.PENDING);

      // Check deadline
      if (settings?.deadline) {
        const deadlineMs = settings.deadline * 60 * 1000; // Convert minutes to milliseconds
        const timeElapsed = Date.now() - (quote.validUntil - 30000); // Assuming 30s quote validity
        if (timeElapsed > deadlineMs) {
          throw new Error('Transaction deadline exceeded');
        }
      }

      // Get swap transaction from Jupiter
      const swapTransactionData = await this.getSwapTransaction(
        quote.jupiterQuote,
        wallet.publicKey,
        settings
      );

      // Deserialize the transaction
      const swapTransactionBuf = Buffer.from(swapTransactionData.swapTransaction, 'base64');
      let transaction: Transaction | VersionedTransaction;

      try {
        // Try to deserialize as VersionedTransaction first
        transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      } catch {
        // Fallback to legacy Transaction
        transaction = Transaction.from(swapTransactionBuf);
      }

      // Sign the transaction
      const signedTransaction = await wallet.signTransaction(transaction);

      // Send the transaction with timeout handling
      const sendPromise = this.connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        }
      );

      // Add timeout for transaction sending
      const timeoutMs = settings?.deadline ? settings.deadline * 60 * 1000 : 60000; // Default 1 minute
      const signature = await Promise.race([
        sendPromise,
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Transaction send timeout')), timeoutMs)
        )
      ]);

      onStatusUpdate?.(TransactionStatus.PENDING, signature);

      // Wait for confirmation with timeout
      const confirmationPromise = this.connection.confirmTransaction(
        {
          signature,
          blockhash: transaction instanceof VersionedTransaction 
            ? 'recent' // VersionedTransaction doesn't expose blockhash directly
            : transaction.recentBlockhash || 'recent',
          lastValidBlockHeight: swapTransactionData.lastValidBlockHeight,
        },
        'confirmed'
      );

      const confirmation = await Promise.race([
        confirmationPromise,
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), timeoutMs)
        )
      ]);

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
      // Only log detailed error in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Swap execution failed:', error);
      }
      onStatusUpdate?.(TransactionStatus.FAILED, undefined, errorMessage);
      
      return {
        signature: '',
        status: TransactionStatus.FAILED,
        error: errorMessage,
      };
    }
  }

  /**
   * Get optimal compute unit price based on network conditions
   */
  async getOptimalComputeUnitPrice(): Promise<number> {
    try {
      // Get recent prioritization fees
      const recentFees = await this.connection.getRecentPrioritizationFees();
      
      if (recentFees.length === 0) {
        return 1; // Default 1 micro-lamport per compute unit
      }

      // Calculate median fee for better price estimation
      const fees = recentFees.map(fee => fee.prioritizationFee).sort((a, b) => a - b);
      const medianIndex = Math.floor(fees.length / 2);
      const medianFee = fees.length % 2 === 0 
        ? (fees[medianIndex - 1] + fees[medianIndex]) / 2
        : fees[medianIndex];

      // Add small buffer (10%) to ensure transaction inclusion
      return Math.max(1, Math.ceil(medianFee * 1.1));
    } catch (error) {
      console.error('Failed to get optimal compute unit price:', error);
      return 1; // Fallback to minimum
    }
  }

  /**
   * Estimate transaction fee with optimization
   */
  async estimateSwapFee(quote: JupiterQuote, userPublicKey: PublicKey, settings?: Partial<SwapSettings>): Promise<number> {
    try {
      // Get optimal compute unit price if not provided
      const computeUnitPrice = settings?.computeUnitPriceMicroLamports || await this.getOptimalComputeUnitPrice();
      
      const defaultedSettings: SwapSettings = {
        slippageTolerance: settings?.slippageTolerance ?? 0.5,
        deadline: settings?.deadline ?? 20,
        computeUnitPriceMicroLamports: computeUnitPrice,
        priorityFee: settings?.priorityFee,
        maxAccounts: settings?.maxAccounts,
      };

      const swapTransactionData = await this.getSwapTransaction(
        quote, 
        userPublicKey, 
        defaultedSettings
      );
      const swapTransactionBuf = Buffer.from(swapTransactionData.swapTransaction, 'base64');
      
      let transaction: Transaction | VersionedTransaction;
      try {
        transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      } catch {
        transaction = Transaction.from(swapTransactionBuf);
      }

      // Get base fee for transaction
      const baseFee = await this.connection.getFeeForMessage(
        transaction instanceof VersionedTransaction 
          ? transaction.message
          : transaction.compileMessage(),
        'confirmed'
      );

      const baseFeeValue = baseFee.value || 5000;
      
      // Add priority fee if specified
      const priorityFee = settings?.priorityFee || 0;
      
      return baseFeeValue + priorityFee;
    } catch (error) {
      console.error('Failed to estimate swap fee:', error);
      return 5000; // Default fee
    }
  }

  /**
   * Check if swap is still valid
   */
  isQuoteValid(quote: SwapQuote): boolean {
    return Date.now() < quote.validUntil;
  }

  /**
   * Validate swap parameters
   */
  validateSwapParameters(quote: SwapQuote, userPublicKey: PublicKey, tokenBalances: Record<string, bigint>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check if quote is still valid
    if (!this.isQuoteValid(quote)) {
      errors.push('Quote has expired. Please refresh the quote.');
    }

    // Check if user has sufficient input token balance
    if (!quote.jupiterQuote) {
      errors.push('Invalid Jupiter quote data.');
    } else {
      const inputMint = quote.jupiterQuote.inputMint;
      const inputAmount = BigInt(quote.jupiterQuote.inAmount);
      const userBalance = tokenBalances[inputMint] || BigInt(0);

      if (userBalance < inputAmount) {
        errors.push('Insufficient token balance for swap.');
      }
    }

    // Check for high price impact
    if (quote.priceImpact > 15) {
      errors.push('Price impact is too high (>15%). Consider reducing swap amount.');
    }

    // Check slippage tolerance
    if (quote.slippageTolerance > 50) {
      errors.push('Slippage tolerance is too high (>50%).');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create transaction receipt with detailed information
   */
  async createTransactionReceipt(
    signature: string,
    quote: SwapQuote,
    userPublicKey: PublicKey
  ): Promise<any> {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      return {
        signature,
        blockTime: transaction.blockTime,
        slot: transaction.slot,
        fee: transaction.meta?.fee || 0,
        computeUnitsConsumed: transaction.meta?.computeUnitsConsumed || 0,
        preBalances: transaction.meta?.preBalances || [],
        postBalances: transaction.meta?.postBalances || [],
        logMessages: transaction.meta?.logMessages || [],
        status: transaction.meta?.err ? 'failed' : 'success',
        inputToken: quote.jupiterQuote?.inputMint,
        outputToken: quote.jupiterQuote?.outputMint,
        inputAmount: quote.jupiterQuote?.inAmount,
        outputAmount: quote.jupiterQuote?.outAmount,
        priceImpact: quote.priceImpact,
        route: quote.jupiterQuote?.routePlan || [],
      };
    } catch (error) {
      console.error('Failed to create transaction receipt:', error);
      return null;
    }
  }

  /**
   * Get transaction history for a user
   */
  async getTransactionHistory(
    userPublicKey: PublicKey,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        userPublicKey,
        { limit }
      );

      const transactions = await Promise.all(
        signatures.map(async (sig) => {
          try {
            const tx = await this.connection.getTransaction(sig.signature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0
            });
            
            if (!tx) return null;

            // Check if this is a Jupiter swap transaction
            const isJupiterSwap = tx.meta?.logMessages?.some(log => 
              log.includes('Jupiter') || log.includes('JUP')
            );

            if (!isJupiterSwap) return null;

            return {
              signature: sig.signature,
              blockTime: tx.blockTime,
              slot: tx.slot,
              fee: tx.meta?.fee || 0,
              status: tx.meta?.err ? 'failed' : 'success',
              error: tx.meta?.err,
            };
          } catch (error) {
            console.error(`Failed to fetch transaction ${sig.signature}:`, error);
            return null;
          }
        })
      );

      return transactions.filter(tx => tx !== null);
    } catch (error) {
      console.error('Failed to get transaction history:', error);
      return [];
    }
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
      
      if (message.includes('insufficient funds') || message.includes('insufficient lamports')) {
        return 'Insufficient SOL balance to pay for transaction fees.';
      }
      
      if (message.includes('no record of a prior credit') || message.includes('attempt to debit')) {
        return 'Insufficient token balance or token account not found. Please ensure you have enough balance for this swap.';
      }
      
      if (message.includes('tokenaccountnotfound') || message.includes('token account not found')) {
        return 'Token account not found. The token account needs to be created first.';
      }
      
      if (message.includes('slippage tolerance exceeded') || message.includes('slippage')) {
        return 'Price moved beyond your slippage tolerance. Try increasing slippage or refreshing the quote.';
      }
      
      if (message.includes('blockhash not found') || message.includes('expired')) {
        return 'Transaction expired. Please try again.';
      }
      
      if (message.includes('user rejected') || message.includes('cancelled')) {
        return 'Transaction was cancelled.';
      }
      
      if (message.includes('simulation failed')) {
        return 'Transaction simulation failed. Please check your balance and try again.';
      }

      return error.message;
    }

    return 'Transaction failed. Please check your balance and try again.';
  }
}

// Export singleton instance
let jupiterSwapService: JupiterSwapService | null = null;

export const getJupiterSwapService = (connection: Connection): JupiterSwapService => {
  if (!jupiterSwapService) {
    jupiterSwapService = new JupiterSwapService(connection);
  }
  return jupiterSwapService;
};