'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Token } from '@/types';
import { TokenLogo } from '@/components/tokens/TokenLogo';

interface AmountInputCardProps {
  isExpanded: boolean;
  tokenA: Token | null;
  tokenB: Token | null;
  amountA: string;
  amountB: string;
  balanceA: bigint;
  balanceB: bigint;
  poolRatio: number;
  onAmountAChange: (value: string) => void;
  onAmountBChange: (value: string) => void;
  onMaxA: () => void;
  onMaxB: () => void;
  lpTokensToReceive: bigint;
  shareOfPool: number;
  priceImpact: number;
  validationErrors: Record<string, string>;
  isLoadingBalances?: boolean;
}

export function AmountInputCard({
  isExpanded,
  tokenA,
  tokenB,
  amountA,
  amountB,
  balanceA,
  balanceB,
  poolRatio,
  onAmountAChange,
  onAmountBChange,
  onMaxA,
  onMaxB,
  lpTokensToReceive,
  shareOfPool,
  priceImpact,
  validationErrors,
  isLoadingBalances = false,
}: AmountInputCardProps) {
  const amountAInputRef = useRef<HTMLInputElement>(null);
  const amountBInputRef = useRef<HTMLInputElement>(null);
  
  // Detect mobile for optimized animations
  const [isMobile, setIsMobile] = React.useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Animation duration based on device
  const animationDuration = isMobile ? 0.25 : 0.4;
  const opacityDelay = isMobile ? 0.05 : 0.1;

  // Auto-focus first amount input when expanded
  useEffect(() => {
    if (isExpanded && amountAInputRef.current) {
      amountAInputRef.current.focus();
    }
  }, [isExpanded]);

  // Format balance for display
  const formatBalance = (balance: bigint, decimals: number): string => {
    const value = Number(balance) / Math.pow(10, decimals);
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  // Format LP tokens for display
  const formatLPTokens = (tokens: bigint): string => {
    const value = Number(tokens) / Math.pow(10, 9); // Assuming 9 decimals for LP tokens
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Validate input (numbers only, decimal support)
  const handleInputChange = (
    value: string,
    onChange: (value: string) => void
  ) => {
    // Allow empty string
    if (value === '') {
      onChange('');
      return;
    }

    // Allow only numbers and one decimal point
    const regex = /^\d*\.?\d*$/;
    if (regex.test(value)) {
      onChange(value);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, inputType: 'A' | 'B') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move focus to next input or trigger form submission
      if (inputType === 'A' && amountBInputRef.current) {
        amountBInputRef.current.focus();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Clear the input
      if (inputType === 'A') {
        onAmountAChange('');
      } else {
        onAmountBChange('');
      }
    }
  };

  // Get price impact color
  const getPriceImpactColor = (): string => {
    if (priceImpact < 5) return 'text-green-400';
    if (priceImpact < 15) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <AnimatePresence>
      {isExpanded ? (
        <motion.div
          key="expanded"
          initial={{
            height: 0,
            opacity: 0,
            marginTop: 0,
          }}
          animate={{
            height: 'auto',
            opacity: 1,
            marginTop: 16,
            transition: {
              height: {
                duration: animationDuration,
                ease: [0.25, 0.4, 0.25, 1],
              },
              opacity: {
                duration: animationDuration * 0.75,
                delay: opacityDelay,
              },
            },
          }}
          exit={{
            height: 0,
            opacity: 0,
            marginTop: 0,
            transition: {
              height: {
                duration: animationDuration * 0.75,
                ease: [0.25, 0.4, 0.25, 1],
              },
              opacity: {
                duration: animationDuration * 0.5,
              },
            },
          }}
          style={{ willChange: isExpanded ? 'height, opacity, margin-top' : 'auto' }}
          className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-4 md:p-6 overflow-hidden"
        >
          <h3 className="text-base md:text-lg font-semibold text-white mb-4 md:mb-6">
            Enter Amounts
          </h3>

          {/* Token A Amount Input */}
          {tokenA && (
            <div className="mb-4 md:mb-6">
              <div className="flex items-center gap-2 mb-2">
                <TokenLogo token={tokenA} size="sm" />
                <label
                  htmlFor="amount-a-input"
                  className="text-sm font-medium text-white/70"
                >
                  {tokenA.displaySymbol || tokenA.symbol} Amount
                </label>
              </div>
              <div className="relative">
                <input
                  ref={amountAInputRef}
                  id="amount-a-input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  value={amountA}
                  onChange={(e) =>
                    handleInputChange(e.target.value, onAmountAChange)
                  }
                  onKeyDown={(e) => handleKeyDown(e, 'A')}
                  placeholder="0.0"
                  className={`w-full pr-20 md:pr-20 pl-4 py-4 min-h-[56px] bg-white/5 border ${
                    validationErrors.amountA
                      ? 'border-red-500/50'
                      : 'border-white/10'
                  } rounded-2xl text-white text-lg md:text-2xl font-chakra-petch-regular placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 focus:ring-3 focus:ring-blue-500/10 transition-all`}
                  role="spinbutton"
                  aria-label={`${tokenA.displaySymbol || tokenA.symbol} amount`}
                  aria-describedby={`amount-a-balance ${
                    validationErrors.amountA ? 'amount-a-error' : ''
                  }`}
                  aria-invalid={!!validationErrors.amountA}
                />
                <button
                  type="button"
                  onClick={onMaxA}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 px-4 py-2 md:px-3 md:py-1.5 min-h-[44px] md:min-h-0 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm md:text-xs font-semibold rounded-lg hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-blue-500/30 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  aria-label={`Set maximum ${tokenA.displaySymbol || tokenA.symbol} amount`}
                >
                  MAX
                </button>
              </div>
              <div
                id="amount-a-balance"
                className="mt-2 text-sm text-white/60 flex items-center gap-2"
              >
                {isLoadingBalances ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white/60 rounded-full animate-spin" />
                    <span>Loading balance...</span>
                  </>
                ) : (
                  <>Balance: {formatBalance(balanceA, tokenA.decimals)} {tokenA.displaySymbol || tokenA.symbol}</>
                )}
              </div>
              {validationErrors.amountA && (
                <div
                  id="amount-a-error"
                  className="mt-2 text-sm text-red-400"
                  role="alert"
                >
                  {validationErrors.amountA}
                </div>
              )}
            </div>
          )}

          {/* Token B Amount Input */}
          {tokenB && (
            <div className="mb-4 md:mb-6">
              <div className="flex items-center gap-2 mb-2">
                <TokenLogo token={tokenB} size="sm" />
                <label
                  htmlFor="amount-b-input"
                  className="text-sm font-medium text-white/70"
                >
                  {tokenB.displaySymbol || tokenB.symbol} Amount
                </label>
              </div>
              <div className="relative">
                <input
                  ref={amountBInputRef}
                  id="amount-b-input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  value={amountB}
                  onChange={(e) =>
                    handleInputChange(e.target.value, onAmountBChange)
                  }
                  onKeyDown={(e) => handleKeyDown(e, 'B')}
                  placeholder="0.0"
                  className={`w-full pr-20 md:pr-20 pl-4 py-4 min-h-[56px] bg-white/5 border ${
                    validationErrors.amountB
                      ? 'border-red-500/50'
                      : 'border-white/10'
                  } rounded-2xl text-white text-lg md:text-2xl font-chakra-petch-regular placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 focus:ring-3 focus:ring-blue-500/10 transition-all`}
                  role="spinbutton"
                  aria-label={`${tokenB.displaySymbol || tokenB.symbol} amount`}
                  aria-describedby={`amount-b-balance ${
                    validationErrors.amountB ? 'amount-b-error' : ''
                  }`}
                  aria-invalid={!!validationErrors.amountB}
                />
                <button
                  type="button"
                  onClick={onMaxB}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 px-4 py-2 md:px-3 md:py-1.5 min-h-[44px] md:min-h-0 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm md:text-xs font-semibold rounded-lg hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-blue-500/30 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  aria-label={`Set maximum ${tokenB.displaySymbol || tokenB.symbol} amount`}
                >
                  MAX
                </button>
              </div>
              <div
                id="amount-b-balance"
                className="mt-2 text-sm text-white/60 flex items-center gap-2"
              >
                {isLoadingBalances ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white/60 rounded-full animate-spin" />
                    <span>Loading balance...</span>
                  </>
                ) : (
                  <>Balance: {formatBalance(balanceB, tokenB.decimals)} {tokenB.displaySymbol || tokenB.symbol}</>
                )}
              </div>
              {validationErrors.amountB && (
                <div
                  id="amount-b-error"
                  className="mt-2 text-sm text-red-400"
                  role="alert"
                >
                  {validationErrors.amountB}
                </div>
              )}
            </div>
          )}

          {/* Pool Information Display */}
          <div
            className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 rounded-2xl p-4"
            role="region"
            aria-label="Liquidity details"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 mb-3">
              <svg
                className="w-5 h-5 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h4 className="text-sm font-semibold text-white">
                Liquidity Details
              </h4>
            </div>

            <div className="space-y-3">
              {/* LP Tokens to Receive */}
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-1 md:gap-0">
                <span className="text-sm text-white/70">LP Tokens</span>
                <span className="text-sm md:text-sm font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {formatLPTokens(lpTokensToReceive)}
                </span>
              </div>

              {/* Share of Pool */}
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-1 md:gap-0">
                <span className="text-sm text-white/70">Share of Pool</span>
                <span className="text-sm md:text-sm font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {shareOfPool.toFixed(4)}%
                </span>
              </div>

              {/* Price Impact */}
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-1 md:gap-0">
                <span className="text-sm text-white/70">Price Impact</span>
                <span
                  className={`text-sm md:text-sm font-semibold ${getPriceImpactColor()}`}
                >
                  {priceImpact.toFixed(2)}%
                </span>
              </div>

              {/* Pool Ratio Info */}
              {tokenA && tokenB && poolRatio > 0 && (
                <div className="pt-3 border-t border-white/10">
                  <div className="text-xs text-white/50 break-words">
                    Pool Ratio: 1 {tokenA.displaySymbol || tokenA.symbol} ≈{' '}
                    {poolRatio.toFixed(6)} {tokenB.displaySymbol || tokenB.symbol}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* General Validation Errors */}
          {validationErrors.general && (
            <div
              className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400"
              role="alert"
            >
              {validationErrors.general}
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          key="collapsed"
          initial={{
            height: 0,
            opacity: 0,
          }}
          animate={{
            height: 0,
            opacity: 0,
          }}
          className="overflow-hidden"
        >
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 text-center text-white/50 text-sm">
            Select both tokens to continue...
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
