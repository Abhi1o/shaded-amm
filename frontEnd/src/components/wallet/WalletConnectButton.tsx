'use client';

import React from 'react';
import { ChevronDownIcon, WalletIcon } from '@heroicons/react/24/outline';
import { useAccount, useConnect, useDisconnect, useBalance, useChainId } from 'wagmi';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import { getNetworkByChainId } from '../../config/evm-networks';
import { formatEther } from 'viem';

interface WalletConnectButtonProps {
  className?: string;
  showBalance?: boolean;
  showNetwork?: boolean;
}

export const WalletConnectButton: React.FC<WalletConnectButtonProps> = ({
  className = '',
  showBalance = true,
  showNetwork = true,
}) => {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { data: balance } = useBalance({ address });

  const currentNetwork = getNetworkByChainId(chainId);
  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isConnected) {
    return (
      <Menu as="div" className="relative inline-block text-left">
        <MenuButton
          disabled={isPending}
          className={`
            relative inline-flex items-center px-5 py-2 text-sm font-semibold uppercase tracking-wider
            text-white bg-white/10 hover:bg-white/20 rounded-lg border border-white/20
            focus:outline-none focus:ring-2 focus:ring-white/50
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            ${className}
          `}
        >
          {isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <WalletIcon className="h-4 w-4 mr-2" />
              <span>Connect Wallet</span>
            </>
          )}
        </MenuButton>

        <MenuItems className="absolute right-0 mt-2 w-56 rounded-lg backdrop-blur-xl bg-black/95 border border-white/10 shadow-xl focus:outline-none z-50 overflow-hidden">
          <div className="py-1">
            <div className="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-white/10">
              Select Wallet
            </div>
            {connectors.map((connector: any) => (
              <MenuItem key={connector.id}>
                {() => (
                  <button
                    onClick={() => connect({ connector })}
                    className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors duration-150"
                  >
                    <WalletIcon className="h-4 w-4 mr-3 text-gray-400" />
                    {connector.name}
                  </button>
                )}
              </MenuItem>
            ))}
          </div>
        </MenuItems>
      </Menu>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Wallet Info */}
      <Menu as="div" className="relative inline-block text-left">
        <MenuButton className="inline-flex items-center px-4 py-2 border border-white/20 bg-white/10 hover:bg-white/20 text-sm font-medium rounded-lg text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50">
          <WalletIcon className="h-4 w-4 mr-2" />
          {showBalance && balance && (
            <span className="mr-2 font-semibold">{parseFloat(formatEther(balance.value)).toFixed(4)} {balance.symbol}</span>
          )}
          <span className="font-mono text-xs">{shortenAddress(address!)}</span>
          <ChevronDownIcon className="ml-2 h-4 w-4 text-gray-400" />
        </MenuButton>

        <MenuItems className="absolute right-0 mt-2 w-64 rounded-lg backdrop-blur-xl bg-black/95 border border-white/10 shadow-xl focus:outline-none z-50 overflow-hidden">
          <div className="py-1">
            <div className="px-4 py-3 border-b border-white/10">
              <div className="text-xs text-gray-400 mb-1">Connected Network</div>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: currentNetwork?.color || '#6E54FF' }}
                />
                <div className="text-sm font-semibold text-white">
                  {currentNetwork?.displayName || 'Unknown Network'}
                </div>
              </div>
              <div className="text-xs text-gray-400 font-mono break-all mt-2 bg-black/30 px-2 py-1.5 rounded">{address}</div>
            </div>
            
            <MenuItem>
              {() => (
                <button
                  onClick={() => navigator.clipboard.writeText(address!)}
                  className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors duration-150"
                >
                  <span className="mr-3">📋</span>
                  Copy Address
                </button>
              )}
            </MenuItem>
            
            <MenuItem>
              {() => (
                <a
                  href={`${currentNetwork?.blockExplorerUrls[0]}/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors duration-150"
                >
                  <span className="mr-3">🔍</span>
                  View on Explorer
                </a>
              )}
            </MenuItem>
            
            <div className="border-t border-white/10">
              <MenuItem>
                {() => (
                  <button
                    onClick={() => disconnect()}
                    className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors duration-150"
                  >
                    <span className="mr-3">🚪</span>
                    Disconnect
                  </button>
                )}
              </MenuItem>
            </div>
          </div>
        </MenuItems>
      </Menu>
    </div>
  );
};
