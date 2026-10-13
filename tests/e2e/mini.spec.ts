import { expect, test } from '@playwright/test';

test('floats into a corner when scrolled away while playing, without interrupting playback', async ({ page }) => {
  await page.goto('/?mini=1&autohide=0');
  await page.getByRole('button', { name: 'Play' }).click();
  await expect.poll(() => page.evaluate(() => !document.querySelector('video')!.paused)).toBe(true);
  await page.evaluate(() => { (window as unknown as { __v: Element }).__v = document.querySelector('video')!; });

  await page.evaluate(() => window.scrollTo(0, 1500));
  const player = page.locator('.kui-player.is-mini');
  await expect(player).toBeVisible();
  const box = await player.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.y + box!.height).toBeGreaterThan(viewport.height - 40);   // docked at the bottom
  expect(box!.width).toBeLessThan(viewport.width / 2 + 1);

  // The same <video> node, still playing: nothing was moved or reloaded.
  expect(await page.evaluate(() => document.querySelector('video') === (window as unknown as { __v: Element }).__v)).toBe(true);
  expect(await page.evaluate(() => !document.querySelector('video')!.paused)).toBe(true);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('.kui-player.is-mini')).toHaveCount(0);
});

test('"Back to the video" scrolls home; closing pauses', async ({ page }) => {
  await page.goto('/?mini=1&autohide=0');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.getByRole('button', { name: 'Back to the video' }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(1000);

  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.getByRole('button', { name: 'Close mini player' }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector('video')!.paused)).toBe(true);
  await expect(page.locator('.kui-player.is-mini')).toHaveCount(0);
});
