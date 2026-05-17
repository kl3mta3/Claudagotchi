# Claudigotchi

A desktop Claude Code UI with a Tamagotchi-style pet living inside it.

Claudigotchi is a standalone Electron + React app that replaces the Claude Code desktop experience entirely — full chat, streaming responses, code blocks, tool-use display, sessions, files, settings — and adds a procedurally generated pet that grows, reacts, evolves, and occasionally dies in response to how you use Claude. The pet is a first-class citizen of the UI, not a sidebar gimmick.

> Screenshots go here. (Pull requests welcome.)

---

## What it does

- A full Claude Code chat UI: streaming tokens, syntax-highlighted code blocks, collapsible tool-use blocks, sub-agent traces, extended thinking output, image attachments.
- Session sidebar — list, resume, and delete past Claude sessions per project folder.
- Permission prompts for tool calls, with allow-once / always-allow / deny.
- Plan mode review, AskUserQuestion modals, and a three-pane artifact panel for plans and file edits.
- A pet that reacts to Claude activity in real time — animates while tools run, gets bored when you're idle, earns intelligence the more you work.
- 8 personalities, 4 life stages (egg → hatchling → adolescent → adult), procedural SVG appearance, full death + tombstone system.
- Shop with 150+ items: food, toys, consumables, housing, clothing, decorations.
- Nine mini-games including chess, checkers, 2048, breakout, battleship, and "20 Questions" played against Claude itself.
- Persistent per-pet memory (markdown file) that's injected as context when the pet "talks."
- Token economy that ties Claude usage to in-game currency.

---

## How it works

```
You type a message
  → Claudigotchi UI (React)
  → Electron main process
  → Claude Agent SDK / claude CLI
  → Anthropic API
  → streamed back through the bridge
  → chat renders + pet reacts
```

Auth is handled entirely by Claude Code's OAuth — Claudigotchi shells out to `claude login` on first run. We never call the Anthropic API directly and we never store your credentials.

---

## Install & run

**Prerequisites:** Node 18+, npm, git.

```bash
git clone <this-repo>
cd Claudigotchi/app
npm install
npm run dev        # Electron + Vite hot reload
```

Other scripts:

```bash
npm run build      # production build via electron-builder
npm run preview    # preview the built bundle
```

**First launch:**
1. Splash screen checks for the `claude` CLI. If missing, it silently installs `@anthropic-ai/claude-code` globally.
2. Checks auth status. If you're not logged in, the welcome screen shows a **Sign In** button that runs `claude login` for you (browser-based OAuth — no terminal required).
3. App opens. If no save exists, a new egg spawns.

---

## Repo layout

```
Claudigotchi/
├── CLAUDE.md                    ← master spec (AI-targeted, read for full design intent)
├── README.md                    ← you are here
└── app/
    ├── electron.js              ← Electron main process
    ├── preload.js               ← contextBridge → window.claudigotchi API
    ├── splash.html              ← startup splash
    ├── vite.config.js
    ├── package.json
    ├── cli-bridge/              ← talks to the Claude SDK / CLI
    ├── public/                  ← static assets
    ├── scripts/                 ← build helpers (icon generation, etc.)
    └── src/
        ├── App.jsx              ← root layout + global state
        ├── index.jsx
        ├── auth/                ← first-launch sign-in
        ├── claude-ui/           ← chat panel, input bar, settings, etc.
        ├── engine/              ← pet stat / evolution / memory engines
        ├── pet/                 ← pet rendering, environment, action bar
        ├── shop/                ← shop UI + item catalog
        ├── games/               ← mini-games
        └── dev/                 ← developer/debug tooling
```

---

## Save data

Everything Claudigotchi persists lives under `~/.claudigotchi/`:

```
~/.claudigotchi/
├── save.json                    ← current pet, tombstones, settings, inventory
├── pets/
│   └── <pet-name>/
│       └── pet-memory.md        ← pet's persistent memory (markdown)
└── bridge.log                   ← CLI bridge error log
```

`save.json` is versioned and auto-saved every 30 seconds. Tombstones for dead pets are kept forever. The pet's memory file is plain markdown — you can open it in any editor.

---

## Function index

This is the developer tour. Every file gets a short summary; key exports/components are listed under each.

### `app/electron.js` — Electron main process

