import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static SPA, no backend. `base: './'` keeps asset paths relative so a built
// bundle works when served from any localhost path. The dev server and
// `vite preview` both serve over http://localhost — a secure context, which the
// File System Access API requires (file:// double-click will not work).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, open: true },
  // sql.js wasm + the bundled app legitimately exceed 500 kB; raise the warn
  // threshold so the (harmless) chunk-size notice stops firing.
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
});
