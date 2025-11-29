/**
 * Polyfills for browser-only APIs that may be accessed during SSR
 * This prevents "ReferenceError: indexedDB is not defined" and similar errors
 */

// Polyfill indexedDB for server-side rendering
if (typeof window === 'undefined') {
  // @ts-ignore
  global.indexedDB = undefined;
  // @ts-ignore
  global.IDBKeyRange = undefined;
}

export {};
