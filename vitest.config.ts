import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { minifiedCssRaw } from './vite.plugin.css-raw';
import { readFileSync } from 'node:fs';
import { resolve } from 'path';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

export default defineConfig({
  define: { __KUI_VERSION__: JSON.stringify(pkg.version) },
  // Same stylesheet transform the shipped bundles get, so tests see what users do.
  plugins: [react(), minifiedCssRaw()],
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  test: {
    environment: 'jsdom',
    // Without this, Vitest stubs CSS imports — including the `?raw` import that
    // carries the player's stylesheet, which several tests assert on.
    css: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/{unit,component}/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // The gate is on the framework-agnostic core; the React layer is covered
      // by component tests, but its numbers are dominated by JSX branches.
      include: ['modules/**/*.ts'],
      exclude: ['modules/index.ts', 'modules/videoplayer/videoplayer.types.ts'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
    },
  },
});
