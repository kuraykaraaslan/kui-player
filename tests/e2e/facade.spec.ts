import { expect, test } from '@playwright/test';

/**
 * The facade's promise: until the viewer clicks, the page carries a poster and
 * a button — no media request, no <video>, no player. Then one click loads the
 * player and starts it.
 */
test('loads nothing until clicked, then plays', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (request) => urls.push(new URL(request.url()).pathname));

  await page.goto('/?facade=1&prefetch=0');
  const button = page.getByRole('button', { name: 'Play Test clip' });
  await expect(button).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(urls).not.toContain('/media/clip.wav');
  expect(urls.filter((url) => /react\/(VideoPlayer|VideoPlayerChrome)\.tsx$/.test(url))).toEqual([]);
  await expect(page.locator('video')).toHaveCount(0);

  await button.click();
  await expect(page.locator('video')).toHaveCount(1);
  await expect.poll(() => urls.includes('/media/clip.wav')).toBe(true);
  await expect.poll(() => page.evaluate(() => !document.querySelector('video')!.paused)).toBe(true);
});

test('keeps its size from first paint to the loaded player', async ({ page }) => {
  await page.goto('/?facade=1&prefetch=0');
  const stage = page.locator('#stage > div').first();
  const before = await stage.boundingBox();
  await page.getByRole('button', { name: 'Play Test clip' }).click();
  await expect(page.locator('video')).toHaveCount(1);
  const after = await page.locator('#stage > div').first().boundingBox();
  expect(Math.round(after!.height)).toBe(Math.round(before!.height));
});
