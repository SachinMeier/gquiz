const app = document.getElementById('app');
const card = document.getElementById('card');
const front = document.getElementById('front');
const back = document.getElementById('back');
const progressEl = document.getElementById('progress');
const scoreEl = document.getElementById('score');
const toast = document.getElementById('toast');
const modeSelect = document.getElementById('modeSelect');
const continentSelect = document.getElementById('continentSelect');

const wrongBtn = document.getElementById('wrongBtn');
const rightBtn = document.getElementById('rightBtn');
const flipBtn = document.getElementById('flipBtn');

const countrySearch = document.getElementById('countrySearch');
const searchResults = document.getElementById('searchResults');

const scoreModal = document.getElementById('scoreModal');
const scoreModalTitle = document.getElementById('scoreModalTitle');
const scoreModalList = document.getElementById('scoreModalList');
const clearListBtn = document.getElementById('clearListBtn');
const rightScoreEl = document.getElementById('rightScore');
const wrongScoreEl = document.getElementById('wrongScore');

const MODE_STORAGE_KEY = 'geolearn.mode';
const CONTINENT_STORAGE_KEY = 'geolearn.continent';
const WRONG_CODES_KEY = 'geolearn.wrongCodes';
const RIGHT_CODES_KEY = 'geolearn.rightCodes';
let mode = localStorage.getItem(MODE_STORAGE_KEY) || 'outlines';
let continent = localStorage.getItem(CONTINENT_STORAGE_KEY) || 'all';
let allCards = [];
let cards = [];
let i = 0;
let wrongCodes = new Set(JSON.parse(localStorage.getItem(WRONG_CODES_KEY) || '[]'));
let rightCodes = new Set(JSON.parse(localStorage.getItem(RIGHT_CODES_KEY) || '[]'));
let flipped = false;
let gradingInProgress = false;
let cardsLoaded = false;
let initError = null;
let activeGradeToken = 0;
let toastTimer = null;
let codeToIndex = new Map();
let emojiMap = new Map();
let activeModalType = null;
let searchMatches = [];
let searchActiveIndex = 0;

if (!['outlines', 'flags', 'capitals'].includes(mode)) {
  mode = 'outlines';
}

function norm(s) {
  return String(s || '').toLowerCase().trim();
}

function hasCards() {
  return cardsLoaded && cards.length > 0;
}

function setGameplayEnabled(enabled) {
  wrongBtn.disabled = !enabled;
  rightBtn.disabled = !enabled;
  flipBtn.disabled = !enabled;
  card.setAttribute('aria-disabled', enabled ? 'false' : 'true');
}

function cancelPendingGrade() {
  activeGradeToken += 1;
  gradingInProgress = false;
}

function scoreMatch(cardItem, query) {
  const q = norm(query);
  if (!q) return -1;

  const code = norm(cardItem.code);
  const name = norm(cardItem.name);

  if (code === q) return 1000;
  if (name === q) return 950;
  if (name.startsWith(q)) return 800 - (name.length - q.length);
  if (code.startsWith(q)) return 760;
  if (name.includes(q)) return 650 - name.indexOf(q);

  // lightweight fuzzy: query chars in order inside name
  let qi = 0;
  for (const ch of name) {
    if (ch === q[qi]) qi += 1;
    if (qi === q.length) return 400;
  }
  return -1;
}

function persistCodes() {
  localStorage.setItem(WRONG_CODES_KEY, JSON.stringify([...wrongCodes]));
  localStorage.setItem(RIGHT_CODES_KEY, JSON.stringify([...rightCodes]));
}

function trackCode(code, ok) {
  if (ok) {
    rightCodes.add(code);
  } else {
    wrongCodes.add(code);
  }
  persistCodes();
}

