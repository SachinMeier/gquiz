const { test, expect } = require('@playwright/test');
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
          function sample(time) {
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

      // Resetting navigation must preserve the normal reveal interaction.
      await page.locator('#flipBtn').click();
      await expect(page.locator('#card')).toHaveClass(/flipped/);
    });
  }
}
