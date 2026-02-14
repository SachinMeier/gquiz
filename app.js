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

const MODE_STORAGE_KEY = 'geolearn.mode';
let mode = localStorage.getItem(MODE_STORAGE_KEY) || 'outlines';
let cards = [];
let i = 0;
let right = 0;
let wrong = 0;
let flipped = false;
let gradingInProgress = false;

const MODE_LABELS = {
  outlines: 'Outlines',
  flags: 'Flags',
  capitals: 'Capitals',
};

if (!MODE_LABELS[mode]) {
  mode = 'outlines';
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

function flagImage(code, name) {
  const lower = String(code || '').toLowerCase();
  return `<img class="flag-img" alt="Flag of ${name}" src="https://flagcdn.com/w640/${lower}.png" loading="lazy"/>`;
}

function frontContent(c) {
  if (mode === 'flags') {
    return `<div class="visual">${flagImage(c.code, c.name)}</div><div class="label">Tap to reveal</div>`;
  }
  if (mode === 'capitals') {
    return `<div class="visual"></div><div class="label">${c.capital || 'Unknown capital'}</div><div class="sub">Tap to reveal country</div>`;
  }
  return `<div class="visual"><img alt="Country outline" src="${c.path}"/></div><div class="label">Tap to reveal</div>`;
}

function backContent(c) {
  if (mode === 'flags') {
    return `<div class="visual">${flagImage(c.code, c.name)}</div><div class="label">${c.name}</div>`;
  }
  if (mode === 'capitals') {
    return `<div class="visual"></div><div class="label">${c.name}</div><div class="sub">Capital: ${c.capital || 'Unknown'}</div>`;
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

(async function init() {
  const [shapeRes, countriesRes] = await Promise.all([
    fetch('/country-shapes/manifest.json'),
    fetch('/data/countries.json'),
  ]);

  const allShapes = await shapeRes.json();
  const countries = await countriesRes.json();
  const countryByCode = new Map(countries.map((c) => [c.code, c]));

  // One outline per country code, prefer /all/
  const shapeByCode = new Map();
  for (const s of allShapes) {
    if (!countryByCode.has(s.code)) continue;
    const existing = shapeByCode.get(s.code);
    if (!existing || (s.path.includes('/all/') && !existing.path.includes('/all/'))) {
      shapeByCode.set(s.code, s);
    }
  }

  cards = shuffle(
    Array.from(shapeByCode.entries()).map(([code, shape]) => ({
      code,
      path: shape.path,
      name: countryByCode.get(code).name,
      capital: countryByCode.get(code).capital,
    }))
  );

  const modeInput = settingsPanel.querySelector(`input[name="mode"][value="${mode}"]`);
  if (modeInput) modeInput.checked = true;

  render();
})();
