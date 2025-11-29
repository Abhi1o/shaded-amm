import { useEffect, useState, useCallback, useRef } from 'react';
import { Connection, PublicKey, ConfirmedSignatureInfo, ParsedTransactionWithMeta } from '@solana/web3.js';
import { useTransactionStore } from '@/stores/transactionStore';
import { useSolanaConnection } from './useSolanaConnection';
import { useWallet } from './useWallet';
import { Transaction, TransactionType, TransactionStatus, Token } from '@/types';

interface UseTransactionHistoryOptions {
  enabled?: boolean;
  limit?: number;
  fetchOnMount?: boolean;
  batchSize?: number;
}

/**
 * Hook to fetch and sync historical transactions from Solana blockchain
 */
export function useTransactionHistory(options: UseTransactionHistoryOptions = {}) {
  const { enabled = true, limit = 1000, fetchOnMount = true, batchSize = 20 } = options;
  const { connection } = useSolanaConnection();
  const { address, isConnected } = useWallet();
  const { transactions, setTransactions, addTransaction } = useTransactionStore();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Parse transaction to determine type and extract relevant information
   */
  const parseTransaction = useCallback((
    tx: any, // Solana getTransaction can return different types
    signature: string,
    blockTime: number | null | undefined
  ): Transaction | null => {
    if (!tx || !tx.meta) return null;

    const timestamp = blockTime ? blockTime * 1000 : Date.now();
    // Handle both versioned and legacy transactions
    const accountKeys = tx.transaction?.message?.accountKeys || tx.transaction?.staticAccountKeys || [];
    const feePayer = (Array.isArray(accountKeys) 
      ? accountKeys[0]?.pubkey || accountKeys[0]
      : accountKeys[0]
    )?.toString() || '';
    const solFee = BigInt(tx.meta.fee || 0);
    const status: TransactionStatus = tx.meta.err 
      ? TransactionStatus.FAILED 
      : TransactionStatus.CONFIRMED;
    const error = tx.meta.err ? JSON.stringify(tx.meta.err) : undefined;

    // Check if it's a swap transaction (Jupiter, Raydium, Orca, etc.)
    const logMessages = tx.meta.logMessages || [];
    const isSwap = logMessages.some(log => 
      log.includes('Jupiter') || 
      log.includes('JUP') ||
      log.includes('swap') ||
      log.includes('Swap') ||
      log.includes('Raydium') ||
      log.includes('Orca')
    );

    // Check if it's a liquidity transaction
    const isAddLiquidity = logMessages.some(log => 
      log.includes('add') && log.includes('liquidity') ||
      log.includes('AddLiquidity')
    );
    const isRemoveLiquidity = logMessages.some(log => 
      log.includes('remove') && log.includes('liquidity') ||
      log.includes('RemoveLiquidity')
    );
    const isCreatePool = logMessages.some(log => 
      log.includes('create') && log.includes('pool') ||
      log.includes('CreatePool')
    );

    // Parse token transfers
    const preBalances = tx.meta.preTokenBalances || [];
    const postBalances = tx.meta.postTokenBalances || [];
    const preSolBalance = tx.meta.preBalances?.[0] || 0;
    const postSolBalance = tx.meta.postBalances?.[0] || 0;

    // Find token changes
    const tokenChanges = new Map<string, { pre: bigint; post: bigint; decimals: number }>();
    
    preBalances.forEach((balance) => {
      const mint = balance.mint;
      if (!mint) return;
      
      const decimals = balance.uiTokenAmount?.decimals || 9;
      const preAmountStr = balance.uiTokenAmount?.uiAmountString || '0';
      const preAmount = BigInt(Math.floor(parseFloat(preAmountStr) * Math.pow(10, decimals)));
      
      const postBalance = postBalances.find(pb => 
        pb.accountIndex === balance.accountIndex && pb.mint === mint
      );
      const postAmountStr = postBalance?.uiTokenAmount?.uiAmountString || '0';
      const postAmount = postBalance
        ? BigInt(Math.floor(parseFloat(postAmountStr) * Math.pow(10, decimals)))
        : BigInt(0);
      
      if (preAmount !== postAmount) {
        tokenChanges.set(mint, { pre: preAmount, post: postAmount, decimals });
      }
    });

    // Determine transaction type
    let type: TransactionType;
    let tokenIn: Token | undefined;
    let tokenOut: Token | undefined;
    let amountIn: bigint | undefined;
    let amountOut: bigint | undefined;

    if (isSwap) {
      type = TransactionType.SWAP;
      // Try to extract swap information from token changes
      const tokenChangeEntries = Array.from(tokenChanges.entries());
      if (tokenChangeEntries.length >= 2) {
        // Assume first token is input, second is output
        const [mintIn, changeIn] = tokenChangeEntries[0];
        const [mintOut, changeOut] = tokenChangeEntries[1];
        
        const amountInDiff = changeIn.pre > changeIn.post 
          ? changeIn.pre - changeIn.post 
          : BigInt(0);
        const amountOutDiff = changeOut.post > changeOut.pre
          ? changeOut.post - changeOut.pre
          : BigInt(0);

        if (amountInDiff > 0 && amountOutDiff > 0) {
          const decimalsIn = changeIn.decimals || 9;
          const decimalsOut = changeOut.decimals || 9;
          
          tokenIn = {
            mint: mintIn,
            address: mintIn,
            symbol: mintIn.slice(0, 4) + '...' + mintIn.slice(-4),
            name: mintIn,
            decimals: decimalsIn,
            isNative: false,
          };
          tokenOut = {
            mint: mintOut,
            address: mintOut,
            symbol: mintOut.slice(0, 4) + '...' + mintOut.slice(-4),
            name: mintOut,
            decimals: decimalsOut,
            isNative: false,
          };
          amountIn = amountInDiff;
          amountOut = amountOutDiff;
        }
      }
    } else if (isAddLiquidity) {
      type = TransactionType.ADD_LIQUIDITY;
    } else if (isRemoveLiquidity) {
      type = TransactionType.REMOVE_LIQUIDITY;
    } else if (isCreatePool) {
      type = TransactionType.CREATE_POOL;
    } else {
      // Check if it's a token transfer
      const hasTokenTransfers = preBalances.length > 0 || postBalances.length > 0;
      const hasSolTransfer = Math.abs(postSolBalance - preSolBalance) > solFee;

      if (hasTokenTransfers) {
        type = TransactionType.SPL_TRANSFER;
      } else if (hasSolTransfer) {
        type = TransactionType.SOL_TRANSFER;
      } else {
        // Default to SPL transfer if we can't determine
        type = TransactionType.SPL_TRANSFER;
      }
    }

    return {
      signature,
      hash: signature,
      type,
      status,
      timestamp,
      blockTime: blockTime || undefined,
      slot: tx.slot,
      feePayer,
      solFee,
      computeUnitsUsed: tx.meta.computeUnitsConsumed || undefined,
      error,
      logs: logMessages,
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
    };
  }, []);

  /**
   * Fetch transaction history from blockchain with pagination support
   */
  const fetchTransactionHistory = useCallback(async (beforeSignature?: string) => {
    if (!enabled || !isConnected || !address || !connection) {
      return;
    }

    // Cancel any ongoing fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setProgress(null);

    try {
      const publicKey = new PublicKey(address);
      
      // Fetch transaction signatures with pagination
      const fetchOptions: any = { 
        limit: Math.min(limit, 1000) // Solana RPC max is 1000
      };
      
      if (beforeSignature) {
        fetchOptions.before = beforeSignature;
      }

      console.log('Fetching signatures for address:', address, 'with options:', fetchOptions);
      
      const signatures: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(
        publicKey,
        fetchOptions
      );

      console.log(`Fetched ${signatures.length} signatures`);

      if (signatures.length === 0) {
        setLoading(false);
        if (!beforeSignature) {
          setError('No transactions found for this wallet address');
        }
        return;
      }

      // Get existing transaction signatures to avoid duplicates
      const existingSignatures = new Set(transactions.map(tx => tx.signature));
      const newTransactions: Transaction[] = [];

      // Fetch detailed transaction data in batches with progress tracking
      const totalBatches = Math.ceil(signatures.length / batchSize);
      
      for (let i = 0; i < signatures.length; i += batchSize) {
        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          console.log('Transaction fetch aborted');
          break;
        }

        const batch = signatures.slice(i, i + batchSize);
        const currentBatch = Math.floor(i / batchSize) + 1;
        
        setProgress({ current: currentBatch, total: totalBatches });
        console.log(`Processing batch ${currentBatch}/${totalBatches}`);
        
        // Fetch transactions in parallel with error handling
        const txDetails = await Promise.allSettled(
          batch.map(async (sig) => {
            // Skip if already exists
            if (existingSignatures.has(sig.signature)) {
              return null;
            }

            try {
              const tx = await connection.getTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed',
              });

              if (!tx) {
                console.warn(`Transaction ${sig.signature} not found`);
                return null;
              }

              return parseTransaction(
                tx,
                sig.signature,
                sig.blockTime
              );
            } catch (err) {
              console.error(`Failed to fetch transaction ${sig.signature}:`, err);
              return null;
            }
          })
        );

        // Extract successful results
        const validTransactions = txDetails
          .filter((result): result is PromiseFulfilledResult<Transaction | null> => 
            result.status === 'fulfilled' && result.value !== null
          )
          .map(result => result.value as Transaction);

        newTransactions.push(...validTransactions);

        // Small delay to avoid rate limiting
        if (i + batchSize < signatures.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`Parsed ${newTransactions.length} new transactions`);

      // Merge with existing transactions, avoiding duplicates
      const allTransactions = [...transactions];

      newTransactions.forEach(tx => {
        if (!existingSignatures.has(tx.signature)) {
          allTransactions.push(tx);
        }
      });

      // Sort by timestamp (newest first)
      allTransactions.sort((a, b) => b.timestamp - a.timestamp);

      // Update store
      setTransactions(allTransactions);

      console.log(`Total transactions in store: ${allTransactions.length}`);

    } catch (err: any) {
      console.error('Failed to fetch transaction history:', err);
      
      // Handle specific RPC errors
      let errorMessage = 'Failed to fetch transactions';
      
      // Check for 403 error in various formats
      const errorString = JSON.stringify(err);
      const has403 = (
        err?.message?.includes('403') || 
        err?.message?.includes('Forbidden') ||
        errorString?.includes('403') ||
        errorString?.includes('Access forbidden') ||
        err?.code === 403
      );
      
      if (has403) {
        errorMessage = 'RPC endpoint access forbidden. Please configure a custom RPC endpoint in your environment variables.';
      } else if (err?.message?.includes('429') || err?.message?.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again, or use a premium RPC provider.';
      } else if (err?.message?.includes('network') || err?.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
      setProgress(null);
      abortControllerRef.current = null;
    }
  }, [enabled, isConnected, address, connection, limit, batchSize, transactions, parseTransaction, setTransactions]);

  // Fetch on mount if enabled
  useEffect(() => {
    if (fetchOnMount && enabled && isConnected && address) {
      fetchTransactionHistory();
    }
  }, [fetchOnMount, enabled, isConnected, address]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    loading,
    error,
    progress,
    fetchTransactionHistory,
    transactionCount: transactions.length,
  };
}

