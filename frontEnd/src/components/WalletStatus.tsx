'use client';

import React, { useState } from 'react';
import { WalletIcon, Cog6ToothIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useAccount, useBalance, useChainId } from 'wagmi';
import { formatEther } from 'viem';
import { getNetworkByChainId } from '../config/evm-networks';
import { WalletConnectButton } from './wallet/WalletConnectButton';

interface WalletStatusProps {
  showNetworkSwitcher?: boolean;
  showBalance?: boolean;
  className?: string;
}

export const WalletStatus: React.FC<WalletStatusProps> = ({
  showNetworkSwitcher = true,
  showBalance = true,
  className = '',
}) => {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({ address });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const currentNetwork = getNetworkByChainId(chainId);
  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className={`flex flex-col space-y-4 p-6 bg-white rounded-lg shadow-md ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <WalletIcon className="h-6 w-6 mr-2" />
          Wallet Status
        </h2>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          title="Advanced settings"
        >
          <Cog6ToothIcon className="h-5 w-5" />
        </button>
      </div>
      
      <div className="space-y-3">
        {/* Network Information */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Network:</span>
          <div className="flex items-center">
            <div 
              className="w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: currentNetwork?.color || '#6E54FF' }}
            />
            <span className="text-sm text-gray-900">{currentNetwork?.displayName || 'Unknown'}</span>
          </div>
        </div>
        
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${
              isConnected ? 'bg-green-400' : 'bg-red-400'
            }`} />
            <span className={`text-sm font-medium ${
              isConnected ? 'text-green-600' : 'text-red-600'
            }`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        {/* Wallet Information */}
        {connector && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Wallet:</span>
            <span className="text-sm text-gray-900">{connector.name}</span>
          </div>
        )}
        
        {/* Address */}
        {address && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Address:</span>
            <button
              onClick={() => navigator.clipboard.writeText(address)}
              className="text-sm text-gray-900 font-mono hover:text-indigo-600 transition-colors"
              title="Click to copy"
            >
              {shortenAddress(address)}
            </button>
          </div>
        )}

        {/* Balance */}
        {isConnected && showBalance && balance && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Balance:</span>
            <span className="text-sm text-gray-900 font-mono">
              {parseFloat(formatEther(balance.value)).toFixed(4)} {balance.symbol}
            </span>
          </div>
        )}

        {/* Chain ID */}
        {showAdvanced && (
          <div className="border-t border-gray-200 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Chain ID:</span>
              <span className="text-xs text-gray-700">{chainId}</span>
            </div>
            {address && (
              <div className="flex flex-col space-y-1">
                <span className="text-xs font-medium text-gray-500">Full Address:</span>
                <span className="text-xs text-gray-700 font-mono break-all">{address}</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Connection Button */}
      <div className="pt-2">
        <WalletConnectButton 
          className="w-full justify-center"
          showBalance={false}
          showNetwork={showNetworkSwitcher}
        />
      </div>

      {/* Explorer Link */}
      {isConnected && address && currentNetwork && (
        <div className="pt-2 border-t border-gray-200">
          <a
            href={`${currentNetwork.blockExplorerUrls[0]}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            View on Explorer →
          </a>
        </div>
      )}
    </div>
  );
};