The heart of the app on the OS side. Manages all windows, IPC, the Agent SDK process, rate limiting, permission gating, session storage, and git worktree isolation.

- `createMainWindow()` — frameless main app window.
- `createSplashWindow()` — startup splash shown during auth/install checks.
- `createPetWindow()` — detached floating pet window.
- `createArtifactWindow()` — detached artifact (plan/files) window.
- `createFileWindow(path, mode)` — detached file editor window.
- `checkClaudeCLI()` / `installClaudeCLI()` — detect or `npm install -g` the Claude Code CLI.
- `checkClaudeAuth()` / `runClaudeLogin()` — auth status check and OAuth login launcher.
- `loadSdk()` / `claudeBinaryPath()` — lazy-load the `@anthropic-ai/claude-agent-sdk` and resolve the bundled CLI binary.
- `askRendererForPermission(toolName, input)` — prompt the user via the renderer before a tool call runs; backs the `canUseTool` callback.
- Registers ~50 IPC handlers: clipboard, file I/O, git operations, Claude queries, session list/read/delete, window controls, usage/rate-limit broadcast.

### `app/preload.js` — `window.claudigotchi` bridge

Exposes a typed API to the renderer via `contextBridge`. Grouped roughly:

- **Auth:** `checkCLI()`, `installCLI()`, `checkAuth()`, `claudeLogin()`.
- **Claude SDK:** `claudeSend()`, `claudeSessions()`, `claudeAbort()`.
- **Permissions:** `onToolPermissionRequest()`, `toolPermissionDecision()`, `clearAlwaysAllow()`.
- **Worktree / git:** `gitCheckRepo()`, `worktreeCreate()`, `worktreeRemove()`, `worktreeList()`, `gitStatus()`, `gitCommitAll()`, `gitDiscardAll()`, `gitInit()`.
- **Artifact windows:** `isArtifactWindow()`, `artifactPopOut()`, `broadcastArtifactState()`, `sendArtifactAction()`.
- **File windows:** `isFileWindow()`, `fileWindowPath()`, `fileWindowMode()`, `filePopOut()`, `revealInExplorer()`, `deleteFile()`.
- **File I/O:** `listDir()`, `readFileText()`, `writeFileText()`, `readFile()`, `readImageDataUrl()`, `saveTempImage()`.
- **Pet state sync:** `broadcastPetState()`, `sendPetAction()`, `onPetState()`, `onPetAction()`.
- **Persistence:** `saveData()`, `loadData()`, `saveMemory()`, `loadMemory()`, `saveActiveChat()`, `loadActiveChat()`.
- **Window controls:** `minimize()`, `maximize()`, `close()`, `quitApp()`, `petPopOut()`, `petDockIn()`.
- **Usage:** `getUsage()`, `resetSessionUsage()`, `setBlockOverage()`, `setLimitCaps()`.

### `app/cli-bridge/`

Renderer-side glue between React and the Agent SDK stream.

- **`ClaudeBridge.js`** — wraps the SDK stream in callbacks. `new ClaudeBridge({ onToken, onToolUse, onToolResult, onDone, onError })`, then `_handleStreamEvent()` dispatches incoming events.
- **`SessionManager.js`** — higher-level session orchestration. `refresh(cwd)`, `setActive({ sessionId, cwd })`, `send({ message, cwd, sessionId })`, `resume({ sessionId, cwd })`, `newSession({ cwd })`.
- **`StreamParser.js`** — pure functions for parsing Anthropic stream-json. `parseLine()`, `parseChunk()`, `dispatch()`.
- **`WorktreeManager.js`** — git worktree utilities so each session can be isolated on its own branch. `isGitRepo()`, `repoRoot()`, `create()`, `remove()`, `list()`, `status()`, `commitAll()`, `discardAll()`, `init()`.

### `app/src/auth/`

- **`AuthScreen.jsx`** — first-run gate. Checks for the CLI, prompts for install if missing, then prompts for `claude login` if not authed. Shows progress + errors and calls back when ready.

### `app/src/claude-ui/` — the chat UI

