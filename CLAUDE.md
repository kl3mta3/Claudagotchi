# Claudigotchi
## Master Spec — Read This Entire File Before Writing Any Code

---

## What Is Claudigotchi

Claudigotchi is a **standalone desktop app** that replaces the Claude Code desktop experience entirely.
It is a full Claude Code UI — chat, streaming responses, code blocks, session management, file/folder
context, tool use display, settings — with a living Tamagotchi-style pet built natively into the interface.

It is NOT a plugin. It is NOT a companion window. It is ONE app.

The pet is a first-class citizen of the UI, not an afterthought.

---

## How It Works Under The Hood

Claudigotchi bundles or auto-installs the Claude Code CLI on first launch.
All AI calls, tool use, and streaming go through the Claude Code CLI — we never call the Anthropic API directly.
Auth is handled entirely by Claude Code's OAuth system. We just shell out to `claude login`.

```
User types message
  → Claudigotchi UI
  → claude CLI (bundled)
  → Anthropic API (Claude Code's auth)
  → streaming response back
  → Claudigotchi renders it
  → Pet reacts to the event
```

---

## First Launch Flow

1. App opens
2. Check if `claude` CLI is available (bundled or system)
3. If not installed → install silently: `npm install -g @anthropic-ai/claude-code`
4. Check if logged in: `claude --status`
5. If not logged in → show Claudigotchi welcome screen with "Sign In" button
6. "Sign In" button shells out to `claude login` → browser OAuth flow → done
7. App proceeds to main UI
8. New egg spawns if no existing pet save found

User never touches a terminal. Ever.

---

## Repo Structure

```
claudigotchi/
├── CLAUDE.md                        ← this file
├── README.md
├── app/
│   ├── package.json
│   ├── electron.js                  ← Electron main process
│   ├── preload.js                   ← IPC bridge
│   ├── vite.config.js
│   ├── cli-bridge/
│   │   ├── ClaudeBridge.js          ← spawns/manages claude CLI process
│   │   ├── StreamParser.js          ← parses claude CLI streaming output
│   │   └── SessionManager.js        ← session create/list/resume/delete
│   ├── src/
│   │   ├── App.jsx                  ← root layout, panel management
│   │   ├── index.jsx
│   │   ├── auth/
│   │   │   └── AuthScreen.jsx       ← first launch sign-in screen
│   │   ├── claude-ui/               ← the actual Claude Code UI replacement
│   │   │   ├── ChatPanel.jsx        ← message thread, streaming, code blocks
│   │   │   ├── InputBar.jsx         ← message input, slash commands, file attach
│   │   │   ├── SessionSidebar.jsx   ← session list, new session, resume
│   │   │   ├── ToolUseDisplay.jsx   ← shows tool calls (bash, read, write etc)
│   │   │   ├── CodeBlock.jsx        ← syntax highlighted code with copy button
│   │   │   └── SettingsPanel.jsx    ← model, permissions, preferences
│   │   ├── pet/
│   │   │   ├── PetPanel.jsx         ← pet container, handles dock/float/position
│   │   │   ├── PetCanvas.jsx        ← side-view SVG pet, walking, animations
│   │   │   ├── Environment.jsx      ← room/habitat the pet lives in
│   │   │   ├── ChatBubble.jsx       ← personality speech bubbles
│   │   │   ├── StatBars.jsx         ← all 8 stat bars
│   │   │   ├── TokenDisplay.jsx     ← token counter
│   │   │   ├── Tombstones.jsx       ← tombstone row, persistent
│   │   │   └── ActionBar.jsx        ← feed/play/clean/shop/games buttons
│   │   ├── engine/
│   │   │   ├── PetEngine.js         ← stat system, tick loop, death detection
│   │   │   ├── EvolutionFSM.js      ← egg→hatchling→adolescent→adult FSM
│   │   │   ├── PetGenerator.js      ← procedural SVG pet from seed
│   │   │   ├── IntelligenceEngine.js← intelligence stat, project context depth
│   │   │   ├── MemoryManager.js     ← pet-memory.md read/write/summarize
│   │   │   ├── Personalities.js     ← 8 personalities, all speech lines
│   │   │   └── SaveManager.js       ← persist to ~/.claudigotchi/
│   │   ├── shop/
│   │   │   ├── Shop.jsx             ← shop UI, tabs by category
│   │   │   ├── ShopItems.js         ← all item definitions
│   │   │   └── Inventory.js         ← player inventory state
│   │   └── games/
│   │       ├── GameManager.js       ← token cost, launch, result handling
│   │       ├── ThrowBall.jsx        ← throw ball animation game
│   │       └── TwentyQuestions.jsx  ← pet asks user questions via Claude API
│   └── public/
│       └── index.html
```

