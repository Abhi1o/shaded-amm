/**
 * Direct Wallet Connection Hook
 * 
 * Bypasses wagmi's broken state management and connects directly to the wallet
 */

import { useState, useEffect, useCallback } from 'react';
import { usePublicClient, useChainId } from 'wagmi';
import { createWalletClient, custom, type WalletClient } from 'viem';
import { MONAD_TESTNET } from '@/config/evm-networks';

export function useDirectWalletConnection() {
  const publicClient = usePublicClient();
  const chainId = useChainId();
  
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Check if wallet is already connected
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window === 'undefined' || !window.ethereum) {
        return;
      }

      try {
        // Get accounts from MetaMask
        const accounts = await window.ethereum.request({ 
          method: 'eth_accounts' 
        }) as string[];

        if (accounts && accounts.length > 0) {
          console.log('✅ Wallet already connected:', accounts[0]);
          
          // Create wallet client
          const client = createWalletClient({
            account: accounts[0] as `0x${string}`,
            chain: {
              id: MONAD_TESTNET.chainId,
              name: MONAD_TESTNET.name,
              nativeCurrency: MONAD_TESTNET.nativeCurrency,
              rpcUrls: {
                default: { http: MONAD_TESTNET.rpcUrls },
                public: { http: MONAD_TESTNET.rpcUrls },
              },
            },
            transport: custom(window.ethereum),
          });

          setWalletClient(client);
          setAddress(accounts[0]);
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Failed to check wallet connection:', error);
      }
    };

    checkConnection();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return;
    }

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('👛 Accounts changed:', accounts);
      
      if (accounts.length === 0) {
        // Disconnected
        setWalletClient(null);
        setAddress(undefined);
        setIsConnected(false);
      } else {
        // Connected or switched account
        const client = createWalletClient({
          account: accounts[0] as `0x${string}`,
          chain: {
            id: MONAD_TESTNET.chainId,
            name: MONAD_TESTNET.name,
            nativeCurrency: MONAD_TESTNET.nativeCurrency,
            rpcUrls: {
              default: { http: MONAD_TESTNET.rpcUrls },
              public: { http: MONAD_TESTNET.rpcUrls },
            },
          },
          transport: custom(window.ethereum),
        });

        setWalletClient(client);
        setAddress(accounts[0]);
        setIsConnected(true);
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, []);

  // Connect wallet
  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    setIsConnecting(true);

    try {
      console.log('🔌 Connecting wallet...');
      
      // Request accounts
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      console.log('✅ Connected:', accounts[0]);

      // Create wallet client
      const client = createWalletClient({
        account: accounts[0] as `0x${string}`,
        chain: {
          id: MONAD_TESTNET.chainId,
          name: MONAD_TESTNET.name,
          nativeCurrency: MONAD_TESTNET.nativeCurrency,
          rpcUrls: {
            default: { http: MONAD_TESTNET.rpcUrls },
            public: { http: MONAD_TESTNET.rpcUrls },
          },
        },
        transport: custom(window.ethereum),
      });

      setWalletClient(client);
      setAddress(accounts[0]);
      setIsConnected(true);

      return accounts[0];
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setWalletClient(null);
    setAddress(undefined);
    setIsConnected(false);
  }, []);

  // Switch chain
  const switchChain = useCallback(async (targetChainId: number) => {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    try {
      console.log(`🔄 Switching to chain ${targetChainId}...`);
      
      // Try to switch to the chain
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });

      console.log(`✅ Switched to chain ${targetChainId}`);
      return true;
    } catch (error: any) {
      // Chain not added to wallet
      if (error.code === 4902) {
        console.log(`⚠️  Chain ${targetChainId} not found, attempting to add...`);
        
        // Try to add the chain (only works for Monad Testnet in this case)
        if (targetChainId === 10143) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${targetChainId.toString(16)}`,
                chainName: MONAD_TESTNET.name,
                nativeCurrency: MONAD_TESTNET.nativeCurrency,
                rpcUrls: MONAD_TESTNET.rpcUrls,
                blockExplorerUrls: MONAD_TESTNET.blockExplorers?.map(e => e.url),
              }],
            });
            console.log(`✅ Added and switched to chain ${targetChainId}`);
            return true;
          } catch (addError) {
            console.error('Failed to add chain:', addError);
            throw new Error(`Failed to add chain ${targetChainId} to wallet`);
          }
        } else {
          throw new Error(`Chain ${targetChainId} is not configured in your wallet. Please add it manually.`);
        }
      }
      
      // User rejected the request
      if (error.code === 4001) {
        throw new Error('User rejected chain switch request');
      }
      
      console.error('Failed to switch chain:', error);
      throw error;
    }
  }, []);

  return {
    walletClient,
    address,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    switchChain,
    publicClient,
    chainId,
  };
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}
