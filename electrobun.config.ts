import type { ElectrobunConfig } from 'electrobun';

// Wrap the existing Vite SPA as a native desktop app. We do NOT let Electrobun
// bundle the webview: the app is built by Vite (`bun run build`) into dist/, and
// that self-contained, relative-path bundle (base: './') is copied into the
// view. Electrobun only bundles the Bun main process and opens a window at
// views://mainview/index.html.
//
// Build:  bun run build && bunx electrobun build
// Dev:    bun run build && bunx electrobun dev
export default {
  app: {
    name: 'Mic Drop',
    identifier: 'sh.micdrop.judge',
    version: '0.1.0',
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  build: {
    bun: {
      // Must be named index.ts: the launcher loads the bundled output at bun/index.js.
      entrypoint: 'electrobun/index.ts',
    },
    // Copy the whole Vite build (index.html + assets/ + guides/) under the view.
    copy: {
      dist: 'views/mainview',
    },
    mac: {
      // Default renderer is the native WKWebView (tiny bundle). Switch to 'cef'
      // + bundleCEF here only if you want bundled Chromium instead.
      defaultRenderer: 'native',
    },
  },
} satisfies ElectrobunConfig;
