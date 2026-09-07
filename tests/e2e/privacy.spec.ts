import { expect, test, type Page, type Request } from '@playwright/test';

/**
 * The privacy claim, enforced rather than asserted in prose: the player makes
 * no network request other than the media it was pointed at, and writes nothing
 * to browser storage. Google Cast is the single documented exception, and it is
 * opt-in — this file proves both halves.
 *
 * If a future change adds a font, an analytics beacon or a CDN icon sprite,
 * this test fails in CI before anyone has to notice it in a network panel.
 */

const ORIGIN = 'http://localhost:5174';
const CAST_SDK = 'https://www.gstatic.com/cv/js/sender/';

function collectRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request: Request) => urls.push(request.url()));
  return urls;
}

const external = (urls: string[]) =>
  urls.filter((url) => !url.startsWith(ORIGIN) && !url.startsWith('data:') && !url.startsWith('blob:'));

/** Exercise the surfaces most likely to smuggle in a request. */
async function useThePlayer(page: Page) {
  await expect(page.locator('.kui-time')).toContainText('0:30');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('menuitem', { name: /Subtitles/ }).click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('menuitem', { name: /About/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
}

test('makes no request beyond the page and its media', async ({ page }) => {
  const urls = collectRequests(page);
  await page.goto('/?autohide=0');
  await useThePlayer(page);
  await page.waitForTimeout(1000);

  expect(external(urls), `unexpected external requests:\n${external(urls).join('\n')}`).toEqual([]);
  // And the media it *was* pointed at did load — otherwise this proves nothing.
  expect(urls.some((url) => url.includes('/media/clip.wav'))).toBe(true);
});

test('writes nothing to browser storage', async ({ page }) => {
  await page.goto('/?autohide=0');
  await useThePlayer(page);

  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    cookies: document.cookie,
  }));
  expect(storage.local).toEqual([]);
  expect(storage.session).toEqual([]);
  expect(storage.cookies).toBe('');
});

test('no icon font, stylesheet or script is fetched from a CDN', async ({ page }) => {
  const urls = collectRequests(page);
  await page.goto('/?autohide=0');
  await expect(page.locator('.kui-player')).toBeVisible();

  const suspicious = urls.filter((url) =>
    /fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg|jsdelivr|analytics|sentry|segment|beacon/i.test(url));
  expect(suspicious, `unexpected third-party asset:\n${suspicious.join('\n')}`).toEqual([]);
});

test('Cast is opt-in, and its SDK is the only external request it makes', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'the Cast sender SDK is only loaded where Cast can exist');

  const off = collectRequests(page);
  await page.goto('/?autohide=0');
  await expect(page.locator('.kui-player')).toBeVisible();
  await page.waitForTimeout(500);
  expect(off.some((url) => url.startsWith(CAST_SDK)), 'Cast SDK loaded without being asked for').toBe(false);

  // Same page, second load — `on` only sees requests made from here on.
  const on: string[] = [];
  page.on('request', (request) => on.push(request.url()));
  await page.goto('/?cast=1&autohide=0');
  await expect(page.locator('.kui-player')).toBeVisible();
  await page.waitForTimeout(1500);

  const outside = external(on);
  expect(outside.length, 'turning Cast on should have requested the sender SDK').toBeGreaterThan(0);
  for (const url of outside) {
    expect(url.startsWith('https://www.gstatic.com/'), `unexpected external request: ${url}`).toBe(true);
  }
});
