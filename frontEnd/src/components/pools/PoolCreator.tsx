'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Token } from '@/types';
import { TokenSelector } from '@/components/tokens/TokenSelector';
import { useWallet } from '@/hooks/useWallet';
import { useTokenList } from '@/hooks/useTokenList';
import { usePoolCreation } from '@/hooks/usePoolCreation';
import { formatTokenAmount, formatNumber } from '@/utils/formatting';
import { validatePoolCreation, calculateInitialPrice, hasSufficientSolForPoolCreation } from '@/utils/poolValidation';


interface PoolCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onPoolCreated?: (poolId: string) => void;
}

interface PoolCreationState {
  tokenA?: Token;
  tokenB?: Token;
  amountA: string;
  amountB: string;
  initialPrice: number;
  pricePerTokenB: number;
  shareOfPool: number;
}

export function PoolCreator({ isOpen, onClose, onPoolCreated }: PoolCreatorProps) {
  const { isConnected, tokenBalances, publicKey, solBalance } = useWallet();
  const { tokens } = useTokenList();
  const { createPool, isCreating: isCreatingPool, error: poolCreationError, clearError } = usePoolCreation();
  
  const [state, setState] = useState<PoolCreationState>({
    amountA: '',
    amountB: '',
    initialPrice: 0,
    pricePerTokenB: 0,
    shareOfPool: 100, // New pool = 100% share
  });
  
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setState({
        amountA: '',
        amountB: '',
        initialPrice: 0,
        pricePerTokenB: 0,
        shareOfPool: 100,
      });
      setError(null);
      setValidationErrors({});
      clearError();
    }
  }, [isOpen, clearError]);

  // Calculate price ratios when amounts change
  useEffect(() => {
    if (state.tokenA && state.tokenB && state.amountA && state.amountB) {
      const priceData = calculateInitialPrice(state.amountA, state.amountB, state.tokenA, state.tokenB);
      
      if (priceData) {
        setState(prev => ({
          ...prev,
          initialPrice: priceData.priceAPerB,
          pricePerTokenB: priceData.priceBPerA,
        }));
      }
    }
  }, [state.amountA, state.amountB, state.tokenA, state.tokenB]);

  // Get token balances
  const tokenABalance = useMemo(() => {
    if (!state.tokenA || !tokenBalances) return BigInt(0);
    return tokenBalances[state.tokenA.mint] || BigInt(0);
  }, [state.tokenA, tokenBalances]);

  const tokenBBalance = useMemo(() => {
    if (!state.tokenB || !tokenBalances) return BigInt(0);
    return tokenBalances[state.tokenB.mint] || BigInt(0);
  }, [state.tokenB, tokenBalances]);

  // Validation
  const validateInputs = useCallback(() => {
    const validation = validatePoolCreation({
      tokenA: state.tokenA,
      tokenB: state.tokenB,
      amountA: state.amountA,
      amountB: state.amountB,
      tokenABalance,
      tokenBBalance,
    });

    // Convert validation errors to our format
    const errors: Record<string, string> = {};
    validation.errors.forEach((error, index) => {
      if (error.includes('First token')) {
        errors.tokenA = error;
      } else if (error.includes('Second token')) {
        errors.tokenB = error;
      } else if (error.includes('same token')) {
        errors.tokenPair = error;
      } else if (error.includes('first token amount') || error.includes(state.tokenA?.symbol || '')) {
        errors.amountA = error;
      } else if (error.includes('second token amount') || error.includes(state.tokenB?.symbol || '')) {
        errors.amountB = error;
      } else {
        errors[`general_${index}`] = error;
      }
    });

    // Check SOL balance for transaction fees
    if (!hasSufficientSolForPoolCreation(solBalance)) {
      errors.solBalance = 'Insufficient SOL for transaction fees and rent';
    }

    setValidationErrors(errors);
    return validation.isValid && !errors.solBalance;
  }, [state, tokenABalance, tokenBBalance, solBalance]);

  // Handle token selection
  const handleTokenASelect = (token: Token | null) => {
    if (!token) return;
    setState(prev => ({ ...prev, tokenA: token }));
  };

  const handleTokenBSelect = (token: Token | null) => {
    if (!token) return;
    setState(prev => ({ ...prev, tokenB: token }));
  };

  // Handle amount changes
  const handleAmountAChange = (value: string) => {
    // Only allow numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setState(prev => ({ ...prev, amountA: value }));
    }
  };

  const handleAmountBChange = (value: string) => {
    // Only allow numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setState(prev => ({ ...prev, amountB: value }));
    }
  };

  // Set max balance for token A
  const setMaxAmountA = () => {
    if (state.tokenA && tokenABalance > 0) {
      const maxAmount = Number(tokenABalance) / Math.pow(10, state.tokenA.decimals);
      setState(prev => ({ ...prev, amountA: maxAmount.toString() }));
    }
  };

  // Set max balance for token B
  const setMaxAmountB = () => {
    if (state.tokenB && tokenBBalance > 0) {
      const maxAmount = Number(tokenBBalance) / Math.pow(10, state.tokenB.decimals);
      setState(prev => ({ ...prev, amountB: maxAmount.toString() }));
    }
  };

  // Handle pool creation
  const handleCreatePool = async () => {
    if (!isConnected || !publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    if (!validateInputs()) {
      return;
    }

    setError(null);

    try {
      // Convert amounts to proper decimals
      const amountABigInt = BigInt(Math.floor(parseFloat(state.amountA) * Math.pow(10, state.tokenA!.decimals)));
      const amountBBigInt = BigInt(Math.floor(parseFloat(state.amountB) * Math.pow(10, state.tokenB!.decimals)));

      const poolId = await createPool({
        tokenA: state.tokenA!,
        tokenB: state.tokenB!,
        amountA: amountABigInt,
        amountB: amountBBigInt,
        feeRate: 0.25, // 0.25% fee rate
      });

      onPoolCreated?.(poolId);
      onClose();
      
      // Reset form
      setState({
        amountA: '',
        amountB: '',
        initialPrice: 0,
        pricePerTokenB: 0,
        shareOfPool: 100,
      });

    } catch (err) {
      console.error('Pool creation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to create pool');
    }
  };

  const canCreatePool = useMemo(() => {
    return isConnected && 
           state.tokenA && 
           state.tokenB && 
           state.amountA && 
           state.amountB && 
           Object.keys(validationErrors).length === 0;
  }, [isConnected, state, validationErrors]);

  const isCreating = isCreatingPool;
  const displayError = error || poolCreationError;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/25" />
      
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
            <div className="flex items-center justify-between mb-6">
              <Dialog.Title className="text-xl font-semibold text-gray-900">
                Create Liquidity Pool
              </Dialog.Title>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
                disabled={isCreating}
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {!isConnected && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mr-2" />
                  <span className="text-sm text-yellow-800">
                    Please connect your wallet to create a pool
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Token A Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Token
                </label>
                <TokenSelector
                  selectedToken={state.tokenA}
                  onTokenSelect={handleTokenASelect}
                  excludeTokens={state.tokenB ? [state.tokenB.mint] : []}
                  showBalance={true}
                  disabled={isCreating}
                  placeholder="Select first token"
                />
                {validationErrors.tokenA && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.tokenA}</p>
                )}
              </div>

              {/* Token A Amount */}
              {state.tokenA && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {state.tokenA.symbol} Amount
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={state.amountA}
                      onChange={(e) => handleAmountAChange(e.target.value)}
                      placeholder="0.0"
                      disabled={isCreating}
                      className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={setMaxAmountA}
                      disabled={isCreating}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                      MAX
                    </button>
                  </div>
                  <div className="mt-1 flex justify-between text-sm text-gray-500">
                    <span>
                      Balance: {formatTokenAmount(tokenABalance, state.tokenA.decimals)} {state.tokenA.symbol}
                    </span>
                  </div>
                  {validationErrors.amountA && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.amountA}</p>
                  )}
                </div>
              )}

              {/* Token B Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Second Token
                </label>
                <TokenSelector
                  selectedToken={state.tokenB}
                  onTokenSelect={handleTokenBSelect}
                  excludeTokens={state.tokenA ? [state.tokenA.mint] : []}
                  showBalance={true}
                  disabled={isCreating}
                  placeholder="Select second token"
                />
                {validationErrors.tokenB && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.tokenB}</p>
                )}
              </div>

              {/* Token B Amount */}
              {state.tokenB && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {state.tokenB.symbol} Amount
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={state.amountB}
                      onChange={(e) => handleAmountBChange(e.target.value)}
                      placeholder="0.0"
                      disabled={isCreating}
                      className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={setMaxAmountB}
                      disabled={isCreating}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                      MAX
                    </button>
                  </div>
                  <div className="mt-1 flex justify-between text-sm text-gray-500">
                    <span>
                      Balance: {formatTokenAmount(tokenBBalance, state.tokenB.decimals)} {state.tokenB.symbol}
                    </span>
                  </div>
                  {validationErrors.amountB && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.amountB}</p>
                  )}
                </div>
              )}

              {/* Pool Information */}
              {state.tokenA && state.tokenB && state.amountA && state.amountB && state.initialPrice > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center mb-3">
                    <InformationCircleIcon className="w-5 h-5 text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-blue-900">Pool Information</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Initial Price:</span>
                      <span className="font-medium">
                        1 {state.tokenB.symbol} = {formatNumber(state.initialPrice)} {state.tokenA.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Price per {state.tokenA.symbol}:</span>
                      <span className="font-medium">
                        1 {state.tokenA.symbol} = {formatNumber(state.pricePerTokenB)} {state.tokenB.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Your share of pool:</span>
                      <span className="font-medium">{state.shareOfPool}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {displayError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2" />
                    <span className="text-sm text-red-800">{displayError}</span>
                  </div>
                </div>
              )}

              {/* Validation Errors */}
              {validationErrors.tokenPair && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2" />
                    <span className="text-sm text-red-800">{validationErrors.tokenPair}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreatePool}
                  disabled={!canCreatePool || isCreating}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Creating Pool...' : 'Create Pool'}
                </button>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
}