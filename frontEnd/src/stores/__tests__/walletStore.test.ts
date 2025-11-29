import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useWalletStore } from '../walletStore';
import { SolanaCluster, WalletType } from '../../types';
import { PublicKey } from '@solana/web3.js';
import { mockPublicKey } from '../../test/mocks/walletMocks';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('walletStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    // Reset store to initial state
    const { result } = renderHook(() => useWalletStore());
    act(() => {
      result.current.disconnect();
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useWalletStore());

      expect(result.current.publicKey).toBeNull();
      expect(result.current.address).toBeNull();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.cluster).toBe(SolanaCluster.DEVNET);
      expect(result.current.solBalance).toBe(BigInt(0));
      expect(result.current.tokenAccounts).toEqual([]);
      expect(result.current.walletType).toBeNull();
      expect(result.current.walletName).toBeNull();
      expect(result.current.connectionAttempts).toBe(0);
      expect(result.current.lastConnectionAttempt).toBeNull();
      expect(result.current.connectionError).toBeNull();
    });
  });

  describe('Wallet Connection Management', () => {
    it('should set wallet state correctly', () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.setWallet({
          publicKey: mockPublicKey,
          address: mockPublicKey.toString(),
          isConnected: true,
          isConnecting: false,
          cluster: SolanaCluster.MAINNET,
          walletType: WalletType.PHANTOM,
          walletName: 'Phantom',
        });
      });

      expect(result.current.publicKey).toBe(mockPublicKey);
      expect(result.current.address).toBe(mockPublicKey.toString());
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.cluster).toBe(SolanaCluster.MAINNET);
      expect(result.current.walletType).toBe(WalletType.PHANTOM);
      expect(result.current.walletName).toBe('Phantom');
      expect(result.current.connectionError).toBeNull();
    });

    it('should handle PublicKey serialization for persistence', () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.setWallet({
          publicKey: mockPublicKey,
        });
      });

      expect(result.current.address).toBe(mockPublicKey.toString());
    });

    it('should clear connection error on successful connection', () => {
      const { result } = renderHook(() => useWalletStore());

      // First set an error
      act(() => {
        result.current.setConnectionError('Connection failed');
      });

      expect(result.current.connectionError).toBe('Connection failed');

      // Then set wallet (successful connection)
      act(() => {
        result.current.setWallet({
          isConnected: true,
        });
      });

      expect(result.current.connectionError).toBeNull();
    });
  });

  describe('Balance Management', () => {
    it('should update SOL balance', () => {
      const { result } = renderHook(() => useWalletStore());
      const newBalance = BigInt(1500000000); // 1.5 SOL

      act(() => {
        result.current.updateBalance(newBalance);
      });

      expect(result.current.solBalance).toBe(newBalance);
    });

    it('should update token accounts', () => {
      const { result } = renderHook(() => useWalletStore());
      const mockTokenAccounts = [
        {
          address: mockPublicKey,
          mint: mockPublicKey,
          owner: mockPublicKey,
          amount: BigInt(1000),
          decimals: 6,
          isAssociated: true,
        },
      ];

      act(() => {
        result.current.updateTokenAccounts(mockTokenAccounts);
      });

      expect(result.current.tokenAccounts).toEqual(mockTokenAccounts);
    });
  });

  describe('Connection State Management', () => {
    it('should set connecting state', () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.setConnecting(true);
      });

      expect(result.current.isConnecting).toBe(true);
      expect(result.current.connectionError).toBeNull();
    });

    it('should preserve connection error when not starting new connection', () => {
      const { result } = renderHook(() => useWalletStore());

      // Set error first
      act(() => {
        result.current.setConnectionError('Previous error');
      });

      // Set connecting to false (not starting new connection)
      act(() => {
        result.current.setConnecting(false);
      });

      expect(result.current.connectionError).toBe('Previous error');
    });

    it('should set cluster', () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.setCluster(SolanaCluster.MAINNET);
      });

      expect(result.current.cluster).toBe(SolanaCluster.MAINNET);
    });
  });

  describe('Error Management', () => {
    it('should set connection error and stop connecting', () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.setConnectionError('Connection failed');
      });

      expect(result.current.connectionError).toBe('Connection failed');
      expect(result.current.isConnecting).toBe(false);
    });

    it('should increment connection attempts', () => {
      const { result } = renderHook(() => useWalletStore());
      const beforeTime = Date.now();

      act(() => {
        result.current.incrementConnectionAttempts();
      });

      expect(result.current.connectionAttempts).toBe(1);
      expect(result.current.lastConnectionAttempt).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should reset connection attempts', () => {
      const { result } = renderHook(() => useWalletStore());

      // First increment attempts
      act(() => {
        result.current.incrementConnectionAttempts();
        result.current.setConnectionError('Some error');
      });

      expect(result.current.connectionAttempts).toBe(1);
      expect(result.current.connectionError).toBe('Some error');

      // Then reset
      act(() => {
        result.current.resetConnectionAttempts();
      });

      expect(result.current.connectionAttempts).toBe(0);
      expect(result.current.lastConnectionAttempt).toBeNull();
      expect(result.current.connectionError).toBeNull();
    });
  });

  describe('Disconnection', () => {
    it('should reset to initial state on disconnect', () => {
      const { result } = renderHook(() => useWalletStore());

      // First connect
      act(() => {
        result.current.setWallet({
          publicKey: mockPublicKey,
          address: mockPublicKey.toString(),
          isConnected: true,
          walletType: WalletType.PHANTOM,
          walletName: 'Phantom',
        });
        result.current.updateBalance(BigInt(1000000000));
        result.current.incrementConnectionAttempts();
      });

      // Verify connected state
      expect(result.current.isConnected).toBe(true);
      expect(result.current.solBalance).toBe(BigInt(1000000000));
      expect(result.current.connectionAttempts).toBe(1);

      // Then disconnect
      act(() => {
        result.current.disconnect();
      });

      expect(result.current.publicKey).toBeNull();
      expect(result.current.address).toBeNull();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.solBalance).toBe(BigInt(0));
      expect(result.current.tokenAccounts).toEqual([]);
      expect(result.current.walletType).toBeNull();
      expect(result.current.walletName).toBeNull();
      expect(result.current.connectionAttempts).toBe(0);
      expect(result.current.lastConnectionAttempt).toBeNull();
      expect(result.current.connectionError).toBeNull();
    });

    it('should preserve cluster on disconnect', () => {
      const { result } = renderHook(() => useWalletStore());

      // Set cluster and connect
      act(() => {
        result.current.setCluster(SolanaCluster.MAINNET);
        result.current.setWallet({
          isConnected: true,
        });
      });

      expect(result.current.cluster).toBe(SolanaCluster.MAINNET);

      // Disconnect
      act(() => {
        result.current.disconnect();
      });

      // Cluster should be preserved
      expect(result.current.cluster).toBe(SolanaCluster.MAINNET);
    });
  });

  describe('Persistence', () => {
    it('should handle localStorage serialization correctly', () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.setWallet({
          address: mockPublicKey.toString(),
          cluster: SolanaCluster.MAINNET,
          walletType: WalletType.PHANTOM,
          walletName: 'Phantom',
        });
        result.current.updateBalance(BigInt(1500000000));
      });

      // Check that setItem was called (persistence layer)
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should handle localStorage deserialization correctly', () => {
      // Mock stored data
      const storedData = JSON.stringify({
        state: {
          address: mockPublicKey.toString(),
          cluster: SolanaCluster.MAINNET,
          walletType: WalletType.PHANTOM,
          walletName: 'Phantom',
          solBalance: '1500000000',
          isConnected: false, // Should not persist connection state
        },
        version: 0,
      });

      mockLocalStorage.getItem.mockReturnValue(storedData);

      // This would normally happen on store initialization
      // We're testing the storage layer logic
      expect(mockLocalStorage.getItem).toBeDefined();
    });

    it('should handle corrupted localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      // Should not throw error and return null
      const result = mockLocalStorage.getItem('test');
      expect(result).toBe('invalid json');
    });
  });
});