---

## Layout System

### Default Layout (pet docked inside app)
```
┌─────────────────────────────────────────────────┐
│  Title Bar (frameless, draggable)                │
├──────────────┬──────────────────────────────────┤
│              │                                   │
│   Session    │         Chat Panel                │
│   Sidebar    │    (streaming messages,           │
│              │     code blocks, tool use)        │
│              │                                   │
│              ├──────────────────────────────────┤
│              │         Input Bar                 │
├──────────────┴──────────────────────────────────┤
│  Pet Panel (docked bottom — default)             │
│  [🪦🪦] [stats] [pet walking in environment]    │
│  [feed][play][clean][shop][games][↗ pop out]     │
└─────────────────────────────────────────────────┘
```

### Pet Panel Positions (user switchable)
- **Bottom** (default) — horizontal strip across the bottom
- **Top** — horizontal strip across the top
- **Right** — vertical panel on the right side
- **Floating** — detached window, auto-snaps to edge of main window

Toggle position via a dock button in the pet panel header.
Save position preference to settings.

### Pop-Out (Floating) Mode
When user clicks the ↗ pop-out button:
- Pet panel detaches into its own `BrowserWindow`
- Auto-positions itself snapped to the right edge of the main window
- Stays on top of main window
- Has its own resize handle
- "Dock" button to snap back in

---

## CLI Bridge (ClaudeBridge.js)

This is the core of the app. Manages the claude CLI process.

```js
// Spawn claude CLI in a project directory
const proc = spawn('claude', ['--output-format', 'stream-json', '--print', message], {
  cwd: projectPath,
  env: { ...process.env },
  shell: true,
})

// Parse streaming JSON output line by line
proc.stdout.on('data', chunk => {
  StreamParser.parse(chunk, onToken, onToolUse, onDone)
})
```

### StreamParser.js
Parses claude CLI streaming output:
- `type: "text"` → append to chat, trigger pet thinking animation
- `type: "tool_use"` → show ToolUseDisplay, trigger pet working animation
- `type: "tool_result"` → update ToolUseDisplay with result
- `type: "message_stop"` → message complete, award tokens, pet reacts

### SessionManager.js
Wraps claude CLI session commands:
```js
// List sessions
exec('claude --list-sessions', ...)

// Resume session
spawn('claude', ['--resume', sessionId, ...], ...)

// New session in folder
spawn('claude', ['--cwd', folderPath, ...], ...)
```

---

## Pet System

### Life Stages

**Stage 0: Egg 🥚**
- Colored shell derived from future adult palette
- Wiggles on Claude activity
- Crack animations as evolution score builds
- Only hunger stat active

**Stage 1: Hatchling 🫧**
- Ditto-like blob, adult palette at low saturation
- Personality vibes accumulating silently
- Hunger + happiness + cleanliness active

**Stage 2: Adolescent 🐣**
- Proto-form of adult, same silhouette but rounder/softer
- Personality starts showing in speech bubbles
- User prompted to name it here
- All 8 stats active
- Basic shop unlocked

**Stage 3: Adult 🐾**
- Full form, full personality, accessories
- Full shop, housing, clothing unlocked
- Intelligence stat fully visible and growing

**Stage 4: Dead 💀**
- Tombstone added to row (permanent, never cleared)
- Mourning animation plays for 5 seconds
- New egg spawns automatically

---

## Procedural Pet Generation (PetGenerator.js)

Generate adult form first from seed. Derive all earlier stages from it.

```js
function generatePet(seed) {
  const rng = makePRNG(seed)

  // Adult form
  const adult = {
    bodyShape:    pick(['round','chunky','slim','wide'], rng),
    earType:      pick(['round','pointy','floppy','none'], rng),
    tailType:     pick(['stubby','long','curly','none'], rng),
    eyeShape:     pick(['round','almond','wide','sleepy'], rng),
    personalityKey: pick(PERSONALITY_KEYS, rng),
    primaryColor: randomHSL(rng),
    accentColor:  complementaryOrAnalogous(primaryColor, rng),
    eyeColor:     darken(complementary(primaryColor), 20),
    cheekColor:   analogous(primaryColor, -20),
  }

  // Egg — desaturated primary, accent speckles
  // Hatchling — blob shape, same palette low saturation
  // Adolescent — adult shape, softer, ears 70% size

  return { seed, egg, hatchling, adolescent, adult }
}
```

