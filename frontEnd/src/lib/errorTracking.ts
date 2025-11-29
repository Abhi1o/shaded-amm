/**
 * Error tracking and monitoring for Solana DEX
 * Integrates with error tracking services like Sentry
 */

interface ErrorContext {
  user?: {
    publicKey?: string;
    walletType?: string;
  };
  transaction?: {
    signature?: string;
    type?: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}

interface SolanaError extends Error {
  code?: number;
  logs?: string[];
  signature?: string;
}

class ErrorTracking {
  private enabled: boolean;
  private sentryDsn: string | undefined;
  private initialized: boolean = false;

  constructor() {
    this.enabled = process.env.NEXT_PUBLIC_ENABLE_ERROR_TRACKING === 'true';
    this.sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  }

  /**
   * Initialize error tracking service
   */
  async init(): Promise<void> {
    if (!this.enabled || this.initialized) return;

    // Sentry integration is disabled. To enable:
    // 1. Install @sentry/nextjs: npm install @sentry/nextjs
    // 2. Set NEXT_PUBLIC_ENABLE_ERROR_TRACKING=true in .env.local
    // 3. Set NEXT_PUBLIC_SENTRY_DSN=your-dsn in .env.local
    // 4. Uncomment the code below

    console.log('Error tracking is disabled. Errors will be logged to console only.');

    /* Uncomment this block after installing @sentry/nextjs

    try {
      // Initialize Sentry or other error tracking service
      if (this.sentryDsn && typeof window !== 'undefined') {
        const Sentry = await import('@sentry/nextjs');

        Sentry.init({
          dsn: this.sentryDsn,
          environment: process.env.NODE_ENV,
          tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
          beforeSend(event, hint) {
            // Filter out non-critical errors
            if (event.exception) {
              const error = hint.originalException as Error;
              if (error?.message?.includes('User rejected')) {
                return null; // Don't track user rejections
              }
            }
            return event;
          },
        });

        this.initialized = true;
      }
    } catch (error) {
      console.error('Failed to initialize error tracking:', error);
    }
    */
  }

  /**
   * Capture an error with context
   */
  captureError(error: Error | SolanaError, context?: ErrorContext): void {
    if (!this.enabled) {
      console.error('[Error]', error, context);
      return;
    }

    try {
      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.error('[Error Tracking]', error, context);
      }

      // Send to error tracking service
      this.sendToErrorTracking(error, context);
    } catch (trackingError) {
      console.error('Failed to track error:', trackingError);
    }
  }

  /**
   * Capture Solana-specific transaction errors
   */
  captureTransactionError(
    error: SolanaError,
    signature?: string,
    transactionType?: string
  ): void {
    this.captureError(error, {
      transaction: {
        signature,
        type: transactionType,
      },
      tags: {
        errorType: 'transaction',
        network: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'unknown',
      },
      extra: {
        logs: error.logs,
        code: error.code,
      },
    });
  }

  /**
   * Capture wallet connection errors
   */
  captureWalletError(error: Error, walletType?: string): void {
    this.captureError(error, {
      tags: {
        errorType: 'wallet',
        walletType: walletType || 'unknown',
      },
    });
  }

  /**
   * Capture RPC errors
   */
  captureRpcError(error: Error, endpoint?: string): void {
    this.captureError(error, {
      tags: {
        errorType: 'rpc',
        network: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'unknown',
      },
      extra: {
        endpoint,
      },
    });
  }

  /**
   * Set user context for error tracking
   */
  setUser(publicKey: string, walletType?: string): void {
    if (!this.enabled || !this.initialized) return;

    try {
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.setUser({
          id: this.anonymizeAddress(publicKey),
          walletType,
        });
      }
    } catch (error) {
      console.error('Failed to set user context:', error);
    }
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    if (!this.enabled || !this.initialized) return;

    try {
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.setUser(null);
      }
    } catch (error) {
      console.error('Failed to clear user context:', error);
    }
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(message: string, category: string, data?: Record<string, any>): void {
    if (!this.enabled || !this.initialized) return;

    try {
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.addBreadcrumb({
          message,
          category,
          data,
          level: 'info',
        });
      }
    } catch (error) {
      console.error('Failed to add breadcrumb:', error);
    }
  }

  /**
   * Anonymize wallet address for privacy
   */
  private anonymizeAddress(address: string): string {
    if (address.length < 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }

  /**
   * Send error to tracking service
   */
  private sendToErrorTracking(error: Error | SolanaError, context?: ErrorContext): void {
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      const Sentry = (window as any).Sentry;

      // Set context
      if (context?.user) {
        Sentry.setUser({
          id: context.user.publicKey ? this.anonymizeAddress(context.user.publicKey) : undefined,
          walletType: context.user.walletType,
        });
      }

      if (context?.tags) {
        Sentry.setTags(context.tags);
      }

      if (context?.extra) {
        Sentry.setExtras(context.extra);
      }

      // Capture exception
      Sentry.captureException(error);
    }
  }
}

// Export singleton instance
export const errorTracking = new ErrorTracking();

// Export types
export type { ErrorContext, SolanaError };
