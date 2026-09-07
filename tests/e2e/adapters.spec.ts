import { expect, test } from '@playwright/test';

/**
 * The adapter path end to end in a browser: a stub streaming adapter stands in
 * for hls.js (whose own behaviour is covered by unit tests), proving the parts
 * the integration owns — routing, `<source>` suppression, the rendition menu.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/?adapter=1&autohide=0');
  await expect(page.locator('.kui-player')).toBeVisible();
});

test('an adapter takes over the element for the sources it claims', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => (window as unknown as { __adapterAttached?: string }).__adapterAttached))
    .toBe('https://example.com/live.stream');
  // The element must carry no <source> children when an adapter owns it.
  await expect(page.locator('video source')).toHaveCount(0);
});

test('renditions from the adapter fill the quality menu, with Auto', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('menuitem', { name: /Quality/ })).toContainText('Auto');

  await page.getByRole('menuitem', { name: /Quality/ }).click();
  await expect(page.getByRole('menuitemradio', { name: /^Auto/ })).toBeVisible();
  await expect(page.getByRole('menuitemradio', { name: '1080p', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitemradio', { name: '720p', exact: true })).toBeVisible();
});

test('choosing a rendition goes through the adapter, not a source swap', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('menuitem', { name: /Quality/ }).click();
  await page.getByRole('menuitemradio', { name: '720p', exact: true }).click();

  await expect.poll(() => page.evaluate(() => (window as unknown as { __adapterQuality?: number }).__adapterQuality)).toBe(1);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('menuitem', { name: /Quality/ }).click();
  await page.getByRole('menuitemradio', { name: /^Auto/ }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __adapterQuality?: number }).__adapterQuality)).toBe(-1);
});

test('audio renditions discovered by the adapter really switch', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('menuitem', { name: /Audio Language/ }).click();
  await page.getByRole('menuitemradio', { name: 'Türkçe' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __adapterAudio?: number }).__adapterAudio)).toBe(1);
});