All generation deterministic from seed.
Seed stored in save data and never changes.

---

## Stat System (PetEngine.js)

All stats 0–100. Tick every 60 seconds of active session time.

| Stat          | Drops when...                                    | Rises when...                          |
|---------------|--------------------------------------------------|----------------------------------------|
| Hunger        | Time passes                                      | Fed                                    |
| Happiness     | Boredom high, health low, ignored                | Played with, snacks, tasks complete    |
| Cleanliness   | Time passes, bugs in environment                 | Showered, environment cleaned          |
| Boredom       | No Claude activity                               | Tasks running, toys, games             |
| Sleepiness    | Heavy task load                                  | Idle time, sleep item                  |
| Weight        | Overfeeding/snacks (goes up), underfed (goes down)| Balanced diet, exercise toys          |
| Health        | Lagging — drops after other stats bad 10+ ticks  | All stats healthy sustained period     |
| Intelligence  | Never drops                                      | Token usage, message complexity,       |
|               |                                                  | project depth (see below)              |

### Intelligence Stat (IntelligenceEngine.js)

Intelligence is the only stat that never drops. It grows forever.
It is NOT capped at 100 — it's a display number that grows unbounded (show as level or XP bar).

**Growth formula:**
```js
intelligenceDelta +=
  (tokensUsedThisMessage * 0.01) +           // raw token usage
  (messageComplexityScore * 0.5) +           // longer/more complex messages = more
  (projectContextDepth * 1.0) +             // same project folder = more
  (uniqueProjectsContributed * 0.3)          // variety also helps
```

**messageComplexityScore:** estimate from response length + number of tool calls + code blocks generated

**projectContextDepth:** tracked per project folder. The more sessions in the same folder, the higher the depth multiplier. Resets when switching to a new project.

Show intelligence as: INT: 247 (not a bar, a growing number)

---

## Pet Memory System (MemoryManager.js)

Each pet has a memory file at:
`~/.claudigotchi/pets/[pet-name]/pet-memory.md`

### What gets written to memory:
- Project names the user works on ("user often works on a project called SPHERE")
- Languages and tools observed ("user writes a lot of C#")
- User habits ("user tends to work late, sessions often start after 9pm")
- Notable moments ("evolved to adult on 2026-05-20", "first time user fed me sushi")
- Pet's own milestones and experiences

### How memory is used:
- Injected as context when pet generates speech bubbles via Claude API
- Injected when playing 20 Questions game
- Summarized automatically when file exceeds 4000 tokens (keep last 2000, summarize rest)

### Memory update triggers:
- SessionStart — log project, time of day
- Every 10 messages — scan for notable patterns, append observations
- Shop purchases — log what user bought
- Evolution events — always logged
- Death — final entry written before tombstone

### Format:
```markdown
# [Pet Name]'s Memory

## About My Human
- Works on: SPHERE (decentralized internet), KoKoFish (TTS tool), novels
- Primary language: C#
- Tends to work late evenings
- Likes dark humor

## Our History
- Born: 2026-05-16
- Evolved to Hatchling: 2026-05-17
- Named "Glitch" on: 2026-05-19
- Evolved to Adult: 2026-05-25

## Recent Observations
- 2026-05-20: User worked on SPHERE encryption for 3 hours straight
- 2026-05-21: User seems frustrated with a bug in KoKoFish
```

---

## Token Economy

### Earning tokens
| Event                    | Tokens  | Notes                              |
|--------------------------|---------|------------------------------------|
| PreToolUse               | +1      | ×1.5 if boredom < 20              |
| PostToolUse              | +2      | ×1.5 if boredom < 20              |
| Stop (turn complete)     | +5      | ×1.5 if boredom < 20              |
| SessionStart             | +10     | Daily bonus, once per day          |
| Long message (>500 tok)  | +3 bonus|                                    |
| Evolution event          | +25     | One-time per evolution             |

### Spending tokens
- Shop items (see ShopItems.js)
- Games (see Games section)
- Actions: clean environment costs 10t

---

## Games (games/)

### Throw the Ball 🎾 (cost: 5 tokens)
- Pet runs to one side of the environment
- Ball arc animation across the screen
- Pet chases and catches it
- Boredom -25, Happiness +15
- Brief personality-flavored reaction bubble

