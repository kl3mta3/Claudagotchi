import { useEffect, useRef, useMemo } from 'react';
import { CodeBlock } from './CodeBlock.jsx';
import { ToolUseDisplay } from './ToolUseDisplay.jsx';
import { ThinkingBlock }  from './ThinkingBlock.jsx';
import { QuestionCard }   from './QuestionCard.jsx';
import { SubAgentBlock }  from './SubAgentBlock.jsx';
import { useState }       from 'react';
import { ImagePreview, isImagePath } from './ImagePreview.jsx';

/**
 * ChatPanel.jsx
 * Renders the message thread. Each message has:
 *   { id, role: 'user'|'assistant', blocks: [{type:'text'|'code'|'tool', ...}] }
 * Streaming is incremental — App.jsx mutates the last assistant message's text block.
 */
export function ChatPanel({ messages, streaming, onSetGroupAnswer, onSubmitGroup }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  return (
    <div ref={scrollRef} style={S.scroll}>
      {messages.length === 0 && (
        <div style={S.empty}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
          <div>Start a conversation with Claude.</div>
          <div style={S.emptyHint}>Your pet reacts as work happens.</div>
        </div>
      )}
      {(() => {
        // Find the actual last ASSISTANT message index — trailing system
        // messages (achievement unlocks etc) would otherwise stop the egg
        // stamp from rendering because the last index belongs to system.
        let lastAssistantIdx = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant') { lastAssistantIdx = i; break; }
        }
        return messages.map((msg, idx) => (
          <Message
            key={msg.id}
            message={msg}
            isLastAssistant={idx === lastAssistantIdx}
            streaming={streaming}
            onSetGroupAnswer={onSetGroupAnswer}
            onSubmitGroup={onSubmitGroup}
          />
        ));
      })()}
      <style>{`
        @keyframes cgdot { 0%,80%,100%{opacity:.2} 40%{opacity:1} }
      `}</style>
    </div>
  );
}

