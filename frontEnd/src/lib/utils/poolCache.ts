/**
 * Pool Data Cache Utility
 * 
 * Provides localStorage-based caching for pool data to reduce blockchain requests
 * and improve initial page load performance.
 * 
 * Features:
 * - Store pool data in localStorage with timestamps
 * - Automatic cache expiration
 * - Cache validation
 * - Graceful fallback on errors
 */

import { Pool } from '@/types';

const CACHE_KEY = 'samm_pools_cache';
const CACHE_VERSION = '1.0';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface PoolCacheData {
  version: string;
  timestamp: number;
  pools: Pool[];
}

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save pools to localStorage cache
 */
export function savePoolsToCache(pools: Pool[]): void {
  if (!isLocalStorageAvailable()) {
    console.warn('⚠️ localStorage not available, skipping cache save');
    return;
  }

  try {
    const cacheData: PoolCacheData = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      pools
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    console.log(`💾 Saved ${pools.length} pools to cache`);
  } catch (error) {
    console.error('❌ Failed to save pools to cache:', error);
  }
}

/**
 * Load pools from localStorage cache
 * Returns null if cache is invalid, expired, or unavailable
 */
export function loadPoolsFromCache(): Pool[] | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      console.log('📭 No cached pool data found');
      return null;
    }

    const cacheData: PoolCacheData = JSON.parse(cached);

    // Validate cache version
    if (cacheData.version !== CACHE_VERSION) {
      console.log('🔄 Cache version mismatch, invalidating cache');
      clearPoolCache();
      return null;
    }

    // Check if cache is expired
    const age = Date.now() - cacheData.timestamp;
    if (age > CACHE_EXPIRY_MS) {
      console.log(`⏰ Cache expired (${Math.round(age / 1000)}s old), invalidating`);
      clearPoolCache();
      return null;
    }

    // Validate pool data structure
    if (!Array.isArray(cacheData.pools) || cacheData.pools.length === 0) {
      console.log('⚠️ Invalid cache data structure');
      clearPoolCache();
      return null;
    }

    console.log(`✅ Loaded ${cacheData.pools.length} pools from cache (${Math.round(age / 1000)}s old)`);
    return cacheData.pools;
  } catch (error) {
    console.error('❌ Failed to load pools from cache:', error);
    clearPoolCache();
    return null;
  }
}

/**
 * Clear pool cache from localStorage
 */
export function clearPoolCache(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('🗑️ Cleared pool cache');
  } catch (error) {
    console.error('❌ Failed to clear pool cache:', error);
  }
}

/**
 * Get cache age in milliseconds
 * Returns null if no cache exists
 */
export function getCacheAge(): number | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      return null;
    }

    const cacheData: PoolCacheData = JSON.parse(cached);
    return Date.now() - cacheData.timestamp;
  } catch {
    return null;
  }
}

/**
 * Check if cache is valid and not expired
 */
export function isCacheValid(): boolean {
  const age = getCacheAge();
  if (age === null) {
    return false;
  }
  return age < CACHE_EXPIRY_MS;
}
