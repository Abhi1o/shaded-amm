/**
 * EVM Wallet Service
 * 
 * Handles wallet connection, disconnection, network switching, and balance fetching
 * for EVM-compatible wallets (MetaMask, WalletConnect, Coinbase Wallet)
 */

import { ethers } from 'ethers';
import { EVMNetwork } from '@/config/evm-networks';
import ERC20_ABI from '@/abis/ERC20.json';

export type WalletType = 'metamask' | 'walletconnect' | 'coinbase';

export interface WalletConnection {
  address: string;
  chainId: number;
  provider: ethers.BrowserProvider;
}

export interface NetworkConfig {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

export class EVMWalletService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private address: string | null = null;
  private chainId: number | null = null;
  private accountsChangedCallback: ((accounts: string[]) => void) | null = null;
  private chainChangedCallback: ((chainId: number) => void) | null = null;
  private disconnectCallback: (() => void) | null = null;

  /**
   * Connect to a wallet
   */
  async connect(walletType: WalletType = 'metamask'): Promise<WalletConnection> {
    try {
      console.log(`[EVMWalletService] Connecting to ${walletType}...`);

      // Get ethereum provider
      const ethereum = this.getEthereumProvider(walletType);
      if (!ethereum) {
        throw new Error(`${walletType} is not installed. Please install the wallet extension.`);
      }

      // Request account access
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock your wallet.');
      }

      // Create provider and signer
      this.provider = new ethers.BrowserProvider(ethereum);
      this.signer = await this.provider.getSigner();
      this.address = accounts[0];

      // Get chain ID
      const network = await this.provider.getNetwork();
      this.chainId = Number(network.chainId);

      // Set up event listeners
      this.setupEventListeners(ethereum);

      console.log(`[EVMWalletService] Connected successfully`);
      console.log(`  Address: ${this.address}`);
      console.log(`  Chain ID: ${this.chainId}`);

      return {
        address: this.address,
        chainId: this.chainId,
        provider: this.provider,
      };
    } catch (error) {
      console.error('[EVMWalletService] Connection failed:', error);
      throw this.parseWalletError(error);
    }
  }

  /**
   * Disconnect wallet
   */
  async disconnect(): Promise<void> {
    console.log('[EVMWalletService] Disconnecting wallet...');

    // Clear state
    this.provider = null;
    this.signer = null;
    this.address = null;
    this.chainId = null;

    // Remove event listeners
    this.removeEventListeners();

    console.log('[EVMWalletService] Disconnected successfully');
  }

  /**
   * Switch to a different network
   */
  async switchNetwork(chainId: number): Promise<void> {
    if (!this.provider) {
      throw new Error('Wallet not connected');
    }

    try {
      console.log(`[EVMWalletService] Switching to chain ID ${chainId}...`);

      const ethereum = (this.provider as any).provider;
      const chainIdHex = `0x${chainId.toString(16)}`;

      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });

      // Update chain ID
      const network = await this.provider.getNetwork();
      this.chainId = Number(network.chainId);

      console.log(`[EVMWalletService] Switched to chain ID ${this.chainId}`);
    } catch (error: any) {
      // If chain not added, try to add it
      if (error.code === 4902) {
        throw new Error('NETWORK_NOT_CONFIGURED');
      }
      throw this.parseWalletError(error);
    }
  }

  /**
   * Add a new network to the wallet
   */
  async addNetwork(network: EVMNetwork): Promise<void> {
    if (!this.provider) {
      throw new Error('Wallet not connected');
    }

    try {
      console.log(`[EVMWalletService] Adding network ${network.name}...`);

      const ethereum = (this.provider as any).provider;
      const chainIdHex = `0x${network.chainId.toString(16)}`;

      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdHex,
            chainName: network.name,
            nativeCurrency: network.nativeCurrency,
            rpcUrls: network.rpcUrls,
            blockExplorerUrls: network.blockExplorerUrls,
          },
        ],
      });

      console.log(`[EVMWalletService] Network ${network.name} added successfully`);
    } catch (error) {
      console.error('[EVMWalletService] Failed to add network:', error);
      throw this.parseWalletError(error);
    }
  }

  /**
   * Get current connected address
   */
  getAddress(): string | null {
    return this.address;
  }

  /**
   * Get current chain ID
   */
  getChainId(): number | null {
    return this.chainId;
  }

  /**
   * Get native token balance
   */
  async getBalance(address: string): Promise<bigint> {
    if (!this.provider) {
      throw new Error('Wallet not connected');
    }

    try {
      const balance = await this.provider.getBalance(address);
      return balance;
    } catch (error) {
      console.error('[EVMWalletService] Failed to get balance:', error);
      throw error;
    }
  }

  /**
   * Get ERC-20 token balance
   */
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<bigint> {
    if (!this.provider) {
      throw new Error('Wallet not connected');
    }

    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const balance = await contract.balanceOf(userAddress);
      return balance;
    } catch (error) {
      console.error(`[EVMWalletService] Failed to get token balance for ${tokenAddress}:`, error);
      return 0n;
    }
  }

  /**
   * Get provider instance
   */
  getProvider(): ethers.BrowserProvider | null {
    return this.provider;
  }

  /**
   * Get signer instance
   */
  getSigner(): ethers.Signer | null {
    return this.signer;
  }

  /**
   * Set up event listeners for wallet events
   */
  private setupEventListeners(ethereum: any): void {
    // Account changed
    ethereum.on('accountsChanged', (accounts: string[]) => {
      console.log('[EVMWalletService] Accounts changed:', accounts);
      if (accounts.length === 0) {
        this.disconnect();
        this.disconnectCallback?.();
      } else {
        this.address = accounts[0];
        this.accountsChangedCallback?.(accounts);
      }
    });

    // Chain changed
    ethereum.on('chainChanged', (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex, 16);
      console.log('[EVMWalletService] Chain changed:', newChainId);
      this.chainId = newChainId;
      this.chainChangedCallback?.(newChainId);
      // Reload page on chain change (recommended by MetaMask)
      window.location.reload();
    });

    // Disconnect
    ethereum.on('disconnect', () => {
      console.log('[EVMWalletService] Wallet disconnected');
      this.disconnect();
      this.disconnectCallback?.();
    });
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    if (this.provider) {
      const ethereum = (this.provider as any).provider;
      ethereum.removeAllListeners('accountsChanged');
      ethereum.removeAllListeners('chainChanged');
      ethereum.removeAllListeners('disconnect');
    }
  }

  /**
   * Register callback for accounts changed event
   */
  onAccountsChanged(callback: (accounts: string[]) => void): void {
    this.accountsChangedCallback = callback;
  }

  /**
   * Register callback for chain changed event
   */
  onChainChanged(callback: (chainId: number) => void): void {
    this.chainChangedCallback = callback;
  }

  /**
   * Register callback for disconnect event
   */
  onDisconnect(callback: () => void): void {
    this.disconnectCallback = callback;
  }

  /**
   * Get ethereum provider based on wallet type
   */
  private getEthereumProvider(walletType: WalletType): any {
    if (typeof window === 'undefined') {
      return null;
    }

    const ethereum = (window as any).ethereum;

    if (!ethereum) {
      return null;
    }

    // For MetaMask
    if (walletType === 'metamask') {
      if (ethereum.isMetaMask) {
        return ethereum;
      }
      // Check for multiple providers
      if (ethereum.providers) {
        return ethereum.providers.find((p: any) => p.isMetaMask);
      }
    }

    // For Coinbase Wallet
    if (walletType === 'coinbase') {
      if (ethereum.isCoinbaseWallet) {
        return ethereum;
      }
      if (ethereum.providers) {
        return ethereum.providers.find((p: any) => p.isCoinbaseWallet);
      }
    }

    // Default to first available provider
    return ethereum;
  }

  /**
   * Parse wallet errors into user-friendly messages
   */
  private parseWalletError(error: any): Error {
    const message = error?.message || String(error);
    const code = error?.code;

    // User rejected request
    if (code === 4001 || message.includes('User rejected')) {
      return new Error('Transaction rejected by user');
    }

    // Chain not added
    if (code === 4902) {
      return new Error('Network not configured in wallet');
    }

    // Wallet not found
    if (message.includes('not installed') || message.includes('not found')) {
      return new Error('Wallet extension not installed');
    }

    // Already processing
    if (code === -32002) {
      return new Error('Request already pending. Please check your wallet.');
    }

    // Generic error
    return new Error(message);
  }
}

// Export singleton instance
let walletService: EVMWalletService | null = null;

export function getEVMWalletService(): EVMWalletService {
  if (!walletService) {
    walletService = new EVMWalletService();
  }
  return walletService;
}
