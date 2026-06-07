#!/usr/bin/env node
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const input = resolve(projectRoot, "src", "globals.css");
const output = resolve(projectRoot, "dist", "styles.css");

const css = await readFile(input, "utf8");
const result = await postcss([tailwind()]).process(css, { from: input, to: output });

// The host application may own its own Tailwind v4 cascade. We post-process
// the output to drop preflight (which would clobber host resets) while keeping:
//   * the design-token CSS variables (--primary, --surface-*, etc.)
//   * the @theme inline mappings (--color-* → var(--*))
//   * the utility classes scanned from react/ and modules/
const root = postcss.parse(result.css);

root.walkAtRules("layer", (atRule) => {
  if (atRule.params === "base") {
    atRule.remove();
    return;
  }

  if (atRule.params === "theme") {
    atRule.walkRules((rule) => {
      const targetsRoot = rule.selectors.some(
        (s) => s === ":root" || s === ":host" || s === ":root, :host",
      );
      if (!targetsRoot) return;
      // Keep only our namespaced --color-* tokens; prune default Tailwind theme.
      rule.walkDecls((decl) => {
        if (!decl.prop.startsWith("--color-")) {
          decl.remove();
        }
      });
      if (rule.nodes.length === 0) rule.remove();
    });
  }
});

await mkdir(dirname(output), { recursive: true });
await writeFile(output, root.toString());
console.log(`[build-css] ${output} (${root.toString().length} bytes)`);
