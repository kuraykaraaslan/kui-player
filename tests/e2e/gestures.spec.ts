import { expect, test, type Page } from '@playwright/test';

/** Touch gestures only — this file runs under the mobile device project. */

const surface = (page: Page) => page.locator('.kui-player');
const currentTime = (page: Page) => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime);

async function tapAt(page: Page, ratioX: number) {
  const box = (await surface(page).boundingBox())!;
  await page.touchscreen.tap(box.x + box.width * ratioX, box.y + box.height * 0.4);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?autohide=0');
  await expect(page.locator('.kui-time')).toContainText('0:30');
  await page.locator('video').evaluate((v: HTMLVideoElement) => { v.currentTime = 15; });
});

test('double-tapping the right half skips forward', async ({ page }) => {
  await tapAt(page, 0.8);
  await tapAt(page, 0.8);
  await expect(page.locator('.kui-gesture-side--right')).toBeVisible();
  await expect.poll(() => currentTime(page)).toBeGreaterThan(15);
});

test('double-tapping the left half skips back', async ({ page }) => {
  await tapAt(page, 0.2);
  await tapAt(page, 0.2);
  await expect(page.locator('.kui-gesture-side--left')).toBeVisible();
  await expect.poll(() => currentTime(page)).toBeLessThan(15);
});

test('a single tap toggles the controls instead of pausing', async ({ page }) => {
  await page.goto('/');   // auto-hide on, so the chrome is togglable
  await expect(page.locator('.kui-time')).toContainText('0:30');
  const paused = await page.locator('video').evaluate((v: HTMLVideoElement) => v.paused);

  await tapAt(page, 0.5);
  await expect(page.locator('.kui-chrome')).toHaveClass(/is-hidden/);
  expect(await page.locator('video').evaluate((v: HTMLVideoElement) => v.paused)).toBe(paused);

  await tapAt(page, 0.5);
  await expect(page.locator('.kui-chrome')).not.toHaveClass(/is-hidden/);
});

test('holding plays at double speed and releases back', async ({ page }) => {
  const box = (await surface(page).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height * 0.4;

  await page.touchscreen.tap(x, y);   // ensure the surface is live
  await page.dispatchEvent('.kui-player', 'pointerdown', { pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true });
  await expect(page.locator('.kui-gesture-card')).toContainText('2× speed');
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.playbackRate)).toBe(2);

  await page.dispatchEvent('.kui-player', 'pointerup', { pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true });
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.playbackRate)).toBe(1);
});

test('the seek bar keeps a finger-sized touch target', async ({ page }) => {
  const box = (await page.getByRole('slider', { name: 'Seek' }).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
});
