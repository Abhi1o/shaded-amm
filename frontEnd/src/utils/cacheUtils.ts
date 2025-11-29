/**
 * Cache Utilities
 * 
 * Utilities for managing browser and service worker caches.
 * Used for hard refresh functionality.
 * 
 * Requirements:
 * - 1.3: Hard refresh clears cached data
 * - 7.1: Optimize initial page load
 */

/**
 * Clear all service worker caches
 * 
 * This function clears all caches managed by service workers.
 * If no service worker is registered, it does nothing.
 * 
 * @returns Promise that resolves when caches are cleared
 */
export async function clearServiceWorkerCache(): Promise<void> {
  // Check if service worker is supported
  if (!('serviceWorker' in navigator)) {
    console.log('ℹ️  Service worker not supported, skipping cache clear');
    return;
  }

  try {
    // Check if there's a registered service worker
    const registration = await navigator.serviceWorker.getRegistration();
    
    if (!registration) {
      console.log('ℹ️  No service worker registered, skipping cache clear');
      return;
    }

    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      
      if (cacheNames.length === 0) {
        console.log('ℹ️  No caches found');
        return;
      }

      console.log(`🗑️  Clearing ${cacheNames.length} cache(s)...`);
      
      await Promise.all(
        cacheNames.map(cacheName => {
          console.log(`   Deleting cache: ${cacheName}`);
          return caches.delete(cacheName);
        })
      );
      
      console.log('✅ Service worker caches cleared');
    }
  } catch (error) {
    console.error('❌ Failed to clear service worker cache:', error);
    // Don't throw - cache clearing is best-effort
  }
}

/**
 * Perform a complete hard refresh
 * 
 * This function:
 * 1. Clears service worker caches
 * 2. Clears session storage (optional)
 * 3. Triggers a callback for app-specific cache clearing
 * 
 * @param clearAppCache - Callback to clear app-specific caches (e.g., Zustand stores)
 * @param clearSessionStorage - Whether to clear session storage (default: false)
 * @returns Promise that resolves when hard refresh is complete
 */
export async function performHardRefresh(
  clearAppCache?: () => void | Promise<void>,
  clearSessionStorage: boolean = false
): Promise<void> {
  console.log('🔄 Performing hard refresh...');

  try {
    // Step 1: Clear service worker caches
    await clearServiceWorkerCache();

    // Step 2: Clear session storage if requested
    if (clearSessionStorage) {
      console.log('🗑️  Clearing session storage...');
      sessionStorage.clear();
      console.log('✅ Session storage cleared');
    }

    // Step 3: Clear app-specific caches
    if (clearAppCache) {
      console.log('🗑️  Clearing app caches...');
      await clearAppCache();
      console.log('✅ App caches cleared');
    }

    console.log('✅ Hard refresh complete');
  } catch (error) {
    console.error('❌ Hard refresh failed:', error);
    throw error;
  }
}

/**
 * Check if service worker is registered and active
 * 
 * @returns Promise that resolves to true if service worker is active
 */
export async function isServiceWorkerActive(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.active !== undefined;
  } catch (error) {
    console.error('Failed to check service worker status:', error);
    return false;
  }
}
