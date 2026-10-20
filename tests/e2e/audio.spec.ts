import { expect, test } from '@playwright/test';
import { decodePng, extent } from './fixtures/png';

test('podcast layout: artwork, a waveform that fills as it plays, and a working seek click', async ({ page }) => {
  await page.goto('/?audio=1');
  await expect(page.locator('.kui-artwork')).toBeVisible();
  await expect(page.locator('.kui-wave--base')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();   // controls are up without hovering

  // Clicking the wave seeks, like the plain bar does.
  const seek = page.getByRole('slider', { name: 'Seek' });
  const box = (await seek.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
  await expect.poll(() => page.evaluate(() => document.querySelector('video')!.currentTime)).toBeGreaterThan(10);
  await expect.poll(() => page.locator('.kui-wave--played').evaluate((el) => (el as SVGElement).style.clipPath)).toContain('inset(0px 50');
});

// jsdom applies no CSS, so the RTL mirroring was only ever checked as a rule in the source. This looks at pixels.
test.describe('waveform direction', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'pixel probe, checked in Chromium');

  for (const [name, locale] of [['LTR', 'en'], ['RTL', 'ar']] as const) {
    test(`${name}: the played part fills from the ${name === 'LTR' ? 'left' : 'right'} edge, in step with the bars`, async ({ page }) => {
      await page.goto(`/?audio=1&autohide=0&locale=${locale}`);
      await page.locator('.kui-wave--base').waitFor();
      await page.evaluate(() => { const v = document.querySelector('video')!; v.currentTime = 7.5; });   // 25% of 30 s
      await expect(page.locator('.kui-wave--played')).toHaveCSS('clip-path', /inset\(0px 75/);
      // Keep the pointer off the bar and the controls out of the sample.
      await page.mouse.move(0, 0);
      const wave = (await page.locator('.kui-wave--base').boundingBox())!;
      const shot = decodePng(await page.screenshot());
      const y0 = Math.round(wave.y + wave.height * 0.35);
      const y1 = Math.round(wave.y + wave.height * 0.65);
      const accent = ([r, g, b]: [number, number, number]) => b > 200 && r < 110 && g > 90 && g < 160;
      const played = extent(shot, y0, y1, accent);
      expect(played, 'accent-coloured bars are drawn').not.toBeNull();
      const left = Math.round(wave.x); const right = Math.round(wave.x + wave.width);
      const quarter = wave.width * 0.25;
      if (locale === 'en') {
        expect(played![0] - left).toBeLessThan(8);
        expect(played![1] - left).toBeGreaterThan(quarter - 12);
        expect(played![1] - left).toBeLessThan(quarter + 12);
      } else {
        expect(right - played![1]).toBeLessThan(8);
        expect(right - played![0]).toBeGreaterThan(quarter - 12);
        expect(right - played![0]).toBeLessThan(quarter + 12);
      }
      // The grey (unplayed) bars take the rest, so the two halves never overlap.
      const grey = extent(shot, y0, y1, ([r, g, b]) => Math.abs(r - g) < 6 && Math.abs(g - b) < 10 && r > 50 && r < 110);
      expect(grey).not.toBeNull();
    });
  }

  test('the bars themselves are mirrored: RTL draws the same peaks back to front', async ({ page }) => {
    const heights: Record<string, number[]> = {};
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const locale of ['en', 'ar']) {
      await page.goto(`/?audio=1&autohide=0&locale=${locale}`);
      await page.locator('.kui-wave--base').waitFor();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);   // let any fade finish: bar brightness is what is measured
      const wave = (await page.locator('.kui-wave--base').boundingBox())!;
      const shot = decodePng(await page.screenshot());
      const mid = Math.round(wave.y + wave.height / 2);
      // Tallest bar in each of 8 equal slices (a single column could land in the gap between bars).
      heights[locale] = Array.from({ length: 8 }, (_, k) => {
        let tallest = 0;
        for (let x = Math.round(wave.x + (k / 8) * wave.width) + 1; x < Math.round(wave.x + ((k + 1) / 8) * wave.width) - 1; x += 1) {
          let n = 0;
          for (let y = mid; y > mid - wave.height; y -= 1) {
            const [r, g, b] = shot.at(x, y);
            if (r + g + b < 60) break;
            n += 1;
          }
          tallest = Math.max(tallest, n);
        }
        return tallest;
      });
    }
    // Mirrored beats unmirrored by a clear margin (slice edges cut bars differently, so no per-slice equality).
    const gap = (flip: boolean) => heights.en!.reduce((sum, h, k) => sum + Math.abs(h - heights.ar![flip ? 7 - k : k]!), 0);
    expect(gap(true)).toBeLessThan(gap(false) / 2);
  });
});