function openScoreModal(type) {
  activeModalType = type;
  const codes = type === 'right' ? rightCodes : wrongCodes;
  scoreModalTitle.textContent = type === 'right' ? 'Right Answers' : 'Wrong Answers';

  if (codes.size === 0) {
    scoreModalList.innerHTML = '<li><span class="empty-msg">No countries yet.</span></li>';
  } else {
    const sorted = [...codes]
      .map((code) => {
        const c = allCards.find((x) => x.code === code) || cards.find((x) => x.code === code);
        return { code, name: c ? c.name : code, emoji: c ? c.emoji : '' };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    scoreModalList.innerHTML = sorted
      .map((x) => `<li><span class="flag-emoji">${x.emoji}</span> ${x.name}</li>`)
      .join('');
  }

  scoreModal.showModal();
}

function hideSearchResults() {
  searchResults.classList.add('hidden');
  searchResults.innerHTML = '';
  searchMatches = [];
  searchActiveIndex = 0;
}

function jumpToCountry(code) {
  if (!hasCards()) return;

  const target = codeToIndex.get(code);
  if (target === undefined) return;

  cancelPendingGrade();
  i = target;
  flipped = false;
  resetCardVisualState();
  hideSearchResults();
  render();
}

function renderSearchResults() {
  if (!searchMatches.length) {
    hideSearchResults();
    return;
  }

  searchResults.innerHTML = searchMatches
    .map((m, idx) => `
      <li class="${idx === searchActiveIndex ? 'active' : ''}" data-code="${m.code}">
        <span>${m.name}</span>
        <span class="code">${m.code}</span>
      </li>
    `)
    .join('');

  searchResults.classList.remove('hidden');
}

function applyFilters() {
  if (continent === 'all') {
    cards = [...allCards];
  } else {
    cards = allCards.filter((c) => c.continent === continent);
  }
  if (cards.length === 0) cards = [...allCards];
  codeToIndex = new Map(cards.map((c, idx) => [c.code, idx]));
  i = 0;
  flipped = false;
  resetCardVisualState();
  render();
}

function flashScore(el, type) {
  const cls = type === 'right' ? 'flash-right' : 'flash-wrong';
  el.classList.remove('flash-right', 'flash-wrong');
  void el.offsetHeight;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 450);
}

function shuffle(arr) {
  for (let j = arr.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [arr[j], arr[k]] = [arr[k], arr[j]];
  }
  return arr;
}

function showToast(msg) {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  toast.textContent = msg;
  toast.classList.add('show');
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toastTimer = null;
  }, 900);
}

function feedback(type) {
  card.classList.remove('correct-flash', 'wrong-flash');
  const cls = type === 'correct' ? 'correct-flash' : 'wrong-flash';
  card.classList.add(cls);
}

function clearCardFeedback() {
  card.classList.remove('correct-flash', 'wrong-flash');
}

function flagImage(src, name) {
  return `<img class="flag-img" alt="Flag of ${name}" src="${src}" loading="lazy"/>`;
}

function frontContent(c) {
  if (mode === 'flags') {
    return `<div class="visual">${flagImage(c.flagPath, c.name)}</div><div class="label">Tap to reveal</div>`;
  }
  if (mode === 'capitals') {
    return `<div class="label top">${c.name}</div><div class="visual">${flagImage(c.flagPath, c.name)}</div><div class="sub">Tap to reveal capital</div>`;
  }
  return `<div class="visual"><img alt="Country outline" src="${c.path}"/></div><div class="label">Tap to reveal</div>`;
}

function backContent(c) {
  if (mode === 'flags') {
    return `<div class="visual">${flagImage(c.flagPath, c.name)}</div><div class="label">${c.name}</div>`;
  }
  if (mode === 'capitals') {
    return `<div class="label top">${c.name}</div><div class="visual">${flagImage(c.flagPath, c.name)}</div><div class="label">${c.capital || 'Unknown capital'}</div>`;
  }
  return `<div class="visual"><img alt="Country outline" src="${c.path}"/></div><div class="label">${c.name}</div>`;
}

