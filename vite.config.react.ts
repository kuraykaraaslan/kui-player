import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  build: {
    lib: {
      entry: resolve(__dirname, 'react/index.ts'),
      formats: ['es'],
      fileName: () => 'react/index.js',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@kuraykaraaslan/kui-videoplayer',
        '@fortawesome/react-fontawesome',
        '@fortawesome/fontawesome-svg-core',
        '@fortawesome/free-solid-svg-icons',
        '@fortawesome/free-brands-svg-icons',
      ],
      output: { preserveModules: false },
    },
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: true,
  },
});
