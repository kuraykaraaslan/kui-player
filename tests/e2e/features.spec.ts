import { expect, test, type Page } from '@playwright/test';

/** The Phase 4 surfaces, driven in a real browser against real sidecar files. */

const currentTime = (page: Page) =>
  page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime);

test.describe('chapters and storyboards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?chapters=1&autohide=0');
    await expect(page.locator('.kui-time')).toContainText('0:30');
  });

  test('segments the seek bar from a WebVTT chapters file', async ({ page }) => {
    await expect(page.locator('.kui-chapter')).toHaveCount(3);
  });

  test('lists chapters in the menu and seeks to one', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('menuitem', { name: /Chapters/ }).click();
    await page.getByRole('menuitemradio', { name: /The middle/ }).click();
    await expect.poll(() => currentTime(page)).toBe(10);
  });

  test('previews the frame and the chapter under the pointer', async ({ page }) => {
    const bar = page.getByRole('slider', { name: 'Seek' });
    const box = (await bar.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);

    const preview = page.locator('.kui-preview');
    await expect(preview).toBeVisible();
    await expect(preview.locator('.kui-preview-chapter')).toHaveText('The end');
    // The storyboard cue points at a sprite rectangle, not a whole image.
    await expect(preview.locator('.kui-preview-frame')).toHaveCSS('background-position', '-160px 0px');
  });
});

test.describe('subtitles', () => {
  test('renders an SRT track the browser cannot load itself', async ({ page }) => {
    await page.goto('/?srt=1&autohide=0');
    await expect(page.locator('.kui-time')).toContainText('0:30');

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('menuitem', { name: /Subtitles/ }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();

    await page.locator('video').evaluate((v: HTMLVideoElement) => { v.currentTime = 2; return v.play(); });
    await expect(page.locator('.kui-subtitle-text')).toHaveText('SubRip caption', { timeout: 5000 });
  });

  test('applies caption colour and edge from the style menu', async ({ page }) => {
    await page.goto('/?autohide=0');
    await expect(page.locator('.kui-time')).toContainText('0:30');

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('menuitem', { name: /Subtitles/ }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await page.locator('video').evaluate((v: HTMLVideoElement) => { v.currentTime = 2; return v.play(); });
    await expect(page.locator('.kui-subtitle-text')).toBeVisible();

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('menuitem', { name: /Subtitle Style/ }).click();
    await page.getByRole('menuitemradio', { name: 'Yellow' }).click();

    await expect(page.locator('.kui-subtitle-text')).toHaveCSS('color', 'rgb(255, 235, 59)');
  });
});

test.describe('playlist', () => {
  test('offers the next item, and the viewer can take it early', async ({ page }) => {
    await page.goto('/?playlist=1&countdown=30&autohide=0');
    await expect(page.locator('.kui-time')).toContainText('0:30');

    await page.locator('video').evaluate((v: HTMLVideoElement) => { v.currentTime = v.duration - 0.2; return v.play(); });
    const card = page.locator('.kui-up-next');
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card).toContainText('Second item');

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(card).toHaveCount(0);
    // The player has moved on: the second item's title is now the player's.
    await expect(page.locator('.kui-title')).toHaveText('Second item');
  });
});

test.describe('localisation', () => {
  test('translates the controls', async ({ page }) => {
    await page.goto('/?locale=tr&autohide=0');
    await expect(page.getByRole('button', { name: 'Oynat' })).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Konum' })).toBeVisible();
  });

  test('mirrors the layout for Arabic', async ({ page }) => {
    await page.goto('/?locale=ar&autohide=0');
    await expect(page.locator('.kui-player')).toHaveAttribute('dir', 'rtl');
    // The control row is reversed, so play sits to the right of fullscreen.
    const play = (await page.getByRole('button', { name: 'تشغيل' }).boundingBox())!;
    const fullscreen = (await page.getByRole('button', { name: 'ملء الشاشة' }).boundingBox())!;
    expect(play.x).toBeGreaterThan(fullscreen.x);
  });
});

test.describe('persistence', () => {
  test('writes nothing by default, and offers a resume when switched on', async ({ page }) => {
    await page.goto('/?autohide=0');
    await expect(page.locator('.kui-time')).toContainText('0:30');
    await page.locator('video').evaluate((v: HTMLVideoElement) => { v.currentTime = 20; });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);

    // With persistence on, a position is stored and offered on the next visit.
    await page.goto('/?persist=1&autohide=0');
    await expect(page.locator('.kui-time')).toContainText('0:30');
    await page.evaluate(() => {
      const video = document.querySelector('video')!;
      video.currentTime = 20;
      video.dispatchEvent(new Event('timeupdate'));
    });
    await page.waitForTimeout(6000);

    await page.goto('/?persist=1&autohide=0');
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect.poll(() => currentTime(page)).toBeGreaterThan(15);
    await page.evaluate(() => localStorage.clear());
  });
});

test.describe('themes', () => {
  test('applies a preset without any other CSS', async ({ page }) => {
    await page.goto('/?theme=cinema&autohide=0');
    const player = page.locator('.kui-player');
    await expect(player).toHaveAttribute('data-kui-theme', 'cinema');
    await expect(page.locator('.kui-seek-played')).toHaveCSS('background-color', 'rgb(229, 9, 20)');
  });
});
