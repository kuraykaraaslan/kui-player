import { expect, test, type Page } from '@playwright/test';

/**
 * Skin mode with the presence check and alternate sources, in a real browser:
 * what jsdom cannot show is the controls inside a shadow root answering real
 * clicks (the settings panel used to close on the mousedown that opened a menu
 * item) and one prompt over the page for several skinned elements.
 */

type SkinTest = {
  presenceWall: (count: number, everyMs: number, graceMs: number) => number;
  alternates: (prefer: boolean) => void;
};
const skinTest = <K extends keyof SkinTest>(page: Page, name: K, ...args: Parameters<SkinTest[K]>) =>
  page.evaluate(([n, a]) => (window as unknown as { skinTest: Record<string, (...x: unknown[]) => unknown> }).skinTest[n as string]!(...(a as unknown[])), [name, args] as const);

test.describe('presence check across skinned videos', () => {
  test('nine skinned videos ask once, and stop together when nobody answers', async ({ page }) => {
    await page.goto('/skin.html?wall=9&pe=3000&pg=2500');
    await expect(page.locator('video.wall')).toHaveCount(9);
    await expect(page.locator('[data-tepegoz-video-player]')).toHaveCount(9);

    // Playing them is the viewer's doing; press each Play in turn.
    await page.evaluate(() => Promise.all([...document.querySelectorAll<HTMLVideoElement>('video.wall')].map((v) => v.play())));

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toHaveCount(1, { timeout: 8000 });
    await expect(dialog).toContainText('Still watching?');
    await expect(dialog.getByRole('button', { name: 'Continue' })).toBeFocused();

    await expect(page.locator('.kui-overlay--paused')).toHaveCount(9, { timeout: 8000 });
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => [...document.querySelectorAll('video.wall')].every((v) => (v as HTMLVideoElement).paused))).toBe(true);
  });

  test('Continue keeps them all playing', async ({ page }) => {
    await page.goto('/skin.html?wall=3&pe=2000&pg=2000');
    await page.evaluate(() => Promise.all([...document.querySelectorAll<HTMLVideoElement>('video.wall')].map((v) => v.play())));
    await page.getByRole('alertdialog').getByRole('button', { name: 'Continue' }).click({ timeout: 8000 });
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await page.waitForTimeout(2500);
    await expect(page.locator('.kui-overlay--paused')).toHaveCount(0);
    expect(await page.evaluate(() => [...document.querySelectorAll('video.wall')].every((v) => !(v as HTMLVideoElement).paused))).toBe(true);
  });

  test('a video marked data-kui-presence="off" is left alone', async ({ page }) => {
    await page.goto('/skin.html?wall=2&pe=1500&pg=1000&optout=1');
    await expect(page.locator('[data-tepegoz-video-player]')).toHaveCount(2);
    await page.evaluate(() => Promise.all([...document.querySelectorAll<HTMLVideoElement>('video.wall')].map((v) => v.play())));
    await expect(page.locator('.kui-overlay--paused')).toHaveCount(1, { timeout: 8000 });
    expect(await page.evaluate(() => document.querySelectorAll<HTMLVideoElement>('video.wall')[0]!.paused)).toBe(false);
  });
});

test.describe('alternate sources on a skinned video', () => {
  const currentSrc = (page: Page) => page.evaluate(() => document.querySelector<HTMLVideoElement>('#one')!.currentSrc);

  test('are listed in the quality menu and switch the source', async ({ page }) => {
    await page.goto('/skin.html');
    await skinTest(page, 'alternates', false);
    await expect.poll(() => currentSrc(page)).toContain('hd=0');

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('menuitem', { name: /Quality/ }).click();
    await expect(page.getByRole('menuitemradio', { name: 'Standard' })).toBeVisible();
    await page.getByRole('menuitemradio', { name: 'High' }).click();
    await expect.poll(() => currentSrc(page)).toContain('hd=1');
    expect(await page.evaluate(() => (window as unknown as { __sourceChanges: number[] }).__sourceChanges)).toEqual([1]);
  });

  test('can follow fullscreen: High on the big screen, Standard in the card', async ({ page }) => {
    await page.goto('/skin.html');
    await skinTest(page, 'alternates', true);
    await expect.poll(() => currentSrc(page)).toContain('hd=0');

    await page.getByRole('button', { name: 'Enter fullscreen' }).click();
    await expect.poll(() => currentSrc(page)).toContain('hd=1');
    await page.getByRole('button', { name: 'Exit fullscreen' }).click();
    await expect.poll(() => currentSrc(page)).toContain('hd=0');
  });
});
