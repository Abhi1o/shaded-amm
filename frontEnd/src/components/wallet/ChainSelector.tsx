'use client';

import React, { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { NETWORK_LIST, getNetworkByChainId, type EVMNetwork } from '@/config/evm-networks';

interface ChainSelectorProps {
  currentChainId: number;
  onChainChange: (network: EVMNetwork) => void;
  isChanging?: boolean;
  className?: string;
}

export const ChainSelector: React.FC<ChainSelectorProps> = ({
  currentChainId,
  onChainChange,
  isChanging = false,
  className = '',
}) => {
  const currentNetwork = getNetworkByChainId(currentChainId);

  return (
    <Menu as="div" className={`relative inline-block text-left ${className}`}>
      <div>
        <Menu.Button
          disabled={isChanging}
          className="group relative inline-flex items-center px-5 py-2.5 border-2 border-white/20 bg-gradient-to-r from-white/5 via-white/10 to-white/5 backdrop-blur-xl hover:from-white/10 hover:via-white/15 hover:to-white/10 text-sm font-semibold rounded-xl text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 hover:shadow-xl hover:shadow-blue-500/20"
        >
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-blue-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5 rounded-xl transition-all duration-300" />
          
          {/* Network Color Indicator */}
          <div
            className="relative w-2.5 h-2.5 rounded-full mr-2.5 animate-pulse shadow-lg"
            style={{ 
              backgroundColor: currentNetwork?.color || '#6E54FF',
              boxShadow: `0 0 10px ${currentNetwork?.color || '#6E54FF'}`
            }}
          />

          {/* Network Name */}
          <span className="relative font-bold tracking-wide">
            {isChanging ? 'Switching...' : currentNetwork?.displayName || 'Select Chain'}
          </span>

          <ChevronDownIcon className="relative ml-2 h-4 w-4 text-gray-400 group-hover:text-purple-400 transition-colors duration-300" />
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-150"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-3 w-64 rounded-xl backdrop-blur-2xl bg-black/95 border-2 border-white/20 shadow-2xl shadow-blue-500/20 focus:outline-none z-50 overflow-hidden">
          <div className="py-2">
            <div className="px-5 py-3 border-b border-white/10 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5">
              <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Select Network</div>
            </div>

            {NETWORK_LIST.map((network) => {
              const isActive = network.chainId === currentChainId;

              return (
                <Menu.Item key={network.chainId}>
                  {({ active }) => (
                    <button
                      onClick={() => !isActive && onChainChange(network)}
                      disabled={isActive || isChanging}
                      className={`${
                        active ? 'bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10' : ''
                      } ${
                        isActive ? 'bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border-l-2 border-purple-500' : ''
                      } group flex items-center justify-between w-full px-5 py-3 text-sm transition-all duration-200 disabled:cursor-not-allowed hover:border-l-2 hover:border-purple-500`}
                    >
                      <div className="flex items-center">
                        {/* Network Color Indicator */}
                        <div
                          className="w-3 h-3 rounded-full mr-3 shadow-lg"
                          style={{ 
                            backgroundColor: network.color,
                            boxShadow: `0 0 8px ${network.color}`
                          }}
                        />

                        {/* Network Info */}
                        <div className="text-left">
                          <div className={`font-bold ${isActive ? 'text-white' : 'text-gray-300'}`}>
                            {network.displayName}
                          </div>
                          <div className="text-xs text-gray-500 font-medium">
                            {network.nativeCurrency.symbol}
                          </div>
                        </div>
                      </div>

                      {/* Active Indicator */}
                      {isActive && (
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-lg" style={{ boxShadow: '0 0 8px #4ade80' }} />
                        </div>
                      )}
                    </button>
                  )}
                </Menu.Item>
              );
            })}
          </div>

          {/* Info Footer */}
          <div className="border-t border-white/10 px-5 py-3 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5">
            <div className="text-xs text-gray-400 font-semibold">
              Chain ID: <span className="font-mono text-purple-400 font-bold">{currentChainId}</span>
            </div>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};
