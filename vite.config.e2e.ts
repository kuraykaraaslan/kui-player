import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Synthesises the media the end-to-end specs play. A hand-built WAV needs no
 * encoder and no checked-in binary, and every target browser decodes it — the
 * specs assert on playback state, timing and controls, none of which care that
 * the media carries no picture (the poster stands in for one).
 */
function mediaFixtures(): Plugin {
  const SECONDS = 30;
  const RATE = 8000;

  function wav(): Buffer {
    const samples = SECONDS * RATE;
    const data = Buffer.alloc(samples);
    for (let i = 0; i < samples; i += 1) {
      data[i] = 128 + Math.round(40 * Math.sin((2 * Math.PI * 220 * i) / RATE));
    }
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + data.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);       // PCM chunk size
    header.writeUInt16LE(1, 20);        // PCM
    header.writeUInt16LE(1, 22);        // mono
    header.writeUInt32LE(RATE, 24);
    header.writeUInt32LE(RATE, 28);     // byte rate
    header.writeUInt16LE(1, 32);        // block align
    header.writeUInt16LE(8, 34);        // bits per sample
    header.write('data', 36);
    header.writeUInt32LE(data.length, 40);
    return Buffer.concat([header, data]);
  }

  const clip = wav();
  const poster = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">' +
    '<rect width="640" height="360" fill="#1d283a"/>' +
    '<text x="320" y="190" fill="#7f9cf5" font-family="sans-serif" font-size="28" text-anchor="middle">kui-player</text></svg>',
  );
  const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nFirst caption\n\n00:00:04.000 --> 00:00:07.000\nSecond caption\n';
  const srt = '1\n00:00:01,000 --> 00:00:04,000\nSubRip caption\n\n2\n00:00:04,000 --> 00:00:07,000\nSecond SubRip line\n';
  const chapters = 'WEBVTT\n\n00:00:00.000 --> 00:00:10.000\nOpening\n\n00:00:10.000 --> 00:00:20.000\nThe middle\n\n00:00:20.000 --> 00:00:30.000\nThe end\n';
  const storyboard = 'WEBVTT\n\n00:00:00.000 --> 00:00:15.000\n/media/poster.svg#xywh=0,0,160,90\n\n00:00:15.000 --> 00:00:30.000\n/media/poster.svg#xywh=160,0,160,90\n';

  return {
    name: 'kui-e2e-media',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (url === '/media/clip.wav') {
          // Range support: browsers seek by requesting byte ranges.
          const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Type', 'audio/wav');
          if (range) {
            const start = Number(range[1] || 0);
            const end = range[2] ? Number(range[2]) : clip.length - 1;
            res.statusCode = 206;
            res.setHeader('Content-Range', `bytes ${start}-${end}/${clip.length}`);
            res.setHeader('Content-Length', end - start + 1);
            res.end(clip.subarray(start, end + 1));
            return;
          }
          res.setHeader('Content-Length', clip.length);
          res.end(clip);
          return;
        }
        if (url === '/media/poster.svg') {
          res.setHeader('Content-Type', 'image/svg+xml');
          res.end(poster);
          return;
        }
        if (url === '/media/en.vtt') {
          res.setHeader('Content-Type', 'text/vtt');
          res.end(vtt);
          return;
        }
        if (url === '/media/en.srt') {
          res.setHeader('Content-Type', 'text/plain');
          res.end(srt);
          return;
        }
        if (url === '/media/chapters.vtt') {
          res.setHeader('Content-Type', 'text/vtt');
          res.end(chapters);
          return;
        }
        if (url === '/media/storyboard.vtt') {
          res.setHeader('Content-Type', 'text/vtt');
          res.end(storyboard);
          return;
        }
        if (url === '/media/missing.wav') {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        next();
      });
    },
  };
}

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

export default defineConfig({
  define: { __KUI_VERSION__: JSON.stringify(pkg.version) },
  root: resolve(__dirname, 'tests/e2e/app'),
  plugins: [react(), mediaFixtures()],
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  server: { port: 5174, strictPort: true },
});
