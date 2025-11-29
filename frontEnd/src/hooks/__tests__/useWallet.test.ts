import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWallet } from '../useWallet';
import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletStore } from '../../stores/walletStore';
import { useSolanaNetwork } from '../../providers/SolanaWalletProvider';
import { mockPublicKey, MockPhantomAdapter } from '../../test/mocks/walletMocks';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

// Mock the dependencies
vi.mock('@solana/wallet-adapter-react');
vi.mock('../../stores/walletStore');
vi.mock('../../providers/SolanaWalletProvider');

describe('useWallet', () => {
  const mockPhantomAdapter = new MockPhantomAdapter();
  
  const mockUseSolanaWallet = {
    publicKey: null,
    connected: false,
    connecting: false,
    disconnect: vi.fn(),
    wallet: null,
  };

  const mockConnection = {
    getBalance: vi.fn(),
  };

  const mockUseConnection = {
    connection: mockConnection,
  };

  const mockWalletStore = {
    isConnected: false,
    address: null,
    publicKey: null,
    solBalance: BigInt(0),
    connectionAttempts: 0,
    lastConnectionAttempt: null,
    setWallet: vi.fn(),
    setConnecting: vi.fn(),
    updateBalance: vi.fn(),
    disconnect: vi.fn(),
    resetConnectionAttempts: vi.fn(),
  };

  const mockUseSolanaNetwork = {
    network: 'devnet',
  };

  beforeEach(() => {
    vi.mocked(useSolanaWallet).mockReturnValue(mockUseSolanaWallet as any);
    vi.mocked(useConnection).mockReturnValue(mockUseConnection as any);
    vi.mocked(useWalletStore).mockReturnValue(mockWalletStore as any);
    vi.mocked(useSolanaNetwork).mockReturnValue(mockUseSolanaNetwork as any);
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Wallet State Synchronization', () => {
    it('should sync connected wallet state with store', () => {
      // Mock connected state
      const connectedMockWallet = {
        ...mockUseSolanaWallet,
        connected: true,
        publicKey: mockPublicKey,
        wallet: { adapter: mockPhantomAdapter },
      };
      
      vi.mocked(useSolanaWallet).mockReturnValue(connectedMockWallet as any);

      renderHook(() => useWallet());

      expect(mockWalletStore.setWallet).toHaveBeenCalledWith({
        publicKey: mockPublicKey,
        address: mockPublicKey.toString(),
        isConnected: true,
        isConnecting: false,
        walletName: 'Phantom',
      });
      
      expect(mockWalletStore.resetConnectionAttempts).toHaveBeenCalled();
    });

    it('should sync disconnected state with store', () => {
      // Mock disconnected state with store showing connected
      const disconnectedMockWallet = {
        ...mockUseSolanaWallet,
        connected: false,
        connecting: false,
      };
      
      const connectedStore = {
        ...mockWalletStore,
        isConnected: true,
      };
      
      vi.mocked(useSolanaWallet).mockReturnValue(disconnectedMockWallet as any);
      vi.mocked(useWalletStore).mockReturnValue(connectedStore as any);

      renderHook(() => useWallet());

      expect(mockWalletStore.setWallet).toHaveBeenCalledWith({
        publicKey: null,
        address: null,
        isConnected: false,
        isConnecting: false,
        walletName: null,
        walletType: null,
      });
    });

    it('should sync connecting state', () => {
      const connectingMockWallet = {
        ...mockUseSolanaWallet,
        connecting: true,
      };
      
      vi.mocked(useSolanaWallet).mockReturnValue(connectingMockWallet as any);

      renderHook(() => useWallet());

      expect(mockWalletStore.setConnecting).toHaveBeenCalledWith(true);
    });

    it('should not disconnect store when wallet is connecting', () => {
      const connectingMockWallet = {
        ...mockUseSolanaWallet,
        connected: false,
        connecting: true, // Still connecting
      };
      
      vi.mocked(useSolanaWallet).mockReturnValue(connectingMockWallet as any);

      renderHook(() => useWallet());

      // Should not call setWallet to disconnect when still connecting
      expect(mockWalletStore.setWallet).not.toHaveBeenCalledWith(
        expect.objectContaining({
          isConnected: false,
        })
      );
    });
  });

  describe('Balance Management', () => {
    it('should fetch and update SOL balance when wallet connects', async () => {
      const mockBalance = 1000000000; // 1 SOL in lamports
      mockConnection.getBalance.mockResolvedValue(mockBalance);
      
      const connectedMockWallet = {
        ...mockUseSolanaWallet,
        connected: true,
        publicKey: mockPublicKey,
      };
      
      vi.mocked(useSolanaWallet).mockReturnValue(connectedMockWallet as any);

      renderHook(() => useWallet());

      // Wait for balance update
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockConnection.getBalance).toHaveBeenCalledWith(mockPublicKey);
      expect(mockWalletStore.updateBalance).toHaveBeenCalledWith(BigInt(mockBalance));
    });

    it('should handle balance fetch errors gracefully', async () => {
      const balanceError = new Error('Failed to fetch balance');
      mockConnection.getBalance.mockRejectedValue(balanceError);
      
      const connectedMockWallet = {
        ...mockUseSolanaWallet,
        connected: true,
        publicKey: mockPublicKey,
      };
      
      vi.mocked(useSolanaWallet).mockReturnValue(connectedMockWallet as any);

      // Mock console.error to avoid test output noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderHook(() => useWallet());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch SOL balance:', balanceError);
      consoleSpy.mockRestore();
    });

    it('should format SOL balance correctly', () => {
      const storeWithBalance = {
        ...mockWalletStore,
        solBalance: BigInt(1500000000), // 1.5 SOL
      };
      
      vi.mocked(useWalletStore).mockReturnValue(storeWithBalance as any);

      const { result } = renderHook(() => useWallet());

      expect(result.current.formattedSolBalance).toBe('1.5000');
    });
  });

  describe('Wallet Disconnection', () => {
    it('should handle wallet disconnection successfully', async () => {
      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.disconnect();
      });

      expect(mockUseSolanaWallet.disconnect).toHaveBeenCalled();
      expect(mockWalletStore.disconnect).toHaveBeenCalled();
    });

    it('should force disconnect store even if wallet disconnect fails', async () => {
      const disconnectError = new Error('Disconnect failed');
      mockUseSolanaWallet.disconnect.mockRejectedValue(disconnectError);
      
      // Mock console.error to avoid test output noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useWallet());

      await act(async () => {
        await result.current.disconnect();
      });

      expect(mockWalletStore.disconnect).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to disconnect wallet:', disconnectError);
      consoleSpy.mockRestore();
    });
  });

  describe('Reconnection Logic', () => {
    it('should allow reconnection when under attempt limit', () => {
      const storeWithAttempts = {
        ...mockWalletStore,
        connectionAttempts: 2,
        lastConnectionAttempt: Date.now() - 10000, // 10 seconds ago
      };
      
      vi.mocked(useWalletStore).mockReturnValue(storeWithAttempts as any);

      const { result } = renderHook(() => useWallet());

      expect(result.current.canReconnect).toBe(true);
    });

    it('should prevent reconnection when over attempt limit within cooldown', () => {
      const storeWithMaxAttempts = {
        ...mockWalletStore,
        connectionAttempts: 3,
        lastConnectionAttempt: Date.now() - 60000, // 1 minute ago (within 5 min cooldown)
      };
      
      vi.mocked(useWalletStore).mockReturnValue(storeWithMaxAttempts as any);

      const { result } = renderHook(() => useWallet());

      expect(result.current.canReconnect).toBe(false);
    });

    it('should allow reconnection after cooldown period', () => {
      const storeAfterCooldown = {
        ...mockWalletStore,
        connectionAttempts: 3,
        lastConnectionAttempt: Date.now() - 6 * 60 * 1000, // 6 minutes ago (after 5 min cooldown)
      };
      
      vi.mocked(useWalletStore).mockReturnValue(storeAfterCooldown as any);

      const { result } = renderHook(() => useWallet());

      expect(result.current.canReconnect).toBe(true);
    });
  });

  describe('Computed Properties', () => {
    it('should return correct connection status', () => {
      const connectedStore = {
        ...mockWalletStore,
        isConnected: true,
        address: mockPublicKey.toString(),
      };
      
      vi.mocked(useWalletStore).mockReturnValue(connectedStore as any);

      const { result } = renderHook(() => useWallet());

      expect(result.current.isConnected).toBe(true);
    });

    it('should return false for connection status when address is missing', () => {
      const partiallyConnectedStore = {
        ...mockWalletStore,
        isConnected: true,
        address: null, // Missing address
      };
      
      vi.mocked(useWalletStore).mockReturnValue(partiallyConnectedStore as any);

      const { result } = renderHook(() => useWallet());

      expect(result.current.isConnected).toBe(false);
    });

    it('should return network information', () => {
      const { result } = renderHook(() => useWallet());

      expect(result.current.network).toBe('devnet');
    });

    it('should return raw Solana wallet data', () => {
      const { result } = renderHook(() => useWallet());

      expect(result.current.solanaWallet).toEqual({
        publicKey: mockUseSolanaWallet.publicKey,
        connected: mockUseSolanaWallet.connected,
        connecting: mockUseSolanaWallet.connecting,
        wallet: mockUseSolanaWallet.wallet,
      });
    });
  });
});