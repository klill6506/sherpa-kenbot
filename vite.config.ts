import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

// Library build config. The demo app has its own vite config in /demo
// (that one aliases "sherpa-kenbot" straight to ./src so dev needs no build step).
export default defineConfig({
  plugins: [
    react(),
    // Emits .d.ts files into dist so host apps get full TypeScript
    // IntelliSense on every prop.
    dts({ include: ['src'], exclude: ['**/*.test.ts'] }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'kenbot',
    },
    rollupOptions: {
      // Never bundle React — host apps provide it (peer dependency).
      external: ['react', 'react-dom', 'react/jsx-runtime', 'motion', 'motion/react'],
    },
  },
});
