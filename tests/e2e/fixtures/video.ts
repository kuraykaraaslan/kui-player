import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { chromium } from '@playwright/test';

/**
 * A real picture to play. The other fixtures are a silent WAV, which cannot
 * exercise anything that needs video frames (frame stepping, fps measurement,
 * an overlay sized against the picture). There is no encoder in the repo and
 * no binary checked in, so this renders numbered frames in Chromium and
 * encodes them with the ffmpeg build Playwright installs next to its browsers
 * (it can only write VP9, which is all we need). Without either, no file is
 * produced and the specs that need it skip.
 */
export const TEST_VIDEO_FPS = 25;
export const TEST_VIDEO_SECONDS = 10;
export const TEST_VIDEO_PATH = join(tmpdir(), 'kui-player-e2e', 'test.webm');

function findFfmpeg(): string | null {
  try {
    const root = dirname(dirname(dirname(chromium.executablePath())));
    for (const dir of readdirSync(root)) {
      if (!dir.startsWith('ffmpeg-')) continue;
      const bin = readdirSync(join(root, dir)).find((f) => f.startsWith('ffmpeg-'));
      if (bin) return join(root, dir, bin);
    }
  } catch { /* no browsers installed here */ }
  return null;
}

export async function ensureTestVideo(): Promise<void> {
  if (existsSync(TEST_VIDEO_PATH)) return;
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) return;
  mkdirSync(dirname(TEST_VIDEO_PATH), { recursive: true });
  const jpegs = `${TEST_VIDEO_PATH}.${process.pid}.mjpeg`;
  const partial = `${TEST_VIDEO_PATH}.${process.pid}.part.webm`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const frames = await page.evaluate(([count, fps]) => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d')!;
      const out: string[] = [];
      for (let i = 0; i < count; i += 1) {
        ctx.fillStyle = `hsl(${(i * 3) % 360} 60% 35%)`;
        ctx.fillRect(0, 0, 320, 180);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 64px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(i), 160, 110);
        ctx.font = '14px sans-serif';
        ctx.fillText(`${(i / fps).toFixed(2)} s`, 160, 150);
        out.push(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]!);
      }
      return out;
    }, [TEST_VIDEO_SECONDS * TEST_VIDEO_FPS, TEST_VIDEO_FPS] as const);

    // This ffmpeg build has no pipe protocol, so the frames go through a file of concatenated JPEGs.
    writeFileSync(jpegs, Buffer.concat(frames.map((f) => Buffer.from(f, 'base64'))));
    await new Promise<void>((resolve, reject) => {
      const p = spawn(ffmpeg, [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'image2pipe', '-framerate', String(TEST_VIDEO_FPS), '-c:v', 'mjpeg', '-i', jpegs,
        '-c:v', 'libvpx-vp9', '-b:v', '250k', '-g', String(TEST_VIDEO_FPS), '-pix_fmt', 'yuv420p', partial,
      ]);
      p.stderr.on('data', (d: Buffer) => process.stderr.write(d));
      p.on('error', reject);
      p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
    });
    renameSync(partial, TEST_VIDEO_PATH);   // atomic: a parallel run never serves half a file
  } finally {
    await browser.close();
    rmSync(jpegs, { force: true });
  }
}
