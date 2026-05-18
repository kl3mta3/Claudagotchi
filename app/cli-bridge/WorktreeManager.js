/**
 * WorktreeManager — thin wrappers around `git worktree` for the per-session
 * isolation feature. Runs in the main process (uses child_process). Stateless;
 * the caller (App + electron IPC) tracks which sessionId maps to which path.
 *
 * Strategy:
 *   - Worktrees live under ~/.claudigotchi/worktrees/<repoBasename>-<shortSessionId>/
 *   - Each gets a fresh branch named `cg/<shortSessionId>` off HEAD of the user's repo.
 *   - Cleanup is best-effort: `git worktree remove --force` then `git branch -D`.
 *     We swallow errors because users may have manually committed or moved things.
 */
const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const WORKTREE_ROOT = path.join(os.homedir(), '.claudigotchi', 'worktrees');

function ensureRoot() {
  if (!fs.existsSync(WORKTREE_ROOT)) fs.mkdirSync(WORKTREE_ROOT, { recursive: true });
}

/** True if cwd is inside a git working tree. */
function isGitRepo(cwd) {
  if (!cwd) return false;
  try {
    const out = execSync('git rev-parse --is-inside-work-tree', {
      cwd, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8',
    });
    return out.trim() === 'true';
  } catch {
    return false;
  }
}

/** Resolve the actual repo root (handles being called from a subdir). */
function repoRoot(cwd) {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8',
    }).trim();
  } catch {
    return cwd;
  }
}

