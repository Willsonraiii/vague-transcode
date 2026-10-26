import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Builds straight into ../public so the Express server (server-rtx-online.js) serves it as-is.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // emptyOutDir disabled so large local media (portfolio .mp4 clips) survives rebuilds.
  build: { outDir: '../public', emptyOutDir: false },
  server: {
    allowedHosts: ['willson-inspiron-15-3552.tail5e494c.ts.net', '.ts.net', 'localhost'],
    proxy: { '/api': 'http://localhost:3005', '/health': 'http://localhost:3005' }
  }
});
