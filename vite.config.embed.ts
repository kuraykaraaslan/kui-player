import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

// A single, fully self-contained IIFE for injection into arbitrary web pages:
// React + ReactDOM + the engine + the controls chrome + the (shadow-root) CSS,
// with NOTHING external. React is bundled into the closure and never touches
// window.React, so the host page's own React is unaffected. Google Cast is never
// reachable (skin mode passes enableCast=false), so no gstatic script loads.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
    dedupe: ['react', 'react-dom'],
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    __KUI_EMBED_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'embed/index.ts'),
      formats: ['iife'],
      name: '__tepegozVideoPlayerBundle',
      fileName: () => 'embed.js',
    },
    rollupOptions: {
      external: [],
      output: { inlineDynamicImports: true },
    },
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2020',
    sourcemap: false,
    minify: 'esbuild',
  },
});
