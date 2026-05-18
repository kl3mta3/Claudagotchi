/**
 * Azure Trusted Signing hook for electron-builder.
 *
 * Mirrors the env-var + auth pattern used by Vitriol's tools/sign.py so a
 * single Azure Trusted Signing account+profile signs binaries across all of
 * the user's apps. The AzTS profile is per-publisher, not per-app — the
 * cert that signs Vitriol also signs Claudagotchi.
 *
 * electron-builder calls this once per file it produces (the unpacked
 * Claudagotchi.exe, bundled claude.exes under asar-unpacked, elevate.exe,
 * the NSIS uninstaller stub, the NSIS Setup.exe, the portable .exe).
 *
 * Required environment variables:
 *   VITRIOL_AZTS_ENDPOINT    e.g. https://eus.codesigning.azure.net/
 *   VITRIOL_AZTS_ACCOUNT     your Trusted Signing account name
 *   VITRIOL_AZTS_PROFILE     certificate profile name within the account
 *
 * Optional:
 *   VITRIOL_AZTS_DLIB        override Azure.CodeSigning.Dlib.dll path
 *   VITRIOL_AZTS_TS_URL      RFC 3161 timestamp URL
 *                            (default: http://timestamp.acs.microsoft.com)
 *   VITRIOL_SIGNTOOL         override signtool.exe path
 *   SIGN_DESCRIPTION         /d description embedded in signature
 *                            (default: "Claudagotchi")
 *   SIGN_URL                 /du info URL embedded in signature
 *                            (default: https://github.com/kl3mta3/Claudagotchi)
 *
 * Azure auth: signtool inherits Azure auth via the AzTS dlib from one of
 *   1. `az login` interactive session (typical local dev)
 *   2. service-principal env vars AZURE_CLIENT_ID / AZURE_TENANT_ID /
 *      AZURE_CLIENT_SECRET (typical CI)
 *   3. managed identity (Azure VM / GitHub Actions with federation)
 *
 * No SP env vars are READ by this script — they only need to be present in
 * the shell environment if you want auth path 2. For local dev just run
 * `az login` once and forget it.
 *
 * Graceful skip: if the three required env vars are missing, signing is
 * skipped with a clear banner and the build continues to produce an
 * UNSIGNED artifact. Any other failure (signtool error, verify failure)
 * throws so we never wrap a bad inner exe in a good outer installer.
 */
const { execFileSync } = require('node:child_process');
const fs   = require('node:fs');
const os   = require('node:os');
const path = require('node:path');

// If the required AzTS env vars aren't in the process environment when
// sign.js runs, look for the user's shared signing-env script and parse
// `$env:NAME = "value"` lines out of it. This is the file the user
// dot-sources before running Vitriol's `python tools/build_installer.py`;
// honoring it here lets `npm run build` work the same way without a
// manual `. $HOME\.vitriol-sign-env.ps1` step every time.
function loadSignEnvFile() {
  const candidates = [
    // Claudagotchi-specific env file wins so each app can have its own SP /
    // client secret — falls back to the shared Vitriol file otherwise.
    path.join(os.homedir(), '.claudagotchi-sign-env.ps1'),
    path.join(os.homedir(), '.vitriol-sign-env.ps1'),
  ];
  for (const f of candidates) {
    if (!fs.existsSync(f)) continue;
    try {
      const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
      let loaded = 0;
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        // Match `$env:NAME = "value"` or `$env:NAME='value'` or `$env:NAME=value`.
        const m = line.match(/^\$env:([A-Z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S.*?))\s*$/i);
        if (!m) continue;
        const name = m[1];
        const value = m[2] ?? m[3] ?? m[4] ?? '';
        if (!process.env[name]) {
          process.env[name] = value;
          loaded++;
        }
      }
      if (loaded > 0) {
        console.log(`[sign] loaded ${loaded} env var(s) from ${f}`);
      }
      return;
    } catch (e) {
      console.warn(`[sign] could not parse ${f}: ${e.message}`);
    }
  }
}

const DEFAULT_TIMESTAMP_URL = 'http://timestamp.acs.microsoft.com';
const DEFAULT_DESCRIPTION   = 'Claudagotchi';
const DEFAULT_INFO_URL      = 'https://github.com/kl3mta3/Claudagotchi';

