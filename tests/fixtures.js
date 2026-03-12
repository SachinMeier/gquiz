const sampleCards = [
  {
    code: 'AD',
    name: 'Andorra',
    capital: 'Andorra la Vella',
    shapePath: '/country-shapes/all/ad/vector.svg',
    flagPath: '/country-shapes/all/ad/vector.svg',
  },
  {
    code: 'JP',
    name: 'Japan',
    capital: 'Tokyo',
    shapePath: '/country-shapes/all/jp/vector.svg',
    flagPath: '/country-shapes/all/jp/vector.svg',
  },
  {
    code: 'US',
    name: 'United States',
    capital: 'Washington, D.C.',
    shapePath: '/country-shapes/all/us/vector.svg',
    flagPath: '/country-shapes/all/us/vector.svg',
  },
  {
    code: 'AI',
    name: 'Anguilla',
    capital: 'The Valley',
    shapePath: '/country-shapes/all/ai/vector.svg',
    flagPath: '/country-shapes/all/ai/vector.svg',
  },
];

const sampleCountries = [
  {
    code: 'AD',
    name: 'Andorra',
    capital: 'Andorra la Vella',
    flag: 'AD',
    continent: 'Europe',
    microstate: false,
  },
  {
    code: 'JP',
    name: 'Japan',
    capital: 'Tokyo',
    flag: 'JP',
    continent: 'Asia',
    microstate: false,
  },
  {
    code: 'US',
    name: 'United States',
    capital: 'Washington, D.C.',
    flag: 'US',
    continent: 'North America',
    microstate: false,
  },
  {
    code: 'AI',
    name: 'Anguilla',
    capital: 'The Valley',
    flag: 'AI',
    continent: 'North America',
    microstate: true,
  },
];

const singleCardDeck = [sampleCards[0]];
const singleCountryDeck = [sampleCountries[0]];

module.exports = {
  sampleCards,
  sampleCountries,
  singleCardDeck,
  singleCountryDeck,
};