function render() {
  if (!hasCards()) {
    progressEl.textContent = '0 / 0';
    rightScoreEl.textContent = `✅ ${rightCodes.size}`;
    wrongScoreEl.textContent = `❌ ${wrongCodes.size}`;

    if (initError) {
      front.innerHTML = '<div class="label">Unable to load cards</div>';
      back.innerHTML = '<div class="label">Please refresh to retry</div>';
      card.classList.remove('flipped');
    }
    return;
  }

  if (i >= cards.length || i < 0) i = 0;

  const c = cards[i];
  front.innerHTML = frontContent(c);
  back.innerHTML = backContent(c);
  card.classList.toggle('flipped', flipped);

  const progressText = `${i + 1} / ${cards.length}`;
  const rightText = `✅ ${rightCodes.size}`;
  const wrongText = `❌ ${wrongCodes.size}`;
  if (progressEl.textContent !== progressText) progressEl.textContent = progressText;
  if (rightScoreEl.textContent !== rightText) rightScoreEl.textContent = rightText;
  if (wrongScoreEl.textContent !== wrongText) wrongScoreEl.textContent = wrongText;
}

function nextCard() {
  if (!hasCards()) return;

  flipped = false;

  // Skip countries already on the correct list
  const start = i;
  do {
    i = (i + 1) % cards.length;
  } while (rightCodes.has(cards[i].code) && i !== start);

  resetCardVisualState();
  render();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function grade(ok) {
  if (!hasCards() || gradingInProgress) return;
  gradingInProgress = true;
  const gradeToken = ++activeGradeToken;

  // Always show answer before scoring if hidden.
  if (!flipped) {
    flipped = true;
    render();
  }

  const currentCode = cards[i].code;
  trackCode(currentCode, ok);
  if (ok) {
    feedback('correct');
    showToast('Correct!');
  } else {
    feedback('wrong');
    showToast('Wrong');
  }
  render();
  flashScore(ok ? rightScoreEl : wrongScoreEl, ok ? 'right' : 'wrong');

  try {
    // Keep feedback visible while answer is shown.
    await sleep(1500);

    if (gradeToken !== activeGradeToken) return;
    nextCard();
  } finally {
    if (gradeToken === activeGradeToken) {
      gradingInProgress = false;
    }
  }
}

function toggleFlip() {
  if (!hasCards() || gradingInProgress) return;
  flipped = !flipped;
  card.classList.toggle('flipped', flipped);
}

card.addEventListener('click', toggleFlip);
card.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggleFlip();
  }
});

rightBtn.addEventListener('click', () => grade(true));
wrongBtn.addEventListener('click', () => grade(false));
flipBtn.addEventListener('click', toggleFlip);

window.addEventListener('keydown', (e) => {
  const tag = (document.activeElement?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;

  if (e.key === ' ') {
    e.preventDefault();
    toggleFlip();
  } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
    e.preventDefault();
    grade(false);
  } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'f') {
    e.preventDefault();
    grade(true);
  }
});

async function gradeFromSwipe(ok, dx) {
  if (!hasCards() || gradingInProgress) return;
  gradingInProgress = true;
  const gradeToken = ++activeGradeToken;

  const currentCode = cards[i].code;
  trackCode(currentCode, ok);
  showToast(ok ? 'Correct!' : 'Wrong');
  render();
  flashScore(ok ? rightScoreEl : wrongScoreEl, ok ? 'right' : 'wrong');

  const exitX = (dx > 0 ? 1 : -1) * Math.max(window.innerWidth * 0.9, 320);
  card.classList.add(dx > 0 ? 'swipe-out-right' : 'swipe-out-left');
  card.style.transition = 'transform 220ms ease-out';
  card.style.transform = `translateX(${exitX}px) rotate(${dx > 0 ? SWIPE_EXIT_ROTATION : -SWIPE_EXIT_ROTATION}deg)${flipped ? ' rotateY(180deg)' : ''}`;

  try {
    await sleep(240);

    if (gradeToken !== activeGradeToken) return;

    // Load next card content offscreen below
    flipped = false;
    i = (i + 1) % cards.length;
    render();
    clearCardFeedback();
    clearSwipeFeedback();
    card.classList.remove('swipe-out-right', 'swipe-out-left');
    card.style.transition = 'none';
    card.style.transform = 'translateY(60px)';
    card.style.opacity = '0';

    // Force reflow so the position takes effect before animating
    void card.offsetHeight;

    card.style.transition = 'transform 280ms cubic-bezier(.22,.61,.36,1), opacity 280ms ease';
    card.style.transform = '';
    card.style.opacity = '1';

    await sleep(290);
    if (gradeToken !== activeGradeToken) return;
    card.style.transition = '';
    card.style.opacity = '';
  } finally {
    if (gradeToken === activeGradeToken) {
      gradingInProgress = false;
    }
  }
}

