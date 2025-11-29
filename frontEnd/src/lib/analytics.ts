/**
 * Analytics integration for Solana DEX
 * Tracks user interactions, transactions, and errors
 */

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp?: number;
}

interface TransactionEvent {
  type: 'swap' | 'addLiquidity' | 'removeLiquidity' | 'createPool';
  signature: string;
  status: 'initiated' | 'confirmed' | 'failed';
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: string;
  amountOut?: string;
}

class Analytics {
  private enabled: boolean;
  private analyticsId: string | undefined;

  constructor() {
    this.enabled = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true';
    this.analyticsId = process.env.NEXT_PUBLIC_ANALYTICS_ID;
  }

  /**
   * Track a custom event
   */
  track(event: AnalyticsEvent): void {
    if (!this.enabled) return;

    const eventData = {
      ...event,
      timestamp: event.timestamp || Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };

    // Send to analytics service (e.g., Google Analytics, Mixpanel, etc.)
    this.sendToAnalytics(eventData);

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', eventData);
    }
  }

  /**
   * Track wallet connection
   */
  trackWalletConnect(walletType: string, publicKey: string): void {
    this.track({
      name: 'wallet_connected',
      properties: {
        walletType,
        publicKey: this.anonymizeAddress(publicKey),
      },
    });
  }

  /**
   * Track wallet disconnection
   */
  trackWalletDisconnect(): void {
    this.track({
      name: 'wallet_disconnected',
    });
  }

  /**
   * Track transaction events
   */
  trackTransaction(event: TransactionEvent): void {
    this.track({
      name: `transaction_${event.status}`,
      properties: {
        type: event.type,
        signature: event.signature,
        tokenIn: event.tokenIn,
        tokenOut: event.tokenOut,
        amountIn: event.amountIn,
        amountOut: event.amountOut,
      },
    });
  }

  /**
   * Track swap initiation
   */
  trackSwapInitiated(tokenIn: string, tokenOut: string, amountIn: string): void {
    this.track({
      name: 'swap_initiated',
      properties: {
        tokenIn,
        tokenOut,
        amountIn,
      },
    });
  }

  /**
   * Track pool creation
   */
  trackPoolCreation(tokenA: string, tokenB: string): void {
    this.track({
      name: 'pool_created',
      properties: {
        tokenA,
        tokenB,
      },
    });
  }

  /**
   * Track page views
   */
  trackPageView(path: string): void {
    this.track({
      name: 'page_view',
      properties: {
        path,
      },
    });
  }

  /**
   * Track errors (non-critical)
   */
  trackError(error: Error, context?: Record<string, any>): void {
    this.track({
      name: 'error_occurred',
      properties: {
        message: error.message,
        stack: error.stack,
        ...context,
      },
    });
  }

  /**
   * Anonymize wallet address for privacy
   */
  private anonymizeAddress(address: string): string {
    if (address.length < 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }

  /**
   * Send event to analytics service
   */
  private sendToAnalytics(event: any): void {
    // Implement your analytics service integration here
    // Examples: Google Analytics, Mixpanel, Amplitude, etc.
    
    // Google Analytics 4 example:
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', event.name, event.properties);
    }

    // Custom analytics endpoint example:
    if (this.analyticsId) {
      fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }).catch((error) => {
        console.error('Failed to send analytics:', error);
      });
    }
  }
}

// Export singleton instance
export const analytics = new Analytics();

// Export types
export type { AnalyticsEvent, TransactionEvent };
