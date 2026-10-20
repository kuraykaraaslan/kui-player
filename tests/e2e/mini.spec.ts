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

test('drags by the handle, snaps to the nearest corner, and never moves the <video> node', async ({ page }) => {
  await page.goto('/?mini=1&autohide=0');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.evaluate(() => { (window as unknown as { __v: Element }).__v = document.querySelector('video')!; });
  await page.evaluate(() => window.scrollTo(0, 1500));
  const player = page.locator('.kui-player.is-mini');
  await expect(player).toBeVisible();
  await expect(player).toHaveAttribute('data-kui-mini', 'bottom-right');

  const handle = page.getByRole('button', { name: /Move mini player/ });
  const h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(40, 40, { steps: 6 });
  await expect(player).toHaveAttribute('data-kui-dragging', '');
  await page.mouse.move(-500, -500, { steps: 3 });   // past the viewport: clamped
  const dragged = (await player.boundingBox())!;
  expect(dragged.x).toBeGreaterThanOrEqual(-1);
  expect(dragged.y).toBeGreaterThanOrEqual(-1);
  await page.mouse.up();

  await expect(player).toHaveAttribute('data-kui-mini', 'top-left');
  await expect(player).not.toHaveAttribute('data-kui-dragging');
  await expect.poll(async () => (await player.boundingBox())!.x).toBeLessThan(24);
  expect(await page.evaluate(() => document.querySelector('video') === (window as unknown as { __v: Element }).__v)).toBe(true);
  expect(await page.evaluate(() => !document.querySelector('video')!.paused)).toBe(true);

  // The buttons still work after the drag, and the keyboard alternative moves it too.
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await expect(player).toHaveAttribute('data-kui-mini', 'top-right');
  await page.getByRole('button', { name: 'Close mini player' }).click();
  await expect(player).toHaveCount(0);
});

async function floatMini(page: import('@playwright/test').Page, mini = '1') {
  await page.goto(`/?mini=${mini}&autohide=0`);
  await page.getByRole('button', { name: 'Play' }).click();
  await page.evaluate(() => window.scrollTo(0, 1500));
  const player = page.locator('.kui-player.is-mini');
  await expect(player).toBeVisible();
  return player;
}

test('Escape mid-drag cancels the drag without the handle being focused', async ({ page }) => {
  const player = await floatMini(page);
  const h = (await page.getByRole('button', { name: /Move mini player/ }).boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(40, 40, { steps: 6 });
  await expect(player).toHaveAttribute('data-kui-dragging', '');
  await page.keyboard.press('Escape');
  await expect(player).not.toHaveAttribute('data-kui-dragging');
  await page.mouse.up();
  await expect(player).toHaveAttribute('data-kui-mini', 'bottom-right');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('a drop snaps without a Web Animations glide', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __anim: number }).__anim = 0;
      const orig = Element.prototype.animate;
      Element.prototype.animate = function (...args: Parameters<Element['animate']>) {
        (window as unknown as { __anim: number }).__anim++;
        return orig.apply(this, args);
      };
    });
    const player = await floatMini(page);
    const before = await page.evaluate(() => (window as unknown as { __anim: number }).__anim);
    const h = (await page.getByRole('button', { name: /Move mini player/ }).boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(40, 40, { steps: 6 });
    await page.mouse.up();
    await expect(player).toHaveAttribute('data-kui-mini', 'top-left');
    expect(await page.evaluate(() => (window as unknown as { __anim: number }).__anim)).toBe(before);
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('a touch pointer drags by the handle too', async ({ page }) => {
    const player = await floatMini(page, 'touch');
    const h = (await page.getByRole('button', { name: /Move mini player/ }).boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const x = h.x + h.width / 2, y = h.y + h.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 6; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - (x - 40) * i / 6, y: y - (y - 40) * i / 6 }] });
    }
    await expect(player).toHaveAttribute('data-kui-dragging', '');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(player).toHaveAttribute('data-kui-mini', 'top-left');
  });
});
