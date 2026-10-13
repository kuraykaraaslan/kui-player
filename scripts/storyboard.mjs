#!/usr/bin/env node
/*
 * Storyboard generator: one sprite sheet plus a `thumbs.vtt` that the seek
 * preview reads (`parseStoryboard`, `#xywh=` media fragments). Needs ffmpeg and
 * ffprobe on PATH; no npm dependencies.
 *
 *   node scripts/storyboard.mjs <video> [--out dir] [--interval 5]
 *        [--width 160] [--columns 10]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pad = (n, w = 2) => String(n).padStart(w, "0");

export function formatTimestamp(seconds) {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

/** Build the VTT text for a sprite of `count` tiles; pure, so it can be tested. */
export function buildVtt({ duration, interval, width, height, columns, sprite }) {
  const count = Math.max(1, Math.ceil(duration / interval));
  const lines = ["WEBVTT", ""];
  for (let i = 0; i < count; i++) {
    const start = i * interval;
    const end = Math.min(duration, start + interval);
    const x = (i % columns) * width;
    const y = Math.floor(i / columns) * height;
    lines.push(
      `${formatTimestamp(start)} --> ${formatTimestamp(end)}`,
      `${sprite}#xywh=${x},${y},${width},${height}`,
      "",
    );
  }
  return lines.join("\n");
}

function parseArgs(argv) {
  const opts = { out: "storyboard", interval: 5, width: 160, columns: 10 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) opts[a.slice(2)] = argv[++i];
    else rest.push(a);
  }
  return { input: rest[0], opts };
}

function main() {
  const { input, opts } = parseArgs(process.argv.slice(2));
  if (!input) {
    console.error("usage: storyboard.mjs <video> [--out dir] [--interval s] [--width px] [--columns n]");
    process.exit(1);
  }
  const interval = Number(opts.interval);
  const width = Number(opts.width);
  const columns = Number(opts.columns);
  if (![interval, width, columns].every((n) => Number.isFinite(n) && n > 0)) {
    console.error("interval, width and columns must be positive numbers");
    process.exit(1);
  }

  const probe = (entries) =>
    execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", entries,
      "-of", "csv=p=0", input], { encoding: "utf8" }).trim();
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
    "-of", "csv=p=0", input], { encoding: "utf8" }).trim());
  const [srcW, srcH] = probe("stream=width,height").split(",").map(Number);
  // Even height: some encoders reject odd dimensions.
  const height = Math.round((width * srcH) / srcW / 2) * 2;
  const count = Math.max(1, Math.ceil(duration / interval));
  const rows = Math.ceil(count / columns);

  const out = resolve(opts.out);
  mkdirSync(out, { recursive: true });
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", input,
    "-vf", `fps=1/${interval},scale=${width}:${height},tile=${columns}x${rows}`,
    "-frames:v", "1", "-q:v", "4", resolve(out, "sprite.jpg")], { stdio: "inherit" });
  writeFileSync(resolve(out, "thumbs.vtt"),
    buildVtt({ duration, interval, width, height, columns, sprite: "sprite.jpg" }));
  console.log(`wrote ${count} tiles (${columns}x${rows}) to ${out}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
