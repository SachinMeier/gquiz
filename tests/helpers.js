const { expect } = require('@playwright/test');
const { sampleCards, sampleCountries } = require('./fixtures');

async function bootApp(
  page,
  {
    cards = sampleCards,
    countries = sampleCountries,
    storage = {},
    failCards = false,
  } = {}
) {
  await page.route('https://flagcdn.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
    });
  });

  await page.route('**/data/cards.json', async (route) => {
    if (failCards) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'failed' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cards),
    });
  });

  await page.route('**/data/countries.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(countries),
    });
  });

  await page.addInitScript(({ storage: seedStorage }) => {
    window.localStorage.clear();
    for (const [key, value] of Object.entries(seedStorage)) {
      window.localStorage.setItem(key, value);
    }

    Math.random = () => 0;
  }, { storage });

  await page.goto('/');

  if (failCards) {
    await expect(page.locator('#front')).toContainText('Unable to load cards');
    return;
  }

  await expect(page.locator('#progress')).toHaveText(/^\d+ \/ \d+$/);
  await expect(page.locator('#wrongBtn')).toBeEnabled();
  await expect(page.locator('#rightBtn')).toBeEnabled();
}

async function jumpToCountry(page, query, expectedName) {
  await page.locator('#countrySearch').fill(query);
  const match = page.locator('#searchResults li', { hasText: expectedName }).first();
  await expect(match).toBeVisible();
  await match.click();
  await expect(page.locator('#countrySearch')).toHaveValue(new RegExp(`^${expectedName} \\([A-Z]{2}\\)$`));
}

async function setContinent(page, value, checked) {
  await ensureContinentPanelOpen(page);
  const checkbox = page.locator(`#continentPanel input[value="${value}"]`);
  await checkbox.setChecked(checked);
}

async function setIncludeMicrostates(page, checked) {
  await ensureContinentPanelOpen(page);
  await page.locator('#microstateToggle').setChecked(checked);
}

async function ensureContinentPanelOpen(page) {
  const panel = page.locator('#continentPanel');
  const isHidden = await panel.evaluate((element) => element.classList.contains('hidden'));
  if (isHidden) {
    await page.locator('#continentBtn').click();
  }
}

async function closeScoreModal(page) {
  const modal = page.locator('#scoreModal');
  if (await modal.evaluate((element) => element.open)) {
    await page.locator('#scoreModal .icon-btn').click();
  }
}

module.exports = {
  bootApp,
  jumpToCountry,
  setContinent,
  setIncludeMicrostates,
  closeScoreModal,
};
