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
  build: { outDir: '../public', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:3005', '/health': 'http://localhost:3005' } }
});
