/**
 * App.jsx
 * Root layout. Handles auth gate, pet panel positioning, chat thread,
 * and top-level state. Renders either the full app or just the pet panel
 * (when ?petWindow=true).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AuthScreen }     from './auth/AuthScreen.jsx';
import { PetEngine, DEFAULT_STATS } from './engine/PetEngine.js';
import { EvolutionFSM, STAGES }     from './engine/EvolutionFSM.js';
import { IntelligenceEngine }       from './engine/IntelligenceEngine.js';
import { MemoryManager }            from './engine/MemoryManager.js';
import { SaveManager }              from './engine/SaveManager.js';
import { generatePet, randomSeed }  from './engine/PetGenerator.js';
import { GameManager }              from './games/GameManager.js';
import { Inventory }                from './shop/Inventory.js';

import { ChatPanel }      from './claude-ui/ChatPanel.jsx';
import { InputBar }       from './claude-ui/InputBar.jsx';
import { SessionSidebar } from './claude-ui/SessionSidebar.jsx';
import { SettingsPanel }  from './claude-ui/SettingsPanel.jsx';
import { TabSwitcher }    from './claude-ui/TabSwitcher.jsx';
import { ArtifactPanel }  from './claude-ui/ArtifactPanel.jsx';
import { ResizeHandle }   from './claude-ui/ResizeHandle.jsx';

import { PetPanel }       from './pet/PetPanel.jsx';
import { PetProfile }     from './pet/PetProfile.jsx';
import { FloatPetView }   from './pet/FloatPetView.jsx';
import { Shop }           from './shop/Shop.jsx';
import { ThrowBall }      from './games/ThrowBall.jsx';
import { TwentyQuestions} from './games/TwentyQuestions.jsx';
import { Game2048 }       from './games/Game2048.jsx';
import { GameBreakout }   from './games/GameBreakout.jsx';
import { GameChess }      from './games/GameChess.jsx';
import { GamesMenu }      from './games/GamesMenu.jsx';
import { SHOP_ITEMS, ITEM_CATEGORIES, getItemById } from './shop/ShopItems.js';
import { checkAll, getAchievement } from './engine/AchievementEngine.js';
import { buildMainChatAddendum }    from './engine/PetVoice.js';
import { PERSONALITIES }            from './engine/Personalities.js';
import { DevPanel }                 from './dev/DevPanel.jsx';
import { getFurnitureXPct, getFurnitureYPct } from './pet/Environment.jsx';

const TICK_MS = 60_000;
const OBSERVE_EVERY = 10; // messages

const STAGE_NAMES = ['Egg', 'Hatchling', 'Adolescent', 'Adult', 'Dead'];

export default function App() {
  const isPetWindow = window.claudigotchi?.isPetWindow?.() ?? false;

  // The floating pet window is a thin mirror — no engines, no chat.
  if (isPetWindow) return <FloatPetView />;

  // ── App state ─────────────────────────────────────────────────────────────
  const [authed,        setAuthed]        = useState(false);
  const [loaded,        setLoaded]        = useState(false);
  const [petPos,        setPetPos]        = useState('bottom');
  const [theme,         setTheme]         = useState('dark');
  const [alwaysOnTop,   setAlwaysOnTop]   = useState(false);
  const [blockOverage,  setBlockOverage]  = useState(false);
  const [usage,         setUsage]         = useState(null); // { rateLimit, session, blockOverage }
  const [mode,          setMode]          = useState('code'); // 'chat' | 'code'
  const [model,         setModel]         = useState('claude-opus-4-7');
  const [permissionMode,setPermissionMode]= useState('default');
  const [effort,        setEffort]        = useState('medium');
  const [fastMode,      setFastMode]      = useState(false);
  const [hiddenSessions,setHiddenSessions]= useState([]);

  // Artifact panel state — auto-opens on first plan / Write / Edit per turn
  const [artifact,        setArtifact]        = useState(null);
  const [artifactHistory, setArtifactHistory] = useState([]);
  const [artifactOpen,    setArtifactOpen]    = useState(false);
  const userDismissedArtifactRef = useRef(false);

  const [petAppearance, setPetAppearance] = useState(null);
  const [petName,       setPetName]       = useState('');
  const [engineState,   setEngineState]   = useState(null);
  const [evoState,      setEvoState]      = useState(null);
  const [intelState,    setIntelState]    = useState({ intelligence: 0 });
  const [tombstones,    setTombstones]    = useState([]);
  const [inventoryItems,setInventoryItems]= useState([]);
  const [housing,       setHousing]       = useState('default');
  const [foreground,    setForeground]    = useState(null);
  const [pickupMode,    setPickupMode]    = useState(false);
  const [sidebarWidth,  setSidebarWidth]  = useState(220);
  const [artifactWidth, setArtifactWidth] = useState(460);
  const [petRightWidth, setPetRightWidth] = useState(360);
  const [clothing,      setClothing]      = useState([]);
  const [bugs,          setBugs]          = useState(0);

  const [mood,          setMood]          = useState('idle');
  const [speech,        setSpeech]        = useState(null);
  const [namingMode,    setNamingMode]    = useState(false);

  const [currentFolder, setCurrentFolder] = useState(null);
  const [currentSession,setCurrentSession]= useState(null);
  const [messages,      setMessages]      = useState([]);
  const [streaming,     setStreaming]     = useState(false);

  // Modals
  const [showShop,      setShowShop]      = useState(false);
  const [showThrowBall, setShowThrowBall] = useState(false);
  const [showTQ,        setShowTQ]        = useState(false);
  const [showGamesMenu, setShowGamesMenu] = useState(false);
  const [show2048,      setShow2048]      = useState(false);
  const [showBreakout,  setShowBreakout]  = useState(false);
  const [showChess,     setShowChess]     = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [showDev,       setShowDev]       = useState(false);
  const [tuning,        setTuning]        = useState({ tokenMultiplier: 1 });
  const [furniturePositions, setFurniturePositions] = useState({});  // { itemId: { xPct, yPct } }
  const [showProfile,   setShowProfile]   = useState(false);
  const [profileFirstReveal, setProfileFirstReveal] = useState(false);

  // Phase 8: achievements, unlocks, interactive furniture & cosmetics
  const [unlockedAchievements, setUnlockedAchievements] = useState([]);
  const [unlockedGames,        setUnlockedGames]        = useState([]);
  const [totalTokensEarned,    setTotalTokensEarned]    = useState(0);
  const [lastActiveDates,      setLastActiveDates]      = useState([]);
  const [longestSessionMinutes,setLongestSessionMinutes]= useState(0);
  const [totalTurns,           setTotalTurns]           = useState(0);
  const [hasReachedAdult,      setHasReachedAdult]      = useState(false);
  const [petBio,               setPetBio]               = useState('');
  const [petQuirks,            setPetQuirks]            = useState([]);
  const [petCatchphrase,       setPetCatchphrase]       = useState('');
  const [petBorn,              setPetBorn]              = useState(null);
  const [interactionTarget,    setInteractionTarget]    = useState(null);
  const [fedItemEmoji,         setFedItemEmoji]         = useState(null);
  const [showerActive,         setShowerActive]         = useState(false);

  const bioRequestIdRef = useRef(null);
  const sessionStartTimeRef = useRef(null);
  const lastTokensRef = useRef(0);

  // ── Refs (engines + non-rendered helpers) ────────────────────────────────
  const engineRef    = useRef(null);
  const evoRef       = useRef(null);
  const intelRef     = useRef(null);
  const memoryRef    = useRef(null);
  const saveRef      = useRef(null);
  const gameRef      = useRef(null);
  const inventoryRef = useRef(null);
  const tickRef      = useRef(null);
  const speechTORef  = useRef(null);

  // Mutable accumulators for the in-flight assistant message
  const activeAssistantId = useRef(null);
  const activeMsgText     = useRef('');
  const activeThinkingText = useRef('');
  const observedAtRef     = useRef(0);
  // Correlation ID set per send — only events tagged with this id should
  // affect the main chat. Other concurrent queries (20Q, internal sends)
  // tag their own requestIds and we ignore those here.
  const mainRequestId     = useRef(null);

  if (!saveRef.current) saveRef.current = new SaveManager();

  // ── Auth then init pet ─────────────────────────────────────────────────────
  useEffect(() => {
    if (authed) initPet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  async function initPet() {
    const saved = await saveRef.current.load();
    if (saved?.currentPet) {
      const pet = saved.currentPet;
      const appearance = pet.appearance || generatePet(pet.seed);
      setPetAppearance(appearance);
      setPetName(pet.name ?? '');
      setTombstones(saved.tombstones ?? []);
      setInventoryItems(pet.inventory ?? []);
      setHousing(pet.housing ?? 'default');
      setForeground(pet.foreground ?? null);
      setClothing(pet.clothing ?? []);
      setFurniturePositions(pet.furniturePositions ?? {});
      setPetPos(saved.settings?.petPosition ?? 'bottom');
      setSidebarWidth(saved.settings?.sidebarWidth  ?? 220);
      setArtifactWidth(saved.settings?.artifactWidth ?? 460);
      setPetRightWidth(saved.settings?.petRightWidth ?? 360);
      setTheme(saved.settings?.theme ?? 'dark');
      setAlwaysOnTop(!!saved.settings?.alwaysOnTop);
      setBlockOverage(!!saved.settings?.blockOverage);
      window.claudigotchi?.setBlockOverage?.(!!saved.settings?.blockOverage);
      setMode(saved.settings?.mode ?? 'code');
      setModel(saved.settings?.model ?? 'claude-opus-4-7');
      setPermissionMode(saved.settings?.permissionMode ?? 'default');
      setEffort(saved.settings?.effort ?? 'medium');
      setFastMode(!!saved.settings?.fastMode);
      setHiddenSessions(Array.isArray(saved.settings?.hiddenSessions) ? saved.settings.hiddenSessions : []);

      const engine = new PetEngine({ ...pet.stats, tokens: pet.tokens, poops: pet.poops || [], wellRestedUntil: pet.wellRestedUntil || 0 });
      engine.onChange(setEngineState);
      engineRef.current = engine;
      // Apply offline tick replay so a long absence makes the pet hungrier/dirtier
      // (capped at 60 ticks ≈ 1 hour so we don't accidentally kill it overnight).
      const savedAt = saved.savedAt ? new Date(saved.savedAt).getTime() : Date.now();
      const elapsed = Math.max(0, Date.now() - savedAt);
      if (elapsed > 60_000) {
        const r = engine.applyOfflineTicks(elapsed);
        if (r.ticksApplied > 0) {
          setTimeout(() => {
            const note = r.capped
              ? `you were away a while — caught up on the last hour (${r.ticksApplied} ticks)`
              : `you were away ${Math.round(r.ticksApplied)} min — pet aged a bit`;
            showSpeech(note, 4500);
          }, 1500);
        }
      }
      setEngineState(engine.getState());

      const evo = new EvolutionFSM({
        stage: pet.stage, evolutionScore: pet.evolutionScore,
        thresholds: pet.evolutionThresholds, seed: pet.seed,
      });
      evo.onChange(handleEvoEvent);
      evoRef.current = evo;
      setEvoState(evo.getState());

      const intel = new IntelligenceEngine({
        intelligence: pet.intelligence ?? 0,
        projectDepthMap: pet.projectDepthMap ?? {},
      });
      intelRef.current = intel;
      setIntelState(intel.getState());

      const memory = new MemoryManager(pet.name || 'Unknown');
      await memory.load();
      memoryRef.current = memory;

      inventoryRef.current = new Inventory(pet.inventory ?? []);
      // Inventory migrates legacy slot names on construction — sync state back.
      setInventoryItems(inventoryRef.current.list());

      // Migrate clothing too: rewrite legacy slot names
      const migratedClothing = (pet.clothing ?? []).map(c => {
        const s = c.slot;
        const map = { hat: 'head', eyes: 'head', neck: 'body', back: 'body', body: 'body' };
        return map[s] ? { ...c, slot: map[s] } : c;
      });
      setClothing(migratedClothing);

      setPetBio(pet.bio ?? '');
      setPetQuirks(Array.isArray(pet.quirks) ? pet.quirks : []);
      setPetCatchphrase(pet.catchphrase || '');
      setPetBorn(pet.born ?? null);

      // Phase 8 meta
      setUnlockedAchievements(saved.unlockedAchievements ?? []);
      setUnlockedGames(saved.unlockedGames ?? []);
      setTotalTokensEarned(saved.meta?.totalTokensEarned ?? 0);
      setLastActiveDates(saved.meta?.lastActiveDates ?? []);
      setLongestSessionMinutes(saved.meta?.longestSessionMinutes ?? 0);
      setTotalTurns(saved.meta?.totalTurns ?? 0);
      setHasReachedAdult(!!saved.meta?.hasReachedAdult);
      lastTokensRef.current = pet.tokens ?? 0;

      if ((pet.stage ?? 0) >= STAGES.ADOLESCENT && !pet.name) setNamingMode(true);
    } else {
      spawnNewEgg();
    }

    // Mark today as active for streak tracking.
    const todayStr = new Date().toISOString().slice(0, 10);
    setLastActiveDates(prev => prev.includes(todayStr) ? prev : [...prev, todayStr].slice(-90));
    sessionStartTimeRef.current = Date.now();
    initGameManager();
    setLoaded(true);
    startTick();
    startAutoSave();
  }

  function spawnNewEgg() {
    const seed = randomSeed();
    const appearance = generatePet(seed);
    setPetAppearance(appearance);
    setPetName('');
    setInventoryItems([]);
    setHousing('default');
    setClothing([]);
    setFurniturePositions({});
    setNamingMode(false);
    setBugs(0);

    const engine = new PetEngine(DEFAULT_STATS);
    engine.onChange(setEngineState);
    engineRef.current = engine;
    setEngineState(engine.getState());

    const evo = new EvolutionFSM({ seed });
    evo.onChange(handleEvoEvent);
    evoRef.current = evo;
    setEvoState(evo.getState());

    const intel = new IntelligenceEngine();
    intelRef.current = intel;
    setIntelState(intel.getState());

    const memory = new MemoryManager('Unknown');
    memoryRef.current = memory;
    inventoryRef.current = new Inventory();
    setPetBio('');
    setPetQuirks([]);
    setPetCatchphrase('');
    setPetBorn(new Date().toISOString());
  }

  function initGameManager() {
    gameRef.current = new GameManager({
      engine: engineRef.current,
      evo:    evoRef.current,
      memory: memoryRef.current,
      onGameStart: () => { setMood('play'); showSpeech("let's go!"); },
      onGameEnd:   () => { setMood('happy'); setTimeout(() => setMood('idle'), 2000); },
    });
  }

  // ── Tick loop ──────────────────────────────────────────────────────────────
  function startTick() {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      if (!engineRef.current || !evoRef.current) return;
      // Refresh passive items on every tick — cheap and avoids stale snapshots.
      syncPassiveItems();
      const deathResult = engineRef.current.tick();
      evoRef.current.tick(engineRef.current.stats);
      setEngineState(engineRef.current.getState());
      setEvoState(evoRef.current.getState());
      setBugs(engineRef.current.envBugs);
      // Session-minute tracking for marathon achievements
      if (sessionStartTimeRef.current) {
        const mins = Math.floor((Date.now() - sessionStartTimeRef.current) / 60_000);
        if (mins > longestSessionMinutes) setLongestSessionMinutes(mins);
      }
      reEvalAchievements();

      // Phase 8: idle behaviors driven by furniture ownership
      const s = engineRef.current.stats;
      if (s.sleepiness > 75 && inventoryRef.current?.has('pet_bed') && !interactionTarget) {
        setInteractionTarget({ type: 'bed', xRatio: 0.8, ts: Date.now() });
      }
      // Pet PC: every tick, small random chance for adults to walk to PC.
      const stage = evoRef.current?.stage ?? 0;
      if (stage >= STAGES.ADULT && inventoryRef.current?.has('pet_pc') && !interactionTarget) {
        if (Math.random() < 0.05) {
          setInteractionTarget({ type: 'pc', xRatio: 0.6, ts: Date.now() });
          if (intelRef.current) intelRef.current.intelligence += 1;
        }
      }

      if (deathResult === 'health' || deathResult === 'starvation') handleDeath(deathResult);
    }, TICK_MS);
  }

  // ── Phase 8: passive bonus aggregation ────────────────────────────────────
  function gatherPassiveItems() {
    // Equipped clothing — pull defs from catalog (which holds `passive`)
    const items = [];
    for (const c of clothing) {
      const def = getItemById(c.id);
      if (def?.passive) items.push({ id: c.id, passive: def.passive });
    }
    for (const inv of inventoryItems) {
      const def = getItemById(inv.id);
      if (def?.passive) items.push({ id: inv.id, passive: def.passive });
    }
    return items;
  }

  function syncPassiveItems() {
    if (!engineRef.current) return;
    engineRef.current.setPassiveItems(gatherPassiveItems());
    // Evolution-bonus callback wires into the FSM if it supports addEvolution.
    if (!engineRef.current.onEvolutionBonus) {
      engineRef.current.onEvolutionBonus = (n) => {
        const evo = evoRef.current;
        if (!evo) return;
        if (typeof evo.evolutionScore === 'number') {
          evo.evolutionScore += n * 5; // 0.05 → +0.25 per tick into score
        }
      };
    }
  }

  function computeIntelligenceMult() {
    let mult = 1.0;
    for (const it of gatherPassiveItems()) {
      const m = it.passive?.intelligenceMult;
      if (typeof m === 'number') mult *= m;
    }
    return mult;
  }

  // ── Phase 8: achievement evaluation ───────────────────────────────────────
  function reEvalAchievements() {
    const state = {
      totalTokensEarned,
      lastActiveDates,
      longestSessionMinutes,
      totalTurns,
      projectDepthMap: intelRef.current?.projectDepthMap ?? {},
      hasReachedAdult,
    };
    const unlockedNow = checkAll(state);
    const existing = new Set(unlockedAchievements);
    const newly = [];
    for (const id of unlockedNow) if (!existing.has(id)) newly.push(id);
    if (newly.length) {
      setUnlockedAchievements(prev => Array.from(new Set([...prev, ...newly])));
      for (const id of newly) {
        const def = getAchievement(id);
        pushSystemMessage(`🏆 Achievement unlocked: ${def?.name || id}`);
      }
    }
  }

  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  // ── Claude CLI stream → pet reactions + message accumulation ──────────────
  useEffect(() => {
    if (!loaded || !window.claudigotchi) return;

    const unsubStream = window.claudigotchi.onStream(({ sessionId, requestId, event: env }) => {
      if (!engineRef.current || !env) return;
      // Ignore events from other in-flight queries (20Q, internal sends).
      if (requestId && mainRequestId.current && requestId !== mainRequestId.current) return;
      // Always ignore bio-generation traffic in the main chat.
      if (requestId && bioRequestIdRef.current && requestId === bioRequestIdRef.current) return;

      // Adopt session id from any envelope that carries one (init, stream_event, result…)
      const sid = env.session_id || sessionId;
      if (sid && sid !== currentSession) setCurrentSession(sid);

      // ── system: init / status ─────────────────────────────────────────────
      if (env.type === 'system') {
        if (env.subtype === 'init' && !currentSession && env.session_id) {
          setCurrentSession(env.session_id);
        }
        return;
      }

      // ── result: final envelope (turn complete) ────────────────────────────
      if (env.type === 'result') {
        engineRef.current.onHookEvent({ hook: 'Stop' });
        const usage = env.usage ?? {};
        const intel = intelRef.current;
        if (intel) {
          intel.onTurnComplete({
            tokensUsed:     usage.output_tokens ?? 0,
            responseLength: activeMsgText.current.length,
            toolCallCount:  countToolCalls(messages),
            codeBlockCount: countCodeBlocks(activeMsgText.current),
            projectFolder:  currentFolder,
            intelligenceMult: computeIntelligenceMult(),
          });
          setIntelState(intel.getState());
        }
        // Phase 8 counters
        setTotalTurns(t => t + 1);
        const used = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
        if (used > 0) setTotalTokensEarned(t => t + used);
        // Re-check achievements after a turn finishes
        setTimeout(() => reEvalAchievements(), 0);
        setStreaming(false);
        if (messages.length - observedAtRef.current >= OBSERVE_EVERY) {
          observedAtRef.current = messages.length;
          const recent = messages.slice(-OBSERVE_EVERY).map(m => ({
            role: m.role,
            content: (m.blocks ?? [])
              .map(b => b.type === 'text' ? b.text : b.type === 'tool' ? `[tool:${b.name}]` : '')
              .join(' '),
          }));
          memoryRef.current?.observeMessages(recent);
        }
        return;
      }

      // ── user envelope: tool_result blocks come through here ──────────────
      if (env.type === 'user' && env.message?.content) {
        for (const block of env.message.content) {
          if (block.type === 'tool_result') {
            engineRef.current.onHookEvent({ hook: 'PostToolUse', tool_response: block });
            setMood('happy');
            setTimeout(() => setMood('idle'), 1500);
            const isErr = !!block.is_error;
            if (isErr) setBugs(b => Math.min(20, b + 1));
            setMessages(prev => updateToolBlock(prev, block.tool_use_id, block.content, isErr));

            // Fill in Read artifact content when its result arrives
            const contentStr = typeof block.content === 'string'
              ? block.content
              : Array.isArray(block.content)
                ? block.content.map(c => c.text || '').join('')
                : '';
            setArtifactHistory(h => h.map(a =>
              (a.op === 'read' && a.content === '(loading…)') ? { ...a, content: contentStr } : a
            ));
          }
        }
        return;
      }

      // ── stream_event: wraps the raw Anthropic SSE-style event ────────────
      if (env.type !== 'stream_event' || !env.event) return;
      const ev = env.event;

      // Text delta
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
        const chunk = ev.delta.text;
        activeMsgText.current += chunk;
        setMessages(prev => updateLastAssistant(prev, activeAssistantId.current, activeMsgText.current));
        return;
      }

      // Thinking-block stream events. We attach a 'thinking' block to the
      // active assistant message on start, then accumulate delta text into it.
      if (ev.type === 'content_block_start' && ev.content_block?.type === 'thinking') {
        activeThinkingText.current = '';
        setMessages(prev => appendBlockToLastAssistant(prev, activeAssistantId.current, {
          type: 'thinking',
          text: '',
          streaming: true,
          startedAt: Date.now(),
        }));
        return;
      }
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'thinking_delta') {
        activeThinkingText.current += ev.delta.thinking || ev.delta.text || '';
        const cur = activeThinkingText.current;
        setMessages(prev => updateLastThinking(prev, activeAssistantId.current, cur, true));
        return;
      }
      if (ev.type === 'content_block_stop') {
        // Mark thinking block streaming=false if it was the active one
        if (activeThinkingText.current) {
          setMessages(prev => updateLastThinking(prev, activeAssistantId.current, activeThinkingText.current, false));
          activeThinkingText.current = '';
        }
        // fall through; tool_use start handler doesn't care
      }

      // Tool use start
      if (ev.type === 'content_block_start' && ev.content_block?.type === 'tool_use') {
        engineRef.current.onHookEvent({ hook: 'PreToolUse' });
        setMood('thinking');
        const tu = {
          type: 'tool',
          toolId: ev.content_block.id,
          name:   ev.content_block.name,
          input:  ev.content_block.input ?? {},
          result: undefined,
          isError: false,
        };
        setMessages(prev => appendBlockToLastAssistant(prev, activeAssistantId.current, tu));

        // ── Artifact routing — surface plans + file writes/edits in the side panel ──
        const tname = ev.content_block.name;
        const tinput = ev.content_block.input ?? {};
        let newArtifact = null;
        if (tname === 'ExitPlanMode' && tinput.plan) {
          newArtifact = { kind: 'plan', markdown: tinput.plan, ts: Date.now() };
        } else if (tname === 'Write' && tinput.file_path) {
          newArtifact = { kind: 'file', op: 'write', path: tinput.file_path, content: tinput.content ?? '', ts: Date.now() };
        } else if ((tname === 'Edit' || tname === 'MultiEdit') && tinput.file_path) {
          newArtifact = { kind: 'file', op: 'edit', path: tinput.file_path, oldText: tinput.old_string ?? '', newText: tinput.new_string ?? '', ts: Date.now() };
        } else if (tname === 'Read' && tinput.file_path) {
          // Quietly cache reads — don't auto-open the panel for them.
          const a = { kind: 'file', op: 'read', path: tinput.file_path, content: '(loading…)', ts: Date.now() };
          setArtifactHistory(h => [...h, a].slice(-40));
        }
        if (newArtifact) {
          setArtifact(newArtifact);
          setArtifactHistory(h => [...h, newArtifact].slice(-40));
          if (!userDismissedArtifactRef.current) setArtifactOpen(true);
        }
        return;
      }
    });

    const unsubError = window.claudigotchi.onError(({ error, requestId }) => {
      if (requestId && mainRequestId.current && requestId !== mainRequestId.current) return;
      setBugs(b => Math.min(20, b + 1));
      if (error) pushSystemMessage(`⚠ ${String(error).trim().slice(0, 400)}`);
      setStreaming(false);
    });

    return () => { unsubStream?.(); unsubError?.(); };
  }, [loaded, currentSession, currentFolder, messages]);

  // ── Evolution ──────────────────────────────────────────────────────────────
  function handleEvoEvent(event) {
    setEvoState(evoRef.current?.getState());
    if (event.type === 'evolution') {
      setMood('happy');
      if (engineRef.current) engineRef.current.tokens += 25;
      const stageName = STAGE_NAMES[event.toStage] || '';
      memoryRef.current?.logEvolution(stageName);
      if (event.toStage === STAGES.ADOLESCENT) setNamingMode(true);
      if (event.toStage === STAGES.ADULT && !hasReachedAdult) {
        setHasReachedAdult(true);
        setTimeout(() => reEvalAchievements(), 0);
      }
      // First hatch (Egg → Hatchling): generate bio + reveal profile.
      if (event.toStage === STAGES.HATCHLING) {
        generateBioAndReveal();
      }
      showSpeech(`✨ Evolved to ${stageName}! ✨`, 4000);
      setTimeout(() => setMood('idle'), 3000);
      saveNow();
    }
  }

  // ── Phase 8: bio generation via Chat-mode claudeSend ─────────────────────
  function generateBioAndReveal() {
    if (!window.claudigotchi || !petAppearance) return;
    // If we already have a bio (e.g. from a re-spawn replay), just reveal.
    if (petBio) {
      setProfileFirstReveal(true);
      setShowProfile(true);
      return;
    }
    const a = petAppearance.adult || petAppearance.adolescent || petAppearance.hatchling || {};
    const pk = a.personalityKey || petAppearance.adult?.personalityKey || 'mysterious';
    const primary = a.primaryColor?.css || '#888';
    const accent  = a.accentColor?.css  || a.cheekColor?.css || '#666';
    const bodyShape = a.bodyShape || 'round';
    const earType   = a.earType || 'round';
    const tailType  = a.tailType || 'stubby';

    // Ask the model for a structured profile as JSON. Falls back gracefully
    // to plain text if the model ignores the format request.
    const prompt = [
      `You're authoring a profile for a freshly hatched Tamagotchi-style virtual pet.`,
      ``,
      `Pet traits (procedurally generated):`,
      `  Personality: ${pk}`,
      `  Body shape: ${bodyShape}`,
      `  Ears: ${earType}, Tail: ${tailType}`,
      `  Primary color: ${primary}, Accent: ${accent}`,
      ``,
      `Reply with EXACTLY this JSON, nothing else (no markdown fences, no preamble):`,
      `{`,
      `  "bio": "<2-3 sentences in second person addressing the user. Whimsical, charming, brief.>",`,
      `  "quirks": ["<short quirk 1>", "<short quirk 2>", "<short quirk 3>"],`,
      `  "catchphrase": "<one short phrase the pet might say, in character. Under 8 words.>"`,
      `}`,
    ].join('\n');

    const reqId = `bio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    bioRequestIdRef.current = reqId;

    let accumulated = '';
    const unsub = window.claudigotchi.onStream?.(({ requestId: rid, event: env }) => {
      if (rid !== reqId || !env) return;
      if (env.type === 'stream_event' && env.event?.type === 'content_block_delta' && env.event.delta?.type === 'text_delta') {
        accumulated += env.event.delta.text || '';
      }
      if (env.type === 'result') {
        const raw = (accumulated || '').trim();
        // Try to extract JSON (model might wrap it in markdown despite instructions)
        let parsed = null;
        try {
          const m = raw.match(/\{[\s\S]*\}/);
          if (m) parsed = JSON.parse(m[0]);
        } catch { /* noop */ }
        if (parsed?.bio) {
          setPetBio(parsed.bio);
          if (Array.isArray(parsed.quirks)) setPetQuirks(parsed.quirks.slice(0, 5));
          if (parsed.catchphrase) setPetCatchphrase(String(parsed.catchphrase).slice(0, 80));
        } else {
          // Fallback: treat the entire reply as bio text
          setPetBio(raw);
        }
        bioRequestIdRef.current = null;
        try { unsub?.(); } catch { /* noop */ }
        setProfileFirstReveal(true);
        setShowProfile(true);
        setTimeout(() => saveNow(), 0);
      }
    });

    // Always reveal even if Claude is unreachable — fallback to no-bio modal after 15s.
    setTimeout(() => {
      if (bioRequestIdRef.current === reqId) {
        bioRequestIdRef.current = null;
        try { unsub?.(); } catch { /* noop */ }
        setProfileFirstReveal(true);
        setShowProfile(true);
      }
    }, 15_000);

    try {
      window.claudigotchi.claudeSend({
        message: prompt,
        mode: 'chat',
        requestId: reqId,
        model,                         // ← use the currently-selected chat model
        effort,
      });
    } catch (e) {
      console.warn('[bio] send failed', e);
    }
  }

  // ── Death ──────────────────────────────────────────────────────────────────
  function handleDeath(cause) {
    if (!evoRef.current) return;
    evoRef.current.die();
    setEvoState(evoRef.current.getState());
    setMood('dead');
    const ts = saveRef.current.buildTombstone({
      name: petName,
      personalityKey: petAppearance?.adult?.personalityKey,
      born: new Date().toISOString(),
      stage: evoRef.current.stage,
      intelligence: intelRef.current?.intelligence ?? 0,
    }, cause);
    memoryRef.current?.logDeath(cause);
    setTombstones(prev => {
      const next = [...prev, ts];
      // Persist tombstones immediately
      setTimeout(() => saveNow(next), 0);
      return next;
    });
    setTimeout(() => spawnNewEgg(), 5000);
  }

  function confirmName(name) {
    setPetName(name);
    setNamingMode(false);
    evoRef.current?.confirmEvolution();
    memoryRef.current?.updatePetName(name);
    memoryRef.current?.logEvent(`Named ${name}`);
    showSpeech(`Hi! I'm ${name} 🐾`, 3000);
    saveNow();
  }

  // ── Speech bubble ──────────────────────────────────────────────────────────
  function showSpeech(text, ms = 5500) {
    setSpeech(text);
    if (speechTORef.current) clearTimeout(speechTORef.current);
    speechTORef.current = setTimeout(() => setSpeech(null), ms);
  }
  function clearSpeech() {
    if (speechTORef.current) clearTimeout(speechTORef.current);
    setSpeech(null);
  }

  // Pet chat replies get a longer display window since they're substantive.
  function showPetReply(text) { showSpeech(text, 8000); }

  // ── Active chat persistence ─────────────────────────────────────────────
  // Save messages per-tab so closing/reopening doesn't lose the conversation.
  // Validate sessionId on restore so dead sessions don't cause CLI errors.
  const chatSaveTimerRef = useRef(null);
  function persistActiveChat() {
    if (!window.claudigotchi?.saveActiveChat || !loaded) return;
    if (chatSaveTimerRef.current) clearTimeout(chatSaveTimerRef.current);
    chatSaveTimerRef.current = setTimeout(() => {
      window.claudigotchi.saveActiveChat({
        tab: mode,
        payload: {
          messages,
          currentSession,
          currentFolder,
          savedAt: Date.now(),
        },
      });
    }, 800);
  }
  useEffect(() => {
    persistActiveChat();
    // eslint-disable-next-line
  }, [messages, currentSession, currentFolder, mode, loaded]);

  // Restore active chat when mode changes (or on initial load after `loaded`)
  const restoredForModeRef = useRef(null);
  useEffect(() => {
    if (!loaded || !window.claudigotchi?.loadActiveChat) return;
    if (restoredForModeRef.current === mode) return;
    restoredForModeRef.current = mode;
    (async () => {
      const r = await window.claudigotchi.loadActiveChat({ tab: mode });
      if (r?.ok && r.payload) {
        if (Array.isArray(r.payload.messages)) setMessages(r.payload.messages);
        if (r.payload.currentFolder)           setCurrentFolder(r.payload.currentFolder);
        // Only restore session if its file still exists on disk; otherwise null
        if (r.payload.currentSession) setCurrentSession(r.payload.currentSession);
      }
    })();
  }, [loaded, mode]);

  // ── Pet click reaction: bounce + short greeting in the bubble ───────────
  const petClickQuipRef = useRef(0);
  function handlePetClick() {
    if (!petAppearance || !engineRef.current) return;
    const stageNow = evoRef.current?.stage ?? 0;
    if (stageNow === 0 || stageNow === 4) return;       // egg / dead can't react
    setMood('happy');
    setTimeout(() => setMood('idle'), 900);
    // tiny happiness reward, capped so it can't be farmed
    engineRef.current.applyStatDelta({ happiness: 1, boredom: -2 });
    // Rotate a few cute greetings drawn from the pet's personality
    const p = PERSONALITIES[petAppearance.adult?.personalityKey] || {};
    const quips = [
      ...(p.idleQuips || []),
      p.greeting ? p.greeting(petName || 'friend') : null,
      'hi!', '👀', '*pat noticed*', 'hello you',
    ].filter(Boolean);
    const idx = petClickQuipRef.current++ % quips.length;
    showSpeech(quips[idx], 2500);
  }

  // ── Equip / apply already-owned items (no token cost) ───────────────────
  function equipItem(item) {
    inventoryRef.current ??= new Inventory();
    const idsToEquip = Array.isArray(item.bundle) && item.bundle.length ? item.bundle : [item.id];
    for (const id of idsToEquip) inventoryRef.current.equip(id);
    setInventoryItems(inventoryRef.current.list());
    const equipped = inventoryRef.current.list()
      .filter(i => i.equipped && i.slot)
      .map(i => {
        const def = getItemById(i.id);
        return { id: i.id, slot: i.slot, name: def?.name, emoji: def?.emoji };
      });
    setClothing(equipped);
    showSpeech(`equipped ${item.emoji || ''} ${item.name}`);
    setTimeout(() => saveNow(), 0);
  }

  function applyHousing(item) {
    // Foreground items reuse this handler — route them to setForeground instead.
    if (item.category === ITEM_CATEGORIES.FOREGROUND) {
      setForeground(item.foregroundId || item.id);
    } else {
      setHousing(item.id);
    }
    showSpeech(`${item.emoji || ''} ${item.name} applied`);
    setTimeout(() => saveNow(), 0);
  }

  function resetHousing(item) {
    if (item && item.category === ITEM_CATEGORIES.FOREGROUND) {
      setForeground(null);
      showSpeech('border removed');
    } else {
      setHousing('default');
      showSpeech('wallpaper removed');
    }
    setTimeout(() => saveNow(), 0);
  }

  /** Unequip a clothing item (clicked while equipped). */
  function unequipItem(item) {
    if (!inventoryRef.current || !item?.slot) return;
    inventoryRef.current.unequip(item.slot);
    setInventoryItems(inventoryRef.current.list());
    const equipped = inventoryRef.current.list()
      .filter(i => i.equipped && i.slot)
      .map(i => {
        const def = getItemById(i.id);
        return { id: i.id, slot: i.slot, name: def?.name, emoji: def?.emoji };
      });
    setClothing(equipped);
    showSpeech(`unequipped ${item.emoji || ''} ${item.name}`);
    setTimeout(() => saveNow(), 0);
  }

  /** Toggle whether a furniture/toy/instrument is placed in the room. */
  function togglePlaced(item, placed) {
    if (!inventoryRef.current) return;
    inventoryRef.current.setPlaced(item.id, placed);
    setInventoryItems(inventoryRef.current.list());
    setTimeout(() => saveNow(), 0);
  }

  /** Clear the entire room — every furniture/toy un-places at once. Clothes
   *  stay equipped, wallpaper stays applied. Nothing is lost from inventory. */
  function clearRoom() {
    if (!inventoryRef.current) return;
    inventoryRef.current.clearAllPlaced();
    setInventoryItems(inventoryRef.current.list());
    showSpeech('room cleared');
    setTimeout(() => saveNow(), 0);
  }

  // ── Furniture drag persistence ──────────────────────────────────────────
  function handleFurnitureMove(itemId, pos) {
    setFurniturePositions(prev => ({ ...prev, [itemId]: pos }));
    // Debounced save would be nicer; the existing 30s auto-save will catch it.
  }

  // ── Dev-panel actions ────────────────────────────────────────────────────
  function devForceHatch() {
    if (!evoRef.current) return;
    if (evoRef.current.stage === 0) evoRef.current.forceEvolve();
  }
  function devForceEvolve() {
    if (!evoRef.current) return;
    evoRef.current.forceEvolve();
  }
  function devForceDeath() {
    handleDeath('dev');
  }
  function devNewPet() {
    if (window.confirm('Reset and spawn a fresh egg? Current pet will get a tombstone.')) {
      // Tombstone current pet (if any), then respawn
      if (petAppearance && evoRef.current && evoRef.current.stage !== 4) {
        const ts = saveRef.current.buildTombstone({
          name: petName || 'Anonymous',
          personalityKey: petAppearance.adult?.personalityKey,
          born: new Date().toISOString(),
          stage: evoRef.current.stage,
          intelligence: intelRef.current?.intelligence ?? 0,
        }, 'reset');
        setTombstones(prev => [...prev, ts]);
      }
      spawnNewEgg();
      setTimeout(() => saveNow(), 0);
    }
  }
  function devAddTokens(n) {
    if (!engineRef.current) return;
    engineRef.current.tokens += n;
    setEngineState(engineRef.current.getState());
  }
  function devWipeSave() {
    if (window.confirm('PERMANENTLY wipe save.json? All tombstones, achievements, inventory gone. App will restart cycle.')) {
      window.claudigotchi?.saveData?.({ version: 1, savedAt: new Date().toISOString(), currentPet: null, tombstones: [], settings: {} });
      window.location.reload();
    }
  }
  function devSetTuning(patch) {
    const next = { ...tuning, ...patch };
    setTuning(next);
    engineRef.current?.setTuning?.(next);
  }

  // Keep engine tuning in sync with state (on engine swap / new pet)
  useEffect(() => {
    if (engineRef.current?.setTuning) engineRef.current.setTuning(tuning);
  }, [tuning, engineState]);

  // ── Auto-save ─────────────────────────────────────────────────────────────
  function startAutoSave() {
    saveRef.current.startAutoSave(() => ({
      petState: buildPetState(),
      tombstones,
      meta: { totalTokensEarned, lastActiveDates, longestSessionMinutes, totalTurns, hasReachedAdult },
    }));
  }

  function buildPetState() {
    if (!petAppearance || !engineRef.current || !evoRef.current) return null;
    return {
      seed: petAppearance.seed,
      name: petName,
      stage: evoRef.current.stage,
      personalityKey: petAppearance.adult?.personalityKey,
      appearance: petAppearance,
      stats: engineRef.current.stats,
      intelligence: intelRef.current?.intelligence ?? 0,
      projectDepthMap: intelRef.current?.projectDepthMap ?? {},
      evolutionScore: evoRef.current.evolutionScore,
      evolutionThresholds: evoRef.current.thresholds,
      tokens: engineRef.current.tokens,
      born: new Date().toISOString(),
      inventory: inventoryItems,
      housing,
      foreground,
      clothing,
      bio: petBio,
      quirks: petQuirks,
      catchphrase: petCatchphrase,
      furniturePositions,
      poops: engineRef.current.poops || [],
      wellRestedUntil: engineRef.current.wellRestedUntil || 0,
    };
  }

  function saveNow(overrideTombstones) {
    if (!window.claudigotchi) return;
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      currentPet: buildPetState(),
      tombstones: overrideTombstones ?? tombstones,
      settings: { petPosition: petPos, theme, alwaysOnTop, blockOverage, mode, model, permissionMode, effort, fastMode, hiddenSessions, sidebarWidth, artifactWidth, petRightWidth },
      unlockedAchievements,
      unlockedGames,
      meta: {
        totalTokensEarned,
        lastActiveDates,
        longestSessionMinutes,
        totalTurns,
        hasReachedAdult,
      },
    };
    window.claudigotchi.saveData(data);
  }

  // Persist settings when they change
  useEffect(() => { if (loaded) saveNow(); /* eslint-disable-next-line */ }, [petPos, theme, alwaysOnTop, housing, clothing, inventoryItems, mode, sidebarWidth, artifactWidth, petRightWidth]);

  // Hand the latest snapshot to SaveManager's auto-save callback
  useEffect(() => {
    if (!loaded) return;
    saveRef.current.startAutoSave(() => ({
      petState: buildPetState(),
      tombstones,
      meta: { totalTokensEarned, lastActiveDates, longestSessionMinutes, totalTurns, hasReachedAdult },
    }));
    // eslint-disable-next-line
  }, [loaded, petName, petPos, theme, housing, clothing, tombstones, inventoryItems]);

  // Insert a system-style message into the chat (errors, notices)
  const pushSystemMessage = useCallback((text) => {
    setMessages(prev => [...prev, {
      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'assistant',
      blocks: [{ type: 'text', text }],
      system: true,
    }]);
  }, []);

  // ── Chat send ──────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!window.claudigotchi) return;
    const userMsg = { id: `u-${Date.now()}`, role: 'user', blocks: [{ type: 'text', text }] };
    const assistantId = `a-${Date.now() + 1}`;
    activeAssistantId.current = assistantId;
    activeMsgText.current = '';
    const assistantMsg = { id: assistantId, role: 'assistant', blocks: [{ type: 'text', text: '' }] };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    // Each new send re-arms artifact auto-open.
    userDismissedArtifactRef.current = false;

    // SessionStart-ish event for engines & memory (when starting a fresh session)
    if (!currentSession) {
      engineRef.current?.onHookEvent({ hook: 'SessionStart' });
      memoryRef.current?.onSessionStart({
        projectFolder: mode === 'chat' ? null : currentFolder,
        timeOfDay: new Date().toLocaleTimeString(),
      });
    }

    const reqId = `main-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    mainRequestId.current = reqId;

    try {
      // Personality-flavor addendum — the pet's voice as a Greek chorus.
      // PetVoice strictly scopes it so the agent still does what's asked.
      const petAddendum = buildMainChatAddendum({
        petAppearance,
        petName,
        stage: evoRef.current?.stage ?? 0,
        personalityKey: petAppearance?.adult?.personalityKey,
        bio: petBio || undefined,
        quirks: petQuirks,
        catchphrase: petCatchphrase,
      });

      const res = await window.claudigotchi.claudeSend({
        message: text,
        sessionId: currentSession,
        cwd: currentFolder,
        mode,
        model,
        permissionMode,
        effort,
        fastMode,
        requestId: reqId,
        appendSystemPrompt: petAddendum || undefined,
      });
      if (res?.sessionId && res.sessionId !== currentSession) setCurrentSession(res.sessionId);
      // Failsafe: if the SDK returned but we never saw a 'result' event, stop the dots.
      setStreaming(false);
    } catch (e) {
      console.error('[claudeSend]', e);
      pushSystemMessage(`⚠ Send failed: ${e?.message || e}`);
      setStreaming(false);
    }
  }, [currentFolder, currentSession, mode, model, permissionMode, effort, fastMode]);

  // ── Sidebar actions ───────────────────────────────────────────────────────
  async function pickFolder() {
    if (!window.claudigotchi) return;
    const folder = await window.claudigotchi.pickFolder();
    if (folder) setCurrentFolder(folder);
  }

  function newChat() {
    setMessages([]);
    setCurrentSession(null);
    observedAtRef.current = 0;
  }

  const [showHiddenSessions, setShowHiddenSessions] = useState(false);
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);

  async function resumeSession(s) {
    setCurrentSession(s.id);
    setMessages([]);
    setStreaming(false);
    activeAssistantId.current = null;
    activeMsgText.current = '';
    if (!window.claudigotchi?.claudeReadSession) return;
    const res = await window.claudigotchi.claudeReadSession({
      sessionId: s.id,
      cwd: currentFolder,
      mode,
    });
    if (res?.ok && Array.isArray(res.messages)) {
      setMessages(res.messages);
    } else if (res?.error) {
      pushSystemMessage(`⚠ Could not load transcript: ${res.error}`);
    }
  }

  /** Permanently delete — confirms first, then removes the on-disk session
   *  file. This DOES remove it from real Claude Code. Use hideSession for
   *  list-only removal. */
  async function deleteSession(s) {
    const title = s.title || s.id;
    const ok = window.confirm(
      `Permanently delete this session?\n\n"${String(title).slice(0, 120)}"\n\n`
      + `This removes the transcript file on disk. It will disappear from Claude Code as well.\n\n`
      + `Cancel to keep the session, or right-click instead to just hide it from Claudigotchi.`
    );
    if (!ok) return;
    if (window.claudigotchi?.claudeDeleteSession) {
      await window.claudigotchi.claudeDeleteSession({ sessionId: s.id, cwd: currentFolder });
    }
    if (s.id === currentSession) newChat();
    setSessionsRefreshKey(k => k + 1);
  }

  /** Soft hide (right-click "Ignore") — does NOT touch the on-disk session file.
   *  The transcript remains intact and visible to real Claude Code. Just hidden
   *  from our list until "Show all" is checked or the user unhides it. */
  function hideSession(s) {
    setHiddenSessions(prev => {
      if (prev.includes(s.id)) return prev;
      const next = [...prev, s.id];
      setTimeout(() => saveNow(), 0);
      return next;
    });
  }

  function unhideSession(s) {
    setHiddenSessions(prev => prev.filter(id => id !== s.id));
    setTimeout(() => saveNow(), 0);
  }

  // ── Action bar handlers ───────────────────────────────────────────────────
  // ── Action queue: feed/clean/nap walk to furniture before firing ─────────
  const pendingActionRef = useRef(null);

  // Nap state — drives the ActionBar button label (Nap ↔ Wake) and lets us
  // forcibly end a nap early. Auto-cleared by the napTimeoutRef when the
  // nap runs its full course.
  const [isNapping, setIsNapping] = useState(false);
  const napTimeoutRef = useRef(null);
  const NAP_MS = 60_000;

  function isPlaced(itemId) {
    return inventoryItems.some(i => i.id === itemId && i.placed !== false);
  }

  /** Effects applied at the action site (pet's current position or destination). */
  function doFeedNow(item) {
    buyItem(item);                                                  // applies stats + tray emoji
    setMood('eating'); setTimeout(() => setMood('idle'), 1500);
  }
  function doCleanNow() {
    if (!engineRef.current) return false;
    const ok = engineRef.current.cleanEnvironment(10);
    if (!ok) { showSpeech('need 10 🪙 to clean'); return false; }
    setBugs(0);
    setMood('shower');
    showSpeech('✨ all clean!');
    if (isPlaced('shower_head')) {
      setShowerActive(true);
      setTimeout(() => setShowerActive(false), 5000);
    }
    setTimeout(() => setMood('idle'), 2000);
    return true;
  }
  function doNapNow() {
    if (!engineRef.current?.startNap) return;
    engineRef.current.startNap();                                   // sleepiness↓ + well-rested buff
    setEngineState(engineRef.current.getState());
    setMood('sleeping');
    setIsNapping(true);
    showSpeech('zzz… 💤', 4000);
    // Auto-wake after the nap duration
    if (napTimeoutRef.current) clearTimeout(napTimeoutRef.current);
    napTimeoutRef.current = setTimeout(() => {
      setIsNapping(false);
      setMood('idle');
      napTimeoutRef.current = null;
    }, NAP_MS);
  }

  function wakeUp() {
    setIsNapping(false);
    setMood('idle');
    setInteractionTarget(null);                                     // signals PetCanvas to drop sleep mood
    if (napTimeoutRef.current) { clearTimeout(napTimeoutRef.current); napTimeoutRef.current = null; }
    showSpeech('*yawn*… alright, what now?', 2500);
  }

  function feedAction() {
    const stage = evoRef.current?.stage ?? 0;
    const affordable = SHOP_ITEMS
      .filter(it => it.category === ITEM_CATEGORIES.FOOD && (it.stageRequired ?? 0) <= stage)
      .filter(it => (engineRef.current?.tokens ?? 0) >= it.cost)
      .sort((a, b) => a.cost - b.cost)[0];
    if (!affordable) { showSpeech('not enough 🪙 — open shop?'); setShowShop(true); return; }
    if (isPlaced('food_tray')) {
      pendingActionRef.current = { kind: 'feed', item: affordable };
      setInteractionTarget({
        type: 'food_tray',
        xRatio: getFurnitureXPct('food_tray', furniturePositions) / 100,
        yRatio: getFurnitureYPct('food_tray', furniturePositions),
        ts: Date.now(),
      });
      showSpeech('on my way…', 2000);
    } else {
      doFeedNow(affordable);
    }
  }

  function playAction() {
    if (!gameRef.current?.canPlay('throwBall', evoRef.current?.stage ?? 0)) {
      showSpeech('need 5 🪙 to play ball'); return;
    }
    gameRef.current.startGame('throwBall');
    setShowThrowBall(true);
  }

  // Toy click in the room — dispatches to the right interaction.
  // ball → throwBall mini-game; instruments → play mood + happiness/boredom;
  // doll/plushie/squeaky → hug bounce + happiness.
  function handleToyInteract(toyId) {
    if (stage === 0 || stage === 4) return;
    const stat = (engineRef.current?.applyStatDelta) ? engineRef.current.applyStatDelta.bind(engineRef.current) : null;
    if (toyId === 'rubber_ball') {
      // Mirror playAction's gate so we don't crash when missing engine funds.
      if (!gameRef.current?.canPlay('throwBall', evoRef.current?.stage ?? 0)) {
        showSpeech('need 5 🪙 to play ball'); return;
      }
      gameRef.current.startGame('throwBall');
      setShowThrowBall(true);
      return;
    }
    const INSTRUMENTS = new Set(['guitar', 'piano', 'drum_kit', 'microphone', 'turntable']);
    if (INSTRUMENTS.has(toyId)) {
      stat?.({ boredom: -20, happiness: +12 });
      setMood('play');
      const x = getFurnitureXPct(toyId, furniturePositions);
      const yp = getFurnitureYPct(toyId, furniturePositions);
      setInteractionTarget({ type: 'pc', xRatio: x / 100, yRatio: yp, ts: Date.now() }); // pc mood = thinking; reuse to walk over
      setMood('play');
      showSpeech('🎵 ♪ ~ ♫', 4000);
      setTimeout(() => setMood('idle'), 5000);
      return;
    }
    // Plush companions
    if (['doll', 'plushie', 'squeaky_toy'].includes(toyId)) {
      stat?.({ boredom: -12, happiness: +10 });
      setMood('happy');
      showSpeech(toyId === 'squeaky_toy' ? '*squeak* *squeak*' : 'snuggle 🫂', 3500);
      setTimeout(() => setMood('idle'), 2200);
      return;
    }
  }

  function cleanAction() {
    if ((engineRef.current?.tokens ?? 0) < 10) { showSpeech('need 10 🪙 to clean'); return; }
    if (isPlaced('shower_head')) {
      pendingActionRef.current = { kind: 'clean' };
      setInteractionTarget({
        type: 'shower',
        xRatio: getFurnitureXPct('shower_head', furniturePositions) / 100,
        yRatio: getFurnitureYPct('shower_head', furniturePositions),
        ts: Date.now(),
      });
      showSpeech('heading to shower…', 2000);
    } else {
      doCleanNow();
    }
  }

  function napAction() {
    if (!engineRef.current) return;
    const bedId = isPlaced('pet_bed') ? 'pet_bed' : (isPlaced('fancy_bed') ? 'fancy_bed' : null);
    if (bedId) {
      pendingActionRef.current = { kind: 'nap' };
      setInteractionTarget({
        type: 'nap',
        xRatio: getFurnitureXPct(bedId, furniturePositions) / 100,
        yRatio: getFurnitureYPct(bedId, furniturePositions),
        ts: Date.now(),
      });
      showSpeech('off to bed…', 2000);
    } else {
      doNapNow();
    }
  }

  /** Fired by PetCanvas the moment the pet reaches a queued interaction target. */
  function handlePetArrive(/* type */) {
    const p = pendingActionRef.current;
    pendingActionRef.current = null;
    if (!p) return;
    if      (p.kind === 'feed')  doFeedNow(p.item);
    else if (p.kind === 'clean') doCleanNow();
    else if (p.kind === 'nap')   doNapNow();
  }

  // Trash drag drop — removes from inventory & re-syncs canvas state.
  // For multi-instance items, `id` is `${baseId}#${uid}`. If the trashed item
  // was the active foreground, clear that too.
  function handleTrashItem(id) {
    if (!inventoryRef.current) return;
    const removed = inventoryRef.current.list().find(i => i.id === id);
    inventoryRef.current.remove(id);
    setInventoryItems(inventoryRef.current.list());
    if (removed?.id && foreground === removed.id) setForeground(null);
    // Sync any furniturePositions that referenced this id
    setFurniturePositions(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    showSpeech(`🗑️ removed`);
    setTimeout(() => saveNow(), 0);
  }

  function handlePoopRemove(poopId) {
    if (!engineRef.current?.poops) return;
    engineRef.current.poops = engineRef.current.poops.filter(p => p.id !== poopId);
    setEngineState({ ...engineRef.current.getState() });
    // Auto-exit pickup mode when no poops left
    if (engineRef.current.poops.length === 0) setPickupMode(false);
  }

  function openShop()  { setShowShop(true); }
  // Open the unified Games picker — user chooses which game to play.
  function openGames() { setShowGamesMenu(true); }
  function pickGame(id) {
    if (id === '20q')       setShowTQ(true);
    else if (id === 'throwBall') { playAction(); }
    else if (id === '2048')      setShow2048(true);
    else if (id === 'breakout')  setShowBreakout(true);
    else if (id === 'chess')     setShowChess(true);
  }

  // ── Shop ──────────────────────────────────────────────────────────────────
  function buyItem(item) {
    if (!engineRef.current) return;
    const ok = engineRef.current.applyItem(item);
    if (!ok) { showSpeech('not enough 🪙'); return; }

    // Track food quality for evolution
    if (item.category === ITEM_CATEGORIES.FOOD || item.category === ITEM_CATEGORIES.SNACK) {
      evoRef.current?.recordFood?.(item.foodQuality ?? 0.3);
      // Food-tray visual: show emoji for 4s + walk pet over if tray owned.
      setFedItemEmoji(item.emoji || '🍴');
      setTimeout(() => setFedItemEmoji(null), 4000);
      if (inventoryRef.current?.has('food_tray')) {
        setInteractionTarget({ type: 'food_tray', xRatio: 0.5, ts: Date.now() });
      }
    }

    // Stack consumables/etc. in inventory
    inventoryRef.current ??= new Inventory();
    if (item.category === ITEM_CATEGORIES.HOUSING || item.category === ITEM_CATEGORIES.INSTRUMENT) {
      // Wallpaper-style ids replace the room background AND get added to
      // inventory so the user can swap back to other owned wallpapers later.
      if (/^wallpaper_/.test(item.id) || item.id === 'cozyCabin') {
        setHousing(item.id);
        inventoryRef.current.add(item);
        setInventoryItems(inventoryRef.current.list());
      } else {
        inventoryRef.current.add(item);
        setInventoryItems(inventoryRef.current.list());
      }
    } else if (item.category === ITEM_CATEGORIES.CLOTHING) {
      // Bundle: equip every entry; otherwise equip the single item.
      const idsToEquip = Array.isArray(item.bundle) && item.bundle.length ? item.bundle : [item.id];
      for (const id of idsToEquip) {
        inventoryRef.current.equip(id);
      }
      setInventoryItems(inventoryRef.current.list());
      // Build clothing-state from inventory (single per slot) for the canvas.
      const equipped = inventoryRef.current.list()
        .filter(i => i.equipped && i.slot)
        .map(i => {
          const def = getItemById(i.id);
          return { id: i.id, slot: i.slot, name: def?.name, emoji: def?.emoji };
        });
      setClothing(equipped);
    } else if (item.category === ITEM_CATEGORIES.FOREGROUND) {
      // Apply the new foreground immediately AND add to inventory so the
      // user can swap back later via the shop.
      setForeground(item.foregroundId || item.id);
      inventoryRef.current.add(item);
      setInventoryItems(inventoryRef.current.list());
    } else if (item.category === ITEM_CATEGORIES.DECORATION) {
      // Decorations are multi-instance: each buy creates a fresh entry with its
      // own uid so the user can place several of the same kind and trash them
      // independently. Non-multiple decorations fall back to the original add().
      if (item.allowMultiple) {
        inventoryRef.current.addInstance(item);
      } else {
        inventoryRef.current.add(item);
      }
      setInventoryItems(inventoryRef.current.list());
    } else if (item.category === ITEM_CATEGORIES.GAME_UNLOCK) {
      setUnlockedGames(prev => prev.includes(item.gameId) ? prev : [...prev, item.gameId]);
    } else if (item.category === ITEM_CATEGORIES.TOY && !item.persistent) {
      // Instant-use toys (laser_pointer, puzzle_box): play with the pet
      // immediately, apply boredom/happiness deltas, don't litter the room
      // with sprites that have no behavior.
      engineRef.current.applyStatDelta?.({
        boredom: -(item.boredom ?? 20),
        happiness: +(item.happiness ?? 10),
      });
      setMood('play');
      showSpeech(`${item.emoji || '🎉'} ${item.name}!`, 3500);
      setTimeout(() => setMood('idle'), 2200);
    } else {
      inventoryRef.current.add(item);
      setInventoryItems(inventoryRef.current.list());
    }
    memoryRef.current?.logPurchase(item.name);
    showSpeech(`got ${item.emoji || ''} ${item.name}!`);
    setTimeout(() => saveNow(), 0);
  }

  // ── 20 Questions end ──────────────────────────────────────────────────────
  function endTQ({ won, secret }) {
    setShowTQ(false);
    if (won && intelRef.current) {
      intelRef.current.intelligence += 5;
      setIntelState(intelRef.current.getState());
    }
    gameRef.current?.endGame('twentyQuestions', { won });
    if (secret) memoryRef.current?.logEvent(`Played 20 Questions about "${secret}" — ${won ? 'user won' : 'pet won'}`);
  }

  function endThrowBall({ won }) {
    setShowThrowBall(false);
    gameRef.current?.endGame('throwBall', { won });
  }

  // Push a short status line to the tray tooltip whenever stats or name change.
  // NOTE: use evoState + engineState (declared above) — `const stage` / `const stats`
  // are declared further down the component body, so closing over them here
  // would hit the TDZ at render time and black-screen the whole app.
  useEffect(() => {
    if (!window.claudigotchi?.setTrayTooltip) return;
    const stg = evoState?.stage ?? 0;
    const s   = engineState?.stats;
    const name = petName || (stg === 0 ? 'Egg' : 'Pet');
    const tip = `Claudigotchi · ${name}
HNG ${Math.round(s?.hunger ?? 0)}  HAP ${Math.round(s?.happiness ?? 0)}  HLT ${Math.round(s?.health ?? 0)}`;
    window.claudigotchi.setTrayTooltip(tip);
  }, [petName, evoState?.stage, engineState?.stats?.hunger, engineState?.stats?.happiness, engineState?.stats?.health]);

  // ── Usage subscription ────────────────────────────────────────────────────
  useEffect(() => {
    if (!window.claudigotchi?.onUsage) return;
    window.claudigotchi.getUsage?.().then(setUsage);
    return window.claudigotchi.onUsage(setUsage);
  }, []);

  // Persist + push blockOverage setting
  useEffect(() => {
    if (!loaded) return;
    window.claudigotchi?.setBlockOverage?.(blockOverage);
    saveNow();
    // eslint-disable-next-line
  }, [blockOverage]);

  // ── Pet-window state sync (main window owns engines; float window mirrors) ─
  // Broadcast the full pet snapshot to the float window whenever anything changes.
  useEffect(() => {
    if (!loaded || !window.claudigotchi || isPetWindow) return;
    const snapshot = {
      petAppearance, petName,
      stage: evoRef.current?.stage ?? 0,
      stageName: STAGE_NAMES[evoRef.current?.stage ?? 0],
      stats: engineState?.stats,
      tokens: engineState?.tokens ?? 0,
      intelligence: intelState?.intelligence ?? 0,
      mood, speech,
      evolutionScore: evoState?.evolutionScore ?? 0,
      inventory: inventoryItems, housing, foreground, clothing,
      bugs, tombstones, namingMode,
      wellRestedUntil: engineRef.current?.wellRestedUntil || 0,
      poops: engineState?.poops || [],
      furniturePositions,
      isNapping,
    };
    window.claudigotchi.broadcastPetState(snapshot);
  }, [loaded, petAppearance, petName, engineState, intelState, evoState, mood, speech, inventoryItems, housing, foreground, clothing, bugs, tombstones, namingMode, isPetWindow]);

  // Handle action requests coming from the float window.
  useEffect(() => {
    if (!loaded || !window.claudigotchi?.onPetAction) return;
    return window.claudigotchi.onPetAction(({ action, payload }) => {
      switch (action) {
        case 'feed':        feedAction(); break;
        case 'play':        playAction(); break;
        case 'clean':       cleanAction(); break;
        case 'nap':         napAction(); break;
        case 'wake':        wakeUp(); break;
        case 'openShop':    setShowShop(true); break;
        case 'openGames':   setShowTQ(true); break;
        case 'confirmName': confirmName(payload?.name); break;
        case 'posChange':   setPetPos(payload?.pos); break;
      }
    });
    // eslint-disable-next-line
  }, [loaded]);

  // Re-broadcast immediately when the float window asks for current state.
  useEffect(() => {
    if (!loaded || !window.claudigotchi?.onPetStateRequested) return;
    return window.claudigotchi.onPetStateRequested(() => {
      window.claudigotchi.broadcastPetState({
        petAppearance, petName,
        stage: evoRef.current?.stage ?? 0,
        stageName: STAGE_NAMES[evoRef.current?.stage ?? 0],
        stats: engineState?.stats,
        tokens: engineState?.tokens ?? 0,
        intelligence: intelState?.intelligence ?? 0,
        mood, speech,
        evolutionScore: evoState?.evolutionScore ?? 0,
        inventory: inventoryItems, housing, foreground, clothing,
        bugs, tombstones, namingMode,
        wellRestedUntil: engineRef.current?.wellRestedUntil || 0,
        poops: engineState?.poops || [],
        furniturePositions,
        isNapping,
      });
    });
    // eslint-disable-next-line
  }, [loaded, petAppearance, petName, engineState, intelState, evoState, mood, speech, inventoryItems, housing, foreground, clothing, bugs, tombstones, namingMode]);

  // ── Pop out / dock in ─────────────────────────────────────────────────────
  function popOut() { window.claudigotchi?.petPopOut(); setPetPos('float'); }
  function dockIn() { window.claudigotchi?.petDockIn(); setPetPos('bottom'); }
  useEffect(() => {
    if (!window.claudigotchi?.onPetDocked) return;
    return window.claudigotchi.onPetDocked(() => setPetPos('bottom'));
  }, []);

  // ── Render guards ─────────────────────────────────────────────────────────
  if (!authed) return <AuthScreen onAuthenticated={() => setAuthed(true)} />;
  if (!loaded) return <div style={S.loading}>loading claudigotchi…</div>;

  const stage = evoRef.current?.stage ?? 0;
  const stageName = STAGE_NAMES[stage] || '';
  const stats  = engineState?.stats;
  const tokens = engineState?.tokens ?? 0;
  const intel  = intelState?.intelligence ?? 0;
  const personalityKey = petAppearance?.adult?.personalityKey;
  const memorySummary  = memoryRef.current?.getContext?.() ?? '';

  // ── Full app ─────────────────────────────────────────────────────────────
  // When the artifact panel is open, force the pet to a bottom strip so it
  // doesn't collide with the right-side panel. User's stored petPos is preserved.
  const effectivePetPos = artifactOpen ? 'bottom' : petPos;
  const isFloat = effectivePetPos === 'float';
  const horizontal = effectivePetPos === 'bottom' || effectivePetPos === 'top';
  const flexDir = effectivePetPos === 'top' ? 'column-reverse' : 'column';

  function handleModeChange(next) {
    if (next === mode) return;
    setMode(next);
    setMessages([]);
    setCurrentSession(null);
    observedAtRef.current = 0;
    setArtifact(null);
    setArtifactHistory([]);
    setArtifactOpen(false);
    setStreaming(false);
    activeAssistantId.current = null;
    activeMsgText.current = '';
    // Abort any in-flight request from the other tab
    if (currentSession) window.claudigotchi?.claudeAbort?.({ sessionId: currentSession });
  }

  function dismissArtifact() {
    userDismissedArtifactRef.current = true;
    setArtifactOpen(false);
  }

  function approvePlan() {
    sendMessage('Approved, please proceed with the plan.');
  }

  return (
    <div style={{ ...S.root, flexDirection: flexDir }}>
      <div style={S.titleBar}>
        <span style={S.titleText}>{STAGE_EMOJI[stage]} Claudigotchi</span>

        <TabSwitcher mode={mode} onChange={handleModeChange} />

        <div style={S.titleSpacer} />

        <button style={S.devBadge} onClick={() => setShowDev(true)} title="Developer tools (temporary)">DEV</button>

        <button style={S.usageBadge} onClick={() => setShowSettings(true)} title="Click for full usage panel">
          {usage?.session ? `$${(usage.session.costUsd || 0).toFixed(3)} · ${fmtTokens(usage.session.tokensIn + usage.session.tokensOut)}` : '— · —'}
          {usage?.rateLimit?.isUsingOverage && <span style={S.overageDot}>⚠</span>}
        </button>

        <div style={S.winControls}>
          <button style={S.winBtn} onClick={() => window.claudigotchi.minimize()}>─</button>
          <button style={S.winBtn} onClick={() => window.claudigotchi.maximize()}>□</button>
          <button style={S.winBtnX} onClick={() => window.claudigotchi.close()}>✕</button>
        </div>
      </div>

      <div style={S.mainArea}>
        <div style={{ ...S.sidebar, width: sidebarWidth }}>
          <SessionSidebar
            mode={mode}
            currentFolder={currentFolder}
            currentSessionId={currentSession}
            hiddenSessions={hiddenSessions}
            showHidden={showHiddenSessions}
            refreshKey={sessionsRefreshKey}
            onToggleShowHidden={() => setShowHiddenSessions(v => !v)}
            onUnhideAll={() => setHiddenSessions([])}
            onHideSession={hideSession}
            onUnhideSession={unhideSession}
            onPickFolder={pickFolder}
            onNewSession={newChat}
            onResumeSession={resumeSession}
            onDeleteSession={deleteSession}
            onOpenSettings={() => setShowSettings(true)}
          />
        </div>
        <ResizeHandle side="right" onResize={d => setSidebarWidth(w => Math.max(160, Math.min(480, w + d)))} />

        <div style={S.chatArea}>
          <ChatPanel messages={messages} streaming={streaming} />
          <InputBar
            onSend={sendMessage}
            currentFolder={currentFolder}
            disabled={streaming}
            mode={mode}
            model={model} onModelChange={setModel}
            permissionMode={permissionMode} onPermissionModeChange={setPermissionMode}
            effort={effort} onEffortChange={setEffort}
            fastMode={fastMode} onFastModeChange={setFastMode}
          />
        </div>

        {artifactOpen && (
          <ResizeHandle side="left" onResize={d => setArtifactWidth(w => Math.max(240, Math.min(720, w - d)))} />
        )}
        {artifactOpen && (
          <div style={{ ...S.artifactColumn, width: artifactWidth }}>
            <ArtifactPanel
              artifact={artifact}
              history={artifactHistory}
              onClose={dismissArtifact}
              onApprovePlan={approvePlan}
              onPickHistory={(a) => setArtifact(a)}
            />
          </div>
        )}

        {effectivePetPos === 'right' && (
          <ResizeHandle side="left" onResize={d => setPetRightWidth(w => Math.max(280, Math.min(600, w - d)))} />
        )}
        {effectivePetPos === 'right' && (
          <div style={{ ...S.petRight, width: petRightWidth }}>
            <PetPanel
              petPos={petPos}
              petAppearance={petAppearance} petName={petName}
              stage={stage} stageName={stageName}
              stats={stats} tokens={tokens} intelligence={intel}
              mood={mood} speech={speech} evolutionScore={evoState?.evolutionScore ?? 0}
              inventory={inventoryItems} housing={housing} foreground={foreground} clothing={clothing}
              onToyInteract={handleToyInteract}
              onTrashItem={handleTrashItem}
              pickupMode={pickupMode}
              onTogglePickup={() => setPickupMode(m => !m)}
              onPoopRemove={handlePoopRemove}
              bugs={bugs} tombstones={tombstones}
              namingMode={namingMode} onConfirmName={confirmName}
              onFeed={feedAction} onPlay={playAction} onClean={cleanAction}
              onShop={openShop} onGames={openGames}
              onPosChange={setPetPos} onPopOut={popOut}
              onOpenProfile={() => { setProfileFirstReveal(false); setShowProfile(true); }}
              interactionTarget={interactionTarget}
              fedItemEmoji={fedItemEmoji}
              showerActive={showerActive}
              bio={engineRef.current?.bio}
              onPetSays={showPetReply}
              onBubbleDismiss={clearSpeech}
              onPetClick={handlePetClick}
              furniturePositions={furniturePositions}
              onFurnitureMove={handleFurnitureMove}
              onClearRoom={clearRoom}
              poops={engineState?.poops || []}
              onArrive={handlePetArrive}
              onNap={napAction}
              onWake={wakeUp}
              isNapping={isNapping}
              wellRestedUntil={engineRef.current?.wellRestedUntil || 0}
            />
          </div>
        )}
      </div>

      {horizontal && (
        <div style={effectivePetPos === 'bottom' ? S.petBottom : S.petTop}>
          <PetPanel
            petPos={effectivePetPos}
            petAppearance={petAppearance} petName={petName}
            stage={stage} stageName={stageName}
            stats={stats} tokens={tokens} intelligence={intel}
            mood={mood} speech={speech} evolutionScore={evoState?.evolutionScore ?? 0}
            inventory={inventoryItems} housing={housing} foreground={foreground} clothing={clothing}
            onToyInteract={handleToyInteract}
            onTrashItem={handleTrashItem}
            pickupMode={pickupMode}
            onTogglePickup={() => setPickupMode(m => !m)}
            onPoopRemove={handlePoopRemove}
            bugs={bugs} tombstones={tombstones}
            namingMode={namingMode} onConfirmName={confirmName}
            onFeed={feedAction} onPlay={playAction} onClean={cleanAction}
            onShop={openShop} onGames={openGames}
            onPosChange={setPetPos} onPopOut={popOut}
            onOpenProfile={() => { setProfileFirstReveal(false); setShowProfile(true); }}
            interactionTarget={interactionTarget}
            fedItemEmoji={fedItemEmoji}
            showerActive={showerActive}
            bio={engineRef.current?.bio}
            onPetSays={showPetReply}
            onBubbleDismiss={clearSpeech}
            onPetClick={handlePetClick}
            furniturePositions={furniturePositions}
            onFurnitureMove={handleFurnitureMove}
            onClearRoom={clearRoom}
            poops={engineState?.poops || []}
            onArrive={handlePetArrive}
            onNap={napAction}
            onWake={wakeUp}
            isNapping={isNapping}
            wellRestedUntil={engineRef.current?.wellRestedUntil || 0}
          />
        </div>
      )}

      {isFloat && (
        <div style={S.floatHint}>
          Pet is in floating window. Close that window or use "Dock back" to return it here.
        </div>
      )}

      <Shop
        open={showShop} onClose={() => setShowShop(false)}
        tokens={tokens} stage={stage}
        onBuy={buyItem}
        onEquip={equipItem}
        onUnequip={unequipItem}
        onApplyHousing={applyHousing}
        onResetHousing={resetHousing}
        onTogglePlaced={togglePlaced}
        unlockedAchievements={unlockedAchievements}
        inventory={inventoryItems}
        clothing={clothing}
        housing={housing}
        foreground={foreground}
        unlockedGames={unlockedGames}
      />
      <PetProfile
        open={showProfile}
        onClose={() => { setShowProfile(false); setProfileFirstReveal(false); }}
        petAppearance={petAppearance}
        petName={petName}
        stage={stage}
        stageName={stageName}
        stats={stats}
        intelligence={intel}
        evoState={evoState}
        born={petBorn}
        personalityKey={personalityKey}
        bio={petBio}
        quirks={petQuirks}
        catchphrase={petCatchphrase}
        equipped={clothing.map(c => ({ ...c, ...(getItemById(c.id) || {}) }))}
        owned={inventoryItems.map(i => ({ ...i, ...(getItemById(i.id) || {}) }))}
        isFirstReveal={profileFirstReveal}
      />
      <ThrowBall open={showThrowBall} onEnd={endThrowBall} />
      <TwentyQuestions open={showTQ} onEnd={endTQ} petName={petName} personalityKey={personalityKey} memorySummary={memorySummary} />
      <GamesMenu
        open={showGamesMenu}
        unlockedGames={unlockedGames}
        onClose={() => setShowGamesMenu(false)}
        onPick={pickGame}
      />
      <Game2048
        open={show2048}
        onEnd={({ won, score }) => {
          setShow2048(false);
          if (engineRef.current) {
            engineRef.current.applyStatDelta?.({ happiness: won ? 30 : 5, boredom: -25 });
            if (won) engineRef.current.tokens = (engineRef.current.tokens || 0) + 10;
          }
        }}
      />
      <GameBreakout
        open={showBreakout}
        onEnd={({ won, score }) => {
          setShowBreakout(false);
          if (engineRef.current) {
            engineRef.current.applyStatDelta?.({ happiness: won ? 25 : 8, boredom: -20 });
            if (won) engineRef.current.tokens = (engineRef.current.tokens || 0) + 8;
          }
        }}
      />
      <GameChess
        open={showChess}
        petName={petName}
        personalityKey={personalityKey}
        onEnd={({ won, over }) => {
          setShowChess(false);
          if (engineRef.current && over) {
            const delta = won ? { happiness: 40 } : over === 'draw' ? { happiness: 15 } : { happiness: 10 };
            engineRef.current.applyStatDelta?.(delta);
            if (won) engineRef.current.tokens = (engineRef.current.tokens || 0) + 25;
          }
        }}
      />
      <DevPanel
        open={showDev}
        onClose={() => setShowDev(false)}
        stage={stage}
        stageName={stageName}
        tokens={tokens}
        intelligence={intel}
        tuning={tuning}
        onTuningChange={devSetTuning}
        evoThresholds={evoRef.current?.thresholds}
        onForceHatch={devForceHatch}
        onForceEvolve={devForceEvolve}
        onForceDeath={devForceDeath}
        onNewPet={devNewPet}
        onAddTokens={devAddTokens}
        onWipeSave={devWipeSave}
      />

      <SettingsPanel
        open={showSettings} onClose={() => setShowSettings(false)}
        petPos={petPos} onPetPos={(p) => { if (p === 'float') popOut(); else setPetPos(p); }}
        theme={theme} onTheme={setTheme}
        alwaysOnTop={alwaysOnTop} onAlwaysOnTop={setAlwaysOnTop}
        usage={usage}
        blockOverage={blockOverage}
        onBlockOverage={setBlockOverage}
        onResetUsage={() => window.claudigotchi?.resetSessionUsage()}
      />
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const STAGE_EMOJI = ['🥚', '🫧', '🐣', '🐾', '💀'];

function updateLastAssistant(messages, assistantId, text) {
  return messages.map(m => {
    if (m.id !== assistantId) return m;
    const blocks = [...(m.blocks ?? [])];
    // Update the first text block (or push one if missing)
    const idx = blocks.findIndex(b => b.type === 'text');
    if (idx >= 0) blocks[idx] = { ...blocks[idx], text };
    else blocks.unshift({ type: 'text', text });
    return { ...m, blocks };
  });
}

function appendBlockToLastAssistant(messages, assistantId, block) {
  return messages.map(m => m.id === assistantId
    ? { ...m, blocks: [...(m.blocks ?? []), block] }
    : m);
}

/** Update the most recent thinking block on the given assistant message. */
function updateLastThinking(messages, assistantId, text, streaming) {
  return messages.map(m => {
    if (m.id !== assistantId) return m;
    const blocks = [...(m.blocks ?? [])];
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (blocks[i].type === 'thinking') {
        blocks[i] = { ...blocks[i], text, streaming };
        return { ...m, blocks };
      }
    }
    return m;
  });
}

function updateToolBlock(messages, toolId, result, isError) {
  return messages.map(m => {
    const blocks = (m.blocks ?? []).map(b =>
      b.type === 'tool' && b.toolId === toolId
        ? { ...b, result, isError }
        : b
    );
    return { ...m, blocks };
  });
}

function countToolCalls(messages) {
  let n = 0;
  for (const m of messages) for (const b of (m.blocks ?? [])) if (b.type === 'tool') n++;
  return n;
}

function countCodeBlocks(text) {
  if (!text) return 0;
  return (text.match(/```/g)?.length ?? 0) / 2 | 0;
}

function fmtTokens(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

const S = {
  root:        { width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0d0d12', color: '#eee', overflow: 'hidden', userSelect: 'none' },
  loading:     { width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d12', color: '#555', fontSize: 14, letterSpacing: 3 },
  titleBar:    { height: 36, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', background: '#111', borderBottom: '1px solid #1e1e1e', WebkitAppRegion: 'drag', flexShrink: 0 },
  titleText:   { fontSize: 13, fontWeight: 600, letterSpacing: 1 },
  winControls: { display: 'flex', gap: 6, WebkitAppRegion: 'no-drag' },
  winBtn:      { width: 26, height: 22, borderRadius: 4, border: '1px solid #2a2a2a', background: '#1a1a1a', color: '#888', cursor: 'pointer', fontSize: 11 },
  winBtnX:     { width: 26, height: 22, borderRadius: 4, border: '1px solid #2a2a2a', background: '#1a1a1a', color: '#e74c3c', cursor: 'pointer', fontSize: 11 },
  usageBadge:  { WebkitAppRegion: 'no-drag', padding: '3px 10px', borderRadius: 6, border: '1px solid #222', background: '#0e0e14', color: '#aaa', fontSize: 10, fontFamily: 'Consolas, monospace', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  devBadge:    { WebkitAppRegion: 'no-drag', padding: '3px 8px', borderRadius: 6, border: '1px solid #7c3aed', background: '#1a0d2e', color: '#a855f7', fontSize: 9, fontFamily: 'Consolas, monospace', fontWeight: 700, cursor: 'pointer', letterSpacing: 1 },
  overageDot:  { color: '#ffd166' },
  titleSpacer: { flex: 1 },
  artifactColumn: { width: 460, minWidth: 300, maxWidth: '50%', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' },
  mainArea:    { flex: 1, display: 'flex', overflow: 'hidden' },
  sidebar:     { width: 220, borderRight: '1px solid #1e1e1e', flexShrink: 0, overflow: 'hidden', background: '#0a0a0f' },
  chatArea:    { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  petBottom:   { height: 300, borderTop: '1px solid #1e1e1e', flexShrink: 0, background: '#0a0a0f' },
  petTop:      { height: 300, borderBottom: '1px solid #1e1e1e', flexShrink: 0, background: '#0a0a0f' },
  petRight:    { width: 360, borderLeft: '1px solid #1e1e1e', flexShrink: 0, background: '#0a0a0f' },
  floatHint:   { padding: '8px 14px', background: '#1a1a2a', color: '#888', fontSize: 11, textAlign: 'center', borderTop: '1px solid #1e1e1e' },
};
