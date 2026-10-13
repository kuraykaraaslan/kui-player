import { expect, test } from '@playwright/test';

/**
 * Document Picture-in-Picture is Chromium-only and needs a real window, so the
 * flow runs where the API exists and is skipped elsewhere (the component tests
 * cover the logic against a mocked window).
 */
test('moves the player into a PiP window with working controls, and back', async ({ page }) => {
  await page.goto('/?docpip=1&autohide=0');
  const supported = await page.evaluate(() => 'documentPictureInPicture' in window);
  test.skip(!supported, 'Document Picture-in-Picture is not available in this browser');

  await page.getByRole('button', { name: 'Play' }).click();
  await expect.poll(() => page.evaluate(() => !document.querySelector('video')!.paused)).toBe(true);

  const opened = page.waitForEvent('popup').catch(() => null);
  await page.getByRole('button', { name: 'Picture-in-Picture' }).click();
  const pip = await opened;
  test.skip(!pip, 'the browser did not open a PiP window (headless / no user activation)');

  await expect(page.locator('.kui-pip-placeholder')).toBeVisible();
  // Playing on: the same <video> was moved, not re-created.
  await expect.poll(() => pip!.evaluate(() => !document.querySelector('video')!.paused)).toBe(true);

  // The controls work inside the PiP window (React events travel with the moved container).
  await pip!.getByRole('button', { name: 'Pause' }).first().click();
  await expect.poll(() => pip!.evaluate(() => document.querySelector('video')!.paused)).toBe(true);

  // Closing the window brings the player home.
  await pip!.close();
  await expect(page.locator('.kui-pip-placeholder')).toHaveCount(0);
  await expect(page.locator('.kui-player video')).toHaveCount(1);
});