### 20 Questions 🤔 (cost: 15 tokens)
- Pet thinks of something (Claude API picks a secret topic in character)
- User asks yes/no questions, pet answers in personality voice
- Pet tracks question count, gives hints near question 20
- Win: Happiness +30, Intelligence +5, user gets 10 tokens back
- Lose: pet teases user in character
- Full conversation stored in pet memory as "played 20 questions about [topic]"

### More games can be added as Phase 7+ content.

---

## Shop Items (ShopItems.js)

### Food
| Item          | Cost | Hunger | Weight | Health | Happiness | Food Quality |
|---------------|------|--------|--------|--------|-----------|--------------|
| Kibble        | 5    | +20    | 0      | 0      | 0         | 0.4          |
| Salad         | 15   | +25    | -5     | +10    | 0         | 0.9          |
| Pizza Slice   | 8    | +20    | +8     | -5     | +15       | 0.2          |
| Power Bar     | 20   | +30    | 0      | +10    | +5        | 0.8          |
| Mystery Snack | 3    | +10    | +5     | -2     | +20       | 0.1          |
| Fresh Fish    | 25   | +35    | -5     | +15    | +10       | 1.0          |
| Sushi Platter | 40   | +40    | -8     | +20    | +25       | 1.0          |
| Energy Drink  | 12   | 0      | 0      | 0      | +10       | 0.0          |

### Toys
| Item          | Cost | Boredom | Happiness | Intel | Evo  |
|---------------|------|---------|-----------|-------|------|
| Rubber Ball   | 10   | -20     | +10       | 0     | +5   |
| Laser Pointer | 15   | -30     | +20       | 0     | +8   |
| Puzzle Box    | 25   | -40     | +15       | +2    | +12  |
| Code Plushie  | 30   | -35     | +25       | 0     | +15  |
| Chess Set     | 35   | -45     | +20       | +5    | +18  |

### Consumables
| Item          | Cost | Effect                                    |
|---------------|------|-------------------------------------------|
| Shampoo       | 8    | Cleanliness +40                           |
| Bug Spray     | 10   | Clear all env bugs, Cleanliness +10       |
| Vitamins      | 20   | Health +20                                |
| Catnip        | 15   | Happiness +40, chaos mode 30s             |
| Sleep Aid     | 15   | Sleepiness -30                            |

### Housing (Adult unlock)
| Item              | Cost | Effect                              |
|-------------------|------|-------------------------------------|
| Forest Wallpaper  | 50   | Cosmetic                            |
| Space Wallpaper   | 75   | Cosmetic                            |
| Cozy Cabin        | 100  | Cosmetic                            |
| Fancy Bed         | 80   | Sleepiness tick rate -0.5           |
| Aquarium          | 120  | Happiness +1 per tick               |
| Second Monitor    | 150  | Boredom -2 per tick                 |
| Bookshelf         | 90   | Intelligence growth +10%            |
| Whiteboard        | 110  | Intelligence growth +15%            |

### Clothing (Adult unlock)
| Item        | Cost | Slot  | Passive                    |
|-------------|------|-------|----------------------------|
| Top Hat     | 30   | hat   | cosmetic                   |
| Dev Hoodie  | 40   | body  | cosmetic                   |
| Sunglasses  | 25   | eyes  | cosmetic                   |
| Crown       | 100  | hat   | Happiness +5 always        |
| Scarf       | 35   | neck  | cosmetic                   |
| Cape        | 60   | back  | Evo score +5% per tick     |
| Lab Coat    | 80   | body  | Intelligence growth +20%   |
| Wizard Hat  | 120  | hat   | Intelligence growth +25%   |

---

## Evolution System (EvolutionFSM.js)

Hidden score. Randomized thresholds. Never predictable.

```js
evolutionScore += (
  (foodQuality    * 0.30) +
  (ageTicks       * 0.20) +
  (toysUsed       * 0.25) +
  (happinessAvg   * 0.15) +
  (cleanlinessAvg * 0.10) +
  (randomNoise())           // ±5% each tick
)

// Thresholds randomized on pet creation:
// Egg → Hatchling:    80–140
// Hatchling → Adol:   200–320
// Adol → Adult:       400–600
```

Player never sees thresholds. Progress bar fills but has no numbers.

---

## Pet Walking & Environment (PetCanvas.jsx, Environment.jsx)

### Environment (side-view 2D room)
Layered SVG panels:
1. Back wall (wallpaper — changes with housing)
2. Floor (changes with housing)
3. Furniture (placed from inventory)
4. Bug/trash icons (from error events — "code bugs")
5. Pet sprite (walks in front of furniture)

