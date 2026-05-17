const { app, BrowserWindow, ipcMain, dialog, screen, Tray, Menu, nativeImage, shell } = require('electron');
const Worktree = require('./cli-bridge/WorktreeManager.js');
const { exec, spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SAVE_DIR  = path.join(os.homedir(), '.claudigotchi');
const SAVE_FILE = path.join(SAVE_DIR, 'save.json');
const CHATS_DIR = path.join(SAVE_DIR, 'chats');           // chat-mode "project root"
const IS_DEV    = process.env.NODE_ENV === 'development' || !app.isPackaged;

function ensureChatsDir() {
  if (!fs.existsSync(CHATS_DIR)) fs.mkdirSync(CHATS_DIR, { recursive: true });
}

let mainWindow   = null;
let petWindow    = null; // floating pet window when popped out
let splashWindow = null; // first-run launcher / dependency check splash
let tray         = null; // system tray icon (lifetime = app)
let artifactWindow = null; // floating ALL-files artifact panel
// Per-file pop-out windows keyed by absolute file path. A single path can only
// be popped out once; calling pop-out again on the same path focuses the
// existing window instead of opening a duplicate.
const fileWindows = new Map();   // path → BrowserWindow
let isQuitting   = false; // distinguishes "close button" (hide) vs "really quit"

// ─── Window ──────────────────────────────────────────────────────────────────

function createMainWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1400, width - 40),
    height: Math.min(900, height - 40),
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    title: 'Claudagotchi',
    icon: path.join(__dirname, 'public', 'icon.ico'),
    show: false,                  // wait until content's painted, then reveal
    backgroundColor: '#0d0d12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (IS_DEV) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  });

  // Hijack window-close: hide to tray instead of quitting. Pet keeps living
  // in the background; user must use tray → Quit or call window-quit IPC to exit.
  mainWindow.on('close', (e) => {
    if (!isQuitting && tray) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    petWindow?.close();
  });
}

function ensureTray() {
  if (tray) return;
  try {
    // Try a logo file; fall back to an empty image if none exists.
    const candidates = [
      path.join(__dirname, 'public', 'icon.png'),
      path.join(__dirname, 'public', 'logo.png'),
      path.join(__dirname, 'public', 'logo.svg'),
    ];
    let img = null;
    for (const p of candidates) {
      if (fs.existsSync(p)) { img = nativeImage.createFromPath(p); break; }
    }
    if (!img || img.isEmpty()) img = nativeImage.createEmpty();
    tray = new Tray(img);
    tray.setToolTip('Claudagotchi');
    const rebuild = () => {
      const menu = Menu.buildFromTemplate([
        { label: 'Show Claudagotchi', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
        { label: 'Hide',              click: () => { mainWindow?.hide(); } },
        { type: 'separator' },
        { label: 'Quit Claudagotchi', click: () => { isQuitting = true; app.quit(); } },
      ]);
      tray.setContextMenu(menu);
    };
    rebuild();
    tray.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible() && mainWindow.isFocused()) mainWindow.hide();
      else { mainWindow.show(); mainWindow.focus(); }
    });
  } catch (e) {
    logBridge(`tray init failed: ${e?.message || e}`);
  }
}

// ─── Splash / launcher ───────────────────────────────────────────────────────

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 360, height: 440,
    frame: false, transparent: true, resizable: false, alwaysOnTop: true,
    center: true, skipTaskbar: false, show: false,
    title: 'Claudagotchi',
    webPreferences: {
      preload: path.join(__dirname, 'preload-splash.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.once('ready-to-show', () => splashWindow?.show());
  splashWindow.on('closed', () => { splashWindow = null; });
}

function splashStatus(payload) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash-status', payload);
  }
}

/** Locate an npm executable on this machine. Returns the absolute path or null.
 *  Checks PATH, then the standard nvm-windows symlink, then Program Files. We
 *  use this so git-clone users who never ran `npm install` don't get bare
 *  module-not-found errors — we install for them.
 */
function findNpm() {
  const candidates = [
    process.env.npm_execpath,                                                // launched via npm already
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'npm.cmd'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs', 'npm.cmd'),
    path.join(process.env.APPDATA || '', 'npm', 'npm.cmd'),
    'C:\\nodejs\\npm.cmd',
    '/usr/local/bin/npm',
    '/usr/bin/npm',
  ].filter(Boolean);
  for (const c of candidates) { try { if (fs.existsSync(c)) return c; } catch {} }
  // Last resort: rely on PATH and let spawn try to resolve it.
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

/** Run `npm install` in the app dir, streaming progress to the splash. */
function runNpmInstall() {
  return new Promise((resolve, reject) => {
    const npm = findNpm();
    const proc = spawn(npm, ['install', '--no-audit', '--no-fund', '--loglevel=error'], {
      cwd: __dirname,
      shell: process.platform === 'win32', // .cmd needs shell on win32
      windowsHide: true,
    });
    let lastLine = '';
    const onData = (chunk) => {
      const s = chunk.toString();
      const line = s.trim().split('\n').pop()?.slice(0, 120);
      if (line) { lastLine = line; splashStatus({ text: `Installing dependencies…\n${line}`, busy: true }); }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', reject);
    proc.on('exit', (code) => code === 0
      ? resolve()
      : reject(new Error(`npm install exited ${code}. ${lastLine}`)));
  });
}

/** Check that every runtime dependency listed in package.json is actually
 *  installed. Skipped in packaged builds (no npm available, and devDeps were
 *  pruned at packaging time). Returns the list of missing module ids. */
function missingDeps() {
  if (app.isPackaged) return [];
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')); }
  catch { return []; }
  // Only runtime deps. devDeps (vite, electron-builder, sharp, …) intentionally
  // not checked — they're build-time only, missing them is fine at runtime.
  const all = pkg.dependencies || {};
  const missing = [];
  for (const id of Object.keys(all)) {
    try { require.resolve(id, { paths: [__dirname] }); }
    catch { missing.push(id); }
  }
  return missing;
}

/** Run pre-launch checks. Returns true if it's safe to open main window. */
async function runStartupChecks() {
  // 0) If any declared deps are missing (git-clone user, partial install,
  //    new dep added in a fresh pull), run `npm install` once before anything
  //    else tries to require them.
  const missing = missingDeps();
  if (missing.length > 0) {
    splashStatus({
      text: `Installing ${missing.length} missing package${missing.length === 1 ? '' : 's'}…\n(first run only, may take a minute)`,
      busy: true,
    });
    try { await runNpmInstall(); }
    catch (e) {
      splashStatus({
        text: 'Could not install dependencies automatically.\nRun `npm install` in the app folder.',
        error: (e?.message || String(e)) + '\nMissing: ' + missing.slice(0, 5).join(', '),
      });
      return false;
    }
  }

  // 1) Ensure save dir exists (cheap)
  splashStatus({ text: 'Preparing local data…', busy: true });
  try { if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true }); } catch {}

  // 2) Check for the claude CLI (only needed for the OAuth login flow)
  splashStatus({ text: 'Looking for Claude CLI…', busy: true });
  if (!checkClaudeCLI()) {
    splashStatus({ text: 'Installing Claude CLI…\n(first run only, may take a minute)', busy: true });
    try {
      await installClaudeCLI();
    } catch (e) {
      splashStatus({
        text: 'Could not install Claude CLI automatically.',
        error: e.message || String(e),
      });
      return false;
    }
  }

  // 3) Verify the Agent SDK is loadable (caught here = clearer error than mid-chat)
  splashStatus({ text: 'Loading Claude Agent SDK…', busy: true });
  try { await loadSdk(); }
  catch (e) {
    splashStatus({
      text: 'Claude Agent SDK is missing.\nRun `npm install` in the app folder.',
      error: e.message || String(e),
    });
    return false;
  }

  splashStatus({ text: 'Ready. Opening Claudagotchi…', busy: true });
  return true;
}