- **`ChatPanel.jsx`** — the message thread. Renders user/assistant turns, code blocks, tool-use blocks, tool results, thinking blocks, sub-agent runs, and inline images. Streams tokens as they arrive. Auto-scrolls.
- **`InputBar.jsx`** — message composer. Auto-expanding textarea, file/image attach, model picker (Opus / Sonnet / Haiku / legacy), permission-mode picker (Ask / Auto / Plan / YOLO), effort picker, fast-mode toggle, folder picker for "code mode," and the `/pet` slash command for talking to your pet.
- **`SessionSidebar.jsx`** — left sidebar listing saved sessions for the current folder. Resume, delete, search.
- **`SettingsPanel.jsx`** — model, permission mode, effort, token caps, overage blocking, clear always-allow cache.
- **`ArtifactPanel.jsx`** — companion panel with Plan and Files tabs; pop-out and dock controls.
- **`PlanView.jsx`** — modal for reviewing and approving multi-step plans from `ExitPlanMode`.
- **`QuestionCard.jsx`** — modal for `AskUserQuestion` tool calls.
- **`PermissionPrompt.jsx`** — modal for tool permission requests (allow once / always / deny).
- **`ToolUseDisplay.jsx`** — collapsible block showing a tool call's name, input, and result.
- **`ThinkingBlock.jsx`** — collapsible extended-thinking output.
- **`SubAgentBlock.jsx`** — nested display for `Task` tool runs.
- **`CodeBlock.jsx`** — syntax-highlighted code via highlight.js with a copy button.
- **`CodeMirrorEditor.jsx`** — CodeMirror 6 editor used inside file views.
- **`ArtifactFileView.jsx`** — file preview/edit inside the artifact panel.
- **`FloatArtifactView.jsx`** / **`FloatFileView.jsx`** — floating-window containers that mirror the docked views.
- **`ImagePreview.jsx`** — inline display for pasted/uploaded screenshots.
- **`TabSwitcher.jsx`** — toggle between Code and Chat modes.
- **`TabStrip.jsx`** — multi-file tab management in the artifact panel.
- **`GitStatusBar.jsx`** — branch + dirty/clean indicator.

### `app/src/engine/` — the pet brain

- **`PetEngine.js`** — the stat simulation. Tick loop (1/min of active session time), decay rates, `applyItem()` for consumables, `getDeath()` for death detection. Holds the 7 capped stats (hunger, happiness, cleanliness, boredom, sleepiness, weight, health).
- **`EvolutionFSM.js`** — life-stage state machine. `STAGES` enum, `generateThresholds(rng)` to randomize per-pet evolution gates, `onTurnComplete()` to accumulate score. Triggers stage transitions.
- **`IntelligenceEngine.js`** — the one stat that never decays and isn't capped. Grows from token usage, response length, tool-call count, and project depth (more sessions in the same folder = bigger bonus).
- **`MemoryManager.js`** — read/write `pet-memory.md`. `load()`, `save()`, `addObservation(text)`, `getSummary()`. Auto-summarizes when the file grows past ~8000 chars.
- **`SaveManager.js`** — `load()` and `save(petState, tombstones, meta)` to `~/.claudigotchi/save.json`. Auto-save every 30 seconds.
- **`PetGenerator.js`** — deterministic appearance from a seed. `makePRNG(seed)` (mulberry32), `generatePet(seed)`, `eggForm()` / `hatchlingForm()` / `adolescentForm()` to derive earlier stages from the adult form, `randomSeed()`.
- **`Personalities.js`** — 8 personalities (peppy, grumpy, lazy, emo, nerdy, snarky, zen, dramatic). Each one defines its font, palette accents, walk speed/style, greeting, idle quips, situational quips (hungry/bored/sleepy/dirty), task-done quip, level-up quip, death-warning quip, and naming prompt.
- **`PetVoice.js`** — system-prompt builders. `buildMainChatAddendum(state)` adds a short personality tag to Claude's main chat replies; `buildPetImpersonation(state)` is the full prompt that makes Claude speak as the pet for `/pet` chats.
- **`AchievementEngine.js`** — `ACHIEVEMENTS` catalog and `checkAll(state)` to flag any that were just unlocked (tokens earned, consecutive active days, longest session, stages reached, etc.).

### `app/src/pet/` — pet rendering

