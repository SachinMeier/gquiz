const fs = require('fs/promises');
const path = require('path');
const { test, expect } = require('@playwright/test');

const repoRoot = path.resolve(__dirname, '..');

test('cards data references known countries and on-disk shape assets', async () => {
  const [cardsRaw, countriesRaw] = await Promise.all([
    fs.readFile(path.join(repoRoot, 'data/cards.json'), 'utf8'),
    fs.readFile(path.join(repoRoot, 'data/countries.json'), 'utf8'),
  ]);

  const cards = JSON.parse(cardsRaw);
  const countries = JSON.parse(countriesRaw);
  const countryCodes = new Set(countries.map((country) => country.code));
  const seenCodes = new Set();

  expect(cards.length).toBeGreaterThan(0);
  expect(countries.length).toBeGreaterThan(0);

  for (const card of cards) {
    expect(card.code).toMatch(/^[A-Z]{2}$/);
    expect(card.name).toBeTruthy();
    expect(card.shapePath).toMatch(/^\/country-shapes\/.+\/vector\.svg$/);
    expect(card.flagPath).toBeTruthy();
    expect(countryCodes.has(card.code)).toBeTruthy();
    expect(seenCodes.has(card.code)).toBeFalsy();

    seenCodes.add(card.code);

    const assetPath = path.join(repoRoot, card.shapePath.replace(/^\//, ''));
    await expect(fs.access(assetPath)).resolves.toBeUndefined();
  }
});
