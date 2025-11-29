'use client';

import React from 'react';
import { useChainId } from 'wagmi';
import { getDexConfig, isChainSupported, getChainName } from '@/config/dex-config-loader';
import { getNetworkColor } from '@/config/evm-networks';

interface ChainIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

/**
 * Chain Indicator Component
 * 
 * Displays the current connected chain with visual feedback
 * Updates automatically when user switches chains
 */
export function ChainIndicator({ showDetails = true, className = '' }: ChainIndicatorProps) {
  const chainId = useChainId();
  const isSupported = isChainSupported(chainId);
  const chainColor = getNetworkColor(chainId);

  if (!isSupported) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 backdrop-blur-xl bg-red-500/20 border border-red-500/50 rounded-full ${className}`}>
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        <span className="text-sm font-medium text-red-300">
          Unsupported Chain
        </span>
      </div>
    );
  }

  try {
    const config = getDexConfig(chainId);
    const chainName = getChainName(chainId);

    return (
      <div 
        className={`flex items-center gap-2 px-3 py-2 backdrop-blur-xl bg-white/5 border border-white/10 rounded-full hover:border-white/20 transition-all ${className}`}
        style={{ borderColor: `${chainColor}40` }}
      >
        {/* Animated Status Dot */}
        <div 
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: chainColor }}
        />
        
        {/* Chain Name */}
        <span className="text-sm font-medium text-white">
          {chainName}
        </span>

        {/* Details */}
        {showDetails && (
          <>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-400">
              {config.multiShardStats.totalShards} shards
            </span>
          </>
        )}
      </div>
    );
  } catch (error) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 backdrop-blur-xl bg-yellow-500/20 border border-yellow-500/50 rounded-full ${className}`}>
        <div className="w-2 h-2 bg-yellow-500 rounded-full" />
        <span className="text-sm font-medium text-yellow-300">
          Unknown Chain ({chainId})
        </span>
      </div>
    );
  }
}

/**
 * Compact Chain Badge
 * Minimal version for tight spaces
 */
export function ChainBadge() {
  const chainId = useChainId();
  const isSupported = isChainSupported(chainId);
  const chainColor = getNetworkColor(chainId);

  if (!isSupported) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 backdrop-blur-xl bg-red-500/20 border border-red-500/50 rounded-lg">
        <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
        <span className="text-xs font-medium text-red-300">Unsupported</span>
      </div>
    );
  }

  const chainName = getChainName(chainId);
  const shortName = chainName.split(' ')[0]; // "Monad" or "RiseChain"

  return (
    <div 
      className="flex items-center gap-1.5 px-2 py-1 backdrop-blur-xl bg-white/5 border border-white/10 rounded-lg"
      style={{ borderColor: `${chainColor}40` }}
    >
      <div 
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ backgroundColor: chainColor }}
      />
      <span className="text-xs font-medium text-white">{shortName}</span>
    </div>
  );
}

/**
 * Chain Switcher Component
 * Allows users to switch between supported chains
 */
export function ChainSwitcher() {
  const chainId = useChainId();
  const { switchToEVM } = useMultiChain();
  const [isSwitching, setIsSwitching] = React.useState(false);

  const handleSwitch = async (targetChainId: number) => {
    if (targetChainId === chainId) return;
    
    setIsSwitching(true);
    try {
      const network = getNetworkByChainId(targetChainId);
      if (network) {
        await switchToEVM(network);
      }
    } catch (error) {
      console.error('Failed to switch chain:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleSwitch(10143)}
        disabled={isSwitching || chainId === 10143}
        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
          chainId === 10143
            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
            : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:border-white/20'
        }`}
      >
        Monad
      </button>
      <button
        onClick={() => handleSwitch(11155931)}
        disabled={isSwitching || chainId === 11155931}
        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
          chainId === 11155931
            ? 'bg-green-500/20 text-green-300 border border-green-500/50'
            : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:border-white/20'
        }`}
      >
        RiseChain
      </button>
    </div>
  );
}

// Import for ChainSwitcher
import { useMultiChain } from '@/providers/MultiChainProvider';
import { getNetworkByChainId } from '@/config/evm-networks';
