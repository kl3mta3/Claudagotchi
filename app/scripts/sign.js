/**
 * Azure Trusted Signing hook for electron-builder.
 *
 * electron-builder calls this once per file it produces (the unpacked
 * Claudagotchi.exe inside the build, the NSIS installer, the portable .exe,
 * etc.). We delegate to `signtool.exe` using Microsoft's Trusted Signing
 * dispatcher DLL — a Microsoft-managed certificate, so no local keys.
 *
 * Required environment variables (set these in your shell or a .env loaded
 * before `npm run build`):
 *
 *   AZURE_TENANT_ID           — your Entra tenant
 *   AZURE_CLIENT_ID           — service principal app id
 *   AZURE_CLIENT_SECRET       — service principal secret
 *   AZURE_TRUSTED_SIGNING_ENDPOINT     — e.g. https://eus.codesigning.azure.net
 *   AZURE_TRUSTED_SIGNING_ACCOUNT      — your Trusted Signing account name
 *   AZURE_TRUSTED_SIGNING_PROFILE      — your certificate profile name
 *
 * Optional:
 *   SIGNTOOL_PATH             — override signtool.exe location (default:
 *                               searches the standard Windows SDK install)
 *   TRUSTED_SIGNING_DISPATCHER — override path to Azure.CodeSigning.Dispatcher.dll
 *
 * If any required env var is missing we LOG and skip signing (rather than
 * fail the build) so unauthenticated dev builds still produce artifacts.
 */
const { execFileSync } = require('node:child_process');
const fs   = require('node:fs');
const os   = require('node:os');
const path = require('node:path');

function findSigntool() {
  if (process.env.SIGNTOOL_PATH && fs.existsSync(process.env.SIGNTOOL_PATH)) {
    return process.env.SIGNTOOL_PATH;
  }
  // Standard Windows SDK install root. We pick the newest 10.0.xxxxx version.
  const sdkRoot = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  if (!fs.existsSync(sdkRoot)) return null;
  const versions = fs.readdirSync(sdkRoot)
    .filter(d => /^10\./.test(d))
    .sort()
    .reverse();
  for (const v of versions) {
    const candidate = path.join(sdkRoot, v, 'x64', 'signtool.exe');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function findDispatcher() {
  if (process.env.TRUSTED_SIGNING_DISPATCHER && fs.existsSync(process.env.TRUSTED_SIGNING_DISPATCHER)) {
    return process.env.TRUSTED_SIGNING_DISPATCHER;
  }
  // Default install path of the Microsoft.Trusted.Signing.Client NuGet package.
  // Adjust if you installed it elsewhere.
  const candidates = [
    'C:\\Program Files\\Microsoft\\Trusted Signing\\Azure.CodeSigning.Dispatcher.dll',
    path.join(os.homedir(), '.nuget', 'packages', 'microsoft.trusted.signing.client'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && c.endsWith('.dll')) return c;
  }
  return null;
}

module.exports = async function sign(config) {
  const filePath = config.path;
  console.log(`[sign] requested for ${filePath}`);

  const required = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET',
                    'AZURE_TRUSTED_SIGNING_ENDPOINT', 'AZURE_TRUSTED_SIGNING_ACCOUNT',
                    'AZURE_TRUSTED_SIGNING_PROFILE'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.warn(`[sign] SKIPPING — missing env vars: ${missing.join(', ')}`);
    console.warn('[sign] Unsigned dev build. See scripts/sign.js header for setup.');
    return;
  }

  const signtool = findSigntool();
  if (!signtool) {
    console.warn('[sign] SKIPPING — signtool.exe not found. Install the Windows 10/11 SDK.');
    return;
  }
  const dispatcher = findDispatcher();
  if (!dispatcher) {
    console.warn('[sign] SKIPPING — TrustedSigning dispatcher DLL not found.');
    console.warn('[sign] Install via: dotnet tool install --global Microsoft.Trusted.Signing.Client');
    return;
  }

  // Write the metadata file signtool needs each invocation.
  const metaPath = path.join(os.tmpdir(), `cg-signing-${process.pid}.json`);
  fs.writeFileSync(metaPath, JSON.stringify({
    Endpoint:           process.env.AZURE_TRUSTED_SIGNING_ENDPOINT,
    CodeSigningAccountName: process.env.AZURE_TRUSTED_SIGNING_ACCOUNT,
    CertificateProfileName: process.env.AZURE_TRUSTED_SIGNING_PROFILE,
  }, null, 2));

  try {
    execFileSync(signtool, [
      'sign',
      '/v',
      '/fd', 'sha256',
      '/td', 'sha256',
      '/tr', 'http://timestamp.acs.microsoft.com',
      '/dlib', dispatcher,
      '/dmdf', metaPath,
      filePath,
    ], {
      stdio: 'inherit',
      env: {
        ...process.env,
        // Azure.Identity reads these for service principal auth
        AZURE_TENANT_ID:     process.env.AZURE_TENANT_ID,
        AZURE_CLIENT_ID:     process.env.AZURE_CLIENT_ID,
        AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
      },
    });
    console.log(`[sign] OK — ${path.basename(filePath)}`);
  } catch (e) {
    console.error(`[sign] FAILED on ${filePath}:`, e.message);
    throw e;
  } finally {
    try { fs.unlinkSync(metaPath); } catch {}
  }
};
