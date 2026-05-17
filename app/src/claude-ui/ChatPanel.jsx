import { useEffect, useRef } from 'react';
import { CodeBlock } from './CodeBlock.jsx';
import { ToolUseDisplay } from './ToolUseDisplay.jsx';
import { ThinkingBlock }  from './ThinkingBlock.jsx';
import { QuestionCard }   from './QuestionCard.jsx';
import { ImagePreview, isImagePath } from './ImagePreview.jsx';

/**
 * ChatPanel.jsx
 * Renders the message thread. Each message has:
 *   { id, role: 'user'|'assistant', blocks: [{type:'text'|'code'|'tool', ...}] }
 * Streaming is incremental — App.jsx mutates the last assistant message's text block.
 */
export function ChatPanel({ messages, streaming, onAnswerQuestion }) {
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
      {messages.map(msg => (
        <Message key={msg.id} message={msg} onAnswerQuestion={onAnswerQuestion} />
      ))}
      {streaming && (
        <div style={S.typing}>
          <span style={S.dot} /><span style={{ ...S.dot, animationDelay: '0.15s' }} /><span style={{ ...S.dot, animationDelay: '0.3s' }} />
        </div>
      )}
      <style>{`
        @keyframes cgdot { 0%,80%,100%{opacity:.2} 40%{opacity:1} }
      `}</style>
    </div>
  );
}

function Message({ message, onAnswerQuestion }) {
  const isUser = message.role === 'user';
  return (
    <div style={{ ...S.row, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{ ...S.bubble, ...(isUser ? S.userBubble : S.assistantBubble) }}>
        {(message.blocks ?? []).map((b, i) => {
          if (b.type === 'text')      return <TextBlock key={i} text={b.text} />;
          if (b.type === 'code')      return <CodeBlock key={i} code={b.code} language={b.language} />;
          if (b.type === 'tool')      return <ToolUseDisplay key={i} name={b.name} input={b.input} result={b.result} isError={b.isError} />;
          if (b.type === 'thinking')  return <ThinkingBlock key={i} text={b.text} streaming={b.streaming} />;
          if (b.type === 'question')  return (
            <QuestionCard
              key={i}
              question={b.question}
              options={b.options}
              answered={b.answered}
              onAnswer={(label, opt) => onAnswerQuestion?.(message.id, i, label, opt)}
            />
          );
          return null;
        })}
      </div>
    </div>
  );
}

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
  bubble:    { maxWidth: '85%', borderRadius: 12, padding: '10px 14px', fontSize: 13, lineHeight: 1.55, wordWrap: 'break-word', userSelect: 'text', cursor: 'text' },
  userBubble:      { background: '#1f1f33', color: '#e8e8ff', borderTopRightRadius: 4 },
  assistantBubble: { background: '#15151b', color: '#e6e6e6', border: '1px solid #1f1f28', borderTopLeftRadius: 4 },
  text:      { whiteSpace: 'pre-wrap' },
  imageWrap: { margin: '6px 0', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
  imageCaption: { fontSize: 9, color: '#777', fontFamily: 'Consolas, monospace', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  typing:    { display: 'flex', gap: 4, padding: '6px 14px' },
  dot:       { width: 6, height: 6, borderRadius: 3, background: '#6c63ff', animation: 'cgdot 1.4s infinite ease-in-out' },
};
