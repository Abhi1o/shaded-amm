import { WalletName } from '@solana/wallet-adapter-base';

interface WalletPersistenceData {
  walletName: WalletName;
  address: string;
  cluster: string;
  lastConnected: number;
  autoReconnect: boolean;
}

const STORAGE_KEY = 'solana-wallet-persistence';
const PERSISTENCE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

export class WalletPersistenceService {
  private static instance: WalletPersistenceService;

  private constructor() {}

  public static getInstance(): WalletPersistenceService {
    if (!WalletPersistenceService.instance) {
      WalletPersistenceService.instance = new WalletPersistenceService();
    }
    return WalletPersistenceService.instance;
  }

  /**
   * Save wallet connection data for auto-reconnect
   */
  public saveWalletConnection(data: Omit<WalletPersistenceData, 'lastConnected'>): void {
    try {
      const persistenceData: WalletPersistenceData = {
        ...data,
        lastConnected: Date.now(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistenceData));
    } catch (error) {
      console.error('Failed to save wallet persistence data:', error);
    }
  }

  /**
   * Get saved wallet connection data
   */
  public getWalletConnection(): WalletPersistenceData | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const data: WalletPersistenceData = JSON.parse(stored);
      
      // Check if data has expired
      if (Date.now() - data.lastConnected > PERSISTENCE_EXPIRY) {
        this.clearWalletConnection();
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to get wallet persistence data:', error);
      return null;
    }
  }

  /**
   * Clear saved wallet connection data
   */
  public clearWalletConnection(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear wallet persistence data:', error);
    }
  }

  /**
   * Check if auto-reconnect should be attempted
   */
  public shouldAutoReconnect(): boolean {
    const data = this.getWalletConnection();
    return data?.autoReconnect === true;
  }

  /**
   * Update auto-reconnect preference
   */
  public setAutoReconnect(enabled: boolean): void {
    const data = this.getWalletConnection();
    if (data) {
      this.saveWalletConnection({
        ...data,
        autoReconnect: enabled,
      });
    }
  }

  /**
   * Get the last connected wallet name for auto-reconnect
   */
  public getLastConnectedWallet(): WalletName | null {
    const data = this.getWalletConnection();
    return data?.walletName || null;
  }

  /**
   * Check if wallet connection data exists and is valid
   */
  public hasValidConnection(): boolean {
    const data = this.getWalletConnection();
    return data !== null && data.autoReconnect === true;
  }

  /**
   * Update the last connected timestamp
   */
  public updateLastConnected(): void {
    const data = this.getWalletConnection();
    if (data) {
      this.saveWalletConnection({
        walletName: data.walletName,
        address: data.address,
        cluster: data.cluster,
        autoReconnect: data.autoReconnect,
      });
    }
  }

  /**
   * Get connection age in milliseconds
   */
  public getConnectionAge(): number {
    const data = this.getWalletConnection();
    return data ? Date.now() - data.lastConnected : 0;
  }

  /**
   * Check if connection is recent (within last hour)
   */
  public isRecentConnection(): boolean {
    const age = this.getConnectionAge();
    return age < 60 * 60 * 1000; // 1 hour
  }
}

// Export singleton instance
export const walletPersistence = WalletPersistenceService.getInstance();