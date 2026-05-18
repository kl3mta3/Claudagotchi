# Build & Release

## Targets

`npm run build` produces both Windows artifacts in `../dist-electron/`:

- **`Claudagotchi Setup <version>.exe`** — NSIS installer. User picks install dir, gets Start Menu + Desktop shortcuts. Installs to `%LocalAppData%\Claudagotchi` (no UAC).
- **`Claudagotchi-<version>-portable.exe`** — single-file portable. No install; runs from anywhere. Self-extracts to a temp dir per launch.

Both contain the same bundled `node_modules/` (Claude CLI, Agent SDK, codemirror, react, …) — no end-user Node.js install needed.

Git is not bundled. The splash detects it and offers to download MinGit on first run if missing.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server + Electron, hot reload |
| `npm run build:dir` | Unpacked dir only (fast iteration; skips installer + signing) |
| `npm run build` | NSIS + portable, signed if Azure env vars are set |
| `npm run release` | Same as build, plus uploads to a GitHub Release draft via `electron-builder --publish always` |

## Code Signing (Azure Trusted Signing)

1. Copy `.env.example` → `.env` and fill in:
   - `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` — service principal you created in Entra
   - `AZURE_TRUSTED_SIGNING_ENDPOINT` / `_ACCOUNT` / `_PROFILE` — from your Trusted Signing resource

2. Install prerequisites:
   - **Windows 10/11 SDK** (provides `signtool.exe`) — `winget install Microsoft.WindowsSDK`
   - **Trusted Signing dispatcher** — `dotnet tool install --global Microsoft.Trusted.Signing.Client`
     - Or download the NuGet package and point `TRUSTED_SIGNING_DISPATCHER` env var at the DLL

3. Run `npm run build`. `scripts/sign.js` is invoked by electron-builder once per produced binary (unpacked Claudagotchi.exe + installer + portable). Without the env vars it logs `[sign] SKIPPING` and produces unsigned binaries.

## One-time Windows setting (winCodeSign extract)

electron-builder downloads a `winCodeSign` cache that contains macOS-cross-sign tools. Extraction fails on Windows without admin or Developer Mode because of symlinks.

**Fix once**: Settings → Privacy & Security → For Developers → toggle **Developer Mode** on.

After that all builds run unattended.

## Releases (auto-update)

1. Bump `version` in `package.json` (e.g. `0.1.0` → `0.2.0`).
2. Set `GH_TOKEN` in your shell to a PAT with `repo` scope.
3. `npm run release` — uploads both artifacts + a `latest.yml` to a draft GitHub Release.
4. Edit the draft release on GitHub, add notes, **publish**.

Running Claudagotchi instances will then poll the release, prompt the user, download, and `quitAndInstall` themselves.

`electron-updater` reads the `publish.owner` / `repo` config in `package.json`'s `build` block — change those to your own GitHub repo if you fork.

## Distribution options summary

| Distribution | User needs |
|---|---|
| **NSIS installer** | Nothing — installer is self-contained |
| **Portable .exe** | Nothing — single-file self-extracting |
| **Git clone + `npm run dev`** | Node.js + npm |
