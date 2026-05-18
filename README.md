<div align="center">

<p align="center">
  <img src="/images/title.png" alt="Claudagotchi" width="300"/>
</p>

![Repo size](https://img.shields.io/github/repo-size/kl3mta3/Claudagotchi?style=flat-square)
![Last commit](https://img.shields.io/github/last-commit/kl3mta3/Claudagotchi?style=flat-square)
![stars](https://img.shields.io/github/stars/kl3mta3/Claudagotchi?style=flat-square)

<p></P>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with: Electron](https://img.shields.io/badge/built%20with-Electron-47848F.svg)](https://www.electronjs.org/)

---

</div>

A standalone desktop Claude client with a Tamagotchi-style pet living inside it. Replaces the Claude Code desktop experience with full chat, a real code editor, file tree, git integration, per-session worktrees, and a procedurally generated pet that grows, reacts, evolves, and occasionally dies based on how you use Claude.

The pet is a first-class citizen of the UI, not a sidebar gimmick. The IDE side is lightweight but real — find/replace, autocomplete, live git diff in the gutter, format-on-save, an open-terminal-here button, per-file pop-out windows.

<p align="center">
  <img src="/images/view_explorer.png" alt="view_explore" width="500"/>
</p>

<p align="center">
  <img src="/images/pet_long.png" alt="pet_long" width="800"/>
</p>

---

## What it is, honestly

Claudagotchi sits between **Claude Desktop** (chat-only) and **Cursor / Antigravity / VS Code + Claude Code** (full IDEs). More coding capability than Claude Desktop, less than a VS Code-based IDE, plus a living pet nobody else ships.

- **More than Claude Desktop**: real CodeMirror editor, file tree explorer, git status & commits, per-session git worktrees, per-file pop-outs, diff-in-gutter, format-on-save.
- **Less than VS Code-based IDEs**: no language server (no real-time errors except JSON, no go-to-definition, no rename refactor), no debugger, no extension marketplace, no integrated terminal panel yet (we ship a button that pops a real PowerShell instead).
- **The hook**: an AI coding agent wrapped in a virtual creature that reacts to your work, gets bored when you idle, sparkles 1% of the time, and dies if you neglect it. Haven't come across another desktop client doing this — if there's prior art, happy to credit it.

Distribution: one click `.exe`. End user needs nothing pre-installed — Claude CLI is bundled, git is offered on first launch (one-button install of MinGit).

---

## Install

**You don't need Node, npm, or git installed.** Pick one:

| Format                                                     | When to use                                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Claudagotchi Setup 0.1.0.exe** (NSIS installer, ~230 MB) | Most users. Adds Start Menu / Desktop shortcut. Auto-updates.                             |
| **Claudagotchi-0.1.0-portable.exe** (single file, ~230 MB) | No install. Run from anywhere / USB. Auto-updates.                                        |
| **Zip the `win-unpacked/` directory**                      | Power users who want the directory layout. **Does not auto-update** (manual re-download). |
| `git clone` + `npm run dev`                                | Contributors. Requires Node 18+ and npm.                                                  |

Auto-update is wired via `electron-updater` + GitHub Releases. NSIS and portable both prompt + download + restart on their own when a new version ships. You never touch `latest.yml`.

**First launch:**

1. Splash checks for the bundled Claude CLI (`claude.exe` packed in the app via asarUnpack — no global npm install needed).
2. Detects git. If missing, asks once whether to download MinGit (~45 MB) into `~/.claudigotchi/git/`. You can skip; git features just degrade gracefully.
3. Prompts you to sign in to Claude via OAuth (`claude auth login` opens your browser).
4. Pet egg spawns. Pick a folder to start coding.

---

## IDE features

What ships in the editor today:

### Code editor (CodeMirror 6)

- Syntax highlighting: JS/JSX/TS/TSX/MJS/CJS, HTML/HTM, CSS/SCSS/LESS, JSON/JSONC, MD/Markdown, Python. Everything else still gets line numbers and dracula theme.
- **Find** (Ctrl+F) and **Replace** (Ctrl+H) panel — case-sensitive / whole-word / regex toggles. F3 / Shift+F3 for next/previous.
- **Autocomplete** (Ctrl+Space) — language-pack-supplied keywords + snippets.
- **Auto-close brackets**, **bracket matching**, **smart indent**.
- **Code folding** with gutter chevrons (Ctrl+Shift+\[ / Ctrl+Shift+\]).
- **Multi-cursor** (Alt+click) and **rectangular selection** (Alt+drag).
- **JSON lint** in the gutter (other languages silent).
- Tab indents (instead of moving focus).
- Highlights other occurrences of the current selection.

### Live git diff in the editor

When you open a tracked file, the editor pulls `git diff HEAD -- <path>` and paints:

- **Green** background on added lines
- **Yellow** background on changed lines (modified)
- **Red** background + strikethrough on deleted lines
- `+ / − / ~` glyphs in a dedicated gutter column

Refreshes on every save. Untracked files render as all-added (every line green). Falls through silently in non-git folders.

### Format-on-save

Toggle in the editor footer (default ON). On save, runs Prettier in-process for: JS/JSX/TS/TSX/JSON/HTML/CSS/SCSS/LESS/MD/YAML. Malformed code → saves original, never loses data. Per-editor preference persists in `localStorage`. Python format-on-save is on the roadmap (would shell out to `black`).

### Open terminal at folder

`▶_ Terminal` button in the git status bar. Pops a real PowerShell (Windows), Terminal.app (macOS), or `x-terminal-emulator` (Linux) at the current folder's cwd. Detached, lives independently of the app.

### File tree explorer
- Single-click directories to expand
- Double-click files to open in the editor
- Right-click context menu:
  - 📄 Open (edit)
  - 🎨 View as artifact (for HTML/SVG/MD/image preview modes)
  - 📂 Reveal in Explorer (OS file manager)
  - 🗑️ Delete (sends to OS recycle bin via `shell.trashItem`)

### Per-file pop-out windows

Every file tab in the artifact panel has a ↗ button. Pops the file into its own independent window — multiple files open simultaneously, each window keeps its own editor state and saves back to disk normally. Re-pop = focus existing window.

<p align="center">
  <img src="/images/window_popout.png" alt="window_popout" width="800"/>
</p>

### Git integration (no command line needed)

Slim status bar above the input shows: branch · ahead/behind · counts of modified/added/deleted/untracked files. Click to expand a commit panel:

- Commit all (stages everything, prompts for message)
- Discard all (`git reset --hard HEAD + git clean -fd`)
- Initialize tracking (`git init`) for non-git folders

Every picked folder is auto-`git init`'d so Claude's edits are tracked from the start.

### Per-session git worktrees (opt-in)

Settings → per-folder toggle. When enabled, each new session runs in `~/.claudigotchi/worktrees/<repo>-<sid>/` on a fresh `cg/<sid>` branch. Lets you test risky Claude edits without polluting your main working tree. Auto-pruned when the session is deleted.

### Auto-save chat

Active chat for each tab persists to `~/.claudigotchi/chats/<tab>-active.json`. Survives app close. Restores message thread + current session id on next launch (verifies the session file still exists on disk before re-attaching — deleted sessions fall back cleanly).

---

## Claude chat features

- **Streaming responses** with the egg ✓ status pill at the end of each turn
- **Live inline status**: `⏱ 4s · ~210 tokens` while the agent runs, then `🥚 ✓ 12s · 1.2k tokens` for 6s after
- **Code blocks** with syntax highlighting and copy button
- **Thinking blocks** — extended-thinking output renders inline, collapsible
- **AskUserQuestion blocking modal** — agent actually pauses for your answer (not a fake "I'll continue anyway")
- **Plan approval** — `ExitPlanMode` opens the artifact panel with Approve / Reject buttons
- **Tasks panel** — every tool call / Bash / Edit / sub-agent lives in a dedicated right-column panel (whole-session history, scrollable, grouped by turn). Chat thread stays as pure prose.
- **Sub-agent traces** — `Task` tool runs render as collapsible cards in the Tasks panel
- **Sessions**: per-folder list, resume, delete, hide. Search by name.
- **Permission prompts** with Allow once / Always (per cwd) / Deny. Persisted to `~/.claudigotchi/always-allow.json`.
- **Concurrent tab sessions**: open multiple chats side-by-side; background tabs accumulate text deltas while you work in the active tab.
- **Image attachments** — paste screenshots, drag-and-drop, or use `@<path>` in chat to embed local images.
- **Model picker** in the input bar: Opus 4.7 / Sonnet 4.6 / Haiku 4.5 / legacy.
- **Permission mode picker**: Ask each time / Auto / Plan / YOLO.
- **Effort picker**: low / medium / high (controls token budget).
- **Fast mode** toggle: trade quality for speed.
- **Code vs Chat mode** tabs at the top — Chat mode skips the folder picker for pure Q&A.

---

## The pet

### Procedural generation

Each pet is deterministically generated from a 32-bit seed. Combinatorially ~7M+ distinct configurations:

https://github.com/user-attachments/assets/101096b4-5e20-4a35-9669-1a862499f714

### ✨ Shiny pets (1% rate)

Like a shiny Pokémon — same colors as the rolled pet plus a pulsing gold drop-shadow + 6 orbital sparkles that twinkle at staggered timings. Visible from egg through adult. Dev panel has a `✨ Spawn Shiny Egg` button to force one for testing.

### Life stages

- **Egg** → **Hatchling** → **Adolescent** → **Adult** → **Dead** (tombstone)
- 4 life stages with stat-driven evolution. Each pet has randomized thresholds per stage.
- Death from prolonged hunger or health crisis. Tombstones persist forever with name, personality, age, stage reached, intelligence.
- New pet auto-spawns 5s after death. The pet's chat session is wiped on respawn; your code/chat sessions are untouched.

### Behavior

- **Walks 2.5D** around its room (x + y axis), depth-scales smaller toward the back wall.
- **Reacts to Claude activity**: animates while tools run, gets bored when you idle, mood shifts based on stats.
- **Speech bubbles** with personality-flavored idle quips and reactions.
- **Sleeps** in its bed if you buy one.
- **Eats** at its food tray, **showers** under a shower head, **uses** instruments and the pet PC.
- **Plays** with toys (ball, doll, plushies, squeaky toys).

### Stats (7 capped + 1 unbounded)

- Hunger, Happiness, Cleanliness, Boredom, Sleepiness, Weight, Health — all 0-100, decay over time.
- **Intelligence** — never decays, never caps. Grows from token usage, response length, tool calls, project depth.

### Pet-specific chat

`/pet <message>` in the chat input talks to your pet via Claude — replies stream into the pet's speech bubble, not the main chat. Pet's personality, bio, quirks, and catchphrase from generation get injected into the prompt.

### Pet panel positions

- **Bottom dock** (default) — 240px strip below the chat
- **Top dock** — 240px strip above the chat
- **Side dock** — 360px fixed-width column to the right of the chat; OS window grows by 360px when toggled so the chat doesn't shrink
- **Float / pop-out** — separate window, 720×520, can be repositioned independently

<p align="center">
  <img src="/images/pet_popout.png" alt="pet_popout" width="400"/>
</p>

---

## Shop economy

**~150 items** across 10 categories: Food, Snacks, Toys, Consumables, Housing, Flooring, Decorations, Instruments, Clothing, Game unlocks.

- **4 rarity tiers**: common (gray), rare (blue), epic (purple), legendary (gold) — color-coded borders + cost ranges enforced per tier
- **Stage gating**: items require minimum life stage (egg can buy nothing, hatchling can wear head items, adolescent+ everything)
- **Achievement gating**: some legendary items only unlock after milestones (cumulative tokens, day streaks, marathon sessions, etc.)
- **Multi-instance decorations**: buy multiple plushies / pictures / aquariums; each placed independently
- **Passive bonuses**: equipped items can give per-tick stat boosts (Crown = +5 happiness/tick, Lab Coat = +20% intelligence growth, etc.)
- **Foreground flooring**: grass carpet, tile, wood plank, sand, flowers
- **Wallpapers**: sunset, ocean, rainbow, dev grid, blueprint, etc.
- **Drag furniture** around the room — positions persist per item; pet interacts with bed/shower/PC/food-tray at their actual placed locations

<div>

  <table align="center">
  <tr>
    <td align="center"><img src="/images/clothes_instore.png" alt="clothes_instore" width="320"/></td>
    <td align="center"><img src="/images/games_instore.png"   alt="games_instore"   width="320"/></td>
    <td align="center"><img src="/images/feed.png"            alt="feed"            width="320"/></td>
  </tr>
</table>

</div>


### Tokens

Currency earned from Claude usage (5 tokens per typical turn) and game wins. Spent on shop items. Visible in the pet panel header.

---

## Games (9 total)

| Game         | Stage required | Cost              | What you get                                                                     |
| ------------ | -------------- | ----------------- | -------------------------------------------------------------------------------- |
| 20 Questions | Hatchling+     | 5🪙               | Pet picks a secret topic via Claude; you ask yes/no. Win = happiness +30, INT +5 |
| Throw Ball   | Hatchling+     | —                 | Click the ball in the room to bounce it. Boredom −15, happiness +8               |
| Tic-Tac-Toe  | Adolescent+    | 5🪙               | Local AI                                                                         |
| 2048         | Adolescent+    | Shop unlock 150🪙 | Classic                                                                          |
| Breakout     | Adolescent+    | Shop unlock 200🪙 | Brick-breaker                                                                    |
| Connect Four | Adolescent+    | Shop unlock 250🪙 | Yellow vs Red, Claude plays yellow                                               |
| Checkers     | Adolescent+    | Shop unlock 350🪙 | Standard American rules, Claude plays black                                      |
| Battleship   | Adolescent+    | Shop unlock 500🪙 | 8×8 grid, you place fleet, Claude hunts with hit/miss state machine              |
| Chess        | Adolescent+    | Shop unlock 800🪙 | Full chess via `chess.js`, Claude plays black                                    |

Per-move Claude calls are **stateless** (each move = fresh session) so chess/etc. stay fast through long games. Default per-move model is **Haiku 4.5** (configurable per-game in Settings).

Game state **persists**: close mid-game → reopen → resume exactly where you left off. ✕ closes, 🏳️ Surrender ends + clears.

---

## Slash commands

In the chat input:

| Command          | What it does                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `/pet <message>` | Routes to pet impersonation chat — reply streams into the pet's speech bubble, not the main chat thread |

---

## How it works under the hood

```
You type a message
  → Claudagotchi UI (React)
  → Electron main process (electron.js)
  → Claude Agent SDK (@anthropic-ai/claude-agent-sdk)
  → Anthropic API (via your OAuth token)
  → streamed back through the bridge
  → chat renders + Tasks panel populates + pet reacts
```

Auth is handled entirely by Claude Code's OAuth — Claudagotchi spawns the bundled `claude.exe` (from `node_modules/@anthropic-ai/claude-code/bin/`) for `claude auth login`. We never call the Anthropic API directly and we never store your credentials. The token lives in `~/.claude/credentials.json` — same place as any other Claude tool you use.

---

## Save data

```
~/.claudigotchi/
├── save.json                 ← pet, settings, tombstones, inventory, sessions metadata, panel widths
├── chats/
│   ├── chat-active.json      ← active Chat-tab thread + session id
│   ├── code-active.json      ← active Code-tab thread + session id
│   └── <claude-session-files>
├── pets/
│   └── <pet-name>/
│       └── pet-memory.md     ← persistent pet memory (plain markdown)
├── git/                      ← bundled MinGit if accepted on first launch
├── worktrees/                ← per-session git worktrees
├── always-allow.json         ← remembered tool-permission decisions per cwd
└── bridge.log                ← Claude SDK debug log
```

`save.json` is auto-saved every 30s and on every significant state change.

---

## Auto-update

NSIS installer and portable both check `github.com/kl3mta3/Claudigotchi/releases/latest` on launch via `electron-updater`. If a newer version is published:

1. Prompts the user to download.
2. Downloads in background.
3. Prompts to restart; replaces files; relaunches into the new version.

The `win-unpacked` directory build does NOT auto-update (no installer entrypoint) — those users re-download manually.

You don't touch `latest.yml` — `npm run release` uploads it automatically alongside the binaries.

---

## Repo layout

```
Claudigotchi/
├── CLAUDE.md                          ← master spec (AI-targeted)
├── README.md                          ← you are here
├── dist-electron/                     ← build output (gitignored except for committed releases)
└── app/
    ├── electron.js                    ← main process: IPC, splash, auto-updater, claude CLI, git
    ├── preload.js                     ← contextBridge → window.claudigotchi API
    ├── splash.html                    ← startup splash
    ├── package.json
    ├── BUILD.md                       ← release & signing walkthrough
    ├── .env.example                   ← documented signing env vars
    ├── cli-bridge/
    │   └── WorktreeManager.js         ← git wrappers (isGitRepo, create, status, commit, diffFile)
    ├── scripts/
    │   ├── sign.js                    ← Azure Trusted Signing hook
    │   ├── fix-wincodesign-cache.js   ← pre-extract winCodeSign (Dev Mode workaround)
    │   └── build-icon.mjs             ← SVG → ICO + PNG via sharp
    └── src/
        ├── App.jsx                    ← root layout + global state (~3000 lines)
        ├── index.jsx
        ├── auth/AuthScreen.jsx
        ├── claude-ui/                 ← chat, editor, artifact, tasks, sessions, settings
        ├── engine/                    ← pet stat / evolution / memory / intelligence / save
        ├── pet/                       ← pet rendering, environment, action bar, profile
        ├── shop/                      ← shop UI + item catalog + inventory + rarity
        ├── games/                     ← 9 mini-games
        └── dev/                       ← dev panel + sprite gallery (DEV button hidden by default)
```


---

## Tech stack

| Layer                            | Tech                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Shell                            | Electron 33                                                                                          |
| Renderer                         | React 18 + Vite 5                                                                                    |
| Editor                           | CodeMirror 6 (`@codemirror/state, view, commands, language, search, autocomplete, lint`, lang packs) |
| Theme                            | `@uiw/codemirror-theme-dracula`                                                                      |
| Formatter                        | Prettier (lazy-loaded standalone build)                                                              |
| Diff parser                      | Custom unified-diff parser + CodeMirror decorations                                                  |
| Syntax highlight (inline blocks) | highlight.js                                                                                         |
| Chess engine                     | chess.js                                                                                             |
| Claude API                       | `@anthropic-ai/claude-agent-sdk`                                                                     |
| Auth                             | bundled `@anthropic-ai/claude-code` CLI via `claude auth login`                                      |
| Persistence                      | JSON + Markdown via Electron `fs` (main process)                                                     |
| Packaging                        | electron-builder (NSIS + portable)                                                                   |
| Auto-update                      | electron-updater + GitHub Releases                                                                   |
| Code signing                     | Azure Trusted Signing via custom electron-builder sign hook                                          |
| Icons                            | SVG → ICO + PNG via sharp + to-ico                                                                   |

---


### Shipped (v0.1)

- Full chat UI with streaming, sub-agents, thinking blocks, plan approval, AskUserQuestion (blocking)
- CodeMirror 6 editor with autocomplete, find/replace, code folding, multi-cursor, lint gutter
- Live git diff in editor + format-on-save
- File tree explorer with delete-to-trash + reveal-in-explorer
- Per-file pop-out windows
- Git integration: status bar, commit, discard, init, per-session worktrees
- Open-terminal-here button
- Tasks panel (replaces inline work-block accordion)
- Pet: 5 body shapes × 5 ears × 5 tails × 7 markings × 5 pupils × 5 mouths × rare extras (horns/wings/freckles/heterochromia) × 1% shiny rate
- 8 mini-games, ~150 shop items, achievement system
- Auto-updater (NSIS + portable) via GitHub Releases
- Code signing via Azure Trusted Signing
- Bundled Claude CLI (no external Node required at runtime)
- MinGit auto-install prompt on first launch
- DEV tools (hidden by default, `/vedamat` to reveal)
- Sprite gallery for QA


### Roadmap

- Language server / IntelliSense
- Debugger

---

## License

Released under the [MIT License](LICENSE) — © 2026 Kenny Lasyone.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for licenses of bundled
third-party software (Electron, React, Claude Code SDK, CodeMirror, chess.js,
highlight.js, etc.).
