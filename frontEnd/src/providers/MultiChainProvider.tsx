'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { DEFAULT_NETWORK, getNetworkByChainId, type EVMNetwork } from '@/config/evm-networks';

export type ChainType = 'evm' | 'solana';

interface MultiChainContextType {
  // Current chain state
  chainType: ChainType;
  currentChainId: number;
  currentNetwork: EVMNetwork | null;

  // Chain switching
  switchToEVM: (network: EVMNetwork) => Promise<void>;
  switchToSolana: () => void;

  // Loading states
  isSwitching: boolean;
  error: string | null;
}

const MultiChainContext = createContext<MultiChainContextType | undefined>(undefined);

interface MultiChainProviderProps {
  children: ReactNode;
  defaultChain?: 'evm' | 'solana';
}

export function MultiChainProvider({ children, defaultChain = 'evm' }: MultiChainProviderProps) {
  const [chainType, setChainType] = useState<ChainType>(defaultChain);
  const [currentChainId, setCurrentChainId] = useState<number>(DEFAULT_NETWORK.chainId);
  const [currentNetwork, setCurrentNetwork] = useState<EVMNetwork | null>(DEFAULT_NETWORK);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Switch to EVM chain
  const switchToEVM = useCallback(async (network: EVMNetwork) => {
    setIsSwitching(true);
    setError(null);

    try {
      // Check if MetaMask is installed
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          // Try to switch to the network
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${network.chainId.toString(16)}` }],
          });
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: `0x${network.chainId.toString(16)}`,
                    chainName: network.name,
                    nativeCurrency: network.nativeCurrency,
                    rpcUrls: network.rpcUrls,
                    blockExplorerUrls: network.blockExplorerUrls,
                  },
                ],
              });
            } catch (addError) {
              console.error('Error adding chain:', addError);
              throw new Error('Failed to add network to wallet');
            }
          } else {
            throw switchError;
          }
        }

        setChainType('evm');
        setCurrentChainId(network.chainId);
        setCurrentNetwork(network);

        // Store preference
        if (typeof window !== 'undefined') {
          localStorage.setItem('preferredChainType', 'evm');
          localStorage.setItem('preferredChainId', network.chainId.toString());
        }
      } else {
        throw new Error('MetaMask is not installed');
      }
    } catch (err: any) {
      console.error('Chain switch error:', err);
      setError(err.message || 'Failed to switch chain');
    } finally {
      setIsSwitching(false);
    }
  }, []);

  // Switch to Solana
  const switchToSolana = useCallback(() => {
    setChainType('solana');
    setCurrentNetwork(null);

    // Store preference
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredChainType', 'solana');
    }
  }, []);

  // Listen to chain changes from MetaMask
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleChainChanged = (chainIdHex: string) => {
      const chainId = parseInt(chainIdHex, 16);
      const network = getNetworkByChainId(chainId);

      if (network) {
        setCurrentChainId(chainId);
        setCurrentNetwork(network);
        setChainType('evm');
      }
    };

    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
    };
  }, []);

  // Restore preferred chain on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const preferredType = localStorage.getItem('preferredChainType') as ChainType | null;
    const preferredChainId = localStorage.getItem('preferredChainId');

    if (preferredType === 'evm' && preferredChainId) {
      const network = getNetworkByChainId(parseInt(preferredChainId));
      if (network) {
        setChainType('evm');
        setCurrentChainId(network.chainId);
        setCurrentNetwork(network);
      }
    } else if (preferredType === 'solana') {
      setChainType('solana');
      setCurrentNetwork(null);
    }
  }, []);

  const value: MultiChainContextType = {
    chainType,
    currentChainId,
    currentNetwork,
    switchToEVM,
    switchToSolana,
    isSwitching,
    error,
  };

  return (
    <MultiChainContext.Provider value={value}>
      {children}
    </MultiChainContext.Provider>
  );
}

export function useMultiChain() {
  const context = useContext(MultiChainContext);
  if (context === undefined) {
    throw new Error('useMultiChain must be used within a MultiChainProvider');
  }
  return context;
}

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}
