import { vi } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { WalletAdapter, WalletReadyState, WalletName } from '@solana/wallet-adapter-base';

// Mock PublicKey for testing
export const mockPublicKey = new PublicKey('11111111111111111111111111111112');

// Mock wallet adapter
export class MockWalletAdapter implements Partial<WalletAdapter> {
  name: WalletName = 'Mock Wallet' as WalletName;
  url = 'https://mockwallet.com';
  icon = 'data:image/svg+xml;base64,mock';
  readyState = WalletReadyState.Installed;
  publicKey = null;
  connecting = false;
  connected = false;

  connect = vi.fn();
  disconnect = vi.fn();
  sendTransaction = vi.fn();
  signTransaction = vi.fn();
  signAllTransactions = vi.fn();
  signMessage = vi.fn();

  on = vi.fn();
  off = vi.fn();
  emit = vi.fn();
}

// Mock Phantom wallet adapter
export class MockPhantomAdapter extends MockWalletAdapter {
  name: WalletName = 'Phantom' as WalletName;
  url = 'https://phantom.app';
}

// Mock Solflare wallet adapter
export class MockSolflareAdapter extends MockWalletAdapter {
  name: WalletName = 'Solflare' as WalletName;
  url = 'https://solflare.com';
}

// Mock wallet connection success
export const mockSuccessfulConnection = (adapter: MockWalletAdapter) => {
  adapter.connect.mockImplementation(async () => {
    adapter.connecting = true;
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate connection delay
    adapter.connected = true;
    adapter.connecting = false;
    adapter.publicKey = mockPublicKey;
    adapter.emit('connect', mockPublicKey);
  });
};

// Mock wallet connection failure
export const mockFailedConnection = (adapter: MockWalletAdapter, error: Error) => {
  adapter.connect.mockImplementation(async () => {
    adapter.connecting = true;
    await new Promise(resolve => setTimeout(resolve, 100));
    adapter.connecting = false;
    adapter.emit('error', error);
    throw error;
  });
};

// Mock wallet disconnection
export const mockDisconnection = (adapter: MockWalletAdapter) => {
  adapter.disconnect.mockImplementation(async () => {
    adapter.connected = false;
    adapter.publicKey = null;
    adapter.emit('disconnect');
  });
};

// Mock user rejection
export const mockUserRejection = (adapter: MockWalletAdapter) => {
  const rejectionError = new Error('User rejected the request');
  rejectionError.name = 'WalletConnectionError';
  mockFailedConnection(adapter, rejectionError);
};

// Mock network error
export const mockNetworkError = (adapter: MockWalletAdapter) => {
  const networkError = new Error('Network connection failed');
  networkError.name = 'WalletNetworkError';
  mockFailedConnection(adapter, networkError);
};