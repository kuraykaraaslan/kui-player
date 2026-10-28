import { expect, test, type Page } from '@playwright/test';

/**
 * Live streams, the presence check, stopping when out of view and alternate
 * sources, in a real browser. The origin is the /live fixture of
 * vite.config.e2e.ts (a 302 to a session, cookies, 401 once the session ends)
 * behind the real HLS adapter, with a small fetch-based stand-in for hls.js
 * (tests/e2e/app/fetch-hls.ts) — the media pipeline is the only thing replaced.
 */

/** Paths of the requests the page makes that match `pattern`, as they happen. */
function watch(page: Page, pattern: RegExp): string[] {
  const seen: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pattern.test(pathname)) seen.push(pathname);
  });
  return seen;
}

const sessionsIn = (paths: string[]) => new Set(paths.map((p) => /\/live\/s\/([\w-]+)\//.exec(p)?.[1])).size;

test.describe('live mode', () => {
  test('a live stream gets a LIVE badge and no seek bar', async ({ page }) => {
    await page.goto('/?live=1&autohide=0');
    await expect(page.getByRole('button', { name: /^(LIVE|Go to live edge)$/ })).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Seek' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^(Rewind|Forward)/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Play' }).click();
    await expect.poll(() => page.evaluate(() => !document.querySelector('video')!.paused)).toBe(true);
    // The element would "end" its clip if it were not looping a stream that has no end.
    await page.waitForTimeout(500);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('keeps the seek bar when the page asks for the DVR window', async ({ page }) => {
    await page.goto('/?live=1&dvr=1&autohide=0');
    await expect(page.getByRole('button', { name: /^(LIVE|Go to live edge)$/ })).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Seek' })).toBeVisible();
  });

  test('a session that ends mid-stream is reopened from the original address, with no error ever showing', async ({ page }) => {
    await page.addInitScript(() => {
      new MutationObserver(() => {
        if (document.querySelector('.kui-overlay--error')) (window as unknown as { __sawError: boolean }).__sawError = true;
      }).observe(document, { childList: true, subtree: true });
    });
    const links = watch(page, /^\/live\/cam\.m3u8$/);
    const media = watch(page, /^\/live\/s\//);

    await page.goto('/?live=1&ttl=1500&autohide=0');
    await page.getByRole('button', { name: 'Play' }).click();

    // The first session dies after 1.5 s: the player asks the link again (a 302 to a new session)...
    await expect.poll(() => links.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    // ...and segments of the new session arrive, through the redirect and the new cookie.
    await expect.poll(() => sessionsIn(media), { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(() => page.evaluate(() => !document.querySelector('video')!.paused)).toBe(true);

    expect(await page.evaluate(() => (window as unknown as { __sawError?: boolean }).__sawError)).toBeUndefined();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('shows what the source said when it refuses a stream, with a way to try again', async ({ page }) => {
    const attempts = watch(page, /^\/live\/refused\.m3u8$/);
    await page.goto('/?live=1&src=refused&autohide=0');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('This month\'s camera minutes are used up.');
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(attempts).toHaveLength(1);   // a stream that never played is not hammered
  });

  test('shows a plain-text refusal too', async ({ page }) => {
    await page.goto('/?live=1&src=gone&autohide=0');
    await expect(page.getByRole('alert')).toContainText('No such camera.');
  });

  test('gives up with a clear state after the back-off, and keeps the reason', async ({ page }) => {
    const links = watch(page, /^\/live\/dies\.m3u8$/);
    await page.goto('/?live=1&src=dies&ttl=800&retries=2&base=200&autohide=0');
    await page.getByRole('button', { name: 'Play' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('The live stream refused the connection.', { timeout: 15_000 });
    await expect(alert).toContainText('This month\'s camera minutes are used up.');
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(links.length).toBeGreaterThanOrEqual(3);   // the first open, then the reloads
  });
});

test.describe('load on first play', () => {
  test('requests nothing before Play, and the stream after it', async ({ page }) => {
    const live = watch(page, /^\/live\//);
    await page.goto('/?live=1&loadonplay=1&autohide=0');
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(live).toEqual([]);
    await expect(page.getByRole('alert')).toHaveCount(0);

    await page.getByRole('button', { name: 'Play' }).click();
    await expect.poll(() => live.length).toBeGreaterThan(1);
    await expect.poll(() => page.evaluate(() => !document.querySelector('video')!.paused)).toBe(true);
    await expect(page.getByRole('button', { name: /^(LIVE|Go to live edge)$/ })).toBeVisible();
  });
});

test.describe('stop when out of view', () => {
  test('a live player scrolled away makes no requests, and rejoins when it is back', async ({ page }) => {
    const media = watch(page, /^\/live\/s\//);
    await page.goto('/?live=1&spacer=1&autohide=0');
    await page.getByRole('button', { name: 'Play' }).click();
    await expect.poll(() => media.length).toBeGreaterThan(3);

    await page.evaluate(() => window.scrollTo(0, 2500));
    await expect.poll(() => page.evaluate(() => document.querySelector('video')!.paused)).toBe(true);
    await page.waitForTimeout(800);   // let a request that was already in flight finish
    const frozen = media.length;
    await page.waitForTimeout(2500);
    expect(media.length).toBe(frozen);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => media.length).toBeGreaterThan(frozen);
    await expect.poll(() => page.evaluate(() => !document.querySelector('video')!.paused)).toBe(true);
  });
});

test.describe('presence check', () => {
  async function startAll(page: Page, count: number) {
    const play = page.getByRole('button', { name: 'Play', exact: true });
    await expect(play).toHaveCount(count);
    for (let i = 1; i <= count; i += 1) {
      await play.first().click();
      await expect(play).toHaveCount(count - i);   // its button turned into Pause before the next click
    }
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('video')].every((v) => !v.paused))).toBe(true);
  }

  test('nine players ask once, and stop together when nobody answers', async ({ page }) => {
    await page.goto('/?wall=9&pe=5000&pg=3000');
    await startAll(page, 9);

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toHaveCount(1, { timeout: 8000 });
    await expect(dialog).toContainText('Still watching?');
    await expect(dialog.getByRole('button', { name: 'Continue' })).toBeFocused();

    await expect(page.locator('.kui-overlay--paused')).toHaveCount(9, { timeout: 8000 });
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => [...document.querySelectorAll('video')].every((v) => v.paused))).toBe(true);
    await expect(page.getByText('Paused to save data').first()).toBeVisible();
  });

  test('Continue keeps all nine playing', async ({ page }) => {
    await page.goto('/?wall=9&pe=5000&pg=3000');
    await startAll(page, 9);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    await page.waitForTimeout(3500);   // well past where the grace period would have ended
    await expect(page.locator('.kui-overlay--paused')).toHaveCount(0);
    expect(await page.evaluate(() => [...document.querySelectorAll('video')].every((v) => !v.paused))).toBe(true);
  });

  test('a stopped tile plays again from its own Play button', async ({ page }) => {
    await page.goto('/?wall=3&pe=3000&pg=1000');
    await startAll(page, 3);
    await expect(page.locator('.kui-overlay--paused')).toHaveCount(3, { timeout: 8000 });

    await page.locator('.kui-overlay--paused').nth(1).getByRole('button', { name: 'Play' }).click();
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('video')[1]!.paused)).toBe(false);
    await expect(page.locator('.kui-overlay--paused')).toHaveCount(2);
  });
});

test.describe('alternate sources', () => {
  const currentSrc = async (page: Page) => {
    await expect(page.locator('video')).toHaveCount(1);
    return page.evaluate(() => document.querySelector('video')!.currentSrc);
  };

  test('are listed in the quality menu and switch the source', async ({ page }) => {
    await page.goto('/?sources=1&autohide=0');
    expect(await currentSrc(page)).not.toContain('hd=1');

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('menuitem', { name: /Quality/ }).click();
    await expect(page.getByRole('menuitemradio', { name: 'Standard' })).toBeVisible();
    await page.getByRole('menuitemradio', { name: 'High' }).click();
    await expect.poll(() => currentSrc(page)).toContain('hd=1');
  });

  test('can follow fullscreen: High on the big screen, Standard in the card', async ({ page }) => {
    await page.goto('/?sources=1&prefer=1&autohide=0');
    expect(await currentSrc(page)).not.toContain('hd=1');

    await page.getByRole('button', { name: 'Enter fullscreen' }).click();
    await expect.poll(() => currentSrc(page)).toContain('hd=1');
    await page.getByRole('button', { name: 'Exit fullscreen' }).click();
    await expect.poll(() => currentSrc(page)).not.toContain('hd=1');
  });
});