function Message({ message, onSetGroupAnswer, onSubmitGroup, isLastAssistant = false, streaming = false }) {
  const isUser = message.role === 'user';
  // Group consecutive tool/subagent blocks into "Work" runs so a long task's
  // 30 Write/Bash calls don't drown out the agent's prose. Each run is one
  // expandable accordion that opens to show its individual tool cards.
  const groupedBlocks = groupWorkBlocks(message.blocks ?? []);
  return (
    <div style={{ ...S.row, justifyContent: 'flex-start' }}>
      <div style={{ ...S.bubble, ...(isUser ? S.userBubble : S.assistantBubble) }}>
        {groupedBlocks.map((b, i) => {
          if (b.type === 'workRun') return <WorkRun key={i} items={b.items} />;
          if (b.type === 'text')      return <TextBlock key={i} text={b.text} />;
          if (b.type === 'code')      return <CodeBlock key={i} code={b.code} language={b.language} />;
          if (b.type === 'tool')      return <ToolUseDisplay key={i} name={b.name} input={b.input} result={b.result} isError={b.isError} />;
          if (b.type === 'subagent')  return (
            <SubAgentBlock
              key={i}
              description={b.description}
              prompt={b.prompt}
              subagentType={b.subagentType}
              result={b.result}
              isError={b.isError}
              streaming={b.streaming}
            />
          );
          if (b.type === 'thinking')  return <ThinkingBlock key={i} text={b.text} streaming={b.streaming} />;
          if (b.type === 'question')  return (
            // Legacy placeholder while the group is still streaming.
            <QuestionCard key={i} question={b.question} options={b.options || []} answered={false} />
          );
          if (b.type === 'question_group') return (
            <QuestionCard
              key={i}
              group={b.questions}
              submitted={b.submitted}
              onPick={(qIdx, label) => onSetGroupAnswer?.(message.id, i, qIdx, label)}
              onSubmit={() => onSubmitGroup?.(message.id, i)}
            />
          );
          return null;
        })}
        {!isUser && isLastAssistant && (message.streamStartedAt || message.streamDoneAt) && (
          <TurnStatusLine
            startedAt={message.streamStartedAt}
            doneAt={message.streamDoneAt}
            tokens={message.tokensTotal || 0}
            streaming={streaming}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Inline "turn status" line that sits at the top of the active assistant
 * bubble. While streaming: shows a live elapsed timer + rough token estimate
 * ("⏱ 4s · ~210 tokens"). When the turn completes: briefly shows a "🥚 ✓"
 * stamp with final stats, then auto-fades after 6s. Mirrors the Claude
 * desktop pattern of an in-thread status pill that settles per response.
 */
function TurnStatusLine({ startedAt, doneAt, tokens, streaming }) {
  const [now, setNow] = useState(Date.now());
  const [hidden, setHidden] = useState(false);

  // Live elapsed-time ticker while streaming.
  useEffect(() => {
    if (!streaming) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [streaming]);

  // Auto-hide a few seconds after the turn completes — keep the page clean.
  useEffect(() => {
    if (!doneAt) return;
    const t = setTimeout(() => setHidden(true), 6000);
    return () => clearTimeout(t);
  }, [doneAt]);

  if (hidden) return null;
  const elapsedMs = (doneAt || now) - (startedAt || now);
  const elapsedSec = Math.max(0, Math.round(elapsedMs / 1000));
  // Token count is only authoritative after the result envelope. While
  // streaming we don't have a live count, so show a "thinking…" badge.
  const isDone = !streaming && !!doneAt;
  const tokensLabel = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k tokens`
                   : tokens > 0      ? `${tokens} tokens`
                                     : 'tokens…';
  return (
    <div style={STSL.bar}>
      <span>{isDone ? '🥚 ✓' : '⏱'}</span>
      <span>{elapsedSec}s</span>
      <span style={STSL.sep}>·</span>
      <span>{tokensLabel}</span>
    </div>
  );
}
const STSL = {
  bar: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#777', padding: '2px 0 6px', fontFamily: 'Consolas, monospace' },
  sep: { color: '#444' },
};

/** Render plain text, splitting out triple-backtick fenced blocks into CodeBlock,
 *  and @<imagePath> references into inline thumbnails. */
function TextBlock({ text }) {
  if (!text) return null;
  const parts = splitFences(text);
  return (
    <div>
      {parts.map((p, i) => p.type === 'code'
        ? <CodeBlock key={i} code={p.code} language={p.language} />
        : <TextWithImages key={i} text={p.text} />
      )}
    </div>
  );
}

/** Split a plain text segment into runs of text and @<imagePath> refs. */
function TextWithImages({ text }) {
  // Match @C:\Users\... or @/usr/local/... ending in an image extension.
  // Greedy until whitespace; supports both Windows and POSIX paths.
  const re = /@([A-Za-z]:[\\\/][^\s\n]+?\.(?:png|jpe?g|gif|webp|bmp|ico|svg)|\/[^\s\n]+?\.(?:png|jpe?g|gif|webp|bmp|ico|svg))/gi;
  const out = [];
  let last = 0, m, key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      const before = text.slice(last, m.index).replace(/\n+$/, ''); // trim trailing newlines so image isn't pushed down
      if (before) out.push(<div key={key++} style={S.text}>{before}</div>);
    }
    const p = m[1];
    if (isImagePath(p)) {
      out.push(
        <div key={key++} style={S.imageWrap}>
          <ImagePreview path={p} maxWidth={320} maxHeight={240} />
          <div style={S.imageCaption} title={p}>{p.split(/[\\\/]/).pop()}</div>
        </div>
      );
    } else {
      out.push(<div key={key++} style={S.text}>{m[0]}</div>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    const tail = text.slice(last).replace(/^\n+/, '');
    if (tail) out.push(<div key={key++} style={S.text}>{tail}</div>);
  }
  if (out.length === 0) return <div style={S.text}>{text}</div>;
  return <>{out}</>;
}

/**
 * Walk a block list and combine RUNS of tool / subagent blocks into a single
 * 'workRun' wrapper. Text / code / thinking / questions split the run so the
 * narrative flow stays intact between bursts of tool calls.
 */
function groupWorkBlocks(blocks) {
  const out = [];
  let run = null;
  for (const b of blocks) {
    if (b.type === 'tool' || b.type === 'subagent') {
      if (!run) { run = { type: 'workRun', items: [] }; out.push(run); }
      run.items.push(b);
    } else {
      run = null;
      out.push(b);
    }
  }
  return out;
}

/**
 * Compact "Work · N steps" accordion that opens to show the underlying tool /
 * subagent cards inline. Collapsed by default once the run has more than one
 * step; a single-step run renders inline (no point hiding one card).
 */
function WorkRun({ items = [] }) {
  const [open, setOpen] = useState(items.length <= 1);
  if (items.length === 0) return null;
  const errors = items.filter(i => i.isError).length;
  const subagents = items.filter(i => i.type === 'subagent').length;
  return (
    <div style={WS.wrap}>
      <button style={WS.header} onClick={() => setOpen(o => !o)}>
        <span style={WS.chev}>{open ? '▾' : '▸'}</span>
        <span style={WS.label}>Work</span>
        <span style={WS.count}>· {items.length} step{items.length === 1 ? '' : 's'}</span>
        {subagents > 0 && <span style={WS.sub}>· {subagents} sub-agent{subagents === 1 ? '' : 's'}</span>}
        {errors > 0    && <span style={WS.err}>· {errors} error{errors === 1 ? '' : 's'}</span>}
      </button>
      {open && (
        <div style={WS.body}>
          {items.map((b, i) => b.type === 'subagent'
            ? <SubAgentBlock key={i} description={b.description} prompt={b.prompt} subagentType={b.subagentType} result={b.result} isError={b.isError} streaming={b.streaming} />
            : <ToolUseDisplay key={i} name={b.name} input={b.input} result={b.result} isError={b.isError} />
          )}
        </div>
      )}
    </div>
  );
}

const WS = {
  wrap:   { margin: '4px 0', borderLeft: '2px solid #2a2a3a', paddingLeft: 4 },
  header: { display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', textAlign: 'left' },
  chev:   { color: '#555', width: 10 },
  label:  { color: '#aab', fontWeight: 600 },
  count:  { color: '#666' },
  sub:    { color: '#a855f7' },
  err:    { color: '#ff8d8d' },
  body:   { paddingLeft: 8, marginTop: 2 },
};

function splitFences(text) {
  const out = [];
  const re = /```(\w+)?\n?([\s\S]*?)```/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
    out.push({ type: 'code', language: m[1] || 'plaintext', code: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}

const S = {
  scroll:    { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 },
  empty:     { margin: 'auto', textAlign: 'center', color: '#444', fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  emptyHint: { fontSize: 11, color: '#333', marginTop: 6 },
  row:       { display: 'flex', width: '100%' },
  bubble:    { borderRadius: 12, fontSize: 13, lineHeight: 1.55, wordWrap: 'break-word', userSelect: 'text', cursor: 'text' },
  userBubble:      { background: '#1f1f33', color: '#e8e8ff', borderTopLeftRadius: 4, padding: '10px 14px', maxWidth: '85%' },
  assistantBubble: { color: '#e6e6e6', padding: '2px 0', width: '100%' },
  text:      { whiteSpace: 'pre-wrap' },
  imageWrap: { margin: '6px 0', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
  imageCaption: { fontSize: 9, color: '#777', fontFamily: 'Consolas, monospace', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  typing:    { display: 'flex', gap: 4, padding: '6px 14px' },
  dot:       { width: 6, height: 6, borderRadius: 3, background: '#6c63ff', animation: 'cgdot 1.4s infinite ease-in-out' },
};
