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

module.exports = { isGitRepo, repoRoot, create, remove, list, WORKTREE_ROOT };
