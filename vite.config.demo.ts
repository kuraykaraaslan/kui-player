import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "module";
import { resolve } from "path";

const require = createRequire(import.meta.url);

/*
 * Demo-site build config (deployed to Vercel).
 *
 * Builds the repo-root `index.html` + `src/main.tsx` (plus the modules they
 * pull in) as a standalone static site, separate from the library build in
 * `vite.config.ts`. Everything is bundled so Vercel serves a single,
 * self-contained site.
 *
 * Output: `dist-demo/`
 */
export default defineConfig({
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  plugins: [react()],
  resolve: {
    // The repo has a top-level ./react folder (the library's React subpath
    // source) whose name collides with the npm `react` package. Vite's dep
    // optimizer otherwise resolves bare `import 'react'` to that local folder
    // and bundles the library into the optimized `react` dep — so the dep no
    // longer exports `createContext` et al., crashing the demo with a blank
    // screen. Pin the bare react/react-dom specifiers to the real packages
    // (subpaths like react/jsx-runtime resolve normally) and dedupe to a
    // single copy.
    alias: [
      { find: /^react$/, replacement: require.resolve("react") },
      { find: /^react-dom$/, replacement: require.resolve("react-dom") },
      { find: "@", replacement: resolve(__dirname, ".") },
    ],
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: "dist-demo",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
  },
});
