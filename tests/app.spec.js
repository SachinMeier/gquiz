const { test, expect } = require('@playwright/test');
const {
  sampleCards,
  sampleCountries,
  singleCardDeck,
  singleCountryDeck,
} = require('./fixtures');
const {
  bootApp,
  jumpToCountry,
  setContinent,
  setIncludeMicrostates,
  closeScoreModal,
} = require('./helpers');

test('renders a chosen card correctly in outlines, flags, and capitals modes', async ({ page }) => {
  await bootApp(page);
  await jumpToCountry(page, 'jap', 'Japan');

  await expect(page.locator('#front img[alt="Country outline"]')).toBeVisible();

  await page.locator('#modeSelect').selectOption('flags');
  await expect(page.locator('#front img[alt="Flag of Japan"]')).toBeVisible();
  await page.locator('#flipBtn').click();
  await expect(page.locator('#back')).toContainText('Japan');

  await page.locator('#modeSelect').selectOption('capitals');
  await expect(page.locator('#front')).toContainText('Japan');
  await expect(page.locator('#front')).toContainText('Tap to reveal capital');
  await page.locator('#flipBtn').click();
  await expect(page.locator('#back')).toContainText('Tokyo');
});

test('grades a card as correct and restores it through history', async ({ page }) => {
  await bootApp(page);
  await page.locator('#modeSelect').selectOption('capitals');
  await jumpToCountry(page, 'and', 'Andorra');
  const startingProgress = await page.locator('#progress').textContent();

  await expect(page.locator('#front')).toContainText('Andorra');
  await page.locator('#rightBtn').click();

  await expect(page.locator('#rightScore')).toHaveText('✅ 1');
  await expect(page.locator('#toast')).toHaveText('Correct!');
  await expect(page.locator('#progress')).not.toHaveText(startingProgress);

  await page.locator('#backBtn').click();
  await expect(page.locator('#progress')).toHaveText(startingProgress);
  await expect(page.locator('#front')).toContainText('Andorra');
});

test('shows the completion state and can clear the filtered correct list with keyboard shortcuts', async ({ page }) => {
  await bootApp(page, {
    cards: singleCardDeck,
    countries: singleCountryDeck,
  });

  await page.locator('#modeSelect').selectOption('capitals');
  await page.keyboard.press(' ');
  await expect(page.locator('#card')).toHaveClass(/flipped/);

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#rightScore')).toHaveText('✅ 1');
  await expect(page.locator('#front')).toContainText('Congratulations!');
  await expect(page.locator('#wrongBtn')).toBeDisabled();

  await page.locator('#front [data-action="clear-filtered-correct"]').click({ force: true });
  await expect(page.locator('#rightScore')).toHaveText('✅ 0');
  await expect(page.locator('#front')).toContainText('Andorra');
  await expect(page.locator('#wrongBtn')).toBeEnabled();
});

test('scopes wrong-score counts and clear-list actions to the active filters', async ({ page }) => {
  await bootApp(page, {
    storage: {
      'geolearn.continent': JSON.stringify(['Europe']),
      'geolearn.includeMicrostates': 'true',
      'geolearn.wrongCodes': JSON.stringify(['AD', 'JP', 'AI']),
      'geolearn.rightCodes': JSON.stringify([]),
    },
  });

  await expect(page.locator('#wrongScore')).toHaveText('❌ 1');
  await page.locator('#wrongScore').click();
  await expect(page.locator('#scoreModalList')).toContainText('Andorra');
  await expect(page.locator('#scoreModalList')).not.toContainText('Japan');
  await page.locator('#clearListBtn').click();
  await expect(page.locator('#wrongScore')).toHaveText('❌ 0');
  await closeScoreModal(page);

  await setContinent(page, 'Asia', true);
  await setContinent(page, 'North America', true);
  await expect(page.locator('#wrongScore')).toHaveText('❌ 2');

  await setIncludeMicrostates(page, false);
  await expect(page.locator('#wrongScore')).toHaveText('❌ 1');
  await page.locator('#wrongScore').click();
  await expect(page.locator('#scoreModalList')).toContainText('Japan');
  await expect(page.locator('#scoreModalList')).not.toContainText('Anguilla');
});

test('removes a single right-score entry only from the active filter scope', async ({ page }) => {
  await bootApp(page, {
    storage: {
      'geolearn.continent': JSON.stringify(['North America']),
      'geolearn.includeMicrostates': 'true',
      'geolearn.wrongCodes': JSON.stringify([]),
      'geolearn.rightCodes': JSON.stringify(['US', 'JP']),
    },
  });

  await expect(page.locator('#rightScore')).toHaveText('✅ 1');
  await page.locator('#rightScore').click();
  await expect(page.locator('#scoreModalList')).toContainText('United States');
  await expect(page.locator('#scoreModalList')).not.toContainText('Japan');
  await page.locator('.remove-btn[data-code="US"]').click();
  await expect(page.locator('#rightScore')).toHaveText('✅ 0');
  await closeScoreModal(page);

  await setContinent(page, 'Asia', true);
  await expect(page.locator('#rightScore')).toHaveText('✅ 1');
  await page.locator('#rightScore').click();
  await expect(page.locator('#scoreModalList')).toContainText('Japan');
});

test('surfaces card-load failures without enabling gameplay controls', async ({ page }) => {
  await bootApp(page, { failCards: true });

  await expect(page.locator('#front')).toContainText('Unable to load cards');
  await expect(page.locator('#back')).toContainText('Please refresh to retry');
  await expect(page.locator('#toast')).toHaveText('Could not load cards');
  await expect(page.locator('#wrongBtn')).toBeDisabled();
  await expect(page.locator('#rightBtn')).toBeDisabled();
});
