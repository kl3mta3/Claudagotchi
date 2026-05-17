import { useRef, useState } from 'react';
import { ImagePreview, isImagePath } from './ImagePreview.jsx';

export const MODELS = [
  { id: 'claude-opus-4-7',     label: 'Opus 4.7',        shortcut: '1' },
  { id: 'claude-opus-4-7-1m',  label: 'Opus 4.7 1M',     shortcut: '2' },
  { id: 'claude-sonnet-4-6',   label: 'Sonnet 4.6',      shortcut: '3' },
  { id: 'claude-haiku-4-5',    label: 'Haiku 4.5',       shortcut: '4' },
  { id: 'claude-opus-4-6',     label: 'Opus 4.6 Legacy', shortcut: '5' },
];

export const PERMISSION_MODES = [
  { id: 'default',           label: 'Ask',  hint: 'Prompts before tool calls' },
  { id: 'acceptEdits',       label: 'Auto', hint: 'Auto-accepts edits' },
  { id: 'plan',              label: 'Plan', hint: 'Read-only; agent must exit plan first' },
  { id: 'bypassPermissions', label: 'YOLO', hint: 'No prompts — full trust' },
];

export const EFFORTS = [
  { id: 'low',    label: 'Low'    },
  { id: 'medium', label: 'Medium' },
  { id: 'high',   label: 'High'   },
  { id: 'xhigh',  label: 'X-High' },
  { id: 'max',    label: 'Max'    },
];

export function InputBar({
  onSend, onAttach,
  currentFolder, disabled,
  mode = 'code',
  model, onModelChange,
  permissionMode, onPermissionModeChange,
  effort, onEffortChange,
  fastMode, onFastModeChange,
}) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState([]); // [{ path, name }]
  const taRef = useRef(null);

  function send() {
    const text = value.trim();
    if (!text && attachments.length === 0) return;
    if (disabled) return;
    const attachLines = attachments.map(a => '@' + a.path).join('\n');
    const fullMessage = attachLines
      ? (text ? `${text}\n\n${attachLines}` : attachLines)
      : text;
    onSend(fullMessage);
    setValue('');
    setAttachments([]);
    if (taRef.current) taRef.current.style.height = 'auto';
  }

  function addAttachments(paths) {
    if (!paths?.length) return;
    setAttachments(prev => {
      const seen = new Set(prev.map(p => p.path));
      const fresh = paths
        .filter(p => p && !seen.has(p))
        .map(p => ({ path: p, name: String(p).split(/[\\/]/).pop() }));
      return [...prev, ...fresh];
    });
  }

  function removeAttachment(i) {
    setAttachments(prev => prev.filter((_, idx) => idx !== i));
  }

  function keyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function autoGrow(e) {
    setValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  }

  async function pickFile() {
    if (!window.claudigotchi) return;
    const files = await window.claudigotchi.pickFile();
    if (files?.length) addAttachments(files);
  }

  /** Intercept clipboard paste: images get saved to disk + attached; text falls
   *  through to the textarea's native paste behavior. */
  async function handlePaste(e) {
    if (!window.claudigotchi?.saveTempImage) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageItems = [];
    for (const it of items) {
      if (it.kind === 'file' && it.type.startsWith('image/')) imageItems.push(it);
    }
    if (imageItems.length === 0) return; // text/other → let native paste run

    e.preventDefault();
    const saved = [];
    for (const it of imageItems) {
      const blob = it.getAsFile();
      if (!blob) continue;
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload  = () => res(String(r.result).split(',')[1] || '');
        r.onerror = () => rej(r.error);
        r.readAsDataURL(blob);
      });
      const ext = (it.type.split('/')[1] || 'png').toLowerCase();
      const result = await window.claudigotchi.saveTempImage({ base64, ext });
      if (result?.ok && result.path) saved.push(result.path);
    }
    if (saved.length) addAttachments(saved);
  }

  const folderLabel = currentFolder
    ? currentFolder.split(/[\\/]/).filter(Boolean).slice(-2).join('/')
    : 'no folder';

  const modelObj = MODELS.find(m => m.id === model) || MODELS[0];
  const modeObj  = PERMISSION_MODES.find(m => m.id === permissionMode) || PERMISSION_MODES[0];

  // Fast mode only sensible on Opus 4.6 / legacy
  const fastEligible = /opus.*4[-.]?6/i.test(modelObj.label);

  return (
    <div style={S.wrap}>
      <div style={S.contextRow}>
        {mode === 'code' && (
          <span style={S.chip} title={currentFolder || 'no folder'}>📁 {folderLabel}</span>
        )}
        <button style={S.iconBtn} onClick={pickFile} title="Attach file (or paste an image)">📎</button>
        <div style={S.flexSpacer} />
        <Dropdown label={modelObj.label} title="Model">
          {MODELS.map(m => (
            <DropItem key={m.id} active={m.id === model} onClick={() => onModelChange?.(m.id)}>
              {m.label}<span style={S.kbd}>{m.shortcut}</span>
            </DropItem>
          ))}
        </Dropdown>
        {mode === 'code' && (
          <Dropdown label={modeObj.label} accent="#7c3aed" title={modeObj.hint}>
            {PERMISSION_MODES.map(m => (
              <DropItem key={m.id} active={m.id === permissionMode} onClick={() => onPermissionModeChange?.(m.id)}>
                <div style={S.modeLabel}>{m.label}</div>
                <div style={S.modeHint}>{m.hint}</div>
              </DropItem>
            ))}
          </Dropdown>
        )}
        <Dropdown label={(EFFORTS.find(e => e.id === effort) || EFFORTS[1]).label} title="Effort">
          {EFFORTS.map(e => (
            <DropItem key={e.id} active={e.id === effort} onClick={() => onEffortChange?.(e.id)}>{e.label}</DropItem>
          ))}
        </Dropdown>
        {fastEligible && (
          <label style={S.fastToggle} title="Faster output, only on Opus 4.6">
            <input type="checkbox" checked={!!fastMode} onChange={e => onFastModeChange?.(e.target.checked)} />
            <span>Fast</span>
          </label>
        )}
      </div>
      {attachments.length > 0 && (
        <div style={S.attachRow}>
          {attachments.map((a, i) => isImagePath(a.path)
            ? (
              <span key={a.path} style={S.attachThumb} title={a.path}>
                <ImagePreview path={a.path} maxWidth={56} maxHeight={56} style={{ borderRadius: 4 }} />
                <button style={S.thumbX} onClick={() => removeAttachment(i)} title="Remove">×</button>
              </span>
            )
            : (
              <span key={a.path} style={S.attachChip} title={a.path}>
                📎 {a.name}
                <button style={S.attachX} onClick={() => removeAttachment(i)} title="Remove">×</button>
              </span>
            )
          )}
        </div>
      )}
      <div style={S.row}>
        <textarea
          ref={taRef}
          value={value}
          onChange={autoGrow}
          onKeyDown={keyDown}
          onPaste={handlePaste}
          placeholder={disabled ? 'Claude is thinking…' : 'Ask Claude to do something… (Enter to send, Shift+Enter for newline)'}
          rows={1}
          disabled={disabled}
          style={S.textarea}
        />
        <button style={{ ...S.send, opacity: !value.trim() || disabled ? 0.4 : 1 }} onClick={send} disabled={!value.trim() || disabled}>
          ↑
        </button>
      </div>
    </div>
  );
}