// Windows SDK signtool roots. We enumerate every 10.0.* subdir at build
// time and pick the newest — version-pinning lists go stale fast (Microsoft
// shipped 10.0.26100.0 with Win11 24H2, etc).
const SIGNTOOL_SDK_ROOTS = [
  'C:\\Program Files (x86)\\Windows Kits\\10\\bin',
  'C:\\Program Files\\Windows Kits\\10\\bin',
];

// Azure Trusted Signing dlib (formerly the standalone "Azure.CodeSigning.Dlib"
// NuGet package — Microsoft renamed it to "Azure.CodeSigning.Sdk" in 2024).
// We look for both old + new layouts.
const DLIB_FIXED_CANDIDATES = [
  // New SDK layout (Azure.CodeSigning.Sdk, 2024+).
  path.join(os.homedir(), '.nuget', 'packages', 'azure.codesigning.sdk',
            'lib', 'netstandard2.0', 'Azure.CodeSigning.dll'),
  // Old dlib layout (Azure.CodeSigning.Dlib, pre-rename).
  path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'MicrosoftCodeSigning',
            'Azure.CodeSigning.Dlib', 'bin', 'x64', 'Azure.CodeSigning.Dlib.dll'),
  path.join(os.homedir(), '.nuget', 'packages', 'azure.codesigning.dlib',
            'bin', 'x64', 'Azure.CodeSigning.Dlib.dll'),
  'C:\\Program Files\\Microsoft\\Azure.CodeSigning.Dlib\\bin\\x64\\Azure.CodeSigning.Dlib.dll',
];

function whichOnPath(name) {
  const exts = (process.env.PATHEXT || '.EXE').split(';');
  const dirs = (process.env.PATH || '').split(path.delimiter);
  for (const d of dirs) {
    for (const ext of exts) {
      const p = path.join(d, name + ext);
      if (fs.existsSync(p)) return p;
    }
    const bare = path.join(d, name);
    if (fs.existsSync(bare)) return bare;
  }
  return null;
}

function findSigntool() {
  const override = envFor('SIGNTOOL');
  if (override && fs.existsSync(override)) return override;
  // Enumerate Windows SDK installs and pick newest 10.0.* version.
  for (const root of SIGNTOOL_SDK_ROOTS) {
    if (!fs.existsSync(root)) continue;
    try {
      const versions = fs.readdirSync(root)
        .filter(d => /^10\.0\./.test(d))
        .sort()
        .reverse();
      for (const v of versions) {
        const cand = path.join(root, v, 'x64', 'signtool.exe');
        if (fs.existsSync(cand)) return cand;
      }
    } catch { /* keep looking */ }
    // Older SDKs put it directly under bin\x64.
    const flat = path.join(root, 'x64', 'signtool.exe');
    if (fs.existsSync(flat)) return flat;
  }
  return whichOnPath('signtool');
}

function findDlib() {
  const override = envFor('AZTS_DLIB');
  if (override && fs.existsSync(override)) return override;
  for (const c of DLIB_FIXED_CANDIDATES) {
    if (fs.existsSync(c)) return c;
  }
  // NuGet versioned-subdir glob fallback. We try both package names — new
  // Azure.CodeSigning.Sdk and old Azure.CodeSigning.Dlib — and within each
  // we sort versions desc so the newest wins.
  const nugetRoot = path.join(os.homedir(), '.nuget', 'packages');
  const pkgs = [
    { dir: 'azure.codesigning.sdk',  dll: path.join('lib', 'netstandard2.0', 'Azure.CodeSigning.dll') },
    { dir: 'azure.codesigning.dlib', dll: path.join('bin', 'x64', 'Azure.CodeSigning.Dlib.dll') },
  ];
  for (const { dir, dll } of pkgs) {
    const pkgRoot = path.join(nugetRoot, dir);
    if (!fs.existsSync(pkgRoot)) continue;
    try {
      const versions = fs.readdirSync(pkgRoot).sort().reverse();
      for (const v of versions) {
        const p = path.join(pkgRoot, v, dll);
        if (fs.existsSync(p)) return p;
      }
    } catch { /* keep looking */ }
  }
  return null;
}