### Walking behavior
- Pet picks a random X target, walks to it
- At target: idle animation, random quip chance, pick new target after delay
- Faces left when walking left (CSS scaleX(-1))
- Personality walk speeds and styles:
  - Peppy: fast, bouncy
  - Grumpy: slow stomp
  - Lazy: very slow drag
  - Emo: slow float
  - Nerdy: purposeful march
  - Snarky: casual saunter
  - Zen: gentle glide
  - Dramatic: theatrical stride

### Code bugs in environment
Every PostToolUse with error indicators spawns a 🐛 icon in the environment.
Bugs accumulate, decay cleanliness over time.
Bug Spray or Clean action removes all bugs.

---

## Personalities (Personalities.js)

8 personalities. Each has:
- `label`, `emoji`, `font`, `colors`
- `walkSpeed`, `walkStyle`
- `greeting(name)` — first greeting after naming
- `idleQuips[]` — random flavor lines while walking
- `hungryQuip`, `boredQuip`, `sleepyQuip`, `dirtyQuip`
- `taskDoneQuip` — reacts to Claude finishing a task
- `levelUpQuip` — evolution
- `deathWarningQuip` — health critical
- `namingPrompt` — shown during naming screen
- `gameWinQuip`, `gameLoseQuip` — for 20 questions

All personalities are fully helpful. None reduce productivity.
Personality only affects flavor, tone, and cosmetic choices.

---

## Death System

Pet dies if:
- Health = 0 for 5+ consecutive ticks, OR
- Hunger = 0 for 15+ consecutive ticks

### Warning system
- Health ≤ 15: warning bubble, pet looks distressed, red glow on stat bar
- Hunger ≤ 10: warning bubble

### On death
1. Death animation plays
2. Tombstone created and added to row
3. Tombstone data: name, personality, born, died, cause, stage reached, intelligence level
4. Final entry written to pet-memory.md
5. 5 second mourning pause
6. New egg spawns

### Tombstone row
- Fixed strip at top of pet panel (all positions)
- Horizontal scroll if many tombstones
- Hover tooltip shows tombstone details
- Never cleared, persists across all pets forever

---

## Claude Code UI (claude-ui/)

### ChatPanel.jsx
- Renders message thread
- Streams tokens as they arrive from CLI bridge
- Code blocks with syntax highlight + copy button
- Tool use blocks (collapsible, shows tool name + input + result)
- Scroll to bottom on new message
- Typing indicator while streaming

### InputBar.jsx
- Multiline textarea
- Enter to send, Shift+Enter for newline
- Slash command support (/clear, /model, etc passed through to CLI)
- File attach button (opens Electron file dialog, injects as context)
- Folder context indicator (shows current project folder)

### SessionSidebar.jsx
- List of sessions (from claude --list-sessions)
- New session button
- Resume session on click
- Delete session
- Session search/filter
- Add folder button (opens directory picker, sets --cwd for new sessions)

### ToolUseDisplay.jsx
- Shows when Claude runs bash, reads/writes files, etc
- Collapsible
- Color coded by tool type
- Shows input and result

### SettingsPanel.jsx
- Model selector
- Permission settings
- Pet panel position toggle (bottom/top/right/float)
- Theme (dark/light)
- Always on top toggle (for float mode)

---

## Save Data

All data lives at: `~/.claudigotchi/`

```
~/.claudigotchi/
├── save.json                    ← current pet state, tombstones, settings
├── pets/
│   └── [pet-name]/
│       └── pet-memory.md        ← pet's persistent memory
└── bridge.log                   ← CLI bridge error log
```

### save.json structure
```json
{
  "version": 1,
  "settings": {
    "petPosition": "bottom",
    "theme": "dark",
    "alwaysOnTop": false
  },
  "currentPet": {
    "seed": 123456,
    "name": "Glitch",
    "stage": 3,
    "personalityKey": "snarky",
    "appearance": { ... },
    "stats": {
      "hunger": 72, "happiness": 55, "cleanliness": 80,
      "boredom": 30, "sleepiness": 20, "weight": 50, "health": 88
    },
    "intelligence": 247,
    "evolutionScore": 0,
    "evolutionThresholds": { "0": 112, "1": 267, "2": 534 },
    "tokens": 340,
    "born": "2026-05-16T14:22:00Z",
    "inventory": [],
    "housing": "default",
    "clothing": [],
    "projectDepthMap": { "/home/kenny/SPHERE": 14, "/home/kenny/KoKoFish": 7 },
    "totalTokensEarned": 1240,
    "lastSessionDate": "2026-05-16"
  },
  "tombstones": [
    {
      "name": "Blip", "personality": "peppy",
      "born": "2026-05-01T10:00:00Z", "died": "2026-05-09T22:14:00Z",
      "cause": "starvation", "stage": 1, "intelligence": 12
    }
  ]
}
```

