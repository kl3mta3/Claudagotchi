// Post-package: force-embed public/icon.ico into the packaged exe using the
// rcedit binary that ships with electron-builder's winCodeSign cache. We do
// this because @electron/packager's own --icon flag has been intermittently
// silent-failing for this project, leaving the default Electron atom icon
// on the exe even after a successful pack.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..');
const exe  = path.join(root, '..', 'dist-electron', 'Claudagotchi-win32-x64', 'Claudagotchi.exe');
const ico  = path.join(root, 'public', 'icon.ico');

if (!fs.existsSync(exe)) { console.error('exe not found:', exe); process.exit(1); }
if (!fs.existsSync(ico)) { console.error('icon not found:', ico); process.exit(1); }

// Find rcedit. electron-builder caches it under %LOCALAPPDATA%.
const cacheRoot = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'winCodeSign');
let rcedit = null;
if (fs.existsSync(cacheRoot)) {
  for (const dir of fs.readdirSync(cacheRoot).sort().reverse()) {
    const cand = path.join(cacheRoot, dir, 'rcedit-x64.exe');
    if (fs.existsSync(cand)) { rcedit = cand; break; }
  }
}
if (!rcedit) {
  console.warn('rcedit-x64.exe not found in electron-builder cache; skipping icon embed.');
  process.exit(0);
}

try {
  execFileSync(rcedit, [exe, '--set-icon', ico], { stdio: 'inherit' });
  console.log('icon embedded:', path.basename(exe));
} catch (e) {
  console.error('rcedit failed:', e.message);
  process.exit(1);
}

// Explorer caches icons per filename + FILE_ID, even after the bytes change.
// To force a fresh icon read, copy the patched exe to a new name and atomic-
// rename back — Windows treats this as a brand-new file for cache purposes.
try {
  const tmp = exe + '.iconrefresh';
  fs.copyFileSync(exe, tmp);
  fs.unlinkSync(exe);
  fs.renameSync(tmp, exe);
  console.log('cache-evicted via rename trick');
} catch (e) {
  console.warn('rename refresh skipped:', e.message);
}