// Read a "logical" var that may be defined under either the CLAUDAGOTCHI_
// or VITRIOL_ namespace. Claudagotchi-prefixed names win so each app can
// point at its own AzTS account if it wants to.
function envFor(suffix) {
  return process.env[`CLAUDAGOTCHI_${suffix}`]
      || process.env[`VITRIOL_${suffix}`]
      || '';
}

function isConfigured() {
  return Boolean(envFor('AZTS_ENDPOINT') && envFor('AZTS_ACCOUNT') && envFor('AZTS_PROFILE'));
}

module.exports = async function sign(config) {
  const filePath = config.path;
  console.log(`[sign] requested for ${filePath}`);

  if (!isConfigured()) loadSignEnvFile();

  if (!isConfigured()) {
    console.warn('[sign] SKIPPING — AzTS not configured.');
    console.warn('[sign] Set CLAUDAGOTCHI_AZTS_ENDPOINT / _ACCOUNT / _PROFILE');
    console.warn('[sign] (or VITRIOL_AZTS_* for shared setup) and run `az login`');
    console.warn('[sign] OR set AZURE_CLIENT_ID/TENANT_ID/CLIENT_SECRET. Build continues unsigned.');
    return;
  }

  const signtool = findSigntool();
  if (!signtool) {
    console.warn('[sign] SKIPPING — signtool.exe not found.');
    console.warn('[sign] Install the Windows SDK (Signing Tools) from');
    console.warn('[sign]   https://developer.microsoft.com/windows/downloads/windows-sdk/');
    console.warn('[sign] or set $VITRIOL_SIGNTOOL to a full path. Build continues unsigned.');
    return;
  }

  const dlib = findDlib();
  if (!dlib) {
    console.warn('[sign] SKIPPING — Azure.CodeSigning.Dlib.dll not found.');
    console.warn('[sign] Install via NuGet:');
    console.warn('[sign]   nuget install Azure.CodeSigning.Dlib -x \\');
    console.warn('[sign]     -OutputDirectory %USERPROFILE%\\.nuget\\packages');
    console.warn('[sign] or set $VITRIOL_AZTS_DLIB to the full path. Build continues unsigned.');
    return;
  }

  const endpoint    = envFor('AZTS_ENDPOINT');
  const account     = envFor('AZTS_ACCOUNT');
  const profile     = envFor('AZTS_PROFILE');
  const tsUrl       = envFor('AZTS_TS_URL')        || DEFAULT_TIMESTAMP_URL;
  const description = process.env.SIGN_DESCRIPTION || DEFAULT_DESCRIPTION;
  const infoUrl     = process.env.SIGN_URL         || DEFAULT_INFO_URL;

  // The dlib expects its config in a JSON file referenced by /dmdf. Build it
  // on the fly in tmpdir so the env vars stay the single source of truth —
  // no metadata.json on disk that could drift out of sync.
  const metaPath = path.join(os.tmpdir(), `cg-azts-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(metaPath, JSON.stringify({
    Endpoint:               endpoint,
    CodeSigningAccountName: account,
    CertificateProfileName: profile,
  }, null, 2));

  try {
    console.log(`[sign] signing ${path.basename(filePath)} via AzTS`);
    console.log(`[sign]   endpoint: ${endpoint}`);
    console.log(`[sign]   account:  ${account}`);
    console.log(`[sign]   profile:  ${profile}`);

    execFileSync(signtool, [
      'sign',
      '/v',
      '/fd', 'SHA256',
      '/tr', tsUrl,
      '/td', 'SHA256',
      '/dlib', dlib,
      '/dmdf', metaPath,
      '/d', description,
      '/du', infoUrl,
      filePath,
    ], { stdio: 'inherit' });

    // Defensive verify — catches the "signtool returned 0 but the signature
    // won't validate on a clean Windows install" case. Vitriol's sign.py
    // does the same. /pa = default authentication policy (any trusted root).
    console.log(`[sign] verifying ${path.basename(filePath)}`);
    execFileSync(signtool, ['verify', '/pa', '/v', filePath], { stdio: 'inherit' });

    console.log(`[sign] OK — ${path.basename(filePath)}`);
  } catch (e) {
    console.error(`[sign] FAILED on ${filePath}: ${e.message}`);
    throw e;
  } finally {
    try { fs.unlinkSync(metaPath); } catch { /* best effort */ }
  }
};
