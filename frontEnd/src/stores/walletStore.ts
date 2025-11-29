import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WalletState, SolanaCluster, WalletType } from '@/types';
import { PublicKey } from '@solana/web3.js';

interface WalletStore extends WalletState {
  // Actions
  setWallet: (wallet: Partial<WalletState>) => void;
  updateBalance: (solBalance: bigint) => void;
  updateTokenAccounts: (tokenAccounts: any[]) => void;
  setConnecting: (isConnecting: boolean) => void;
  setCluster: (cluster: SolanaCluster) => void;
  disconnect: () => void;
  
  // Connection management
  connectionAttempts: number;
  lastConnectionAttempt: number | null;
  connectionError: string | null;
  setConnectionError: (error: string | null) => void;
  incrementConnectionAttempts: () => void;
  resetConnectionAttempts: () => void;
}

const initialState: WalletState = {
  // Connection state
  publicKey: null,
  address: null,
  isConnected: false,
  isConnecting: false,
  
  // Solana network info
  cluster: SolanaCluster.DEVNET,
  
  // Balances
  solBalance: BigInt(0),
  tokenAccounts: [],
  
  // Wallet metadata
  walletType: null,
  walletName: null,
};

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Connection management
      connectionAttempts: 0,
      lastConnectionAttempt: null,
      connectionError: null,
      
      // Actions
      setWallet: (wallet) => set((state) => {
        // Handle PublicKey serialization for persistence
        const updatedWallet = { ...wallet };
        if (wallet.publicKey && typeof wallet.publicKey !== 'string') {
          updatedWallet.address = wallet.publicKey.toString();
        }
        
        return { 
          ...state, 
          ...updatedWallet,
          connectionError: null, // Clear error on successful connection
        };
      }),
      
      updateBalance: (solBalance) => set((state) => ({ 
        ...state, 
        solBalance 
      })),
      
      updateTokenAccounts: (tokenAccounts) => set((state) => ({ 
        ...state, 
        tokenAccounts 
      })),
      
      setConnecting: (isConnecting) => set((state) => ({ 
        ...state, 
        isConnecting,
        connectionError: isConnecting ? null : state.connectionError, // Clear error when starting new connection
      })),
      
      setCluster: (cluster) => set((state) => ({ 
        ...state, 
        cluster 
      })),
      
      setConnectionError: (connectionError) => set((state) => ({ 
        ...state, 
        connectionError,
        isConnecting: false,
      })),
      
      incrementConnectionAttempts: () => set((state) => ({ 
        ...state, 
        connectionAttempts: state.connectionAttempts + 1,
        lastConnectionAttempt: Date.now(),
      })),
      
      resetConnectionAttempts: () => set((state) => ({ 
        ...state, 
        connectionAttempts: 0,
        lastConnectionAttempt: null,
        connectionError: null,
      })),
      
      disconnect: () => set({
        ...initialState,
        cluster: get().cluster, // Preserve cluster selection
        connectionAttempts: 0,
        lastConnectionAttempt: null,
        connectionError: null,
      }),
    }),
    {
      name: 'solana-wallet-store',
      // Custom storage to handle BigInt and PublicKey serialization
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          
          try {
            const parsed = JSON.parse(str);
            // Reconstruct BigInt values
            if (parsed.state?.solBalance) {
              parsed.state.solBalance = BigInt(parsed.state.solBalance);
            }
            // Reconstruct PublicKey if address exists
            if (parsed.state?.address && !parsed.state?.publicKey) {
              try {
                parsed.state.publicKey = new PublicKey(parsed.state.address);
              } catch (error) {
                console.warn('Failed to reconstruct PublicKey from stored address:', error);
                parsed.state.publicKey = null;
              }
            }
            return parsed;
          } catch (error) {
            console.error('Failed to parse stored wallet state:', error);
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            // Convert BigInt to string for storage
            const serializable = {
              ...value,
              state: {
                ...value.state,
                solBalance: value.state?.solBalance?.toString() || '0',
                publicKey: null, // Don't store PublicKey object, use address instead
              }
            };
            localStorage.setItem(name, JSON.stringify(serializable));
          } catch (error) {
            console.error('Failed to store wallet state:', error);
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      // Only persist certain fields
      partialize: (state) => ({
        address: state.address,
        cluster: state.cluster,
        walletType: state.walletType,
        walletName: state.walletName,
        isConnected: false, // Don't persist connection state
        solBalance: state.solBalance,
      } as unknown as WalletStore),
    }
  )
);