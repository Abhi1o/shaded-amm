'use client';

import React, { useEffect, useState } from 'react';
import { useAccount, useBalance, usePublicClient, useChainId } from 'wagmi';
import { Address, formatUnits } from 'viem';
import { TokenIcon } from '@/components/tokens/TokenIcon';
import { evmApprovalService } from '@/services/evmApprovalService';

interface TokenBalance {
  symbol: string;
  address: string;
  balance: number;
  decimals: number;
  loading: boolean;
}

interface TokenBalancesProps {
  tokens: Array<{ symbol: string; address: string; decimals: number }>;
}

export function TokenBalances({ tokens }: TokenBalancesProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: nativeBalance } = useBalance({ address });
  const [balances, setBalances] = useState<TokenBalance[]>([]);

  useEffect(() => {
    if (!address || !publicClient) {
      setBalances([]);
      return;
    }

    async function fetchBalances() {
      if (!address || !publicClient) return;

      // Fetch token balances
      const balancePromises = tokens.map(async (token) => {
        try {
          const balance = await evmApprovalService.getTokenBalance(
            publicClient,
            token.address as Address,
            address
          );

          return {
            symbol: token.symbol,
            address: token.address,
            balance: Number(formatUnits(balance, token.decimals)),
            decimals: token.decimals,
            loading: false,
          };
        } catch (err) {
          console.error(`Error fetching ${token.symbol} balance:`, err);
          return {
            symbol: token.symbol,
            address: token.address,
            balance: 0,
            decimals: token.decimals,
            loading: false,
          };
        }
      });

      const results = await Promise.all(balancePromises);
      setBalances(results);
    }

    fetchBalances();

    // Refresh every 10 seconds
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [address, publicClient, tokens, chainId]);

  if (!isConnected) {
    return (
      <div className="backdrop-blur-xl bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 text-center">
        <div className="text-yellow-300 text-sm font-medium">
          Connect your wallet to view balances
        </div>
      </div>
    );
  }

  const hasZeroBalances = balances.some((b) => b.balance === 0);

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
      <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
        <span>Your Balances</span>
        {hasZeroBalances && (
          <span className="text-xs text-yellow-400">
            Need test tokens
          </span>
        )}
      </h3>

      {/* Native Balance (MON, ETH, etc) */}
      {nativeBalance && (
        <div className="mb-2 p-2 rounded-xl bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-xs font-bold">
              {nativeBalance.symbol.charAt(0)}
            </div>
            <span className="text-white font-medium text-sm">{nativeBalance.symbol}</span>
          </div>
          <span className="text-white font-mono text-sm">
            {parseFloat(formatUnits(nativeBalance.value, nativeBalance.decimals)).toFixed(4)}
          </span>
        </div>
      )}

      {/* Token Balances */}
      {balances.map((token) => (
        <div
          key={token.address}
          className={`mb-2 p-2 rounded-xl flex items-center justify-between ${
            token.balance === 0
              ? 'bg-red-500/10 border border-red-500/30'
              : 'bg-white/5'
          }`}
        >
          <div className="flex items-center gap-2">
            <TokenIcon symbol={token.symbol} size="sm" />
            <span className="text-white font-medium text-sm">{token.symbol}</span>
            {token.balance === 0 && (
              <span className="text-xs text-red-400">No balance</span>
            )}
          </div>
          <span className="text-white font-mono text-sm">
            {token.loading ? '...' : token.balance.toFixed(4)}
          </span>
        </div>
      ))}

      {hasZeroBalances && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-xs text-gray-400 space-y-1">
            <div className="font-semibold text-yellow-300">⚠️ Missing tokens</div>
            <div>You need test tokens to swap on {chainId === 10143 ? 'Monad' : 'RiseChain'}.</div>
            <div className="mt-2 text-blue-400">
              Contact the team for test tokens
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