let startX = 0;
let currentX = 0;
let dragging = false;
const SWIPE_THRESHOLD = 70;
const SWIPE_EXIT_ROTATION = 14;

function clearSwipeFeedback() {
  app.classList.remove('swipe-right', 'swipe-left');
  app.style.setProperty('--swipe-bg-opacity', '0');
}

function setSwipeFeedback(dx) {
  app.classList.remove('swipe-right', 'swipe-left');
  if (Math.abs(dx) < 8) {
    app.style.setProperty('--swipe-bg-opacity', '0');
    return;
  }

  const progress = Math.min(Math.abs(dx) / 180, 1);
  app.style.setProperty('--swipe-bg-opacity', String(0.14 + progress * 0.36));
  app.classList.add(dx > 0 ? 'swipe-right' : 'swipe-left');
}

function resetCardTransform() {
  card.classList.remove('swipe-out-right', 'swipe-out-left');
  card.style.transition = '';
  card.style.transform = '';
  clearSwipeFeedback();
}

function resetCardVisualState() {
  clearCardFeedback();
  resetCardTransform();
}

card.addEventListener('touchstart', (e) => {
  if (!hasCards() || gradingInProgress) return;
  startX = e.touches[0].clientX;
  currentX = startX;
  dragging = true;
  card.style.transition = '';
  card.classList.remove('swipe-out-right', 'swipe-out-left');
  clearSwipeFeedback();
}, { passive: true });

card.addEventListener('touchmove', (e) => {
  if (!dragging || gradingInProgress || !hasCards()) return;
  currentX = e.touches[0].clientX;
  const dx = currentX - startX;
  setSwipeFeedback(dx);
  card.style.transform = `translateX(${dx}px) rotate(${dx * 0.02}deg)${flipped ? ' rotateY(180deg)' : ''}`;
}, { passive: true });

card.addEventListener('touchend', () => {
  if (!dragging || gradingInProgress || !hasCards()) return;
  dragging = false;
  const dx = currentX - startX;

  if (dx > SWIPE_THRESHOLD) {
    gradeFromSwipe(true, dx);
  } else if (dx < -SWIPE_THRESHOLD) {
    gradeFromSwipe(false, dx);
  } else {
    card.style.transition = 'transform 180ms ease-out';
    card.style.transform = `${flipped ? 'rotateY(180deg)' : ''}`;
    clearSwipeFeedback();
    setTimeout(() => {
      card.style.transition = '';
      card.style.transform = '';
    }, 200);
  }
});

modeSelect.addEventListener('change', () => {
  cancelPendingGrade();
  mode = modeSelect.value;
  localStorage.setItem(MODE_STORAGE_KEY, mode);
  flipped = false;
  resetCardVisualState();
  render();
});

continentSelect.addEventListener('change', () => {
  cancelPendingGrade();
  continent = continentSelect.value;
  localStorage.setItem(CONTINENT_STORAGE_KEY, continent);
  applyFilters();
});

