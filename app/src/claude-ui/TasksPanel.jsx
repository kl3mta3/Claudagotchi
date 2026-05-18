import { useEffect, useMemo, useRef } from 'react';
import { ToolUseDisplay } from './ToolUseDisplay.jsx';
import { SubAgentBlock }  from './SubAgentBlock.jsx';

/**
 * TasksPanel — right-column dedicated view of every tool / subagent call from
 * the current session. Moved out of the chat thread (where it lived as the
 * inline "▸ Work · N steps" accordion in ChatPanel) so the chat reads as
 * pure prose, like Claude Desktop.
 *
 * Reads work blocks from the same `messages` state the chat uses — no extra
 * plumbing, because every tool/subagent block is already appended to the
 * active assistant message's `blocks` array via App.jsx's
 * `appendBlockToLastAssistant`.
 *
 * Whole-session view: each assistant turn that contains any work blocks gets
 * its own collapsible section. Scrolls vertically. Auto-pins to the bottom
 * when the active turn's work-block count grows.
 */
export function TasksPanel({ messages = [], onClose }) {
  const scrollRef = useRef(null);

  // Build {turn, blocks[]} for each assistant message that contains tool or
  // subagent blocks. Order is chronological (oldest at top → newest at bottom).
  const turns = useMemo(() => {
    const out = [];
    let turnNo = 0;
    for (const m of messages) {
      if (m.role !== 'assistant') continue;
      turnNo++;
      const blocks = (m.blocks ?? []).filter(b => b.type === 'tool' || b.type === 'subagent');
      if (!blocks.length) continue;
      out.push({
        id: m.id,
        n: turnNo,
        ts: m.streamStartedAt || null,
        blocks,
      });
    }
    return out;
  }, [messages]);

  // Auto-scroll to the bottom whenever the total work-block count changes.
  // Lets users keep an eye on the LATEST tool the agent is running. If the
  // user manually scrolled up, this still wins (we can refine later).
  const totalBlocks = useMemo(
    () => turns.reduce((acc, t) => acc + t.blocks.length, 0),
    [turns],
  );
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [totalBlocks]);

  const totalErrors    = turns.reduce((acc, t) => acc + t.blocks.filter(b => b.isError).length, 0);
  const totalSubagents = turns.reduce((acc, t) => acc + t.blocks.filter(b => b.type === 'subagent').length, 0);

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span style={S.title}>🛠 Tasks</span>
        <span style={S.meta}>
          {totalBlocks} step{totalBlocks === 1 ? '' : 's'}
          {totalSubagents > 0 && <span style={{ color: '#a855f7' }}> · {totalSubagents} sub-agent{totalSubagents === 1 ? '' : 's'}</span>}
          {totalErrors    > 0 && <span style={{ color: '#ff8d8d' }}> · {totalErrors} error{totalErrors === 1 ? '' : 's'}</span>}
        </span>
        <div style={{ flex: 1 }} />
        {onClose && <button style={S.closeBtn} onClick={onClose} title="Hide tasks panel">✕</button>}
      </div>

      <div ref={scrollRef} style={S.body}>
        {turns.length === 0 && (
          <div style={S.empty}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🛠</div>
            <div>No tasks yet.</div>
            <div style={S.emptyHint}>Claude's tool calls (Bash, Edit, Read, sub-agents…) will appear here as they run.</div>
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} style={S.turn}>
            <div style={S.turnHeader}>
              <span style={S.turnNo}>Turn {t.n}</span>
              {t.ts && <span style={S.turnTime}>{formatRelativeTime(t.ts)}</span>}
              <span style={S.turnSteps}>· {t.blocks.length} step{t.blocks.length === 1 ? '' : 's'}</span>
            </div>
            <div style={S.turnBody}>
              {t.blocks.map((b, i) => b.type === 'subagent' ? (
                <SubAgentBlock
                  key={i}
                  description={b.description}
                  prompt={b.prompt}
                  subagentType={b.subagentType}
                  result={b.result}
                  isError={b.isError}
                  streaming={b.streaming}
                />
              ) : (
                <ToolUseDisplay
                  key={i}
                  name={b.name}
                  input={b.input}
                  result={b.result}
                  isError={b.isError}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "5s ago" / "3m ago" / "1h ago" — keeps the turn header compact. */
function formatRelativeTime(ts) {
  const ms = Date.now() - ts;
  if (ms < 60_000)        return `${Math.max(1, Math.floor(ms / 1000))}s ago`;
  if (ms < 3600_000)      return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 24 * 3600_000) return `${Math.floor(ms / 3600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

const S = {
  wrap:    { display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0f', borderLeft: '1px solid #1e1e1e', overflow: 'hidden' },
  header:  { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid #1a1a22', background: '#0e0e14', flexShrink: 0 },
  title:   { fontSize: 11, color: '#aab', fontWeight: 700, letterSpacing: 0.5 },
  meta:    { fontSize: 10, color: '#666' },
  closeBtn:{ background: 'transparent', border: 'none', color: '#777', cursor: 'pointer', fontSize: 13, padding: '0 6px' },
  body:    { flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 12 },
  empty:   { margin: 'auto', textAlign: 'center', color: '#555', fontSize: 12, paddingTop: 40 },
  emptyHint:{ fontSize: 10, color: '#444', marginTop: 6, maxWidth: 280, lineHeight: 1.5 },
  turn:    { borderLeft: '2px solid #2a2a3a', paddingLeft: 6 },
  turnHeader: { display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 10, color: '#888', marginBottom: 4 },
  turnNo:  { fontWeight: 700, color: '#aab' },
  turnTime:{ color: '#666' },
  turnSteps:{ color: '#666' },
  turnBody:{ display: 'flex', flexDirection: 'column', gap: 4 },
};
