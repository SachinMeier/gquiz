const { test, expect } = require('@playwright/test');
test.use({ serviceWorkers: 'block' });
const { bootApp } = require('./helpers');

const navigation = {
  'correct button': (page) => page.locator('#rightBtn').click(),
  'wrong button': (page) => page.locator('#wrongBtn').click(),
  'correct hotkey': (page) => page.keyboard.press('ArrowRight'),
  'wrong hotkey': (page) => page.keyboard.press('ArrowLeft'),
  'swipe right': (page) => swipe(page, 140),
  'swipe left': (page) => swipe(page, -140),
};

async function swipe(page, dx) {
  const bounds = await page.locator('#card').boundingBox();
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x, y }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [{ x: x + dx, y }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd', touchPoints: [],
  });
  await session.detach();
}

for (const [action, navigate] of Object.entries(navigation)) {
  for (const flipped of [false, true]) {
    test(`${action} shows only the next front when starting ${flipped ? 'flipped' : 'unflipped'}`, async ({ page }) => {
      if (action.startsWith('swipe')) {
        await page.setViewportSize({ width: 390, height: 844 });
      }
      await bootApp(page);
      if (flipped) {
        await page.locator('#flipBtn').click();
        await expect.poll(() => page.locator('#card').evaluate((card) =>
          new DOMMatrixReadOnly(getComputedStyle(card).transform).m33
        )).toBe(-1);
      }

      // Inspect every painted frame, including the first frame with new content.
      // Checking the final class alone misses the answer during an unflip.
      await page.evaluate(() => {
        const card = document.getElementById('card');
        const front = document.getElementById('front');
        const original = front.innerHTML;
        window.navigationFrames = new Promise((resolve) => {
          const frames = [];
          let changedAt;
          window.answerFrames = [];
          function sample(time) {
            if (front.innerHTML === original && card.classList.contains('flipped')) {
              const transform = new DOMMatrixReadOnly(getComputedStyle(card).transform);
              const bounds = card.getBoundingClientRect();
              if (transform.m33 < -0.99 && bounds.left >= -1 && bounds.right <= innerWidth + 1) {
                window.answerFrames.push({
                  time,
                  color: getComputedStyle(document.getElementById('back')).backgroundColor,
                  feedback: card.classList.contains('correct-flash') || card.classList.contains('wrong-flash'),
                });
              }
            }
            if (front.innerHTML !== original) {
              changedAt ??= time;
              const transform = new DOMMatrixReadOnly(getComputedStyle(card).transform);
              frames.push({
                frontFacing: Math.abs(transform.m33 - 1) < 0.0001,
                flipped: card.classList.contains('flipped'),
              });
            }
            if (changedAt !== undefined && time - changedAt >= 400) {
              resolve(frames);
            } else {
              requestAnimationFrame(sample);
            }
          }
          requestAnimationFrame(sample);
        });
      });

      await navigate(page);
      const frames = await page.evaluate(() => window.navigationFrames);
      expect(frames.length).toBeGreaterThan(1);
      expect(frames.filter((frame) => !frame.frontFacing || frame.flipped)).toEqual([]);

      const answerFrames = await page.evaluate(() => window.answerFrames.filter((frame) => frame.feedback));
      expect(answerFrames.length).toBeGreaterThan(2);
      expect(answerFrames.at(-1).time - answerFrames[0].time).toBeGreaterThan(200);
      expect(answerFrames.some((frame) => frame.color === (
        action.includes('correct') || action === 'swipe right' ? 'rgb(34, 197, 94)' : 'rgb(185, 28, 28)'
      ))).toBe(true);

      // Resetting navigation must preserve the normal reveal interaction.
      await page.locator('#flipBtn').click();
      await expect(page.locator('#card')).toHaveClass(/flipped/);
    });
  }
}

for (const [action, navigate] of Object.entries(navigation)) {
  test(`freeze preserves lists over repeated passes using ${action}`, async ({ page }) => {
    await bootApp(page, {
      storage: {
        'geolearn.rightCodes': JSON.stringify(['JP', 'US', 'AI']),
        'geolearn.wrongCodes': JSON.stringify(['AD']),
      },
    });
    const freeze = page.locator('#freezeBtn');
    await expect(freeze).toHaveAttribute('aria-pressed', 'false');
    await freeze.click();
    await expect(freeze).toHaveAttribute('aria-pressed', 'true');
    for (let pass = 0; pass < 3; pass++) {
      await navigate(page);
      await expect(page.locator('#card')).toHaveClass(/flipped/);
      await expect(page.locator('#card')).not.toHaveClass(/flipped/);
      await expect.poll(() => page.locator('#card').evaluate((card) => card.style.transition)).toBe('');
      await expect(page.locator('#progress')).toHaveText('1 / 1');
      await expect(page.locator('#rightScore')).toHaveText('✅ 3');
      await expect(page.locator('#wrongScore')).toHaveText('❌ 1');
    }
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('geolearn.wrongCodes')))).toEqual(['AD']);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('geolearn.rightCodes')))).toEqual(['JP', 'US', 'AI']);
    await freeze.click();
    await page.locator('#rightBtn').click();
    await expect(page.locator('#front')).toContainText('Congratulations!');
    await expect(page.locator('#rightScore')).toHaveText('✅ 4');
    await expect(page.locator('#wrongScore')).toHaveText('❌ 0');
  });
}

test('freeze does not add ungraded cards and is restored on reload', async ({ page }) => {
  await bootApp(page, { storage: { 'geolearn.freeze': 'true' } });
  await expect(page.locator('#freezeBtn')).toHaveAttribute('aria-pressed', 'true');
  for (const action of ['correct button', 'wrong button']) {
    await navigation[action](page);
    await expect(page.locator('#card')).toHaveClass(/flipped/);
    await expect(page.locator('#card')).not.toHaveClass(/flipped/);
    await expect(page.locator('#rightScore')).toHaveText('✅ 0');
    await expect(page.locator('#wrongScore')).toHaveText('❌ 0');
  }
  expect(await page.evaluate(() => localStorage.getItem('geolearn.freeze'))).toBe('true');
  await page.reload();
  await expect(page.locator('#freezeBtn')).toHaveAttribute('aria-pressed', 'true');
});

test('changing mode during answer preview cancels pending navigation', async ({ page }) => {
  await bootApp(page);
  const original = await page.locator('#front img').getAttribute('src');
  await page.locator('#wrongBtn').click();
  await page.locator('#modeSelect').selectOption('flags');
  await expect(page.locator('#card')).not.toHaveClass(/flipped/);
  await page.waitForTimeout(1000);
  await expect(page.locator('#front img')).toHaveAttribute('src', original);
  await expect(page.locator('#card')).not.toHaveClass(/wrong-flash/);
});
