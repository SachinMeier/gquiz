// Bump SHELL_CACHE whenever the app shell or deck data changes.
const SHELL_CACHE = 'geolearn-shell-v2';
const ASSET_CACHE = 'geolearn-images-v1';
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
// Refresh corrected outlines without discarding the rest of the offline deck.
const ASSET_REVISIONS = {
  '/country-shapes/all/bs/vector.svg': 'bahamas-2026-10-20',
  '/country-shapes/namerica/bs/vector.svg': 'bahamas-2026-10-20',
};
const SHELL_PATHS = ['/', '/index.html', '/app.js', '/styles.css', '/data/cards.json', '/data/countries.json'];
const inFlight = new Map();
let warming = null;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL_PATHS.map((path) => new Request(path, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('geolearn-shell-') && name !== SHELL_CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

async function getAsset(url) {
  if (!inFlight.has(url)) {
    const work = (async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(url);
      const storedAt = Number(cached?.headers.get('x-geolearn-cached-at') || 0);
      const revision = ASSET_REVISIONS[new URL(url).pathname] || '1';
      const cachedRevision = cached?.headers.get('x-geolearn-revision') || '1';
      if (cached && cachedRevision === revision && Date.now() - storedAt < YEAR_MS) return cached;
      try {
        // FlagCDN allows CORS, so status and body are readable. Avoid opaque
        // responses: they can hide HTTP errors and consume excessive quota.
        const response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'reload' });
        if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
        const headers = new Headers(response.headers);
        headers.set('x-geolearn-cached-at', String(Date.now()));
        headers.set('x-geolearn-revision', revision);
        const dated = new Response(await response.blob(), { status: response.status, headers });
        await cache.put(url, dated.clone());
        return dated;
      } catch (error) {
        // Expiry triggers refresh; keep a usable offline copy if refresh fails.
        if (cached) return cached;
        throw error;
      }
    })();
    inFlight.set(url, work);
    work.finally(() => inFlight.delete(url)).catch(() => {});
  }
  return (await inFlight.get(url)).clone();
}

async function getShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (!response.ok) throw new Error(`App request failed: ${response.status}`);
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request)
      || (request.mode === 'navigate' ? await cache.match('/index.html') : null);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if ((url.origin === self.location.origin && url.pathname.startsWith('/country-shapes/'))
      || (url.origin === 'https://flagcdn.com' && url.pathname.startsWith('/w640/'))) {
    event.respondWith(getAsset(url.href));
  } else if (url.origin === self.location.origin
      && (event.request.mode === 'navigate' || SHELL_PATHS.includes(url.pathname))) {
    event.respondWith(getShell(event.request));
  }
});

async function reportStatus(status) {
  for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
    client.postMessage({ type: 'CACHE_STATUS', ...status });
  }
}

async function warmDeck() {
  await reportStatus({ ready: false });
  try {
    const cache = await caches.open(SHELL_CACHE);
    const manifest = await cache.match('/data/cards.json');
    const cards = await manifest.json();
    // Queue every flag first, regardless of selected mode, filters, or progress.
    const urls = [...new Set([
      ...cards.map((card) => card.flagPath),
      ...cards.map((card) => card.shapePath),
    ])].filter(Boolean).map((path) => new URL(path, self.location.origin).href);
    let cursor = 0;
    let failed = 0;
    // Bound network concurrency so a new deck stays immediately playable.
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (cursor < urls.length) {
        const url = urls[cursor++];
        try { await getAsset(url); } catch { failed += 1; }
      }
    }));
    await reportStatus({ ready: failed === 0, failed: failed > 0 });
  } catch {
    await reportStatus({ ready: false, failed: true });
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_DECK') return;
  if (!warming) warming = warmDeck().finally(() => { warming = null; });
  event.waitUntil(warming);
});
