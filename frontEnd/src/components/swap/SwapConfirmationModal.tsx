'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { 
  XMarkIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { SwapQuote, TransactionStatus, Token } from '@/types';
import { TokenLogo } from '@/components/tokens';
import { formatTokenAmount } from '@/utils/formatting';

interface SwapConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  quote: SwapQuote | null;
  tokenIn: Token | null;
  tokenOut: Token | null;
  amountIn: string;
  amountOut: string;
  transactionStatus?: TransactionStatus;
  transactionSignature?: string;
  error?: string;
}

export function SwapConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  quote,
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  transactionStatus,
  transactionSignature,
  error
}: SwapConfirmationModalProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Update countdown timer
  useEffect(() => {
    if (!quote || !isOpen) return;

    const updateTimer = () => {
      const remaining = Math.max(0, quote.validUntil - Date.now());
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [quote, isOpen]);

  // Format time remaining
  const formatTimeRemaining = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  };

  // Get status icon and color
  const getStatusDisplay = () => {
    switch (transactionStatus) {
      case TransactionStatus.PENDING:
        return {
          icon: <ClockIcon className="w-6 h-6 text-yellow-500" />,
          title: 'Transaction Pending',
          description: 'Please wait while your transaction is being processed...',
          color: 'yellow'
        };
      case TransactionStatus.CONFIRMED:
        return {
          icon: <CheckCircleIcon className="w-6 h-6 text-green-500" />,
          title: 'Swap Successful!',
          description: 'Your swap has been completed successfully.',
          color: 'green'
        };
      case TransactionStatus.FAILED:
        return {
          icon: <ExclamationCircleIcon className="w-6 h-6 text-red-500" />,
          title: 'Swap Failed',
          description: error || 'Your swap transaction failed.',
          color: 'red'
        };
      default:
        return null;
    }
  };

  const statusDisplay = getStatusDisplay();
  const isProcessing = transactionStatus === TransactionStatus.PENDING;
  const isCompleted = transactionStatus === TransactionStatus.CONFIRMED || transactionStatus === TransactionStatus.FAILED;

  if (!quote || !tokenIn || !tokenOut) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/25" />
      
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <Dialog.Title className="text-lg font-medium text-gray-900">
                {statusDisplay ? statusDisplay.title : 'Confirm Swap'}
              </Dialog.Title>
              {!isProcessing && (
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Status Display */}
            {statusDisplay && (
              <div className="mb-6 text-center">
                <div className="flex justify-center mb-3">
                  {statusDisplay.icon}
                </div>
                <p className="text-sm text-gray-600">
                  {statusDisplay.description}
                </p>
                {transactionSignature && (
                  <div className="mt-3">
                    <a
                      href={`https://solscan.io/tx/${transactionSignature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      View on Solscan
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Swap Details */}
            {!statusDisplay && (
              <>
                {/* Quote Expiry Warning */}
                {timeRemaining < 10000 && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center text-yellow-800">
                      <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
                      <span className="text-sm font-medium">
                        Quote expires in {formatTimeRemaining(timeRemaining)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Swap Summary */}
                <div className="mb-6">
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-2">You&apos;re swapping</div>
                    
                    {/* From Token */}
                    <div className="flex items-center justify-center space-x-3 mb-4">
                      <TokenLogo token={tokenIn} size="md" />
                      <div>
                        <div className="text-xl font-semibold text-gray-900">
                          {amountIn} {tokenIn.symbol}
                        </div>
                      </div>
                    </div>

                    <div className="text-gray-400 mb-4">↓</div>

                    {/* To Token */}
                    <div className="flex items-center justify-center space-x-3">
                      <TokenLogo token={tokenOut} size="md" />
                      <div>
                        <div className="text-xl font-semibold text-gray-900">
                          {amountOut} {tokenOut.symbol}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transaction Details */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Price Impact</span>
                    <span className={`font-medium ${
                      quote.priceImpact > 5 ? 'text-red-600' : quote.priceImpact > 1 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {quote.priceImpact.toFixed(2)}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Slippage Tolerance</span>
                    <span className="font-medium text-gray-900">
                      {quote.slippageTolerance}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Minimum Received</span>
                    <span className="font-medium text-gray-900">
                      {formatTokenAmount(quote.minimumReceived, tokenOut.decimals)} {tokenOut.symbol}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Network Fee</span>
                    <span className="font-medium text-gray-900">
                      ≈ {formatTokenAmount(quote.estimatedSolFee, 9)} SOL
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Route</span>
                    <span className="font-medium text-gray-900">
                      {quote.routeType === 'direct' ? 'Direct' : `${quote.jupiterQuote?.routePlan.length} hops`}
                    </span>
                  </div>
                </div>

                {/* High Price Impact Warning */}
                {quote.priceImpact > 5 && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center text-red-800">
                      <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
                      <span className="text-sm font-medium">High Price Impact</span>
                    </div>
                    <p className="text-sm text-red-700 mt-1">
                      This swap has a price impact of {quote.priceImpact.toFixed(2)}%. 
                      You may receive significantly less than expected.
                    </p>
                  </div>
                )}

                {/* Route Information */}
                {quote.jupiterQuote && quote.jupiterQuote.routePlan.length > 1 && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm font-medium text-blue-800 mb-2">
                      Multi-hop Route ({quote.jupiterQuote.routePlan.length} steps)
                    </div>
                    <div className="text-xs text-blue-700 space-y-1">
                      {quote.jupiterQuote.routePlan.map((step, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span>{step.swapInfo.label}</span>
                          <span>{step.percent}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              {!statusDisplay && (
                <>
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onConfirm}
                    disabled={timeRemaining === 0}
                    className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      timeRemaining === 0
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {timeRemaining === 0 ? 'Quote Expired' : 'Confirm Swap'}
                  </button>
                </>
              )}
              
              {isProcessing && (
                <div className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>Processing...</span>
                  </div>
                </div>
              )}
              
              {isCompleted && (
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Close
                </button>
              )}
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
}