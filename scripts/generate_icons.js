// Run with `node scripts/generate_icons.js` after editing favicon.svg.
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

async function main() {
  const root = path.resolve(__dirname, '..');
  const svg = await fs.readFile(path.join(root, 'favicon.svg'), 'utf8');
  const output = path.join(root, 'images/icons');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const sizes = [16, 32, 48, 180, 192, 512];
    const buffers = [];
    for (const size of sizes) {
      const encoded = await page.evaluate(async ({ svg, size }) => {
        const image = new Image();
        image.src = `data:image/svg+xml;base64,${btoa(svg)}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const context = canvas.getContext('2d');
        // Home-screen icons use an opaque background; the OS applies its mask.
        if (size >= 180) {
          context.fillStyle = '#0f172a';
          context.fillRect(0, 0, size, size);
        }
        context.drawImage(image, 0, 0, size, size);
        return canvas.toDataURL('image/png').split(',')[1];
      }, { svg, size });
      const buffer = Buffer.from(encoded, 'base64');
      buffers.push(buffer);
      const name = size === 180 ? 'apple-touch-icon.png'
        : size >= 192 ? `icon-${size}.png` : `favicon-${size}.png`;
      await fs.writeFile(path.join(output, name), buffer);
    }
    // ICO directory followed by three PNG-encoded frames (16, 32, 48px).
    const frames = buffers.slice(0, 3);
    const directory = Buffer.alloc(6 + frames.length * 16);
    directory.writeUInt16LE(1, 2);
    directory.writeUInt16LE(frames.length, 4);
    let offset = directory.length;
    frames.forEach((frame, index) => {
      const entry = 6 + index * 16;
      directory[entry] = directory[entry + 1] = sizes[index];
      directory.writeUInt16LE(1, entry + 4);
      directory.writeUInt16LE(32, entry + 6);
      directory.writeUInt32LE(frame.length, entry + 8);
      directory.writeUInt32LE(offset, entry + 12);
      offset += frame.length;
    });
    await fs.writeFile(path.join(root, 'favicon.ico'), Buffer.concat([directory, ...frames]));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
