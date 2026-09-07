import { readFileSync } from 'fs';
import { transformSync } from 'esbuild';
import type { Plugin } from 'vite';

/**
 * The player stylesheet is imported with `?raw` and inlined into the bundle, so
 * its comments and indentation would ship to every consumer. Minify that copy
 * on the way in — `dist/styles.css`, which people read and link themselves,
 * stays formatted.
 */
export function minifiedCssRaw(): Plugin {
  return {
    name: 'kui-minified-css-raw',
    enforce: 'pre',
    load(id) {
      const [file, query] = id.split('?');
      if (query !== 'raw' || !file?.endsWith('.css')) return null;
      const css = readFileSync(file, 'utf8');
      const { code } = transformSync(css, { loader: 'css', minify: true });
      return `export default ${JSON.stringify(code.trim())};`;
    },
  };
}