- **`PetPanel.jsx`** — the dockable container. Renders the canvas, stat bars, token display, tombstone row, action bar, environment, and (in adult stage) pet profile. Supports bottom / top / right / floating positions.
- **`PetCanvas.jsx`** — the SVG pet itself. Side-view rendering of body, ears, tail, eyes, and equipped clothing. Walking AI that picks targets, flips direction, anchors feet to the floor band, and reacts to interactables (bed, shower, food tray, PC). Plays mood animations (idle, happy, sad, eating, napping, etc.) and shows chat bubbles.
- **`Environment.jsx`** — the room behind the pet. Layered wallpapers, foregrounds, draggable furniture (bed, shower, PC, food bowl, trash), bouncing toys, and `🐛` icons for code bugs.
- **`ChatBubble.jsx`** — speech bubble with personality-flavored styling.
- **`StatBars.jsx`** — visual gauges for the 7 capped stats.
- **`TokenDisplay.jsx`** — current token balance with earn/spend feedback.
- **`Tombstones.jsx`** — the persistent memorial row at the top of the pet panel. Hover for details.
- **`ActionBar.jsx`** — Feed / Clean / Pick-up toggle / Nap-Wake / Shop / Games buttons.
- **`PetProfile.jsx`** — adult-stage summary panel: name, stage, personality, appearance description, editable biography/quirks/catchphrase, evolution progress.
- **`PetChat.jsx`** — talk-to-your-pet UI, invoked via `/pet`.
- **`FloatPetView.jsx`** — floating-window container that mirrors the docked pet panel.

### `app/src/shop/`

- **`Shop.jsx`** — shop UI with category tabs, item grid, rarity-colored borders, buy/equip/unequip actions, and achievement gating.
- **`ShopItems.js`** — catalog of 150+ items. Categories: food, snacks, toys, consumables, housing, foreground, decorations, instruments, clothing, game unlocks. Each item carries id, name, emoji, description, cost, rarity, stage requirement, and stat effects.
- **`Inventory.js`** — inventory state. Consumables stack as counts; clothing tracks which slot is equipped per stage (egg has none, hatchling has head-only, adolescent and adult get all 4 slots). `equipItem()`, `unequipItem()`, `consumeItem()`, stage-gating logic.
- **`Rarity.js`** — tier definitions: common (gray), rare (blue), epic (purple), legendary (gold). Validates cost ranges per tier.

### `app/src/games/`

- **`GameManager.js`** — game registry. `GAMES` lists each one with its token cost, stat effects, evolution bonus, and required stage.
- **`GamesMenu.jsx`** — the launcher, filtered by stage and unlock status.
- **`ThrowBall.jsx`** — interactive ball toss. Boredom −25, Happiness +15.
- **`TwentyQuestions.jsx`** — Claude picks a secret topic in character; you ask yes/no questions. Win = Happiness +30, Intelligence +5, half-refund. Loss = the pet teases you. The whole game is saved to pet memory.
- **`Game2048.jsx`** — classic 2048.
- **`GameBreakout.jsx`** — brick-breaker arcade.
- **`GameChess.jsx`** — full chess powered by `chess.js`.
- **`GameCheckers.jsx`** — checkers vs. AI.
- **`GameBattleship.jsx`** — naval combat.
- **`GameConnectFour.jsx`** — Connect Four vs. AI.
- **`GameTicTacToe.jsx`** — tic-tac-toe.

### `app/src/dev/`

- **`DevPanel.jsx`** — developer-only tooling, toggled by the DEV button. Force stage transitions, spawn a new pet, tune decay rates and token costs, view evolution thresholds, add tokens, wipe save.

### `app/src/App.jsx` & `index.jsx`

- **`App.jsx`** — root component. Gates on `AuthScreen`, picks the right layout for main vs. pet vs. artifact vs. file windows, owns all top-level state (pet, stats, intelligence, tokens, inventory, active chat, settings), runs the 60-second engine tick, drives chat streaming and tool-call handling, mirrors pet state out to floating windows, and calls `SaveManager`.
- **`index.jsx`** — React entry point.

---

## Tech stack

| Layer            | Tech                                          |
|------------------|-----------------------------------------------|
| Shell            | Electron 33+                                  |
| Renderer         | React 18 + Vite                               |
| Editor           | CodeMirror 6 (`@codemirror/*`)                |
| Syntax highlight | highlight.js                                  |
| Chess engine     | chess.js                                      |
| Claude API       | `@anthropic-ai/claude-agent-sdk` + Claude CLI |
| Persistence      | JSON + Markdown via Electron `fs` (main proc) |
| Auth             | `claude login` (shelled out)                  |
| Packaging        | electron-builder                              |

---

## License

MIT
