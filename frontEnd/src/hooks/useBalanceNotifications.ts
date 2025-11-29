'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Token } from '@/types';

interface BalanceChange {
  id: string;
  token: Token;
  oldBalance: bigint;
  newBalance: bigint;
  timestamp: number;
}

interface UseBalanceNotificationsReturn {
  notifications: BalanceChange[];
  addBalanceChange: (token: Token, oldBalance: bigint, newBalance: bigint) => void;
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

export function useBalanceNotifications(): UseBalanceNotificationsReturn {
  const [notifications, setNotifications] = useState<BalanceChange[]>([]);
  const previousBalancesRef = useRef<Record<string, bigint>>({});

  // Add a new balance change notification
  const addBalanceChange = useCallback((token: Token, oldBalance: bigint, newBalance: bigint) => {
    // Only notify if there's a significant change (avoid dust amounts)
    const minChangeThreshold = BigInt(Math.pow(10, Math.max(0, token.decimals - 6))); // 0.000001 of the token
    const difference = newBalance > oldBalance 
      ? newBalance - oldBalance 
      : oldBalance - newBalance;

    if (difference < minChangeThreshold) {
      return;
    }

    const notification: BalanceChange = {
      id: `${token.mint}-${Date.now()}-${Math.random()}`,
      token,
      oldBalance,
      newBalance,
      timestamp: Date.now()
    };

    setNotifications(prev => [...prev, notification]);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 10000);
  }, []);

  // Dismiss a specific notification
  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Track balance changes and create notifications
  const trackBalanceChange = useCallback((token: Token, newBalance: bigint) => {
    const previousBalance = previousBalancesRef.current[token.mint];
    
    if (previousBalance !== undefined && previousBalance !== newBalance) {
      addBalanceChange(token, previousBalance, newBalance);
    }
    
    previousBalancesRef.current[token.mint] = newBalance;
  }, [addBalanceChange]);

  return {
    notifications,
    addBalanceChange,
    dismissNotification,
    clearAllNotifications,
  };
}