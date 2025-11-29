'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircleIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import { Token } from '@/types';
import { TokenLogo } from './TokenLogo';
import { formatTokenAmount } from '@/utils/formatting';

interface BalanceChange {
  id: string;
  token: Token;
  oldBalance: bigint;
  newBalance: bigint;
  timestamp: number;
}

interface BalanceChangeNotificationProps {
  changes: BalanceChange[];
  onDismiss: (id: string) => void;
  autoHideDuration?: number;
}

export function BalanceChangeNotification({
  changes,
  onDismiss,
  autoHideDuration = 5000
}: BalanceChangeNotificationProps) {
  const [visibleChanges, setVisibleChanges] = useState<BalanceChange[]>([]);

  useEffect(() => {
    setVisibleChanges(changes);

    // Auto-hide notifications
    if (autoHideDuration > 0) {
      const timeouts = changes.map(change => 
        setTimeout(() => onDismiss(change.id), autoHideDuration)
      );

      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    }
  }, [changes, onDismiss, autoHideDuration]);

  if (visibleChanges.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {visibleChanges.map((change) => {
        const isIncrease = change.newBalance > change.oldBalance;
        const difference = isIncrease 
          ? change.newBalance - change.oldBalance
          : change.oldBalance - change.newBalance;

        return (
          <div
            key={change.id}
            className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm animate-slide-in-right"
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <TokenLogo token={change.token} size="sm" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium text-gray-900">
                    {change.token.symbol} Balance Updated
                  </p>
                  {isIncrease ? (
                    <ArrowUpIcon className="w-4 h-4 text-green-500" />
                  ) : (
                    <ArrowDownIcon className="w-4 h-4 text-red-500" />
                  )}
                </div>
                
                <div className="mt-1">
                  <p className="text-xs text-gray-500">
                    {isIncrease ? '+' : '-'}
                    {formatTokenAmount(difference, change.token.decimals)} {change.token.symbol}
                  </p>
                  <p className="text-xs text-gray-400">
                    New balance: {formatTokenAmount(change.newBalance, change.token.decimals)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onDismiss(change.id)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600"
              >
                <CheckCircleIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}