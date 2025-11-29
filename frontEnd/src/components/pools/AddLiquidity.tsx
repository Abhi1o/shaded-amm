'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Pool } from '@/types';
import { TokenLogo } from '@/components/tokens/TokenLogo';
import { useWallet } from '@/hooks/useWallet';
import { useConnection } from '@solana/wallet-adapter-react';
import { formatTokenAmount, formatNumber } from '@/utils/formatting';
import { validatePoolCreation, hasSufficientSolForPoolCreation } from '@/utils/poolValidation';
import { getLiquidityService } from '@/services/liquidityService';
import { TransactionStatus, TransactionType } from '@/types';
import { useTransactionStore } from '@/stores/transactionStore';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, getAccount } from '@solana/spl-token';

interface AddLiquidityProps {
  pool: Pool | null;
  isOpen: boolean;
  onClose: () => void;
  onLiquidityAdded?: (poolId: string, txSignature: string) => void;
}

interface LiquidityState {
  amountA: string;
  amountB: string;
  lpTokensToReceive: bigint;
  shareOfPool: number;
  priceImpact: number;
}

export function AddLiquidity({ pool, isOpen, onClose, onLiquidityAdded }: AddLiquidityProps) {
  const { isConnected, tokenBalances, solBalance, solanaWallet, publicKey } = useWallet();
  const { connection } = useConnection();
  const { addTransaction } = useTransactionStore();
  
  const [state, setState] = useState<LiquidityState>({
    amountA: '',
    amountB: '',
    lpTokensToReceive: BigInt(0),
    shareOfPool: 0,
    priceImpact: 0,
  });
  
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [poolTokenBalances, setPoolTokenBalances] = useState<Record<string, bigint>>({});

  // Reset state when dialog opens/closes or pool changes
  useEffect(() => {
    if (!isOpen || !pool) {
      setState({
        amountA: '',
        amountB: '',
        lpTokensToReceive: BigInt(0),
        shareOfPool: 0,
        priceImpact: 0,
      });
      setError(null);
      setValidationErrors({});
      setPoolTokenBalances({});
    }
  }, [isOpen, pool]);

  // Fetch balances for pool tokens (same pattern as swap)
  useEffect(() => {
    if (!pool || !isConnected || !publicKey || !connection) {
      setPoolTokenBalances({});
      return;
    }

    const fetchPoolTokenBalances = async () => {
      const balances: Record<string, bigint> = {};

      try {
        const nativeSOLMint = 'So11111111111111111111111111111111111111112';

        // Fetch Token A balance
        if (pool.tokenA.mint === nativeSOLMint) {
          // Native SOL - use connection.getBalance
          const solBal = await connection.getBalance(publicKey);
          balances[nativeSOLMint] = BigInt(solBal);
        } else {
          // SPL Token (including wrapped SOL and other tokens)
          try {
            const tokenAMint = new PublicKey(pool.tokenA.mint);
            const tokenAATA = await getAssociatedTokenAddress(
              tokenAMint,
              publicKey
            );
            const tokenAAccount = await getAccount(connection, tokenAATA, 'confirmed', TOKEN_PROGRAM_ID);
            balances[pool.tokenA.mint] = BigInt(tokenAAccount.amount);
          } catch (error) {
            // Token account doesn't exist - balance is 0
            balances[pool.tokenA.mint] = BigInt(0);
          }
        }

        // Fetch Token B balance
        if (pool.tokenB.mint === nativeSOLMint) {
          // Native SOL - use connection.getBalance
          const solBal = await connection.getBalance(publicKey);
          balances[nativeSOLMint] = BigInt(solBal);
        } else {
          // SPL Token (including wrapped SOL and other tokens)
          try {
            const tokenBMint = new PublicKey(pool.tokenB.mint);
            const tokenBATA = await getAssociatedTokenAddress(
              tokenBMint,
              publicKey
            );
            const tokenBAccount = await getAccount(connection, tokenBATA, 'confirmed', TOKEN_PROGRAM_ID);
            balances[pool.tokenB.mint] = BigInt(tokenBAccount.amount);
          } catch (error) {
            // Token account doesn't exist - balance is 0
            balances[pool.tokenB.mint] = BigInt(0);
          }
        }

        setPoolTokenBalances(balances);
      } catch (error) {
        console.error('Failed to fetch pool token balances:', error);
        setPoolTokenBalances({});
      }
    };

    fetchPoolTokenBalances();

    // Refresh balances periodically
    const interval = setInterval(fetchPoolTokenBalances, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [pool, isConnected, publicKey, connection]);

  // Get token balances - use pool-specific balances first, fallback to global tokenBalances
  const tokenABalance = useMemo(() => {
    if (!pool) return BigInt(0);
    // Check pool-specific balances first
    if (poolTokenBalances[pool.tokenA.mint] !== undefined) {
      return poolTokenBalances[pool.tokenA.mint];
    }
    // Fallback to global tokenBalances
    if (tokenBalances) {
    return tokenBalances[pool.tokenA.mint] || BigInt(0);
    }
    return BigInt(0);
  }, [pool, poolTokenBalances, tokenBalances]);

  const tokenBBalance = useMemo(() => {
    if (!pool) return BigInt(0);
    // Check pool-specific balances first
    if (poolTokenBalances[pool.tokenB.mint] !== undefined) {
      return poolTokenBalances[pool.tokenB.mint];
    }
    // For SOL symbol, also check native SOL mint (in case pool uses wrapped SOL but user has native)
    const nativeSOLMint = 'So11111111111111111111111111111111111111112';
    if (pool.tokenB.symbol === 'SOL' && poolTokenBalances[nativeSOLMint] !== undefined) {
      return poolTokenBalances[nativeSOLMint];
    }
    // Fallback to global tokenBalances
    if (tokenBalances) {
    return tokenBalances[pool.tokenB.mint] || BigInt(0);
    }
    return BigInt(0);
  }, [pool, poolTokenBalances, tokenBalances]);

  // Calculate current pool ratio
  const poolRatio = useMemo(() => {
    if (!pool || pool.reserveA === BigInt(0) || pool.reserveB === BigInt(0)) {
      return 0;
    }
    return Number(pool.reserveA) / Number(pool.reserveB);
  }, [pool]);

  // Calculate amounts based on pool ratio
  const calculateAmountB = useCallback((amountA: string) => {
    if (!pool || !amountA || poolRatio === 0) return '';
    
    const amountANum = parseFloat(amountA);
    if (isNaN(amountANum) || amountANum <= 0) return '';
    
    // Adjust for token decimals
    const amountABigInt = BigInt(Math.floor(amountANum * Math.pow(10, pool.tokenA.decimals)));
    const amountBBigInt = (amountABigInt * pool.reserveB) / pool.reserveA;
    const amountBNum = Number(amountBBigInt) / Math.pow(10, pool.tokenB.decimals);
    
    return amountBNum.toString();
  }, [pool, poolRatio]);

  const calculateAmountA = useCallback((amountB: string) => {
    if (!pool || !amountB || poolRatio === 0) return '';
    
    const amountBNum = parseFloat(amountB);
    if (isNaN(amountBNum) || amountBNum <= 0) return '';
    
    // Adjust for token decimals
    const amountBBigInt = BigInt(Math.floor(amountBNum * Math.pow(10, pool.tokenB.decimals)));
    const amountABigInt = (amountBBigInt * pool.reserveA) / pool.reserveB;
    const amountANum = Number(amountABigInt) / Math.pow(10, pool.tokenA.decimals);
    
    return amountANum.toString();
  }, [pool, poolRatio]);

  // Handle amount changes
  const handleAmountAChange = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setState(prev => ({ ...prev, amountA: value }));
      
      if (value && poolRatio > 0) {
        const calculatedB = calculateAmountB(value);
        setState(prev => ({ ...prev, amountB: calculatedB }));
      } else if (!value) {
        setState(prev => ({ ...prev, amountB: '' }));
      }
    }
  };

  const handleAmountBChange = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setState(prev => ({ ...prev, amountB: value }));
      
      if (value && poolRatio > 0) {
        const calculatedA = calculateAmountA(value);
        setState(prev => ({ ...prev, amountA: calculatedA }));
      } else if (!value) {
        setState(prev => ({ ...prev, amountA: '' }));
      }
    }
  };

  // Calculate LP tokens and pool share
  useEffect(() => {
    if (!pool || !state.amountA || !state.amountB) {
      setState(prev => ({ 
        ...prev, 
        lpTokensToReceive: BigInt(0), 
        shareOfPool: 0,
        priceImpact: 0 
      }));
      return;
    }

    try {
      const amountABigInt = BigInt(Math.floor(parseFloat(state.amountA) * Math.pow(10, pool.tokenA.decimals)));
      const amountBBigInt = BigInt(Math.floor(parseFloat(state.amountB) * Math.pow(10, pool.tokenB.decimals)));

      // Calculate LP tokens using constant product formula
      // LP tokens = min(amountA * totalSupply / reserveA, amountB * totalSupply / reserveB)
      let lpTokens: bigint;
      
      if (pool.lpTokenSupply === BigInt(0)) {
        // First liquidity provision - geometric mean
        lpTokens = BigInt(Math.floor(Math.sqrt(Number(amountABigInt) * Number(amountBBigInt))));
      } else {
        const lpFromA = (amountABigInt * pool.lpTokenSupply) / pool.reserveA;
        const lpFromB = (amountBBigInt * pool.lpTokenSupply) / pool.reserveB;
        lpTokens = lpFromA < lpFromB ? lpFromA : lpFromB;
      }

      // Calculate share of pool
      const newTotalSupply = pool.lpTokenSupply + lpTokens;
      const shareOfPool = newTotalSupply > 0 ? Number(lpTokens) / Number(newTotalSupply) * 100 : 0;

      // Calculate price impact (simplified)
      const currentPrice = Number(pool.reserveA) / Number(pool.reserveB);
      const newReserveA = pool.reserveA + amountABigInt;
      const newReserveB = pool.reserveB + amountBBigInt;
      const newPrice = Number(newReserveA) / Number(newReserveB);
      const priceImpact = Math.abs((newPrice - currentPrice) / currentPrice) * 100;

      setState(prev => ({
        ...prev,
        lpTokensToReceive: lpTokens,
        shareOfPool,
        priceImpact,
      }));
    } catch (error) {
      console.error('Error calculating LP tokens:', error);
    }
  }, [pool, state.amountA, state.amountB]);

  // Validation
  const validateInputs = useCallback(() => {
    if (!pool) return false;

    const validation = validatePoolCreation({
      tokenA: pool.tokenA,
      tokenB: pool.tokenB,
      amountA: state.amountA,
      amountB: state.amountB,
      tokenABalance,
      tokenBBalance,
    });

    const errors: Record<string, string> = {};
    validation.errors.forEach((error) => {
      if (error.includes(pool.tokenA.symbol)) {
        errors.amountA = error;
      } else if (error.includes(pool.tokenB.symbol)) {
        errors.amountB = error;
      } else {
        errors.general = error;
      }
    });

    // Check SOL balance
    if (!hasSufficientSolForPoolCreation(solBalance)) {
      errors.solBalance = 'Insufficient SOL for transaction fees';
    }

    // Check price impact
    if (state.priceImpact > 5) {
      errors.priceImpact = 'High price impact. Consider reducing the amount.';
    }

    setValidationErrors(errors);
    return validation.isValid && !errors.solBalance && state.priceImpact <= 15; // Max 15% price impact
  }, [pool, state, tokenABalance, tokenBBalance, solBalance]);

  // Set max balance
  const setMaxAmountA = () => {
    if (pool && tokenABalance > 0) {
      const maxAmount = Number(tokenABalance) / Math.pow(10, pool.tokenA.decimals);
      handleAmountAChange(maxAmount.toString());
    }
  };

  const setMaxAmountB = () => {
    if (pool && tokenBBalance > 0) {
      const maxAmount = Number(tokenBBalance) / Math.pow(10, pool.tokenB.decimals);
      handleAmountBChange(maxAmount.toString());
    }
  };

  // Handle add liquidity
  const handleAddLiquidity = async () => {
    if (!isConnected || !pool) {
      setError('Please connect your wallet first');
      return;
    }

    if (!validateInputs()) {
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      const amountABigInt = BigInt(Math.floor(parseFloat(state.amountA) * Math.pow(10, pool.tokenA.decimals)));
      const amountBBigInt = BigInt(Math.floor(parseFloat(state.amountB) * Math.pow(10, pool.tokenB.decimals)));

      if (!connection || !solanaWallet) {
        throw new Error('Connection or wallet not available');
      }

      const liquidityService = getLiquidityService(connection, pool.programId);
      
      // Calculate min LP tokens (with 1% slippage tolerance)
      const minLpTokens = state.lpTokensToReceive * BigInt(99) / BigInt(100);

      const result = await liquidityService.addLiquidity(
        {
          pool,
          amountA: amountABigInt,
          amountB: amountBBigInt,
          minLpTokens,
        },
        solanaWallet,
        (status, signature, error) => {
          if (error) {
            setError(error);
          }
        }
      );

      if (result.status === TransactionStatus.CONFIRMED) {
        onLiquidityAdded?.(pool.id, result.signature);
        
        // Record transaction
        addTransaction({
          signature: result.signature,
          hash: result.signature,
          type: TransactionType.ADD_LIQUIDITY,
          status: TransactionStatus.CONFIRMED,
          timestamp: Date.now(),
          tokenIn: pool.tokenA,
          tokenOut: pool.tokenB,
          amountIn: amountABigInt,
          amountOut: amountBBigInt,
          feePayer: solanaWallet.publicKey?.toString() || '',
          solFee: BigInt(5000), // Estimated
        });
        
      onClose();
      } else {
        setError(result.error || 'Failed to add liquidity');
      }

    } catch (err) {
      console.error('Add liquidity failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to add liquidity');
    } finally {
      setIsAdding(false);
    }
  };

  const canAddLiquidity = useMemo(() => {
    return isConnected && 
           pool &&
           state.amountA && 
           state.amountB && 
           Object.keys(validationErrors).length === 0;
  }, [isConnected, pool, state, validationErrors]);

  if (!pool) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/25" />
      
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
            <div className="flex items-center justify-between mb-6">
              <Dialog.Title className="text-xl font-semibold text-gray-900">
                Add Liquidity
              </Dialog.Title>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
                disabled={isAdding}
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
              <div>
                <div className="font-medium text-gray-900">
                  {pool.tokenA.symbol}/{pool.tokenB.symbol}
                </div>
                <div className="text-sm text-gray-500">
                  {pool.feeRate}% fee • {formatTokenAmount(pool.totalLiquidity, 6)} LP tokens
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Token A Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {pool.tokenA.symbol} Amount
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={state.amountA}
                    onChange={(e) => handleAmountAChange(e.target.value)}
                    placeholder="0.0"
                    disabled={isAdding}
                    className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={setMaxAmountA}
                    disabled={isAdding}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    MAX
                  </button>
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  Balance: {formatTokenAmount(tokenABalance, pool.tokenA.decimals)} {pool.tokenA.symbol}
                </div>
                {validationErrors.amountA && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.amountA}</p>
                )}
              </div>

              {/* Token B Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {pool.tokenB.symbol} Amount
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={state.amountB}
                    onChange={(e) => handleAmountBChange(e.target.value)}
                    placeholder="0.0"
                    disabled={isAdding}
                    className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={setMaxAmountB}
                    disabled={isAdding}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    MAX
                  </button>
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  Balance: {formatTokenAmount(tokenBBalance, pool.tokenB.decimals)} {pool.tokenB.symbol}
                </div>
                {validationErrors.amountB && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.amountB}</p>
                )}
              </div>

              {/* Liquidity Information */}
              {state.lpTokensToReceive > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center mb-3">
                    <InformationCircleIcon className="w-5 h-5 text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-blue-900">Liquidity Details</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">LP Tokens to Receive:</span>
                      <span className="font-medium">
                        {formatTokenAmount(state.lpTokensToReceive, 6)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Share of Pool:</span>
                      <span className="font-medium">{formatNumber(state.shareOfPool, 4)}%</span>
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
              {(validationErrors.general || validationErrors.priceImpact || validationErrors.solBalance) && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2" />
                    <span className="text-sm text-red-800">
                      {validationErrors.general || validationErrors.priceImpact || validationErrors.solBalance}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isAdding}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddLiquidity}
                  disabled={!canAddLiquidity || isAdding}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAdding ? 'Adding Liquidity...' : 'Add Liquidity'}
                </button>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
}