countrySearch.addEventListener('focus', () => {
  countrySearch.value = '';
  hideSearchResults();
});

countrySearch.addEventListener('input', () => {
  if (!hasCards()) {
    hideSearchResults();
    return;
  }

  const q = countrySearch.value;
  if (!q.trim()) {
    hideSearchResults();
    return;
  }

  searchMatches = cards
    .map((c) => ({ c, score: scoreMatch(c, q) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
    .slice(0, 8)
    .map((x) => x.c);

  searchActiveIndex = 0;
  renderSearchResults();
});

countrySearch.addEventListener('keydown', (e) => {
  if (!searchMatches.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    searchActiveIndex = (searchActiveIndex + 1) % searchMatches.length;
    renderSearchResults();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    searchActiveIndex = (searchActiveIndex - 1 + searchMatches.length) % searchMatches.length;
    renderSearchResults();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const chosen = searchMatches[searchActiveIndex];
    if (!chosen) return;
    jumpToCountry(chosen.code);
    countrySearch.value = `${chosen.name} (${chosen.code})`;
  } else if (e.key === 'Escape') {
    hideSearchResults();
  }
});

searchResults.addEventListener('mousedown', (e) => {
  const el = e.target instanceof Element ? e.target : null;
  if (!el) return;

  const li = el.closest('li[data-code]');
  if (!li) return;

  const code = li.dataset.code;
  const chosen = searchMatches.find((x) => x.code === code);
  if (!chosen) return;

  jumpToCountry(chosen.code);
  countrySearch.value = `${chosen.name} (${chosen.code})`;
});

rightScoreEl.addEventListener('click', () => openScoreModal('right'));
wrongScoreEl.addEventListener('click', () => openScoreModal('wrong'));

scoreModal.addEventListener('click', (e) => {
  if (e.target === scoreModal) scoreModal.close();
});

clearListBtn.addEventListener('click', () => {
  if (activeModalType === 'right') {
    rightCodes.clear();
  } else {
    wrongCodes.clear();
  }
  persistCodes();
  scoreModalList.innerHTML = '<li><span class="empty-msg">No countries yet.</span></li>';
  render();
});

document.addEventListener('click', (e) => {
  const target = e.target;

  if (target !== countrySearch && !searchResults.contains(target)) {
    hideSearchResults();
  }

});

(async function init() {
  setGameplayEnabled(false);

  try {
    const [cardsRes, countriesRes] = await Promise.all([
      fetch('/data/cards.json'),
      fetch('/data/countries.json'),
    ]);

    if (!cardsRes.ok) {
      throw new Error(`Failed to load cards: HTTP ${cardsRes.status}`);
    }

    const rawCards = await cardsRes.json();
    if (!Array.isArray(rawCards) || rawCards.length === 0) {
      throw new Error('Cards payload is empty');
    }

    let codeToContinent = new Map();
    if (countriesRes.ok) {
      const countries = await countriesRes.json();
      emojiMap = new Map(countries.map((c) => [c.code, c.flag || '']));
      codeToContinent = new Map(countries.map((c) => [c.code, c.continent || '']));
    }

    allCards = shuffle(
      rawCards.map((c) => ({
        code: c.code,
        path: c.shapePath,
        name: c.name,
        capital: c.capital,
        flagPath: c.flagPath,
        emoji: emojiMap.get(c.code) || '',
        continent: codeToContinent.get(c.code) || '',
      }))
    );

    if (!allCards.length) {
      throw new Error('No cards available after processing');
    }

    modeSelect.value = mode;
    continentSelect.value = continent;
    applyFilters();

    cardsLoaded = true;
    initError = null;
    setGameplayEnabled(true);
    render();
  } catch (err) {
    console.error(err);
    initError = err;
    cardsLoaded = false;
    allCards = [];
    cards = [];
    codeToIndex = new Map();
    hideSearchResults();
    setGameplayEnabled(false);
    showToast('Could not load cards');
    render();
  }
})();
