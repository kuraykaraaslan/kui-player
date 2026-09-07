#!/usr/bin/env node
/*
 * Bundle-size gate. Deliberately dependency-free: measuring a gzipped file is
 * twelve lines of node, and a size budget that pulls in its own dependency tree
 * is a poor advertisement for a library whose selling point is not having one.
 *
 * Budgets live in `size-limit` in package.json, so the shape stays familiar and
 * swapping in the real tool later is a config change, not a rewrite.
 *
 *   node scripts/check-size.mjs          # measure and enforce
 *   node scripts/check-size.mjs --write  # rewrite the budgets to current sizes
 */
import { readFile, writeFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = resolve(projectRoot, "package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
const budgets = pkg["size-limit"] ?? [];
const write = process.argv.includes("--write");

const KB = 1024;
const parseLimit = (limit) => {
  const match = /^([\d.]+)\s*(k|K)?B$/.exec(String(limit).trim());
  if (!match) throw new Error(`Unparseable size limit: ${limit}`);
  return Number(match[1]) * (match[2] ? KB : 1);
};

let failed = false;
const rows = [];

for (const entry of budgets) {
  const paths = Array.isArray(entry.path) ? entry.path : [entry.path];
  let bytes = 0;
  for (const rel of paths) {
    const file = resolve(projectRoot, rel);
    try { await stat(file); } catch {
      console.error(`✗ ${entry.name}: missing ${rel} — run the build first`);
      failed = true;
      bytes = NaN;
      break;
    }
    bytes += gzipSync(await readFile(file), { level: 9 }).length;
  }
  if (Number.isNaN(bytes)) continue;

  const limit = parseLimit(entry.limit);
  const ok = bytes <= limit;
  if (!ok) failed = true;
  entry.limit = write ? `${(Math.ceil((bytes / KB) * 10) / 10).toFixed(1)} kB` : entry.limit;
  rows.push({
    name: entry.name,
    gzip: `${(bytes / KB).toFixed(2)} kB`,
    limit: entry.limit,
    headroom: `${(((limit - bytes) / limit) * 100).toFixed(0)}%`,
    status: ok ? "ok" : "OVER",
  });
}

console.table(rows);

if (write) {
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log("[check-size] budgets rewritten to current sizes");
  process.exit(0);
}

if (failed) {
  console.error("\n[check-size] bundle budget exceeded — see the table above.");
  process.exit(1);
}
console.log("[check-size] all bundles within budget");
