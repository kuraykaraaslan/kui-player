import { expect, test, type Page } from '@playwright/test';

/**
 * Skin mode against real elements the page owns — the differentiating feature,
 * so it gets the same treatment as playback: driven in a browser, not mocked.
 */

type SkinTest = {
  skinAll: (selector?: string) => number;
  stop: () => void;
  count: () => number;
  addVideo: () => void;
};

const skin = (page: Page) => ({
  skinAll: (selector?: string) => page.evaluate((s) => (window as unknown as { skinTest: SkinTest }).skinTest.skinAll(s), selector),
  stop: () => page.evaluate(() => (window as unknown as { skinTest: SkinTest }).skinTest.stop()),
  count: () => page.evaluate(() => (window as unknown as { skinTest: SkinTest }).skinTest.count()),
  addVideo: () => page.evaluate(() => (window as unknown as { skinTest: SkinTest }).skinTest.addVideo()),
});

const overlays = (page: Page) => page.locator('[data-tepegoz-video-player]');

test.beforeEach(async ({ page }) => {
  await page.goto('/skin.html');
  await expect(page.locator('#one')).toBeVisible();
});

test('installs a global and skins the page\'s own videos', async ({ page }) => {
  expect(await page.evaluate(() => typeof window.kuiPlayer?.skinAll)).toBe('function');
  expect(await skin(page).skinAll()).toBe(2);
  await expect(overlays(page)).toHaveCount(2);

  // Both elements are marked, and neither was replaced.
  await expect(page.locator('#one[data-kui-skinned]')).toHaveCount(1);
  await expect(page.locator('#two[data-kui-skinned]')).toHaveCount(1);
});

test('takes over the native controls and gives them back', async ({ page }) => {
  const controls = () => page.locator('#one').evaluate((v: HTMLVideoElement) => v.controls);
  expect(await controls()).toBe(true);

  await skin(page).skinAll();
  expect(await controls()).toBe(false);

  await skin(page).stop();
  expect(await controls()).toBe(true);
  await expect(overlays(page)).toHaveCount(0);
  await expect(page.locator('[data-kui-skinned]')).toHaveCount(0);
});

test('drives the element it adopted', async ({ page }) => {
  await skin(page).skinAll('#one');
  const video = page.locator('#one');
  await expect(page.locator('.kui-player')).toBeVisible();

  await page.getByRole('button', { name: 'Play' }).first().click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);

  await page.getByRole('button', { name: 'Forward 10 seconds' }).first().click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(9);
});

test('covers the visible player box, not just the raw element', async ({ page }) => {
  await skin(page).skinAll('#two');
  const overlay = overlays(page).first();
  const box = (await overlay.boundingBox())!;
  const videoBox = (await page.locator('#two').boundingBox())!;

  // The wrapper is wider than the element; the overlay must not be narrower
  // than the video, and must stay centred on it.
  expect(box.width).toBeGreaterThanOrEqual(videoBox.width - 1);
  const overlayCentre = box.x + box.width / 2;
  const videoCentre = videoBox.x + videoBox.width / 2;
  expect(Math.abs(overlayCentre - videoCentre)).toBeLessThan(12);
});

test('picks up videos added after it started', async ({ page }) => {
  await skin(page).skinAll();
  await expect(overlays(page)).toHaveCount(2);

  await skin(page).addVideo();
  await expect(overlays(page)).toHaveCount(3);
  expect(await skin(page).count()).toBe(3);
});

test('skinning twice does not stack two chromes on one video', async ({ page }) => {
  await skin(page).skinAll('#one');
  await skin(page).skinAll('#one');
  await expect(overlays(page)).toHaveCount(1);
});

test('auto-starts from the script tag configuration', async ({ page }) => {
  await page.goto('/skin.html?auto=1&accent=%23ff0000');
  await expect(overlays(page)).toHaveCount(2);
  // The accent is set on the shadow-root wrapper; the chrome must inherit it,
  // which only works because the stylesheet reads the public token rather than
  // redeclaring it.
  const accent = await page.locator('.kui-player').first().evaluate(
    (el) => getComputedStyle(el).getPropertyValue('--_kui-accent').trim(),
  );
  expect(accent).toBe('#ff0000');
  const played = await page.locator('.kui-seek-played').first().evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(played).toBe('rgb(255, 0, 0)');
});
