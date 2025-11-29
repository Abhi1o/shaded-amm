import { useEffect, useCallback, useRef } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useTransactionStore } from '@/stores/transactionStore';
import { useSolanaConnection } from './useSolanaConnection';
import { TransactionStatus } from '@/types';

interface UseTransactionTrackingOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useTransactionTracking(options: UseTransactionTrackingOptions = {}) {
  const { autoRefresh = true, refreshInterval = 15000 } = options; // Increased from 5s to 15s
  const { connection } = useSolanaConnection();
  const { transactions, updateTransaction } = useTransactionStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionsRef = useRef<Map<string, number>>(new Map());

  // Track pending transactions with WebSocket
  const trackTransaction = useCallback(
    async (signature: string) => {
      if (!connection) return;

      try {
        // Subscribe to transaction status updates
        const subscriptionId = connection.onSignature(
          signature,
          (result, context) => {
            if (result.err) {
              updateTransaction(signature, {
                status: TransactionStatus.FAILED,
                error: JSON.stringify(result.err),
                slot: context.slot,
              });
            } else {
              updateTransaction(signature, {
                status: TransactionStatus.CONFIRMED,
                slot: context.slot,
              });
            }

            // Clean up subscription
            const subId = subscriptionsRef.current.get(signature);
            if (subId !== undefined) {
              connection.removeSignatureListener(subId);
              subscriptionsRef.current.delete(signature);
            }
          },
          'confirmed'
        );

        subscriptionsRef.current.set(signature, subscriptionId);
      } catch (error) {
        console.error('Failed to track transaction:', error);
      }
    },
    [connection, updateTransaction]
  );

  // Poll for transaction status updates
  const pollTransactionStatus = useCallback(
    async (signature: string) => {
      if (!connection) return;

      try {
        const status = await connection.getSignatureStatus(signature);

        if (status.value) {
          if (status.value.err) {
            updateTransaction(signature, {
              status: TransactionStatus.FAILED,
              error: JSON.stringify(status.value.err),
              slot: status.value.slot,
            });
          } else if (status.value.confirmationStatus === 'confirmed' || 
                     status.value.confirmationStatus === 'finalized') {
            updateTransaction(signature, {
              status: TransactionStatus.CONFIRMED,
              slot: status.value.slot,
            });
          }
        }
      } catch (error) {
        console.error('Failed to poll transaction status:', error);
      }
    },
    [connection, updateTransaction]
  );

  // Fetch transaction details
  const fetchTransactionDetails = useCallback(
    async (signature: string) => {
      if (!connection) return null;

      try {
        const tx = await connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (tx) {
          return {
            blockTime: tx.blockTime || undefined,
            slot: tx.slot,
            solFee: BigInt(tx.meta?.fee || 0),
            computeUnitsUsed: tx.meta?.computeUnitsConsumed,
            logs: tx.meta?.logMessages || undefined,
            error: tx.meta?.err ? JSON.stringify(tx.meta.err) : undefined,
          };
        }

        return null;
      } catch (error) {
        console.error('Failed to fetch transaction details:', error);
        return null;
      }
    },
    [connection]
  );

  // Update pending transactions
  const updatePendingTransactions = useCallback(async () => {
    const pendingTxs = transactions.filter(
      (tx) => tx.status === TransactionStatus.PENDING
    );

    for (const tx of pendingTxs) {
      await pollTransactionStatus(tx.signature);
    }
  }, [transactions, pollTransactionStatus]);

  // Set up auto-refresh for pending transactions
  useEffect(() => {
    if (!autoRefresh || !connection) return;

    intervalRef.current = setInterval(() => {
      updatePendingTransactions();
    }, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, connection, refreshInterval, updatePendingTransactions]);

  // Track new pending transactions
  useEffect(() => {
    if (!connection) return;

    const pendingTxs = transactions.filter(
      (tx) => tx.status === TransactionStatus.PENDING && 
             !subscriptionsRef.current.has(tx.signature)
    );

    pendingTxs.forEach((tx) => {
      trackTransaction(tx.signature);
    });
  }, [transactions, connection, trackTransaction]);

  // Clean up subscriptions on unmount
  useEffect(() => {
    return () => {
      if (connection) {
        subscriptionsRef.current.forEach((subId) => {
          connection.removeSignatureListener(subId);
        });
        subscriptionsRef.current.clear();
      }
    };
  }, [connection]);

  return {
    trackTransaction,
    pollTransactionStatus,
    fetchTransactionDetails,
    updatePendingTransactions,
  };
}
