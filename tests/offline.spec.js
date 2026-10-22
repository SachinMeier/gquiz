const { test, expect } = require('@playwright/test');
const { sampleCards, sampleCountries } = require('./fixtures');

const cards = sampleCards.map((card) => ({
  ...card, flagPath: `https://flagcdn.com/w640/${card.code.toLowerCase()}.png`,
}));
const imageBody = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="10"><rect width="16" height="10" fill="blue"/></svg>';

async function fixtureOffline(context, { holdFlags = Promise.resolve(), failFlag = () => false } = {}) {
  const requested = [];
  // Context routes also intercept the service worker's own network requests.
  await context.route('**/data/cards.json', (route) => route.fulfill({ json: cards }));
  await context.route('**/data/countries.json', (route) => route.fulfill({ json: sampleCountries }));
  await context.route('https://flagcdn.com/**', async (route) => {
    requested.push(route.request().url());
    await holdFlags;
    if (failFlag(route.request().url())) return route.fulfill({ status: 503, body: 'Unavailable' });
    await route.fulfill({ contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: imageBody });
  });
  return requested;
}

async function ready(page) {
  await expect(page.locator('#offlineStatus')).toHaveText('Ready for offline play', { timeout: 15000 });
}

async function restartWarmup(page) {
  await page.evaluate(() => {
    document.getElementById('offlineStatus').textContent = '';
    navigator.serviceWorker.controller.postMessage({ type: 'CACHE_DECK' });
  });
}

test('preloads every flag without blocking play, then reloads and plays all modes fully offline', async ({ page, context }) => {
  let releaseFlags;
  const holdFlags = new Promise((resolve) => { releaseFlags = resolve; });
  const requested = await fixtureOffline(context, { holdFlags });
  await page.goto('/');
  await expect(page.locator('#rightBtn')).toBeEnabled();
  await expect.poll(() => requested.length).toBe(cards.length);
  await expect(page.locator('#offlineStatus')).toHaveText('Saving for offline play…');
  releaseFlags();
  await ready(page);
  expect(new Set(requested)).toEqual(new Set(cards.map((card) => card.flagPath)));

  // No fixture routes may supply responses during offline verification.
  await context.unrouteAll({ behavior: 'wait' });
  // Also fail worker-owned fetches: Chromium's offline emulation can leave
  // service-worker network requests online in some browser versions.
  await context.route('**/*', (route) => route.abort('internetdisconnected'));
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#rightBtn')).toBeEnabled();
  await expect(page.locator('#progress')).toHaveText(/\d \/ 4/);
  for (const mode of ['flags', 'capitals', 'outlines']) {
    await page.locator('#modeSelect').selectOption(mode);
    for (const card of cards) {
      await page.locator('#countrySearch').fill(card.code);
      await page.locator(`#searchResults li[data-code="${card.code}"]`).click();
      await expect.poll(() => page.locator('#front img').evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
      await page.locator('#flipBtn').click();
      await expect(page.locator('#back')).toContainText(mode === 'capitals' ? card.capital : card.name);
    }
  }
  await page.locator('#wrongBtn').click();
  await expect(page.locator('#wrongScore')).toHaveText('❌ 1');
  await expect(page.locator('#card')).not.toHaveClass(/flipped/);
});

test('reuses fresh flags, refreshes year-old flags, and retains expired copies offline', async ({ page, context }) => {
  const requested = await fixtureOffline(context);
  await page.goto('/');
  await ready(page);
  const initialRequests = requested.length;
  await restartWarmup(page);
  await ready(page);
  expect(requested.length).toBe(initialRequests);

  async function expireFlag() {
    await page.evaluate(async (url) => {
      const cache = await caches.open('geolearn-images-v1');
      const response = await cache.match(url);
      const headers = new Headers(response.headers);
      headers.set('x-geolearn-cached-at', String(Date.now() - 366 * 24 * 60 * 60 * 1000));
      await cache.put(url, new Response(await response.blob(), { headers }));
    }, cards[0].flagPath);
  }
  await expireFlag();
  await restartWarmup(page);
  await ready(page);
  expect(requested.length).toBe(initialRequests + 1);
  expect(requested.at(-1)).toBe(cards[0].flagPath);

  await expireFlag();
  await context.unrouteAll({ behavior: 'wait' });
  // Also fail worker-owned fetches: Chromium's offline emulation can leave
  // service-worker network requests online in some browser versions.
  await context.route('**/*', (route) => route.abort('internetdisconnected'));
  await context.setOffline(true);
  await restartWarmup(page);
  await ready(page);
  await page.locator('#modeSelect').selectOption('flags');
  await page.locator('#countrySearch').fill('AD');
  await page.locator('#searchResults li[data-code="AD"]').click();
  await expect.poll(() => page.locator('#front img').evaluate((img) => img.naturalWidth > 0)).toBe(true);
});

test('a failed flag does not stop other downloads and reconnect retries only missing images', async ({ page, context }) => {
  let failing = true;
  const requested = await fixtureOffline(context, { failFlag: (url) => failing && url === cards[0].flagPath });
  await page.goto('/');
  await expect(page.locator('#offlineStatus')).toHaveText('Offline download incomplete — reconnect to retry');
  expect(new Set(requested)).toEqual(new Set(cards.map((card) => card.flagPath)));
  const initialRequests = requested.length;
  failing = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await ready(page);
  expect(requested.length).toBe(initialRequests + 1);
  expect(requested.at(-1)).toBe(cards[0].flagPath);
});

test('refreshes the old Bahamas outline while retaining fresh cached flags', async ({ page, context }) => {
  const requested = await fixtureOffline(context);
  await page.goto('/');
  await ready(page);
  const initialRequests = requested.length;
  const outline = '/country-shapes/all/bs/vector.svg';
  const result = await page.evaluate(async (url) => {
    const cache = await caches.open('geolearn-images-v1');
    await cache.put(url, new Response('old single-island outline', {
      headers: {
        'content-type': 'image/svg+xml',
        'x-geolearn-cached-at': String(Date.now()),
      },
    }));
    const response = await fetch(url);
    return { text: await response.text(), revision: response.headers.get('x-geolearn-revision') };
  }, outline);
  expect(result.text).toContain('Natural Earth');
  expect(result.text).not.toContain('old single-island outline');
  expect(result.revision).toBe('bahamas-2026-10-20');
  await restartWarmup(page);
  await ready(page);
  expect(requested.length).toBe(initialRequests);

  await context.unrouteAll({ behavior: 'wait' });
  await context.route('**/*', (route) => route.abort('internetdisconnected'));
  await context.setOffline(true);
  expect(await page.evaluate(async (url) => (await fetch(url)).text(), outline)).toBe(result.text);
});
