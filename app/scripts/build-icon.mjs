// Build a multi-resolution Windows ICO + PNG from public/icon.svg.
// Run with: node scripts/build-icon.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root      = path.join(__dirname, '..');
const svgPath   = path.join(root, 'public', 'icon.svg');
const outIco    = path.join(root, 'public', 'icon.ico');
const outPng    = path.join(root, 'public', 'icon.png');

const svg = fs.readFileSync(svgPath);

// Generate the sizes Windows expects in an .ico (256 is required for
// taskbar/Explorer high-DPI, the smaller ones for legacy contexts).
const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs  = await Promise.all(sizes.map(s =>
  sharp(svg, { density: 384 })
    .resize(s, s)
    .png()
    .toBuffer()
));

fs.writeFileSync(outIco, await toIco(pngs));
console.log(`wrote ${outIco}`);

// Also write a 512x512 PNG for the Linux/macOS BrowserWindow icon path.
const big = await sharp(svg, { density: 384 }).resize(512, 512).png().toBuffer();
fs.writeFileSync(outPng, big);
console.log(`wrote ${outPng}`);
