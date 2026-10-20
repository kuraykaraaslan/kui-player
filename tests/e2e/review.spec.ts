import { expect, test, type Page } from '@playwright/test';

/*
 * What the jsdom suites cannot see: real layout, a real <video> with a real
 * picture, and the real `requestVideoFrameCallback` clock. They play
 * /media/test.webm (25 fps, 10 s, frame number painted on every frame), which
 * tests/e2e/fixtures/video.ts renders once. Chromium only: that is where the
 * fixture is encoded for and where `requestVideoFrameCallback` is checked.
 */
test.describe('on a real video', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'checked in Chromium');
  test.beforeEach(async ({ request }) => {
    const res = await request.get('/media/test.webm', { headers: { Range: 'bytes=0-0' } });
    test.skip(!res.ok(), 'no test video (no Playwright ffmpeg / Chromium to render it)');
  });

  const video = (page: Page) => page.locator('video');
  const ready = async (page: Page) => {
    await video(page).waitFor();
    await page.waitForFunction(() => (document.querySelector('video')?.readyState ?? 0) >= 3);
  };
  const play = (page: Page) => page.evaluate(() => document.querySelector('video')!.play());
  const pause = (page: Page) => page.evaluate(() => document.querySelector('video')!.pause());
  const time = (page: Page) => page.evaluate(() => document.querySelector('video')!.currentTime);
  const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

  test.describe('learning: watched strip on the seek bar', () => {
    for (const [name, locale] of [['LTR', 'en'], ['RTL', 'ar']] as const) {
      test(`${name}: sits on the seek bar, starts at the leading edge, and grows while playing`, async ({ page }) => {
        await page.goto(`/?video=1&learning=1&autohide=0&locale=${locale}`);
        await ready(page);
        await expect(page.locator('.kui-seek-watched')).toHaveCount(0);   // nothing watched yet

        await play(page);
        await expect(page.locator('.kui-watched-run')).toBeVisible();
        await expect.poll(() => time(page)).toBeGreaterThan(2);
        await pause(page);
        const seek = await box(page, '[role="slider"]');
        const strip = await box(page, '.kui-seek-watched');
        const first = await box(page, '.kui-watched-run');

        // On the seek bar: same horizontal extent, hairline-thin, and actually painted.
        expect(Math.abs(strip.x - seek.x)).toBeLessThan(2);
        expect(Math.abs(strip.width - seek.width)).toBeLessThan(2);
        expect(strip.height).toBeGreaterThanOrEqual(1);
        expect(strip.height).toBeLessThanOrEqual(4);
        expect(strip.y).toBeGreaterThanOrEqual(seek.y);                    // within the slider's hit area, under the track
        expect(strip.y + strip.height).toBeLessThanOrEqual(seek.y + seek.height + 1);
        await expect(page.locator('.kui-seek-watched')).toHaveCSS('opacity', '0.6');

        // The leading edge is the left one in LTR and the right one in RTL; the run is what has been played.
        // (A few percent of slack: the first stretch is only counted once playback has really started.)
        const slack = strip.width * 0.05;
        if (locale === 'en') expect(Math.abs(first.x - strip.x)).toBeLessThan(slack);
        else expect(Math.abs(first.x + first.width - (strip.x + strip.width))).toBeLessThan(slack);
        const played = (await time(page)) / 10;
        expect(first.width / strip.width).toBeGreaterThan(played - 0.1);
        expect(first.width / strip.width).toBeLessThanOrEqual(played + 0.02);

        // It grows as playback continues.
        await play(page);
        await expect.poll(async () => (await box(page, '.kui-watched-run')).width, { timeout: 5000 }).toBeGreaterThan(first.width + 20);
      });
    }

    test('a seek leaves a gap: only what was played is marked', async ({ page }) => {
      await page.goto('/?video=1&learning=1&autohide=0');
      await ready(page);
      await play(page);
      await expect.poll(() => time(page)).toBeGreaterThan(1.2);
      await page.evaluate(() => { document.querySelector('video')!.currentTime = 6; });
      await expect.poll(() => time(page)).toBeGreaterThan(7.2);
      await pause(page);
      await expect(page.locator('.kui-watched-run')).toHaveCount(2);
      const strip = await box(page, '.kui-seek-watched');
      const [a, b] = await page.locator('.kui-watched-run').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
      expect(b! - a!).toBeGreaterThan(strip.width * 0.4);
    });
  });

  test.describe('frame tools', () => {
    /** Records the presented-frame clock, the same API the component listens to. */
    const recordFrames = (page: Page) => page.evaluate(() => {
      const v = document.querySelector('video')! as HTMLVideoElement & { requestVideoFrameCallback: (cb: (n: number, m: { mediaTime: number }) => void) => void };
      const w = window as unknown as { __frames: number[] };
      w.__frames = [];
      const loop = (_n: number, m: { mediaTime: number }) => { w.__frames.push(m.mediaTime); v.requestVideoFrameCallback(loop); };
      v.requestVideoFrameCallback(loop);
    });
    const lastFrame = (page: Page) => page.evaluate(() => { const f = (window as unknown as { __frames: number[] }).__frames; return f[f.length - 1] ?? -1; });

    async function settle(page: Page, seconds: number) {
      await expect.poll(() => lastFrame(page)).toBeCloseTo(seconds, 1);
    }

    test('measures 25 fps from real frames, steps by one frame, and jumps by frame number and timecode', async ({ page }) => {
      await page.goto('/?video=1&frames=1&autohide=0');
      await ready(page);
      await recordFrames(page);
      await play(page);
      await expect.poll(() => time(page)).toBeGreaterThan(2);   // 30 frames are needed to measure
      await pause(page);
      await page.locator('.kui-frametools').waitFor();

      // Timecode and frame box both follow the presented frame, at the measured rate.
      const inputs = page.locator('.kui-frametools-input');
      await expect.poll(async () => {
        const t = await lastFrame(page);
        return (await inputs.nth(1).inputValue()) === String(Math.round(t * 25));
      }).toBe(true);
      const frame = Math.round((await lastFrame(page)) * 25);
      const sec = Math.floor(frame / 25);
      const tc = `00:00:${String(sec).padStart(2, '0')}:${String(frame % 25).padStart(2, '0')}`;
      await expect(inputs.first()).toHaveValue(tc);     // 25 frames per second, not the 30 default

      // `.` and `,` move exactly one presented frame.
      const playButton = page.getByRole('button', { name: 'Play', exact: true });
      await expect(playButton).toBeVisible();     // the player has seen the pause: stepping only works while paused
      await playButton.focus();                   // and the shortcuts act on a focused player
      const before = await lastFrame(page);
      await page.keyboard.press('.');
      await expect.poll(() => lastFrame(page)).toBeCloseTo(before + 0.04, 3);
      await page.keyboard.press('.');
      await expect.poll(() => lastFrame(page)).toBeCloseTo(before + 0.08, 3);
      await page.keyboard.press(',');
      await expect.poll(() => lastFrame(page)).toBeCloseTo(before + 0.04, 3);
      await expect(inputs.nth(1)).toHaveValue(String(Math.round((before + 0.04) * 25)));

      // Go to a frame number.
      await inputs.nth(1).fill('100');
      await inputs.nth(1).press('Enter');
      await settle(page, 4);
      await expect(inputs.first()).toHaveValue('00:00:04:00');
      await expect(inputs.nth(1)).toHaveValue('100');

      // Go to a timecode.
      await inputs.first().fill('00:00:06:12');
      await inputs.first().press('Enter');
      await settle(page, 6.48);
      await expect(inputs.nth(1)).toHaveValue('162');
      expect(await page.evaluate(() => document.querySelector('video')!.paused)).toBe(true);
    });

    for (const [name, locale] of [['LTR', 'en'], ['RTL', 'ar']] as const) {
      test(`${name}: the timecode box, frame box and buttons fit inside the player without touching`, async ({ page }) => {
        await page.goto(`/?video=1&frames=1&autohide=0&locale=${locale}`);
        await ready(page);
        await page.locator('.kui-frametools').waitFor();
        const player = await box(page, '.kui-player');
        const items = await page.locator('.kui-frametools input, .kui-frametools button, .kui-frametools select').evaluateAll(
          (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }),
        );
        expect(items).toHaveLength(5);
        for (const r of items) {
          expect(r.w).toBeGreaterThan(30);
          expect(r.h).toBeGreaterThan(20);
          expect(r.x).toBeGreaterThanOrEqual(player.x);
          expect(r.x + r.w).toBeLessThanOrEqual(player.x + player.width);
          expect(r.y).toBeGreaterThanOrEqual(player.y);
          expect(r.y + r.h).toBeLessThanOrEqual(player.y + player.height);
        }
        for (let i = 0; i < items.length; i += 1) {
          for (let j = i + 1; j < items.length; j += 1) {
            const a = items[i]!; const b = items[j]!;
            const apart = a.x + a.w <= b.x + 0.5 || b.x + b.w <= a.x + 0.5 || a.y + a.h <= b.y + 0.5 || b.y + b.h <= a.y + 0.5;
            expect(apart, `controls ${i} and ${j} overlap`).toBe(true);
          }
        }
        // The panel itself must not spill past its own edge either.
        const panel = await box(page, '.kui-frametools');
        for (const r of items) {
          expect(r.x).toBeGreaterThanOrEqual(panel.x - 0.5);
          expect(r.x + r.w).toBeLessThanOrEqual(panel.x + panel.width + 0.5);
        }
      });
    }
  });

  test.describe('non-linear banner ad', () => {
    const events = (page: Page) => page.evaluate(() => (window as unknown as { __adEvents: { type: string }[] }).__adEvents.map((e) => e.type));

    test('sits over the lower picture inside the player, clear of the controls, and never pauses the video', async ({ page }) => {
      await page.goto('/?video=1&nl=1&autohide=0');
      await ready(page);
      await play(page);
      const banner = page.getByRole('complementary', { name: 'Advertisement' });
      await expect(banner).toBeVisible();

      const player = await box(page, '.kui-player');
      const img = (await banner.locator('img').boundingBox())!;
      expect(img.width).toBeCloseTo(300, 0);
      expect(img.height).toBeCloseTo(50, 0);
      // Inside the player (it used to render above it, in the 24 px top-slot strip), centred, in the lower half.
      expect(img.x).toBeGreaterThanOrEqual(player.x);
      expect(img.x + img.width).toBeLessThanOrEqual(player.x + player.width);
      expect(img.y).toBeGreaterThanOrEqual(player.y + player.height / 2);
      expect(img.y + img.height).toBeLessThanOrEqual(player.y + player.height);
      expect(Math.abs(img.x + img.width / 2 - (player.x + player.width / 2))).toBeLessThan(2);
      // Clear of the seek bar and the control row.
      const seek = await box(page, '[role="slider"]');
      expect(img.y + img.height).toBeLessThanOrEqual(seek.y);
      // The picture is still there, and playing.
      const t0 = await time(page);
      await expect.poll(() => time(page)).toBeGreaterThan(t0 + 0.4);
      expect(await page.evaluate(() => document.querySelector('video')!.paused)).toBe(false);
      expect(await events(page)).toEqual(['nonlinear:start']);

      // Dismiss: the banner goes, playback goes on.
      await banner.getByRole('button', { name: 'Close ad' }).click();
      await expect(banner).toHaveCount(0);
      expect(await page.evaluate(() => document.querySelector('video')!.paused)).toBe(false);
      expect(await events(page)).toEqual(['nonlinear:start', 'nonlinear:end']);
      await expect.poll(() => time(page)).toBeGreaterThan(t0 + 0.6);
    });

    test('is not taken away with the auto-hiding controls', async ({ page }) => {
      await page.goto('/?video=1&nl=1');
      await ready(page);
      await play(page);
      const banner = page.getByRole('complementary', { name: 'Advertisement' });
      await expect(banner).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(page.locator('.kui-chrome')).toHaveClass(/is-hidden/, { timeout: 8000 });
      await expect(banner).toBeVisible();
      expect(await banner.locator('img').evaluate((el) => {
        let node: Element | null = el;
        while (node) { if (getComputedStyle(node).opacity === '0' || getComputedStyle(node).visibility === 'hidden') return false; node = node.parentElement; }
        return true;
      })).toBe(true);
    });
  });
});
