import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: false, // Disable CSS processing in tests
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});