// Splash button handlers
let splashRetryResolver = null;
ipcMain.handle('splash-retry', () => { splashRetryResolver?.(); });
ipcMain.handle('splash-skip',  () => { splashRetryResolver?.('skip'); });
ipcMain.handle('splash-quit',  () => { app.quit(); });

function createPetWindow(bounds) {
  // Floating pet window — snaps to right edge of main window
  const mainBounds = mainWindow?.getBounds() ?? { x: 0, y: 0, width: 800, height: 600 };
  petWindow = new BrowserWindow({
    width: 380,
    height: mainBounds.height,
    x: mainBounds.x + mainBounds.width + 8,
    y: mainBounds.y,
    minWidth: 300,
    minHeight: 400,
    frame: false,
    alwaysOnTop: false,
    title: 'Claudagotchi Pet',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const url = IS_DEV
    ? 'http://localhost:5173?petWindow=true'
    : `file://${path.join(__dirname, 'dist', 'index.html')}?petWindow=true`;

  petWindow.loadURL(url);
  petWindow.on('closed', () => {
    petWindow = null;
    mainWindow?.webContents.send('pet-window-closed');
  });
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

function checkClaudeCLI() {
  try {
    execSync('claude --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function installClaudeCLI() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['install', '-g', '@anthropic-ai/claude-code'], {
      shell: true, stdio: 'pipe',
    });
    proc.on('close', code => code === 0 ? resolve() : reject(new Error('Install failed')));
  });
}

function checkClaudeAuth() {
  return new Promise(resolve => {
    exec('claude auth status', { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve(false);
      try {
        const data = JSON.parse(stdout);
        resolve(!!data.loggedIn);
      } catch {
        // Older versions printed text — fall back
        resolve(/logged\s*in/i.test(stdout));
      }
    });
  });
}

function runClaudeLogin() {
  return new Promise((resolve) => {
    // `claude auth login` opens a browser flow. Inherit stdio so any prompts surface.
    const proc = spawn('claude', ['auth', 'login'], { shell: true, stdio: 'inherit' });
    proc.on('close', () => resolve());
  });
}

// ─── IPC: Auth ────────────────────────────────────────────────────────────────

ipcMain.handle('check-cli', async () => {
  return checkClaudeCLI();
});

ipcMain.handle('install-cli', async () => {
  try {
    await installClaudeCLI();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('check-auth', async () => {
  return checkClaudeAuth();
});

ipcMain.handle('claude-login', async () => {
  await runClaudeLogin();
  return checkClaudeAuth();
});

// ─── IPC: Claude Agent SDK (in-process) ──────────────────────────────────────
// We use @anthropic-ai/claude-code's `query()` instead of spawning the CLI.
// The SDK reads the same ~/.claude/.credentials.json that `claude auth login`
// writes, so we keep the CLI only for the one-time browser OAuth flow.

const activeSessions = new Map(); // sessionId → AbortController

// ── canUseTool permission plumbing ───────────────────────────────────────────
// Tools that are read-only and always safe to allow without prompting.
const READONLY_TOOLS = new Set(['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'ToolSearch']);
// Per-cwd "always allow" cache, persisted to disk so decisions survive restart.
const ALLOW_ALLOW_FILE = path.join(os.homedir(), '.claudigotchi', 'always-allow.json');
const allowAlwaysCache = new Set();
try {
  if (fs.existsSync(ALLOW_ALLOW_FILE)) {
    const arr = JSON.parse(fs.readFileSync(ALLOW_ALLOW_FILE, 'utf8'));
    if (Array.isArray(arr)) for (const k of arr) allowAlwaysCache.add(k);
  }
} catch {}
function saveAlwaysAllow() {
  try {
    if (!fs.existsSync(path.dirname(ALLOW_ALLOW_FILE))) fs.mkdirSync(path.dirname(ALLOW_ALLOW_FILE), { recursive: true });
    fs.writeFileSync(ALLOW_ALLOW_FILE, JSON.stringify([...allowAlwaysCache], null, 2));
  } catch {}
}
ipcMain.handle('clear-always-allow', () => { allowAlwaysCache.clear(); saveAlwaysAllow(); return { ok: true }; });
// Pending permission prompts awaiting renderer reply: requestId → {resolve, timeout}
const pendingPermissions = new Map();
let permissionReqSeq = 0;

function askRendererForPermission(payload) {
  return new Promise((resolve) => {
    const reqId = `perm-${++permissionReqSeq}-${Date.now()}`;
    const timeout = setTimeout(() => {
      pendingPermissions.delete(reqId);
      resolve({ behavior: 'deny', message: 'Permission prompt timed out.' });
    }, 90_000);
    pendingPermissions.set(reqId, { resolve, timeout });
    // Broadcast to BOTH main and pet windows — whichever is in focus the
    // user picks from. First decision wins (renderer's responsibility).
    try {
      mainWindow?.webContents.send('tool-permission-request', { reqId, ...payload });
      petWindow?.webContents.send('tool-permission-request', { reqId, ...payload });
    } catch {
      clearTimeout(timeout);
      pendingPermissions.delete(reqId);
      resolve({ behavior: 'deny', message: 'No window available to ask permission.' });
    }
  });
}

/** ExitPlanMode plan-approval prompt. Routed to the main window only (plan
 *  UI lives in the artifact panel which is main-window-bound). */
function askRendererForPlan(payload) {
  return new Promise((resolve) => {
    const reqId = `plan-${++permissionReqSeq}-${Date.now()}`;
    const timeout = setTimeout(() => {
      pendingPermissions.delete(reqId);
      resolve({ behavior: 'deny', message: 'Plan approval timed out.' });
    }, 600_000); // 10 minutes — plans are long; users may need to read carefully
    pendingPermissions.set(reqId, { resolve, timeout });
    try {
      mainWindow?.webContents.send('plan-approval-request', { reqId, ...payload });
    } catch {
      clearTimeout(timeout);
      pendingPermissions.delete(reqId);
      resolve({ behavior: 'deny', message: 'No window available for plan approval.' });
    }
  });
}

// ── Explorer / file-tree IPCs ────────────────────────────────────────────────
const BINARY_EXTS = new Set(['exe','dll','so','dylib','bin','png','jpg','jpeg','gif','webp','ico','pdf','zip','tar','gz','7z','mp3','mp4','mov','avi','wav','ogg','class','jar','psd','ttf','otf','woff','woff2']);
ipcMain.handle('list-dir', async (_, p) => {
  try {
    if (!p) return { ok: false, error: 'no path' };
    const real = path.resolve(p);
    const entries = fs.readdirSync(real, { withFileTypes: true })
      // Hide noisy dot-dirs that aren't useful in a code explorer.
      .filter(e => !['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build', '.next'].includes(e.name))
      .map(e => ({
        name: e.name,
        path: path.join(real, e.name),
        isDir: e.isDirectory(),
      }))
      .sort((a, b) => (a.isDir === b.isDir) ? a.name.localeCompare(b.name) : (a.isDir ? -1 : 1));
    return { ok: true, entries };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('read-file-text', async (_, p) => {
  try {
    if (!p) return { ok: false, error: 'no path' };
    const real = path.resolve(p);
    const ext  = (real.match(/\.([^.]+)$/) || [])[1]?.toLowerCase();
    const stat = fs.statSync(real);
    if (stat.size > 4 * 1024 * 1024) return { ok: false, error: 'File too large (>4MB)', binary: true };
    if (BINARY_EXTS.has(ext))         return { ok: false, error: 'Binary file', binary: true, ext };
    const buf = fs.readFileSync(real);
    // Heuristic: if there's a null byte in the first 8KB, treat as binary.
    const slice = buf.slice(0, Math.min(buf.length, 8192));
    if (slice.includes(0)) return { ok: false, error: 'Binary content detected', binary: true, ext };
    return { ok: true, content: buf.toString('utf8'), ext };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('write-file-text', async (_, { path: p, content } = {}) => {
  try {
    if (!p) return { ok: false, error: 'no path' };
    fs.writeFileSync(path.resolve(p), content || '', 'utf8');
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ── Worktree IPCs ────────────────────────────────────────────────────────────
ipcMain.handle('git-check-repo', (_, { cwd } = {}) => {
  return { isRepo: Worktree.isGitRepo(cwd), root: Worktree.isGitRepo(cwd) ? Worktree.repoRoot(cwd) : null };
});
ipcMain.handle('worktree-create', (_, { cwd, sessionId } = {}) => {
  try {
    const wt = Worktree.create(cwd, sessionId);
    logBridge(`worktree create cwd=${cwd} sessionId=${sessionId} → ${wt.path}`);
    return { ok: true, ...wt };
  } catch (e) {
    logBridge(`worktree create FAILED cwd=${cwd}: ${e.message}`);
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('worktree-remove', (_, payload = {}) => {
  try {
    Worktree.remove(payload);
    logBridge(`worktree remove ${payload.path}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('worktree-list', (_, { repoRoot } = {}) => {
  return { worktrees: Worktree.list(repoRoot) };
});
ipcMain.handle('git-status',    (_, { cwd } = {}) => ({ status: Worktree.status(cwd) }));
ipcMain.handle('git-commit-all',(_, { cwd, message } = {}) => Worktree.commitAll(cwd, message));
ipcMain.handle('git-discard-all',(_, { cwd } = {}) => Worktree.discardAll(cwd));
ipcMain.handle('git-init',      (_, { cwd } = {}) => Worktree.init(cwd));

ipcMain.handle('tool-permission-decision', (_, { reqId, decision }) => {
  const entry = pendingPermissions.get(reqId);
  if (!entry) return { ok: false, reason: 'unknown reqId (already resolved/timed out)' };
  clearTimeout(entry.timeout);
  pendingPermissions.delete(reqId);
  entry.resolve(decision || { behavior: 'deny' });
  return { ok: true };
});

let lastSendDiagnostics = null;
ipcMain.handle('get-last-send-diagnostics', () => lastSendDiagnostics);

let _sdkPromise = null;
function loadSdk() {
  // Dynamic import so this CJS file can pull in the ESM-only package.
  // NOTE: `@anthropic-ai/claude-code` is a CLI wrapper only; the programmatic
  // SDK lives in `@anthropic-ai/claude-agent-sdk` (exposes query(), tool(), etc).
  if (!_sdkPromise) _sdkPromise = import('@anthropic-ai/claude-agent-sdk');
  return _sdkPromise;
}

/**
 * Locate the bundled claude.exe binary, rewriting any asar path → asar.unpacked
 * so spawn() can actually execute it. Falls back to system `claude` on PATH.
 */
function resolveClaudeBinary() {
  // 1) Look in the unpacked SDK location first (works in packaged builds).
  const candidates = [
    path.join(__dirname, '..', 'app.asar.unpacked', 'node_modules', '@anthropic-ai', 'claude-agent-sdk-win32-x64', 'claude.exe'),
    path.join(__dirname, 'node_modules', '@anthropic-ai', 'claude-agent-sdk-win32-x64', 'claude.exe'),
    path.join(__dirname, '..', 'app.asar.unpacked', 'node_modules', '@anthropic-ai', 'claude-code-win32-x64', 'claude.exe'),
    path.join(__dirname, 'node_modules', '@anthropic-ai', 'claude-code-win32-x64', 'claude.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // 2) Try require.resolve — only works if the package is unpacked. Rewrite if asar.
  try {
    const pkgPath = require.resolve('@anthropic-ai/claude-agent-sdk-win32-x64/package.json');
    const dir = path.dirname(pkgPath).replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
    const bin = path.join(dir, 'claude.exe');
    if (fs.existsSync(bin)) return bin;
  } catch {}
  // 3) Last resort — let the SDK fall back to looking up `claude` on PATH.
  return null;
}

let _claudeBin = null;
function claudeBinaryPath() {
  if (_claudeBin === null) {
    _claudeBin = resolveClaudeBinary() || undefined;
    logBridge(`Resolved claude binary: ${_claudeBin || '(none — will use PATH)'}`);
  }
  return _claudeBin;
}

// Cached usage stats — broadcast to renderer whenever they change.
// Per-limit-type state (five_hour, weekly, …). We see one event per type
// from the SDK; we keep them merged so the UI can show both cards.
let rateLimits  = {};   // { five_hour: {...info}, weekly: {...info} }
let windowUsage = {};   // { five_hour: {messages, tokensIn, tokensOut, windowStart, resetsAt}, weekly: {...} }

let sessionUsage = {
  tokensIn: 0, tokensOut: 0, cacheCreation: 0, cacheRead: 0,
  costUsd: 0, turns: 0, startedAt: Date.now(),
};

// Renderer-controlled setting: if true, abort the current query the moment
// the SDK reports we'd be using overage credit.
let blockOverage = false;
// User-editable message caps per window (rough estimates per plan tier).
let limitCaps = { five_hour: 45, weekly: 480 };

ipcMain.handle('set-block-overage', (_, v) => { blockOverage = !!v; });
ipcMain.handle('set-limit-caps',    (_, caps) => {
  if (caps && typeof caps === 'object') {
    limitCaps = { ...limitCaps, ...caps };
    broadcastUsage();
  }
});

function persistedUsagePath() { return path.join(SAVE_DIR, 'usage.json'); }
function loadWindowUsage() {
  try {
    const p = persistedUsagePath();
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (data && typeof data === 'object') windowUsage = data;
    }
  } catch {}
}
function saveWindowUsage() {
  try {
    if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });
    fs.writeFileSync(persistedUsagePath(), JSON.stringify(windowUsage));
  } catch {}
}
loadWindowUsage();

function recordRateLimit(info) {
  if (!info?.rateLimitType) return;
  const t = info.rateLimitType;
  rateLimits[t] = { ...info, type: t };

  // If our stored resetsAt is older than the new one, the previous window
  // closed — start fresh. (Also handles cold-start with no prior data.)
  const existing = windowUsage[t];
  if (!existing || (info.resetsAt && existing.resetsAt && info.resetsAt > existing.resetsAt + 5)) {
    windowUsage[t] = {
      messages: 0, tokensIn: 0, tokensOut: 0,
      windowStart: Math.floor(Date.now() / 1000),
      resetsAt: info.resetsAt,
    };
    saveWindowUsage();
  } else if (existing && !existing.resetsAt && info.resetsAt) {
    existing.resetsAt = info.resetsAt;
    saveWindowUsage();
  }
}

function accumulateUsage(usage) {
  const inT  = usage.input_tokens  || 0;
  const outT = usage.output_tokens || 0;
  for (const t of Object.keys(windowUsage)) {
    const w = windowUsage[t];
    w.messages  = (w.messages  || 0) + 1;
    w.tokensIn  = (w.tokensIn  || 0) + inT;
    w.tokensOut = (w.tokensOut || 0) + outT;
  }
  saveWindowUsage();
}

function broadcastUsage() {
  const payload = {
    rateLimits, rateLimit: rateLimits.five_hour || rateLimits.weekly || null,
    windowUsage, limitCaps,
    session: sessionUsage,
    blockOverage,
  };
  mainWindow?.webContents.send('usage-update', payload);
  petWindow?.webContents.send('usage-update', payload);
}

ipcMain.handle('get-usage', () => ({
  rateLimits, rateLimit: rateLimits.five_hour || rateLimits.weekly || null,
  windowUsage, limitCaps,
  session: sessionUsage,
  blockOverage,
}));

ipcMain.handle('reset-session-usage', () => {
  sessionUsage = { tokensIn: 0, tokensOut: 0, cacheCreation: 0, cacheRead: 0, costUsd: 0, turns: 0, startedAt: Date.now() };
  broadcastUsage();
});

ipcMain.handle('reset-window-usage', (_, type) => {
  if (type && windowUsage[type]) {
    windowUsage[type] = { messages: 0, tokensIn: 0, tokensOut: 0, windowStart: Math.floor(Date.now() / 1000), resetsAt: windowUsage[type].resetsAt };
    saveWindowUsage();
    broadcastUsage();
  }
});

// Persistent bridge log so failures are diagnosable from the user's side.
function logBridge(line) {
  try {
    if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });
    fs.appendFileSync(path.join(SAVE_DIR, 'bridge.log'),
      `[${new Date().toISOString()}] ${line}\n`);
  } catch {}
}

ipcMain.handle('claude-send', async (event, { message, sessionId, cwd, model, permissionMode, mode, effort, fastMode, requestId, appendSystemPrompt, systemPrompt, disallowedTools, enableThinking } = {}) => {
  // Chat mode: ignore the user's cwd; use a dedicated empty project dir so the
  // SDK doesn't autoload CLAUDE.md / hooks / project memory. Code mode: unchanged.
  if (mode === 'chat') { ensureChatsDir(); cwd = CHATS_DIR; }

  // Validate the sessionId belongs to this project. If a stale id from a
  // different cwd (e.g. left over after a tab switch) sneaks in, drop it
  // silently so the SDK starts a fresh session instead of erroring out.
  if (sessionId && cwd) {
    const sessionFile = path.join(os.homedir(), '.claude', 'projects', encodeProjectDir(cwd), `${sessionId}.jsonl`);
    if (!fs.existsSync(sessionFile)) {
      logBridge(`SEND dropping stale sessionId=${sessionId} (file not found in ${encodeProjectDir(cwd)})`);
      sessionId = null;
    }
  }

  logBridge(`SEND mode=${mode} req=${requestId || '-'} model=${model || 'default'} permMode=${permissionMode || 'default'} sessionId=${sessionId || 'new'} cwd=${cwd || 'home'} msglen=${(message || '').length} appendSysPrompt=${appendSystemPrompt ? appendSystemPrompt.length + 'ch' : 'none'} sysPrompt=${systemPrompt ? systemPrompt.length + 'ch' : 'none'} disallowedTools=${(disallowedTools || []).length}`);

  // Track the latest send so the DEV panel can read it back.
  lastSendDiagnostics = {
    ts: Date.now(),
    mode, requestId, model, permissionMode, sessionId, cwd,
    msgLen: (message || '').length,
    appendSystemPromptLen: appendSystemPrompt ? appendSystemPrompt.length : 0,
    systemPromptLen: systemPrompt ? systemPrompt.length : 0,
    disallowedToolsCount: (disallowedTools || []).length,
    lastError: null,
  };
  let sdk;
  try { sdk = await loadSdk(); }
  catch (e) {
    event.sender.send('claude-error', { sessionId, error: `Agent SDK not installed: ${e.message}` });
    return { sessionId: null, exitCode: 1 };
  }

  const controller = new AbortController();
  let realSessionId = sessionId || null;
  const provisional = sessionId || `pending-${Date.now()}`;
  activeSessions.set(provisional, controller);

  const options = {
    cwd: cwd || os.homedir(),
    includePartialMessages: true,
    abortController: controller,
    // Permission gate — when the SDK is about to use a host-visible tool it
    // calls canUseTool. We forward to the renderer via an IPC request/reply
    // so the user can Allow / Deny. Bypass for whitelisted-by-session-mode
    // tools (Read, Glob, Grep are always safe). Always-allow decisions live
    // in `allowAlwaysCache` for the duration of the process.
    canUseTool: async (toolName, input /*, ctx */) => {
      // SDK contract: allow→{updatedInput}, deny→{message}.
      const safeInput = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
      const allow = () => ({ behavior: 'allow', updatedInput: safeInput });
      const deny  = (msg) => ({ behavior: 'deny', message: msg || 'User denied the tool call.' });

      // Sub-agents and read-only tools auto-allow.
      if (toolName === 'Task' || READONLY_TOOLS.has(toolName)) return allow();

      // ExitPlanMode → plan approval modal in the artifact panel.
      if (toolName === 'ExitPlanMode') {
        const dec = await askRendererForPlan({
          plan: safeInput.plan || '(no plan provided)',
          sessionId: realSessionId || sessionId || provisional,
        });
        return dec?.behavior === 'allow' ? allow() : deny(dec?.message);
      }

      // AskUserQuestion is intercepted in the renderer via the existing
      // content-block stream UI; here we just allow it to proceed so the SDK
      // continues. The renderer captures the question + sends user picks back
      // via sendMessage. Returning allow with the unchanged input is enough.
      // (Future: switch to a real tool_result via canUseTool answer shape.)
      if (toolName === 'AskUserQuestion') return allow();

      // Per-cwd persistent always-allow cache.
      const cacheKey = `${cwd || ''}::${toolName}`;
      if (allowAlwaysCache.has(cacheKey)) return allow();

      const decision = await askRendererForPermission({
        toolName, input: safeInput, cwd, sessionId: realSessionId || sessionId || provisional,
      });
      if (decision?.always) { allowAlwaysCache.add(cacheKey); saveAlwaysAllow(); }
      return decision?.behavior === 'allow' ? allow() : deny(decision?.message);
    },
  };
  if (sessionId)      options.resume         = sessionId;
  if (model)          options.model          = model;
  if (permissionMode) options.permissionMode = permissionMode;
  if (effort)         options.effort         = effort;
  if (fastMode)       options.fastMode       = true;
  if (appendSystemPrompt) options.appendSystemPrompt = appendSystemPrompt;
  if (systemPrompt)       options.systemPrompt       = systemPrompt;
  if (disallowedTools && Array.isArray(disallowedTools)) options.disallowedTools = disallowedTools;
  // Extended thinking — when enabled, the model emits content_block 'thinking'
  // events the renderer can surface in a collapsible block. Default ON for Opus,
  // OFF for Haiku (which doesn't support it well).
  const thinkingOn = enableThinking ?? /opus/i.test(String(model || ''));
  if (thinkingOn) options.thinking = { type: 'enabled', budget_tokens: 8000 };

  // CRITICAL: in packaged builds the SDK can't spawn the claude binary from
  // inside app.asar. Hand it the real on-disk path explicitly.
  const binPath = claudeBinaryPath();
  if (binPath) options.pathToClaudeCodeExecutable = binPath;

  try {
    const iter = sdk.query({ prompt: message, options });
    let sawAny = false;
    for await (const msg of iter) {
      sawAny = true;
      // Adopt session id from any envelope that carries one
      if (!realSessionId && msg?.session_id) {
        realSessionId = msg.session_id;
        activeSessions.delete(provisional);
        activeSessions.set(realSessionId, controller);
      }

      // Track rate limits + cumulative usage
      if (msg?.type === 'rate_limit_event' && msg.rate_limit_info) {
        recordRateLimit(msg.rate_limit_info);
        broadcastUsage();

        if (blockOverage && msg.rate_limit_info.isUsingOverage) {
          // Hard-abort: user opted out of overage spend.
          controller.abort();
          event.sender.send('claude-error', {
            sessionId: realSessionId || provisional,
            error: 'Blocked: this request would use overage credit (disable in Settings → Usage).',
          });
          break;
        }
      }

      if (msg?.type === 'result') {
        const u = msg.usage || {};
        sessionUsage = {
          ...sessionUsage,
          tokensIn:      sessionUsage.tokensIn      + (u.input_tokens          || 0),
          tokensOut:     sessionUsage.tokensOut     + (u.output_tokens         || 0),
          cacheCreation: sessionUsage.cacheCreation + (u.cache_creation_input_tokens || 0),
          cacheRead:     sessionUsage.cacheRead     + (u.cache_read_input_tokens     || 0),
          costUsd:       sessionUsage.costUsd       + (msg.total_cost_usd || 0),
          turns:         sessionUsage.turns         + 1,
        };
        accumulateUsage(u);
        broadcastUsage();
      }

      event.sender.send('claude-stream', {
        sessionId: realSessionId || provisional,
        requestId,
        event: msg,
      });
    }
    if (!sawAny) {
      logBridge('SDK iterator yielded nothing — sending empty-stream warning');
      event.sender.send('claude-error', {
        sessionId: realSessionId || provisional,
        requestId,
        error: 'No response from Claude (the SDK returned no events). Check ~/.claudigotchi/bridge.log',
      });
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      const msg = e?.message || String(e);
      logBridge(`SDK ERROR: ${msg}\n${e?.stack || ''}`);
      if (lastSendDiagnostics) lastSendDiagnostics.lastError = msg;
      event.sender.send('claude-error', {
        sessionId: realSessionId || provisional,
        requestId,
        error: msg,
      });
    }
  } finally {
    activeSessions.delete(realSessionId || provisional);
  }

  return { sessionId: realSessionId || provisional, exitCode: 0 };
});

// Encode a cwd the same way Claude Code stores project directories.
// Empirical rule (verified against ~/.claude/projects/): replace every
// non-[a-zA-Z0-9_] character with a literal `-`. No squashing. No trimming.
//   C:\Users\Kenny\Claudagotchi             →  C--Users-Kenny-Claudagotchi
//   C:\Users\Kenny\.claudigotchi\chats      →  C--Users-Kenny--claudigotchi-chats
//   C:\Users\Kenny\source\repos\Moveit (RSUI)→ C--Users-Kenny-source-repos-Moveit--RSUI-
function encodeProjectDir(p) {
  return String(p).replace(/[^a-zA-Z0-9_]/g, '-');
}

// Read the first interesting line from a session jsonl to derive a title.
function readSessionMeta(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n').filter(Boolean).slice(0, 30);
    let title = null;
    for (const line of lines) {
      try {
        const ev = JSON.parse(line);
        if (!title && ev.content && typeof ev.content === 'string') {
          title = ev.content.split('\n')[0].slice(0, 80);
        }
        if (!title && ev.message?.content) {
          const text = Array.isArray(ev.message.content)
            ? (ev.message.content.find(b => b.type === 'text')?.text || '')
            : ev.message.content;
          if (text) title = String(text).split('\n')[0].slice(0, 80);
        }
        if (title) break;
      } catch {}
    }
    return { title, updated: stat.mtimeMs, created: stat.birthtimeMs || stat.mtimeMs };
  } catch {
    return { title: null, updated: 0, created: 0 };
  }
}

ipcMain.handle('claude-list-sessions', async (_, { cwd, mode } = {}) => {
  try {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    if (!fs.existsSync(projectsDir)) return [];

    // Strict mode-based split (Phase 10): chat mode ONLY reads CHATS_DIR's
    // encoded projects directory; code mode ONLY reads the currently-picked
    // folder. With no folder selected in code mode we return [] so chat
    // sessions can't leak into the code-tab sidebar.
    if (mode === 'chat') { ensureChatsDir(); cwd = CHATS_DIR; }

    let targetDirs = [];
    if (cwd) {
      const encoded = encodeProjectDir(cwd);
      const candidate = path.join(projectsDir, encoded);
      if (fs.existsSync(candidate)) targetDirs.push(candidate);
    } else if (!mode || mode === 'code') {
      // Code mode without a folder: return empty list. User must pick a folder.
      return [];
    } else {
      targetDirs = fs.readdirSync(projectsDir)
        .map(name => path.join(projectsDir, name))
        .filter(p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } });
    }

    // Paranoia: filter so chat-mode never accidentally surfaces a non-CHATS_DIR
    // session and code-mode never surfaces a CHATS_DIR one.
    const chatsEncoded = encodeProjectDir(CHATS_DIR);
    targetDirs = targetDirs.filter(dir => {
      const base = path.basename(dir);
      if (mode === 'chat') return base === chatsEncoded;
      if (mode === 'code') return base !== chatsEncoded;
      return true;
    });

    const sessions = [];
    for (const dir of targetDirs) {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));
      for (const f of files) {
        const id = f.replace(/\.jsonl$/, '');
        const meta = readSessionMeta(path.join(dir, f));
        sessions.push({
          id,
          title: meta.title || '(untitled)',
          created: meta.created,
          updated: meta.updated,
          project: path.basename(dir),
        });
      }
    }
    sessions.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    return sessions.slice(0, 200);
  } catch (e) {
    console.error('[claude-list-sessions]', e);
    return [];
  }
});

/**
 * Read a session's on-disk JSONL and reduce it to our renderer-friendly
 * message shape: [{ id, role, blocks: [...] }]. Used when a user clicks a
 * session in the sidebar.
 */
ipcMain.handle('claude-read-session', async (_, { sessionId, cwd, mode } = {}) => {
  try {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    if (mode === 'chat') { ensureChatsDir(); cwd = CHATS_DIR; }

    // Find the .jsonl file (search across project dirs if no cwd)
    let filePath = null;
    if (cwd) {
      const p = path.join(projectsDir, encodeProjectDir(cwd), `${sessionId}.jsonl`);
      if (fs.existsSync(p)) filePath = p;
    }
    if (!filePath && fs.existsSync(projectsDir)) {
      for (const dirName of fs.readdirSync(projectsDir)) {
        const p = path.join(projectsDir, dirName, `${sessionId}.jsonl`);
        if (fs.existsSync(p)) { filePath = p; break; }
      }
    }
    if (!filePath) return { ok: false, error: 'Session file not found' };

    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);

    // Two-pass: first pass finds the LATEST assistant snapshot per message id;
    // second pass builds the ordered timeline by walking the JSONL in order,
    // emitting each user prompt and each assistant message exactly once.
    const latestAssistant = new Map(); // msgId -> latest event
    for (const line of lines) {
      let ev; try { ev = JSON.parse(line); } catch { continue; }
      if (ev.type === 'assistant' && ev.message?.id) latestAssistant.set(ev.message.id, ev);
    }

    const emittedAssistant = new Set();
    const messages = [];
    for (const line of lines) {
      let ev; try { ev = JSON.parse(line); } catch { continue; }

      // User prompt
      if (ev.type === 'queue-operation' && ev.operation === 'enqueue' && ev.content) {
        messages.push({
          id: `u-${messages.length}`,
          role: 'user',
          blocks: [{ type: 'text', text: String(ev.content) }],
        });
        continue;
      }

      // Assistant: emit the FINAL snapshot when we hit the first occurrence
      if (ev.type === 'assistant' && ev.message?.id && !emittedAssistant.has(ev.message.id)) {
        const finalEv = latestAssistant.get(ev.message.id) || ev;
        emittedAssistant.add(ev.message.id);
        const blocks = [];
        for (const block of finalEv.message.content || []) {
          if (block.type === 'text' && block.text) {
            blocks.push({ type: 'text', text: block.text });
          } else if (block.type === 'tool_use') {
            blocks.push({
              type: 'tool', toolId: block.id, name: block.name,
              input: block.input || {}, result: undefined, isError: false,
            });
          }
        }
        if (blocks.length > 0) {
          messages.push({ id: `a-${ev.message.id}`, role: 'assistant', blocks });
        }
        continue;
      }

      // Tool results backfill into prior tool blocks
      if (ev.type === 'user' && Array.isArray(ev.message?.content)) {
        for (const block of ev.message.content) {
          if (block.type === 'tool_result' && block.tool_use_id) {
            const resultText = typeof block.content === 'string'
              ? block.content
              : Array.isArray(block.content)
                ? block.content.map(c => c.text || '').join('')
                : JSON.stringify(block.content);
            for (const msg of messages) {
              for (const b of msg.blocks) {
                if (b.type === 'tool' && b.toolId === block.tool_use_id) {
                  b.result  = resultText;
                  b.isError = !!block.is_error;
                }
              }
            }
          }
        }
      }
    }

    return { ok: true, messages };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('claude-delete-session', async (_, { sessionId, cwd }) => {
  try {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    let candidates = [];
    if (cwd) {
      candidates.push(path.join(projectsDir, encodeProjectDir(cwd), `${sessionId}.jsonl`));
    } else if (fs.existsSync(projectsDir)) {
      for (const dirName of fs.readdirSync(projectsDir)) {
        candidates.push(path.join(projectsDir, dirName, `${sessionId}.jsonl`));
      }
    }
    for (const c of candidates) {
      if (fs.existsSync(c)) fs.unlinkSync(c);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('claude-abort', async (_, { sessionId } = {}) => {
  // When sessionId is omitted or 'all', abort every in-flight request.
  // newChat / force-kill paths don't know the SDK-provisional session id,
  // so the easy correct thing is to nuke everything that's still running.
  if (!sessionId || sessionId === 'all') {
    for (const [k, ctl] of activeSessions.entries()) {
      try { ctl.abort(); } catch {}
      activeSessions.delete(k);
    }
    return { ok: true, aborted: 'all' };
  }
  const ctl = activeSessions.get(sessionId);
  if (ctl) { try { ctl.abort(); } catch {} ; activeSessions.delete(sessionId); }
  return { ok: true, aborted: sessionId };
});

// ─── IPC: File system ─────────────────────────────────────────────────────────

ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('pick-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
  });
  return result.canceled ? [] : result.filePaths;
});

/**
 * Save a pasted/dropped image to ~/.claudigotchi/temp/<ts>.<ext> and return
 * the absolute path. Used by InputBar's paste handler to attach screenshots.
 */
ipcMain.handle('save-temp-image', async (_, { base64, ext } = {}) => {
  try {
    if (!base64) return { ok: false, error: 'no image data' };
    const tempDir = path.join(SAVE_DIR, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const safeExt = String(ext || 'png').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'png';
    const filename = `paste-${Date.now()}.${safeExt}`;
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Cap how large an image we'll inline into the renderer (prevents 50MB pastes
// from blowing up memory). 8MB encoded base64 ≈ ~6MB raw — plenty for screenshots.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMG_MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
  ico: 'image/x-icon', svg: 'image/svg+xml',
};

ipcMain.handle('read-image-data-url', async (_, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return { ok: false, error: 'not found' };
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_IMAGE_BYTES) return { ok: false, error: 'too large' };
    const ext = String(filePath).split('.').pop()?.toLowerCase();
    const mime = IMG_MIME[ext] || 'application/octet-stream';
    const buf = fs.readFileSync(filePath);
    return { ok: true, dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('read-file', async (_, filePath) => {
  try { return { ok: true, content: fs.readFileSync(filePath, 'utf8') }; }
  catch (e) { return { ok: false, error: e.message }; }
});

// ─── IPC: Save/Load ───────────────────────────────────────────────────────────

ipcMain.handle('save-data', async (_, data) => {
  try {
    if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });
    fs.writeFileSync(SAVE_FILE, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('load-data', async () => {
  try {
    if (!fs.existsSync(SAVE_FILE)) return { ok: true, data: null };
    return { ok: true, data: JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8')) };
  } catch (e) { return { ok: false, error: e.message }; }
});

/**
 * Per-tab chat persistence. We save just the bare messages + activeSession +
 * cwd so a reload restores the conversation as the user left it. Stored at
 * ~/.claudigotchi/chats/<tab>-active.json (tab is 'code' or 'chat').
 */
ipcMain.handle('save-active-chat', async (_, { tab, payload } = {}) => {
  try {
    if (!tab) return { ok: false, error: 'no tab' };
    const dir = path.join(SAVE_DIR, 'chats');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${tab}-active.json`);
    fs.writeFileSync(file, JSON.stringify(payload ?? {}), 'utf8');
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('load-active-chat', async (_, { tab } = {}) => {
  try {
    const file = path.join(SAVE_DIR, 'chats', `${tab}-active.json`);
    if (!fs.existsSync(file)) return { ok: true, payload: null };
    return { ok: true, payload: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('save-memory', async (_, { petName, content }) => {
  try {
    const dir = path.join(SAVE_DIR, 'pets', petName);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'pet-memory.md'), content, 'utf8');
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('load-memory', async (_, { petName }) => {
  try {
    const file = path.join(SAVE_DIR, 'pets', petName, 'pet-memory.md');
    if (!fs.existsSync(file)) return { ok: true, content: null };
    return { ok: true, content: fs.readFileSync(file, 'utf8') };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ─── IPC: Window controls ─────────────────────────────────────────────────────

// ─── IPC: Pet-window state sync ──────────────────────────────────────────────
// Main window holds the live engines; pet window is a view-only mirror.
// Main → Pet:  'pet-state' (full snapshot, sent on each change)
// Pet  → Main: 'pet-action' { action, payload? } (forwarded to main window)
ipcMain.handle('broadcast-pet-state', (_, state) => {
  petWindow?.webContents.send('pet-state', state);
});

ipcMain.handle('send-pet-action', (_, action) => {
  mainWindow?.webContents.send('pet-action', action);
});

ipcMain.handle('request-pet-state', () => {
  // When the pet window opens, ask main to push current state immediately.
  mainWindow?.webContents.send('pet-state-requested');
});

ipcMain.handle('window-minimize',    () => mainWindow?.minimize());
ipcMain.handle('window-maximize',    () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.handle('window-close',       () => mainWindow?.close());
ipcMain.handle('window-quit',        () => { isQuitting = true; app.quit(); });
ipcMain.handle('tray-tooltip',       (_e, tip) => { try { tray?.setToolTip(String(tip || 'Claudagotchi').slice(0, 127)); } catch {} });
ipcMain.handle('pet-pop-out',        () => { if (!petWindow) createPetWindow(); });
ipcMain.handle('pet-dock-in',        () => { petWindow?.close(); });

function createArtifactWindow() {
  const mainBounds = mainWindow?.getBounds() ?? { x: 0, y: 0, width: 800, height: 600 };
  artifactWindow = new BrowserWindow({
    width: 520,
    height: mainBounds.height,
    x: mainBounds.x + mainBounds.width + 8,
    y: mainBounds.y,
    minWidth: 360, minHeight: 400,
    frame: false, alwaysOnTop: false,
    title: 'Claudagotchi Artifacts',
    icon: path.join(__dirname, 'public', 'icon.ico'),
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const url = IS_DEV
    ? 'http://localhost:5173?artifactWindow=true'
    : `file://${path.join(__dirname, 'dist', 'index.html')}?artifactWindow=true`;
  artifactWindow.loadURL(url);
  artifactWindow.on('closed', () => {
    artifactWindow = null;
    mainWindow?.webContents.send('artifact-window-closed');
  });
}
ipcMain.handle('artifact-pop-out', () => { if (!artifactWindow) createArtifactWindow(); });
ipcMain.handle('artifact-dock-in', () => { artifactWindow?.close(); });
// Broadcast artifact state from main → artifact window. Main is the source of truth.
ipcMain.handle('broadcast-artifact-state', (_, payload) => {
  artifactWindow?.webContents.send('artifact-state', payload);
});
// Forward artifact-window actions back to main: close-file, pick-history, approve/reject.
ipcMain.handle('send-artifact-action', (_, action) => {
  mainWindow?.webContents.send('artifact-action', action);
});
ipcMain.handle('request-artifact-state', () => {
  mainWindow?.webContents.send('artifact-state-requested');
});

// Per-file pop-out: each tab can spawn its own independent window. Re-popping
// the same path focuses the existing window instead of opening a duplicate.
function createFileWindow(filePath, mode = 'edit') {
  const existing = fileWindows.get(filePath);
  if (existing && !existing.isDestroyed()) { existing.focus(); return; }
  const mainBounds = mainWindow?.getBounds() ?? { x: 0, y: 0, width: 800, height: 600 };
  const offset = fileWindows.size * 24;
  const win = new BrowserWindow({
    width: 720,
    height: Math.min(mainBounds.height, 800),
    x: mainBounds.x + 80 + offset,
    y: mainBounds.y + 80 + offset,
    minWidth: 360, minHeight: 300,
    frame: false,
    title: 'Claudagotchi File',
    icon: path.join(__dirname, 'public', 'icon.ico'),
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const enc = encodeURIComponent(filePath);
  const m   = encodeURIComponent(mode || 'edit');
  const url = IS_DEV
    ? `http://localhost:5173?fileWindow=true&path=${enc}&mode=${m}`
    : `file://${path.join(__dirname, 'dist', 'index.html')}?fileWindow=true&path=${enc}&mode=${m}`;
  win.loadURL(url);
  fileWindows.set(filePath, win);
  win.on('closed', () => {
    if (fileWindows.get(filePath) === win) fileWindows.delete(filePath);
    mainWindow?.webContents.send('file-window-closed', { path: filePath });
  });
}
ipcMain.handle('file-pop-out', (_e, { path: filePath, mode }) => { if (filePath) createFileWindow(filePath, mode); });
// Reveal a file or folder in the OS file manager (Explorer / Finder / xdg-open).
ipcMain.handle('reveal-in-explorer', (_e, { path: target }) => {
  if (!target) return { ok: false, error: 'no path' };
  try { shell.showItemInFolder(target); return { ok: true }; }
  catch (e) { return { ok: false, error: String(e?.message || e) }; }
});
ipcMain.handle('file-dock-in', (_e, { path: filePath }) => { fileWindows.get(filePath)?.close(); });
ipcMain.handle('file-window-list', () => Array.from(fileWindows.keys()));
ipcMain.handle('get-main-bounds',    () => mainWindow?.getBounds());

// ─── App lifecycle ────────────────────────────────────────────────────────────

async function bootstrap() {
  createSplashWindow();

  // Loop: run checks, allow retry on failure. Skip continues anyway.
  let ok = false;
  while (!ok) {
    ok = await runStartupChecks();
    if (ok) break;
    // Wait for the user to click Retry / Skip / Quit
    const choice = await new Promise(resolve => { splashRetryResolver = resolve; });
    if (choice === 'skip') { ok = true; break; }
    // Otherwise loop (Retry)
  }

  ensureTray();
  createMainWindow();
  // Failsafe: if main window hasn't shown after 8s, force-close splash anyway.
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  }, 8000);
}

app.whenReady().then(bootstrap);
app.on('window-all-closed', () => {
  // Don't auto-quit when the tray is alive — close = hide-to-tray.
  // Exiting requires explicit user action via the tray "Quit" item.
  if (tray) return;
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => { isQuitting = true; });
app.on('activate', () => { if (!mainWindow) createMainWindow(); });