function Dropdown({ label, accent, title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={S.ddWrap}>
      <button
        title={title}
        style={{ ...S.ddBtn, ...(accent ? { color: accent, borderColor: accent + '55' } : {}) }}
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      >
        {label} <span style={S.chevron}>▾</span>
      </button>
      {open && (
        <div style={S.ddMenu}>
          {children}
        </div>
      )}
    </div>
  );
}

function DropItem({ active, onClick, children }) {
  return (
    <div
      style={{ ...S.ddItem, ...(active ? S.ddItemActive : {}) }}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    >
      {active && <span style={S.checkmark}>✓ </span>}
      {children}
    </div>
  );
}

const S = {
  wrap:     { borderTop: '1px solid #1e1e1e', padding: 10, background: '#0c0c11', flexShrink: 0 },
  contextRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  chip:     { fontSize: 11, color: '#888', background: '#15151b', padding: '3px 8px', borderRadius: 10, border: '1px solid #1f1f28', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  iconBtn:  { background: 'transparent', border: '1px solid #222', color: '#888', cursor: 'pointer', padding: '2px 8px', borderRadius: 6, fontSize: 12 },
  flexSpacer: { flex: 1 },
  row:      { display: 'flex', gap: 8, alignItems: 'flex-end' },
  textarea: { flex: 1, resize: 'none', background: '#15151b', color: '#e8e8e8', border: '1px solid #222', borderRadius: 10, padding: '10px 12px', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', outline: 'none', minHeight: 38, maxHeight: 160 },
  send:     { width: 38, height: 38, borderRadius: 10, border: 'none', background: '#6c63ff', color: '#fff', cursor: 'pointer', fontSize: 18, fontWeight: 700, flexShrink: 0 },
  attachRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  attachChip:{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 4px 3px 8px', background: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 6, fontSize: 11, color: '#bbb', maxWidth: 240, overflow: 'hidden' },
  attachX:   { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '0 4px', fontSize: 13, lineHeight: 1 },
  attachThumb:{ position: 'relative', display: 'inline-block', padding: 2, background: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 6, lineHeight: 0 },
  thumbX:    { position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, border: 'none', background: '#3a1a1a', color: '#ff8d8d', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' },

  // Dropdown
  ddWrap:   { position: 'relative' },
  ddBtn:    { background: '#15151b', border: '1px solid #2a2a2a', color: '#bbb', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' },
  chevron:  { fontSize: 9, opacity: 0.6 },
  ddMenu:   { position: 'absolute', bottom: '100%', right: 0, marginBottom: 4, background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: 4, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 50 },
  ddItem:   { padding: '6px 10px', borderRadius: 4, color: '#ccc', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ddItemActive: { background: '#1a1a2a' },
  kbd:      { background: '#0a0a0f', padding: '0 5px', borderRadius: 3, fontSize: 9, color: '#777' },
  modeLabel:{ fontSize: 11, fontWeight: 600, color: '#ddd' },
  modeHint: { fontSize: 9, color: '#777', marginTop: 1 },
  checkmark:{ color: '#6c63ff', fontSize: 10 },
  fastToggle: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#ffd166', cursor: 'pointer' },
};
