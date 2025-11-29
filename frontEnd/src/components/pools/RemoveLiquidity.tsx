'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Pool } from '@/types';
import { TokenLogo } from '@/components/tokens/TokenLogo';
import { useWallet } from '@/hooks/useWallet';
import { useConnection } from '@solana/wallet-adapter-react';
import { formatTokenAmount, formatNumber } from '@/utils/formatting';
import { hasSufficientSolForPoolCreation } from '@/utils/poolValidation';
import { getLiquidityService } from '@/services/liquidityService';
import { TransactionStatus, TransactionType } from '@/types';
import { useTransactionStore } from '@/stores/transactionStore';
import { usePoolPosition } from '@/hooks/useLiquidityPositions';
import { getAssociatedTokenAddress } from '@solana/spl-token';

interface RemoveLiquidityProps {
  pool: Pool | null;
  isOpen: boolean;
  onClose: () => void;
  onLiquidityRemoved?: (poolId: string, txSignature: string) => void;
}

interface RemovalState {
  percentage: number;
  lpTokensToRemove: bigint;
  tokenAToReceive: bigint;
  tokenBToReceive: bigint;
  priceImpact: number;
}

export function RemoveLiquidity({ pool, isOpen, onClose, onLiquidityRemoved }: RemoveLiquidityProps) {
  const { isConnected, solBalance, solanaWallet, publicKey } = useWallet();
  const { connection } = useConnection();
  const { addTransaction } = useTransactionStore();
  const { position } = usePoolPosition(pool?.id || null);
  
  const [state, setState] = useState<RemovalState>({
    percentage: 0,
    lpTokensToRemove: BigInt(0),
    tokenAToReceive: BigInt(0),
    tokenBToReceive: BigInt(0),
    priceImpact: 0,
  });
  
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [fetchedLpBalance, setFetchedLpBalance] = useState<bigint>(BigInt(0));

  // Get user LP token balance from position or fetched balance
  const userLpTokenBalance = useMemo(() => {
    if (position) {
      return position.lpTokenBalance;
    }
    return fetchedLpBalance;
  }, [position, fetchedLpBalance]);

  // Reset state when dialog opens/closes or pool changes
  useEffect(() => {
    if (!isOpen || !pool) {
      setState({
        percentage: 0,
        lpTokensToRemove: BigInt(0),
        tokenAToReceive: BigInt(0),
        tokenBToReceive: BigInt(0),
        priceImpact: 0,
      });
      setError(null);
      setValidationErrors({});
    }
  }, [isOpen, pool]);
  
  useEffect(() => {
    const fetchLpBalance = async () => {
      if (!pool || !publicKey || !connection || position) {
        if (position) {
          setFetchedLpBalance(position.lpTokenBalance);
        }
        return;
      }
      
      try {
        const lpTokenAccount = await getAssociatedTokenAddress(
          pool.lpTokenMint,
          publicKey
        );
        const accountInfo = await connection.getTokenAccountBalance(lpTokenAccount);
        if (accountInfo.value) {
          setFetchedLpBalance(BigInt(accountInfo.value.amount));
        } else {
          setFetchedLpBalance(BigInt(0));
        }
      } catch (error) {
        // Account doesn't exist - user has no LP tokens
        setFetchedLpBalance(BigInt(0));
      }
    };
    
    if (isOpen && pool && publicKey) {
      fetchLpBalance();
    }
  }, [isOpen, pool, publicKey, connection, position]);

  // Calculate removal amounts based on percentage
  useEffect(() => {
    if (!pool || state.percentage === 0 || userLpTokenBalance === BigInt(0)) {
      setState(prev => ({
        ...prev,
        lpTokensToRemove: BigInt(0),
        tokenAToReceive: BigInt(0),
        tokenBToReceive: BigInt(0),
        priceImpact: 0,
      }));
      return;
    }

    try {
      // Calculate LP tokens to remove
      const lpTokensToRemove = (userLpTokenBalance * BigInt(state.percentage)) / BigInt(100);
      
      // Calculate tokens to receive based on pool share
      const shareOfPool = Number(lpTokensToRemove) / Number(pool.lpTokenSupply);
      const tokenAToReceive = BigInt(Math.floor(Number(pool.reserveA) * shareOfPool));
      const tokenBToReceive = BigInt(Math.floor(Number(pool.reserveB) * shareOfPool));

      // Calculate price impact (simplified)
      const currentPrice = Number(pool.reserveA) / Number(pool.reserveB);
      const newReserveA = pool.reserveA - tokenAToReceive;
      const newReserveB = pool.reserveB - tokenBToReceive;
      const newPrice = newReserveA > 0 && newReserveB > 0 ? Number(newReserveA) / Number(newReserveB) : currentPrice;
      const priceImpact = Math.abs((newPrice - currentPrice) / currentPrice) * 100;

      setState(prev => ({
        ...prev,
        lpTokensToRemove,
        tokenAToReceive,
        tokenBToReceive,
        priceImpact,
      }));
    } catch (error) {
      console.error('Error calculating removal amounts:', error);
    }
  }, [pool, state.percentage, userLpTokenBalance]);

  // Handle percentage change
  const handlePercentageChange = (percentage: number) => {
    setState(prev => ({ ...prev, percentage }));
  };

  // Validation
  const validateInputs = useCallback(() => {
    const errors: Record<string, string> = {};

    if (state.percentage <= 0) {
      errors.percentage = 'Please select an amount to remove';
    }

    if (state.percentage > 100) {
      errors.percentage = 'Cannot remove more than 100%';
    }

    if (state.lpTokensToRemove > userLpTokenBalance) {
      errors.balance = 'Insufficient LP token balance';
    }

    // Check SOL balance for transaction fees
    if (!hasSufficientSolForPoolCreation(solBalance)) {
      errors.solBalance = 'Insufficient SOL for transaction fees';
    }

    // Check price impact
    if (state.priceImpact > 5) {
      errors.priceImpact = 'High price impact. Consider reducing the amount.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [state, userLpTokenBalance, solBalance]);

  // Handle remove liquidity
  const handleRemoveLiquidity = async () => {
    if (!isConnected || !pool) {
      setError('Please connect your wallet first');
      return;
    }

    if (!validateInputs()) {
      return;
    }

    setIsRemoving(true);
    setError(null);

    try {
      if (!connection || !solanaWallet) {
        throw new Error('Connection or wallet not available');
      }

      // Calculate minimum tokens to receive (with 1% slippage tolerance)
      const minTokenA = state.tokenAToReceive * BigInt(99) / BigInt(100);
      const minTokenB = state.tokenBToReceive * BigInt(99) / BigInt(100);

      const liquidityService = getLiquidityService(connection, pool.programId);

      const result = await liquidityService.removeLiquidity(
        {
          pool,
          lpTokenAmount: state.lpTokensToRemove,
          minTokenA,
          minTokenB,
        },
        solanaWallet,
        (status, signature, error) => {
          if (error) {
            setError(error);
          }
        }
      );

      if (result.status === TransactionStatus.CONFIRMED) {
        onLiquidityRemoved?.(pool.id, result.signature);
        
        // Record transaction
        addTransaction({
          signature: result.signature,
          hash: result.signature,
          type: TransactionType.REMOVE_LIQUIDITY,
          status: TransactionStatus.CONFIRMED,
          timestamp: Date.now(),
          tokenIn: pool.tokenA,
          tokenOut: pool.tokenB,
          amountIn: state.tokenAToReceive,
          amountOut: state.tokenBToReceive,
          feePayer: solanaWallet.publicKey?.toString() || '',
          solFee: BigInt(5000), // Estimated
        });
        
        onClose();
      } else {
        setError(result.error || 'Failed to remove liquidity');
      }

    } catch (err) {
      console.error('Remove liquidity failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove liquidity');
    } finally {
      setIsRemoving(false);
    }
  };

  const canRemoveLiquidity = useMemo(() => {
    return isConnected && 
           pool &&
           state.percentage > 0 && 
           Object.keys(validationErrors).length === 0;
  }, [isConnected, pool, state.percentage, validationErrors]);

  if (!pool) return null;

  const userShareOfPool = userLpTokenBalance > 0 && pool.lpTokenSupply > 0 
    ? Number(userLpTokenBalance) / Number(pool.lpTokenSupply) * 100 
    : 0;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/25" />
      
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
            <div className="flex items-center justify-between mb-6">
              <Dialog.Title className="text-xl font-semibold text-gray-900">
                Remove Liquidity
              </Dialog.Title>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
                disabled={isRemoving}
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Pool Info */}
            <div className="flex items-center space-x-3 mb-6 p-3 bg-gray-50 rounded-lg">
              <div className="flex -space-x-2">
                <TokenLogo token={pool.tokenA} size="sm" />
                <TokenLogo token={pool.tokenB} size="sm" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  {pool.tokenA.symbol}/{pool.tokenB.symbol}
                </div>
                <div className="text-sm text-gray-500">
                  Your share: {formatNumber(userShareOfPool, 4)}% • {formatTokenAmount(userLpTokenBalance, 6)} LP tokens
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Percentage Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Amount to Remove
                </label>
                
                {/* Percentage Buttons */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[25, 50, 75, 100].map((percentage) => (
                    <button
                      key={percentage}
                      onClick={() => handlePercentageChange(percentage)}
                      disabled={isRemoving}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border ${
                        state.percentage === percentage
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      } disabled:opacity-50`}
                    >
                      {percentage}%
                    </button>
                  ))}
                </div>

                {/* Custom Percentage Slider */}
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={state.percentage}
                    onChange={(e) => handlePercentageChange(parseInt(e.target.value))}
                    disabled={isRemoving}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span className="font-medium text-gray-900">{state.percentage}%</span>
                    <span>100%</span>
                  </div>
                </div>

                {validationErrors.percentage && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.percentage}</p>
                )}
              </div>

              {/* Tokens to Receive */}
              {state.percentage > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-700">You will receive:</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <TokenLogo token={pool.tokenA} size="sm" />
                        <span className="font-medium">{pool.tokenA.symbol}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatTokenAmount(state.tokenAToReceive, pool.tokenA.decimals)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <TokenLogo token={pool.tokenB} size="sm" />
                        <span className="font-medium">{pool.tokenB.symbol}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatTokenAmount(state.tokenBToReceive, pool.tokenB.decimals)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Removal Information */}
              {state.percentage > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center mb-3">
                    <InformationCircleIcon className="w-5 h-5 text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-blue-900">Removal Details</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">LP Tokens to Burn:</span>
                      <span className="font-medium">
                        {formatTokenAmount(state.lpTokensToRemove, 6)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Price Impact:</span>
                      <span className={`font-medium ${state.priceImpact > 5 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {formatNumber(state.priceImpact, 2)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2" />
                    <span className="text-sm text-red-800">{error}</span>
                  </div>
                </div>
              )}

              {/* Validation Errors */}
              {(validationErrors.balance || validationErrors.priceImpact || validationErrors.solBalance) && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2" />
                    <span className="text-sm text-red-800">
                      {validationErrors.balance || validationErrors.priceImpact || validationErrors.solBalance}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isRemoving}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRemoveLiquidity}
                  disabled={!canRemoveLiquidity || isRemoving}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRemoving ? 'Removing Liquidity...' : 'Remove Liquidity'}
                </button>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
}