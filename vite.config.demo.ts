import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { minifiedCssRaw } from "./vite.plugin.css-raw";
import { createRequire } from "module";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const require = createRequire(import.meta.url);

/*
 * Publishes the agent-facing docs alongside the demo: `llms.txt`, the full
 * reference, and every recipe served as plain markdown. Developers increasingly
 * ask an assistant which player to use, and an assistant can only answer from
 * what it can fetch.
 */
function docsPlugin(): Plugin {
  const root = resolve(__dirname);
  const files = () => [
    { from: resolve(root, "llms.txt"), to: "llms.txt" },
    { from: resolve(root, "llms-full.txt"), to: "llms-full.txt" },
    { from: resolve(root, "README.md"), to: "README.md" },
    { from: resolve(root, "CONTRIBUTING.md"), to: "CONTRIBUTING.md" },
    ...readdirSync(resolve(root, "recipes"))
      .filter((name) => name.endsWith(".md"))
      .map((name) => ({ from: resolve(root, "recipes", name), to: `recipes/${name}` })),
  ];

  return {
    name: "kui-docs",
    generateBundle() {
      for (const file of files()) {
        this.emitFile({ type: "asset", fileName: file.to, source: readFileSync(file.from, "utf8") });
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").replace(/^\//, "").split("?")[0];
        const match = files().find((file) => file.to === url);
        if (!match) return next();
        res.setHeader("Content-Type", url.endsWith(".md") ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8");
        res.end(readFileSync(match.from, "utf8"));
      });
    },
  };
}

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
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

export default defineConfig({
  define: { __KUI_VERSION__: JSON.stringify(pkg.version) },
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  plugins: [react(), docsPlugin(), minifiedCssRaw()],
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
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        skin: resolve(__dirname, "skin.html"),
      },
    },
    outDir: "dist-demo",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
  },
});
