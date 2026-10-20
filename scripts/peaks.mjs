#!/usr/bin/env node
/*
 * Waveform peaks generator: decodes the audio with ffmpeg and writes
 * audiowaveform-compatible JSON ({ version, channels, sample_rate,
 * samples_per_pixel, bits, length, data: [min, max, ...] }) that the player's
 * `waveform` prop reads (`parsePeaks`). Needs ffmpeg on PATH; no npm dependencies.
 *
 *   node scripts/peaks.mjs <audio-or-video> [--out peaks.json]
 *        [--samples-per-pixel 256] [--sample-rate 8000] [--bits 8]
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Folds signed 16-bit little-endian mono PCM into min/max pairs, one per
 * `samplesPerPixel` samples. Streaming: feed chunks of any size (an odd byte
 * count is carried over), then call `finish()`. Pure, so it is testable
 * without ffmpeg.
 */
export class PeakAccumulator {
  constructor({ samplesPerPixel = 256, bits = 8 } = {}) {
    if (!Number.isInteger(samplesPerPixel) || samplesPerPixel < 1) throw new RangeError("samplesPerPixel must be a positive integer");
    if (bits !== 8 && bits !== 16) throw new RangeError("bits must be 8 or 16");
    this.samplesPerPixel = samplesPerPixel;
    this.bits = bits;
    this.data = [];
    this.count = 0;
    this.min = 0;
    this.max = 0;
    this.carry = null;
  }

  /** Scale a 16-bit sample into the signed range of `bits`. */
  scale(v) {
    return this.bits === 16 ? v : Math.max(-128, Math.min(127, Math.round(v / 256)));
  }

  push(chunk) {
    let buf = chunk;
    if (this.carry !== null) buf = Buffer.concat([Buffer.from([this.carry]), chunk]);
    const usable = buf.length - (buf.length % 2);
    this.carry = usable < buf.length ? buf[buf.length - 1] : null;
    for (let i = 0; i < usable; i += 2) this.add(buf.readInt16LE(i));
  }

  add(sample) {
    if (this.count === 0) { this.min = sample; this.max = sample; }
    else if (sample < this.min) this.min = sample;
    else if (sample > this.max) this.max = sample;
    this.count += 1;
    if (this.count === this.samplesPerPixel) this.flush();
  }

  flush() {
    this.data.push(this.scale(this.min), this.scale(this.max));
    this.count = 0;
  }

  /** The audiowaveform document; a trailing partial pixel is kept. */
  finish(sampleRate) {
    if (this.count > 0) this.flush();
    return {
      version: 2,
      channels: 1,
      sample_rate: sampleRate,
      samples_per_pixel: this.samplesPerPixel,
      bits: this.bits,
      length: this.data.length / 2,
      data: this.data,
    };
  }
}

/** Whole PCM buffer to a document, for small inputs and tests. */
export function buildPeaks(pcm, { sampleRate = 8000, samplesPerPixel = 256, bits = 8 } = {}) {
  const acc = new PeakAccumulator({ samplesPerPixel, bits });
  acc.push(Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
  return acc.finish(sampleRate);
}

const USAGE = "usage: peaks.mjs <input> [--out file] [--samples-per-pixel n] [--sample-rate hz] [--bits 8|16]";
const FLAGS = new Set(["out", "samples-per-pixel", "sample-rate", "bits"]);

/** Throws on an unknown flag or a flag with no value; a value may not itself look like a flag. */
export function parseArgs(argv) {
  const opts = { out: "peaks.json", "samples-per-pixel": 256, "sample-rate": 8000, bits: 8 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const name = a.slice(2);
      if (!FLAGS.has(name)) throw new Error(`unknown option ${a}`);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${a} needs a value`);
      opts[name] = value;
      i++;
    } else rest.push(a);
  }
  return { input: rest[0], opts };
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`${e.message}\n${USAGE}`);
    process.exit(1);
  }
  const { input, opts } = parsed;
  if (!input) {
    console.error(USAGE);
    process.exit(1);
  }
  const out = resolve(opts.out);
  const samplesPerPixel = Number(opts["samples-per-pixel"]);
  const sampleRate = Number(opts["sample-rate"]);
  const bits = Number(opts.bits);
  let acc;
  try {
    if (!Number.isInteger(sampleRate) || sampleRate < 1) throw new RangeError("sample-rate must be a positive integer");
    acc = new PeakAccumulator({ samplesPerPixel, bits });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  // Mono, signed 16-bit little-endian, no video: the simplest thing to fold.
  const ff = spawn("ffmpeg", ["-v", "error", "-i", input, "-vn", "-ac", "1", "-ar", String(sampleRate), "-f", "s16le", "-"],
    { stdio: ["ignore", "pipe", "inherit"] });
  ff.on("error", (e) => { console.error(`could not run ffmpeg: ${e.message}`); process.exit(1); });
  ff.stdout.on("data", (chunk) => acc.push(chunk));
  ff.on("close", (code) => {
    if (code !== 0) { console.error(`ffmpeg exited with ${code}`); process.exit(1); }
    const doc = acc.finish(sampleRate);
    if (doc.length === 0) { console.error("ffmpeg produced no audio samples (does the input have an audio track?)"); process.exit(1); }
    const stream = createWriteStream(out);
    stream.end(JSON.stringify(doc));
    stream.on("finish", () => console.log(`wrote ${doc.length} peaks to ${out}`));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
