import { expect, test } from '@playwright/test';

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
