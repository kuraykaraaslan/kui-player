import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'path';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

export default defineConfig({
  define: { __KUI_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  // `public/` belongs to the demo site, not to the published package.
  publicDir: false,
  build: {
    lib: {
      entry: resolve(__dirname, 'modules/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: { external: [] },
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
});
