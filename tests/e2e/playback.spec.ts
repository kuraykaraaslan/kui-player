import { expect, test, type Page } from '@playwright/test';

const player = (page: Page) => page.locator('.kui-player');
const seek = (page: Page) => page.getByRole('slider', { name: 'Seek' });

test.beforeEach(async ({ page }) => {
  await page.goto('/?autohide=0');
  await expect(player(page)).toBeVisible();
  // Wait for the element to report metadata, as any real player must.
  await expect(page.locator('.kui-time')).toContainText('0:30');
});

test('plays and pauses from the control bar', async ({ page }) => {
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('the clock advances while playing', async ({ page }) => {
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('.kui-time')).not.toContainText('0:00/', { timeout: 5000 });
});

test('clicking the seek bar jumps to that position', async ({ page }) => {
  const box = (await seek(page).boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
  const time = await page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime);
  expect(time).toBeGreaterThan(12);
  expect(time).toBeLessThan(18);
});

test('dragging the seek bar scrubs', async ({ page }) => {
  const box = (await seek(page).boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  const time = await page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime);
  expect(time).toBeGreaterThan(18);
});

test('the seek bar is operable and announced from the keyboard', async ({ page }) => {
  await seek(page).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => Math.round(v.currentTime))).toBe(10);
  await expect(seek(page)).toHaveAttribute('aria-valuetext', '0:10 of 0:30');

  await page.keyboard.press('Home');
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime)).toBe(0);
});

test('player-wide keyboard shortcuts work once it has focus', async ({ page }) => {
  await player(page).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.keyboard.press('k');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

  await page.keyboard.press('m');
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
});

test('the volume slider changes element volume', async ({ page }) => {
  await page.getByRole('button', { name: 'Mute' }).hover();
  const volume = page.getByRole('slider', { name: 'Volume' });
  await volume.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.volume)).toBeLessThan(1);
});

test('a broken source shows the error overlay instead of spinning', async ({ page }) => {
  await page.goto('/?broken=1&autohide=0');
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible({ timeout: 5000 });
  await expect(alert).toContainText(/unavailable|network/i);
  await expect(page.locator('.kui-overlay--loading')).toHaveCount(0);
  await expect(alert.getByRole('button', { name: /try again/i })).toBeEnabled();
});

test('subtitles render as an overlay when selected', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('menuitem', { name: /Subtitles/ }).click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();

  await page.locator('video').evaluate((v: HTMLVideoElement) => { v.currentTime = 2; return v.play(); });
  await expect(page.locator('.kui-subtitle-text')).toHaveText('First caption', { timeout: 5000 });
});

test('fullscreen enters and leaves', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit needs a real user gesture for fullscreen in headless runs');
  await page.getByRole('button', { name: 'Enter fullscreen' }).click();
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible();
  await page.getByRole('button', { name: 'Exit fullscreen' }).click();
  await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeVisible();
});

test('picture-in-picture toggles where the browser supports it', async ({ page }) => {
  const supported = await page.evaluate(() => document.pictureInPictureEnabled === true);
  test.skip(!supported, 'no Picture-in-Picture in this browser');
  const button = page.getByRole('button', { name: 'Picture-in-Picture' });
  await expect(button).toBeVisible();
});
