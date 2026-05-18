/**
 * electron-builder downloads winCodeSign-2.6.0 (a 7z bundle with macOS
 * code-signing helpers) and extracts it on every Windows build. The bundle
 * contains symlinks under darwin/10.12/lib/ — creating those on Windows
 * requires admin OR "Developer Mode" enabled. Without that privilege, 7zip
 * returns exit code 2 and the whole build aborts even though we only need
 * the Windows binaries inside the archive.
 *
 * This script pre-extracts the cache once, ignoring the symlink failures,
 * then writes empty placeholder files where the symlinks would go. With
 * the cache dir already populated, electron-builder skips re-extraction.
 *
 * Run before `npm run build`, or wire into the prebuild step.
 */
const fs   = require('node:fs');
const os   = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CACHE = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign');
const SEVENZIP = path.resolve(__dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');

if (!fs.existsSync(CACHE)) {
  console.log(`[wincodesign-fix] cache dir not yet created: ${CACHE}`);
  console.log('[wincodesign-fix] electron-builder will download on first build; rerun this script after.');
  process.exit(0);
}
if (!fs.existsSync(SEVENZIP)) {
  console.error(`[wincodesign-fix] 7za.exe missing — run npm install first`);
  process.exit(1);
}

const archives = fs.readdirSync(CACHE).filter(f => f.endsWith('.7z'));
if (!archives.length) {
  console.log('[wincodesign-fix] no .7z archives in cache yet');
  process.exit(0);
}

const placeholders = [
  'darwin/10.12/lib/libcrypto.dylib',
  'darwin/10.12/lib/libssl.dylib',
];

let fixed = 0;
for (const archive of archives) {
  const archivePath = path.join(CACHE, archive);
  const dirName = archive.replace(/\.7z$/, '');
  const targetDir = path.join(CACHE, dirName);

  // If a previous run already created our .metadata.json marker, skip.
  // (The OS symlink files may exist as zero-byte placeholders from prior
  // failed 7zip runs — that's not a reliable "extracted" marker.)
  const ourMarker = path.join(targetDir, '.metadata.json');
  if (fs.existsSync(ourMarker)) continue;

  console.log(`[wincodesign-fix] extracting ${archive}…`);
  try {
    execFileSync(SEVENZIP, ['x', '-snld', '-bd', '-y', archivePath, `-o${targetDir}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    // exit code 2 = symlink failures, harmless for our purposes
    if (e.status !== 2) {
      console.error(`[wincodesign-fix] 7zip failed on ${archive} with exit ${e.status}`);
      continue;
    }
  }

  // Write empty placeholders for the macOS symlinks so electron-builder's
  // existence checks pass. They're never read on Windows builds.
  for (const rel of placeholders) {
    const p = path.join(targetDir, rel);
    if (fs.existsSync(p)) continue;
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '');
  }
  // Drop the marker electron-builder's cache check looks for so it won't
  // retry the 7zip extraction (which keeps failing on the macOS symlinks).
  fs.writeFileSync(path.join(targetDir, '.metadata.json'), JSON.stringify({
    extractedAt: new Date().toISOString(),
    fixedBy:     'scripts/fix-wincodesign-cache.js',
    note:        'symlinks under darwin/10.12/lib are zero-byte placeholders (Windows builds only need the windows-10 sub-tree)',
  }));
  fixed++;
}

console.log(`[wincodesign-fix] OK — pre-extracted ${fixed} archive(s).`);