---

## Tech Stack

| Layer              | Tech                                        |
|--------------------|---------------------------------------------|
| Shell              | Electron 33+                                |
| Renderer           | React 18 + Vite                             |
| Styling            | CSS Modules + CSS custom properties         |
| Pet graphics       | Inline SVG, procedurally colored            |
| Animation          | CSS keyframes + requestAnimationFrame       |
| CLI integration    | Node child_process (spawn)                  |
| Stream parsing     | Line-by-line JSON from claude --stream-json |
| Persistence        | JSON + Markdown via Electron fs (main proc) |
| Syntax highlight   | highlight.js or shiki                       |
| Auth               | claude login (shelled out)                  |

---

## Build & Run

```bash
cd app
npm install
npm run dev       # Electron + Vite hot reload

npm run build     # Production build
```

---

## Implementation Phases

### Phase 1 — Shell & Auth
- [ ] Electron window, frameless, custom title bar
- [ ] Vite + React renderer
- [ ] Auth screen with Sign In button → shells out to claude login
- [ ] Check auth status on launch
- [ ] Main layout scaffold (sidebar + chat + pet panel bottom)

### Phase 2 — CLI Bridge
- [ ] ClaudeBridge.js — spawn claude CLI, send messages
- [ ] StreamParser.js — parse streaming output tokens
- [ ] SessionManager.js — list/create/resume/delete sessions
- [ ] Basic chat renders in ChatPanel

### Phase 3 — Full Claude UI
- [ ] Streaming renders correctly (tokens appear live)
- [ ] Code blocks with syntax highlight
- [ ] ToolUseDisplay for bash/file operations
- [ ] InputBar with file attach + slash commands
- [ ] SessionSidebar functional
- [ ] SettingsPanel

### Phase 4 — Pet Engine
- [ ] PetGenerator.js — procedural SVG pet from seed
- [ ] PetEngine.js — all 8 stats, tick system
- [ ] EvolutionFSM.js — 4 stages, randomized thresholds
- [ ] IntelligenceEngine.js — growing INT stat
- [ ] SaveManager.js — persist/restore
- [ ] Wire CLI events to pet reactions

### Phase 5 — Pet Rendering
- [ ] PetCanvas.jsx — side-view SVG pet, all life stages
- [ ] Environment.jsx — room, wallpaper, furniture, bugs
- [ ] Walking logic — random target, personality speed, direction flip
- [ ] Animations — idle float, walk, happy bounce, thinking wobble, shower shake
- [ ] ChatBubble.jsx — speech bubbles, personality flavored
- [ ] Tombstone row

### Phase 6 — Pet Memory
- [ ] MemoryManager.js — read/write pet-memory.md
- [ ] SessionStart hook → log project, time
- [ ] Periodic observation logging
- [ ] Memory injection into speech bubble generation
- [ ] Auto-summarize when memory exceeds limit

### Phase 7 — Shop & Games
- [ ] Shop.jsx — full item catalog, tabs, token display
- [ ] All item effects wired to PetEngine
- [ ] ThrowBall.jsx — animation game
- [ ] TwentyQuestions.jsx — Claude API game in character
- [ ] GameManager.js — cost, launch, result

### Phase 8 — Pet Panel Flexibility
- [ ] Bottom/top/right dock toggle
- [ ] Pop-out floating window
- [ ] Auto-snap to main window edge
- [ ] Position saved to settings

### Phase 9 — Polish
- [ ] Housing applied to environment rendering
- [ ] Clothing rendered on SVG pet
- [ ] Death animation + mourning sequence
- [ ] Tray icon with pet emoji
- [ ] Installer / auto-update

---

## Notes for Claude Code

- Read this entire file before writing any code
- Build phases in order — do not skip ahead
- The CLI bridge is the heart of the app — get it solid in Phase 2 before building UI on top
- Pet graphics are all inline SVG — no image files
- Never hardcode thresholds — always read from save data
- Intelligence never decreases, is not capped at 100
- Memory file is markdown, written by the app, read by Claude API calls for context
- When in doubt about a design decision, refer to this file
- Save file lives at ~/.claudigotchi/save.json — never delete during dev, use a reset flag instead
- Test each phase independently before moving to the next
