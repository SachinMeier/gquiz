const app = document.getElementById('app');
const card = document.getElementById('card');
const shape = document.getElementById('shape');
const nameEl = document.getElementById('name');
const progressEl = document.getElementById('progress');
const scoreEl = document.getElementById('score');
const toast = document.getElementById('toast');

const wrongBtn = document.getElementById('wrongBtn');
const rightBtn = document.getElementById('rightBtn');
const revealBtn = document.getElementById('revealBtn');

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

let cards = [];
let i = 0;
let right = 0;
let wrong = 0;
let revealed = false;

function labelFor(cardItem) {
  const maybe = regionNames.of(cardItem.code);
  return maybe && maybe !== cardItem.code ? maybe : cardItem.code;
}

function shuffle(arr) {
  for (let j = arr.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [arr[j], arr[k]] = [arr[k], arr[j]];
  }
  return arr;
}

function render() {
  if (!cards.length) return;
  if (i >= cards.length) i = 0;
  const c = cards[i];
  shape.innerHTML = `<img alt="Country shape" src="${c.path}" />`;
  nameEl.textContent = revealed ? labelFor(c) : 'Tap to reveal';
  progressEl.textContent = `${i + 1} / ${cards.length}`;
  scoreEl.textContent = `✅ ${right} · ❌ ${wrong}`;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 850);
}

function feedback(type) {
  app.classList.remove('correct', 'wrong');
  app.classList.add(type);
  setTimeout(() => app.classList.remove(type), 260);
}

function answer(ok) {
  if (!revealed) {
    revealed = true;
    render();
    return;
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

  revealed = false;
  i = (i + 1) % cards.length;
  render();
}

card.addEventListener('click', () => {
  if (!revealed) {
    revealed = true;
    render();
  }
});
card.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (!revealed) {
      revealed = true;
      render();
    }
  }
});

rightBtn.addEventListener('click', () => answer(true));
wrongBtn.addEventListener('click', () => answer(false));
revealBtn.addEventListener('click', () => {
  revealed = true;
  render();
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
  card.style.transform = `translateX(${dx}px) rotate(${dx * 0.03}deg)`;
}, { passive: true });

card.addEventListener('touchend', () => {
  if (!dragging) return;
  dragging = false;
  const dx = currentX - startX;
  card.style.transform = '';
  if (dx > 70) answer(true);
  if (dx < -70) answer(false);
});

(async function init() {
  const res = await fetch('/country-shapes/manifest.json');
  const allCards = await res.json();

  // Keep one shape per country code, preferring /all/ paths.
  const byCode = new Map();
  for (const item of allCards) {
    const existing = byCode.get(item.code);
    if (!existing || (item.path.includes('/all/') && !existing.path.includes('/all/'))) {
      byCode.set(item.code, item);
    }
  }

  cards = shuffle(Array.from(byCode.values()));
  render();
})();
