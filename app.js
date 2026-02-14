const app = document.getElementById('app');
const card = document.getElementById('card');
const front = document.getElementById('front');
const back = document.getElementById('back');
const progressEl = document.getElementById('progress');
const scoreEl = document.getElementById('score');
const toast = document.getElementById('toast');
const modeLabel = document.getElementById('modeLabel');

const wrongBtn = document.getElementById('wrongBtn');
const rightBtn = document.getElementById('rightBtn');
const flipBtn = document.getElementById('flipBtn');

const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettings = document.getElementById('closeSettings');

const countrySearch = document.getElementById('countrySearch');
const searchResults = document.getElementById('searchResults');

const MODE_STORAGE_KEY = 'geolearn.mode';
let mode = localStorage.getItem(MODE_STORAGE_KEY) || 'outlines';
let cards = [];
let i = 0;
let right = 0;
let wrong = 0;
let flipped = false;
let gradingInProgress = false;
let codeToIndex = new Map();
let searchMatches = [];
let searchActiveIndex = 0;

const MODE_LABELS = {
  outlines: 'Outlines',
  flags: 'Flags',
  capitals: 'Capitals',
};

if (!MODE_LABELS[mode]) {
  mode = 'outlines';
}

function norm(s) {
  return String(s || '').toLowerCase().trim();
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

function hideSearchResults() {
  searchResults.classList.add('hidden');
  searchResults.innerHTML = '';
  searchMatches = [];
  searchActiveIndex = 0;
}

function jumpToCountry(code) {
  const target = codeToIndex.get(code);
  if (target === undefined) return;
  i = target;
  flipped = false;
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

function shuffle(arr) {
  for (let j = arr.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [arr[j], arr[k]] = [arr[k], arr[j]];
  }
  return arr;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 900);
}

function feedback(type) {
  card.classList.remove('correct-flash', 'wrong-flash');
  const cls = type === 'correct' ? 'correct-flash' : 'wrong-flash';
  card.classList.add(cls);
}

function flagImage(src, name) {
  return `<img class="flag-img" alt="Flag of ${name}" src="${src}" loading="lazy"/>`;
}

function frontContent(c) {
  if (mode === 'flags') {
    return `<div class="visual">${flagImage(c.flagPath, c.name)}</div><div class="label">Tap to reveal</div>`;
  }
  if (mode === 'capitals') {
    return `<div class="visual"></div><div class="label">${c.name}</div><div class="sub">Tap to reveal capital</div>`;
  }
  return `<div class="visual"><img alt="Country outline" src="${c.path}"/></div><div class="label">Tap to reveal</div>`;
}

function backContent(c) {
  if (mode === 'flags') {
    return `<div class="visual">${flagImage(c.flagPath, c.name)}</div><div class="label">${c.name}</div>`;
  }
  if (mode === 'capitals') {
    return `<div class="visual"></div><div class="label">${c.capital || 'Unknown capital'}</div><div class="sub">${c.name}</div>`;
  }
  return `<div class="visual"><img alt="Country outline" src="${c.path}"/></div><div class="label">${c.name}</div>`;
}

function render() {
  if (!cards.length) return;
  if (i >= cards.length) i = 0;

  const c = cards[i];
  front.innerHTML = frontContent(c);
  back.innerHTML = backContent(c);
  card.classList.toggle('flipped', flipped);

  progressEl.textContent = `${i + 1} / ${cards.length}`;
  scoreEl.textContent = `✅ ${right} · ❌ ${wrong}`;
  modeLabel.textContent = `Mode: ${MODE_LABELS[mode]}`;
}

function nextCard() {
  card.classList.remove('correct-flash', 'wrong-flash');
  flipped = false;
  i = (i + 1) % cards.length;
  render();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function grade(ok) {
  if (gradingInProgress) return;
  gradingInProgress = true;

  // Always show answer before scoring if hidden.
  if (!flipped) {
    flipped = true;
    render();
  }

  if (ok) {
    right += 1;
    feedback('correct');
    showToast('Correct!');
  } else {
    wrong += 1;
    feedback('wrong');
    showToast('Wrong');
  }

  // Keep feedback visible while answer is shown.
  await sleep(1500);
  nextCard();
  gradingInProgress = false;
}

function toggleFlip() {
  if (gradingInProgress) return;
  flipped = !flipped;
  render();
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
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    grade(false);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    grade(true);
  }
});

let startX = 0;
let currentX = 0;
let dragging = false;

card.addEventListener('touchstart', (e) => {
  startX = e.touches[0].clientX;
  currentX = startX;
  dragging = true;
}, { passive: true });

card.addEventListener('touchmove', (e) => {
  if (!dragging) return;
  currentX = e.touches[0].clientX;
  const dx = currentX - startX;
  card.style.transform = `${flipped ? 'rotateY(180deg)' : ''} translateX(${dx}px) rotate(${dx * 0.02}deg)`;
}, { passive: true });

card.addEventListener('touchend', () => {
  if (!dragging) return;
  dragging = false;
  const dx = currentX - startX;
  card.style.transform = '';
  if (dx > 70) grade(true);
  else if (dx < -70) grade(false);
});

settingsBtn.addEventListener('click', () => settingsPanel.classList.toggle('hidden'));
closeSettings.addEventListener('click', () => settingsPanel.classList.add('hidden'));

settingsPanel.addEventListener('change', (e) => {
  const t = e.target;
  if (t && t.name === 'mode') {
    mode = t.value;
    localStorage.setItem(MODE_STORAGE_KEY, mode);
    flipped = false;
    render();
  }
});

countrySearch.addEventListener('input', () => {
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
    hideSearchResults();
  } else if (e.key === 'Escape') {
    hideSearchResults();
  }
});

searchResults.addEventListener('mousedown', (e) => {
  const li = e.target.closest('li[data-code]');
  if (!li) return;
  const code = li.dataset.code;
  const chosen = searchMatches.find((x) => x.code === code);
  if (!chosen) return;
  jumpToCountry(chosen.code);
  countrySearch.value = `${chosen.name} (${chosen.code})`;
  hideSearchResults();
});

document.addEventListener('click', (e) => {
  if (e.target === countrySearch || searchResults.contains(e.target)) return;
  hideSearchResults();
});

(async function init() {
  const cardsRes = await fetch('/data/cards.json');
  const allCards = await cardsRes.json();

  cards = shuffle(
    allCards.map((c) => ({
      code: c.code,
      path: c.shapePath,
      name: c.name,
      capital: c.capital,
      flagPath: c.flagPath,
    }))
  );

  codeToIndex = new Map(cards.map((c, idx) => [c.code, idx]));

  const modeInput = settingsPanel.querySelector(`input[name="mode"][value="${mode}"]`);
  if (modeInput) modeInput.checked = true;

  render();
})();
