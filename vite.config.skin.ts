import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { minifiedCssRaw } from './vite.plugin.css-raw';
import { resolve } from 'path';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

export default defineConfig({
  define: { __KUI_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), minifiedCssRaw()],
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  // Skin mode as an importable ESM entry (`@kuraykaraaslan/kui-player/skin`),
// built separately so its shared code never reshapes the React entry's chunks.
// `public/` belongs to the demo site, not to the published package.
  publicDir: false,
  build: {
    lib: {
      entry: resolve(__dirname, 'embed/skin.ts'),
      formats: ['es'],
      fileName: () => 'skin/index.js',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@kuraykaraaslan/kui-player',
      ],
      output: {
        preserveModules: false,
        chunkFileNames: 'skin/[name].js',
        banner: '"use client";',
      },
    },
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: true,
  },
});
