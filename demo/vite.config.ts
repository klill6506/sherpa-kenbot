import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// The demo imports "sherpa-kenbot" straight from ../src — no build step
// needed, and edits to the library hot-reload instantly.
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // The repo lives on a network share (V: → \\kenmay2021\D). Native file
      // watching (fs.watch) crashes over SMB, so poll for changes instead.
      usePolling: true,
      interval: 400,
    },
  },
  resolve: {
    alias: {
      'sherpa-kenbot': resolve(__dirname, '../src/index.ts'),
    },
    // Guarantee a single React copy even though the library source lives
    // outside the demo folder (two copies break hooks).
    dedupe: ['react', 'react-dom', 'motion'],
  },
});
