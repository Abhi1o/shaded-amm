/**
 * Pool Refresh Configuration
 * 
 * Controls how frequently pool data is fetched from the backend
 */

export const POOL_REFRESH_CONFIG = {
  /**
   * Auto-refresh interval in milliseconds
   * Default: 60 seconds (60000ms)
   * 
   * This controls how often the pools page automatically refreshes pool data
   * in the background. Set to 0 to disable auto-refresh.
   * 
   * Changed from 30s to 60s to reduce API load and provide more stable UX.
   */
  AUTO_REFRESH_INTERVAL: 60000,

  /**
   * Minimum time between fetches in milliseconds
   * Default: 15 seconds (15000ms)
   * 
   * This prevents excessive API calls by enforcing a minimum delay between
   * consecutive fetch requests. Even if multiple refresh requests are triggered,
   * they will be throttled to respect this interval.
   * 
   * Changed from 10s to 15s to further reduce API load.
   */
  MIN_FETCH_INTERVAL: 15000,

  /**
   * Cache TTL (Time To Live) in milliseconds
   * Default: 5 minutes (300000ms)
   * 
   * How long to consider cached pool data as "fresh" before marking it as stale.
   * This doesn't prevent fetching, but helps with UI indicators.
   */
  CACHE_TTL: 300000,

  /**
   * Enable auto-refresh by default
   * Default: true
   * 
   * Set to false to disable automatic background refreshing.
   * Users can still manually refresh using the refresh button.
   */
  ENABLE_AUTO_REFRESH: true,
};

/**
 * Get the auto-refresh interval
 * Can be overridden by environment variable
 */
export function getAutoRefreshInterval(): number {
  const envInterval = process.env.NEXT_PUBLIC_POOL_REFRESH_INTERVAL;
  if (envInterval) {
    const parsed = parseInt(envInterval, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return POOL_REFRESH_CONFIG.AUTO_REFRESH_INTERVAL;
}

/**
 * Get the minimum fetch interval
 * Can be overridden by environment variable
 */
export function getMinFetchInterval(): number {
  const envInterval = process.env.NEXT_PUBLIC_MIN_FETCH_INTERVAL;
  if (envInterval) {
    const parsed = parseInt(envInterval, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return POOL_REFRESH_CONFIG.MIN_FETCH_INTERVAL;
}
