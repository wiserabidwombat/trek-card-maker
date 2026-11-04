import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// BASE_PATH is set by the GitHub Pages workflow to '/<repo>/'; local dev and other hosts use '/'.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/setupTests.ts'],
    globals: false,
  },
});