/** Short id from a sessionId or a random fallback. ~6 chars, filename-safe. */
function shortId(sessionId) {
  const s = String(sessionId || '').replace(/[^a-zA-Z0-9]/g, '');
  if (s.length >= 6) return s.slice(0, 6);
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Create a worktree off the repo's HEAD on a fresh branch.
 * Returns { path, branch, repoRoot } or throws on failure.
 */
function create(cwd, sessionId) {
  ensureRoot();
  if (!isGitRepo(cwd)) throw new Error(`Not a git repo: ${cwd}`);
  const root   = repoRoot(cwd);
  const base   = path.basename(root) || 'repo';
  const sid    = shortId(sessionId);
  const branch = `cg/${sid}`;
  const dest   = path.join(WORKTREE_ROOT, `${base}-${sid}`);

  // Pre-clean any leftover folder/branch from a previous run with the same id.
  try { execSync(`git worktree remove --force "${dest}"`, { cwd: root, stdio: 'ignore' }); } catch {}
  try { execSync(`git branch -D ${branch}`, { cwd: root, stdio: 'ignore' }); } catch {}
  if (fs.existsSync(dest)) {
    try { fs.rmSync(dest, { recursive: true, force: true }); } catch {}
  }

  execSync(`git worktree add "${dest}" -b ${branch}`, { cwd: root, stdio: 'ignore' });
  return { path: dest, branch, repoRoot: root };
}

/** Best-effort prune. Caller owns the {path, branch, repoRoot} triple. */
function remove({ path: dest, branch, repoRoot: root }) {
  try { execSync(`git worktree remove --force "${dest}"`, { cwd: root, stdio: 'ignore' }); } catch {}
  if (branch) {
    try { execSync(`git branch -D ${branch}`, { cwd: root, stdio: 'ignore' }); } catch {}
  }
  // If the directory somehow survived (e.g. lock file), nuke it from disk.
  if (dest && fs.existsSync(dest)) {
    try { fs.rmSync(dest, { recursive: true, force: true }); } catch {}
  }
}

/**
 * Parse `git worktree list --porcelain` from a repo root.
 * Returns [{ path, branch }], excluding the main worktree.
 */
function list(root) {
  try {
    const out = execSync('git worktree list --porcelain', {
      cwd: root, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8',
    });
    const items = [];
    let cur = null;
    for (const line of out.split(/\r?\n/)) {
      if (line.startsWith('worktree ')) {
        if (cur) items.push(cur);
        cur = { path: line.slice('worktree '.length), branch: null };
      } else if (line.startsWith('branch ')) {
        if (cur) cur.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
      }
    }
    if (cur) items.push(cur);
    // Drop the main worktree (the repo root itself) — only return extras.
    return items.filter(w => w.path !== root);
  } catch {
    return [];
  }
}

/**
 * Read a compact status snapshot for the given cwd.
 * Returns { branch, ahead, behind, modified, added, deleted, untracked, clean } or null.
 * branch is the current HEAD (or 'detached' / null when in odd states).
 */
function status(cwd) {
  if (!isGitRepo(cwd)) return null;
  try {
    const out = execSync('git status --porcelain=v1 -b', {
      cwd, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8',
    });
    const lines = out.split(/\r?\n/);
    const header = lines[0] || '';
    let branch = null, ahead = 0, behind = 0;
    // ## main...origin/main [ahead 2, behind 3]
    // ## HEAD (no branch)
    const m = header.match(/^##\s+([^.\s]+)(?:\.\.\.[^\s]+)?(?:\s+\[([^\]]+)\])?/);
    if (m) {
      branch = m[1] === 'HEAD' ? 'detached' : m[1];
      const meta = m[2] || '';
      const a = meta.match(/ahead\s+(\d+)/);   if (a) ahead  = parseInt(a[1], 10);
      const b = meta.match(/behind\s+(\d+)/);  if (b) behind = parseInt(b[1], 10);
    }
    let modified = 0, added = 0, deleted = 0, untracked = 0;
    for (const ln of lines.slice(1)) {
      if (!ln) continue;
      const xy = ln.slice(0, 2);
      if (xy === '??') { untracked++; continue; }
      // Count the index status (X) and worktree status (Y) — collapse to one per file.
      const x = xy[0], y = xy[1];
      if (x === 'A' || y === 'A') added++;
      else if (x === 'D' || y === 'D') deleted++;
      else if (x === 'M' || y === 'M' || x === 'R' || y === 'R') modified++;
    }
    const clean = modified + added + deleted + untracked === 0;
    return { branch, ahead, behind, modified, added, deleted, untracked, clean };
  } catch {
    return null;
  }
}

/** Stage all and commit with the given message. Returns { ok, error?, sha? }. */
function commitAll(cwd, message) {
  if (!message || !message.trim()) return { ok: false, error: 'message required' };
  if (!isGitRepo(cwd)) return { ok: false, error: 'not a git repo' };
  try {
    execSync('git add -A', { cwd, stdio: 'ignore' });
    // -m with the message escaped via env var to dodge quoting on Windows.
    execSync(`git commit -m "${String(message).replace(/"/g, '\\"').slice(0, 500)}"`, {
      cwd, stdio: 'ignore', env: { ...process.env },
    });
    const sha = execSync('git rev-parse --short HEAD', {
      cwd, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8',
    }).trim();
    return { ok: true, sha };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** Hard-discard ALL uncommitted changes (working tree + index + untracked). */
function discardAll(cwd) {
  if (!isGitRepo(cwd)) return { ok: false, error: 'not a git repo' };
  try {
    execSync('git reset --hard HEAD', { cwd, stdio: 'ignore' });
    execSync('git clean -fd',         { cwd, stdio: 'ignore' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** Run `git diff HEAD -- <filePath>` and return the raw unified diff text.
 *  Returns '' if not a git repo, file is untracked but staged, or diff is empty.
 *  Includes both unstaged + staged changes by comparing against HEAD. */
function diffFile(filePath) {
  if (!filePath) return '';
  const dir = path.dirname(filePath);
  if (!isGitRepo(dir)) return '';
  try {
    // -C runs git as if invoked from <dir>. --no-color keeps output parseable.
    // --unified=0 would be smaller but we want a few lines of context for the
    // hunks; the default 3 is fine. HEAD compares against last commit.
    return execSync(`git -C "${dir}" diff HEAD --no-color -- "${filePath}"`, {
      stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    });
  } catch (e) {
    // git exits non-zero if the file is untracked (no HEAD version). Treat
    // every line as an addition by reading the file and synthesizing a diff.
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      const headers = [
        `diff --git a/${path.basename(filePath)} b/${path.basename(filePath)}`,
        'new file mode 100644',
        '--- /dev/null',
        `+++ b/${path.basename(filePath)}`,
        `@@ -0,0 +1,${lines.length} @@`,
      ];
      return headers.concat(lines.map(l => '+' + l)).join('\n');
    } catch { return ''; }
  }
}

/** Run `git init` in cwd. Used to opt non-git folders into tracking. */
function init(cwd) {
  if (!cwd) return { ok: false, error: 'no path' };
  try {
    execSync('git init', { cwd, stdio: 'ignore' });
    // Make sure HEAD exists by creating an initial commit if there's content.
    // Helps later worktree ops which need at least one commit to branch off.
    try {
      execSync('git add -A',                                  { cwd, stdio: 'ignore' });
      execSync('git commit --allow-empty -m "Initial commit"',{ cwd, stdio: 'ignore' });
    } catch {}
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

module.exports = { isGitRepo, repoRoot, create, remove, list, status, commitAll, discardAll, init, diffFile, WORKTREE_ROOT };
