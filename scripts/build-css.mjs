#!/usr/bin/env node
// Emits dist/styles.css from the player's single hand-written stylesheet.
// There is no Tailwind step any more: the library ships scoped `kui-` classes
// and CSS custom properties, so it drops into a host app with any styling stack
// (or none). The same file is inlined into the bundle via `?raw`, so this build
// exists only for apps that prefer a real stylesheet (a strict CSP, say).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const input = resolve(projectRoot, "react", "styles", "player.css");
const output = resolve(projectRoot, "dist", "styles.css");

const css = await readFile(input, "utf8");

await mkdir(dirname(output), { recursive: true });
await writeFile(output, css);
console.log(`[build-css] ${output} (${css.length} bytes)`);
