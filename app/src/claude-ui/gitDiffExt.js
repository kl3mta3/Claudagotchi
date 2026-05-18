/**
 * gitDiffExt — CodeMirror 6 extension that paints line-level git-diff
 * decorations directly into the editor. Mirrors VS Code / Cursor:
 *   green background  → added line
 *   red background    → removed line shown as a "ghost" widget above next line
 *   yellow accent     → modified line (added + removed adjacent)
 *   gutter +/-/~ glyphs to call out each hunk
 *
 * Lives entirely in the renderer; the diff text comes from the main process
 * via `window.claudigotchi.gitDiffFile(absPath)` which shells out to
 * `git diff HEAD -- <path>`.
 *
 * Usage in CodeMirrorEditor:
 *   const updater = createDiffUpdater(view);
 *   updater.refresh(filePath);
 *   // call updater.refresh(filePath) again on save to re-pull diff
 */
import { Decoration, EditorView, gutter, GutterMarker, WidgetType } from '@codemirror/view';
import { StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';

const addLine = Decoration.line({ attributes: { class: 'cg-diff-add' } });
const delLine = Decoration.line({ attributes: { class: 'cg-diff-del' } });
const modLine = Decoration.line({ attributes: { class: 'cg-diff-mod' } });

// One effect to swap in a fresh diff result.
export const setDiffEffect = StateEffect.define();

const diffField = StateField.define({
  create() { return { hunks: [], deco: Decoration.none }; },
  update(value, tr) {
    let next = value;
    for (const e of tr.effects) {
      if (e.is(setDiffEffect)) {
        next = { hunks: e.value, deco: buildDeco(e.value, tr.state) };
      }
    }
    // Re-build decorations if doc changed (line numbers might shift).
    if (tr.docChanged && next.hunks.length) {
      next = { hunks: next.hunks, deco: buildDeco(next.hunks, tr.state) };
    }
    return next;
  },
  provide: f => EditorView.decorations.from(f, v => v.deco),
});

function buildDeco(hunks, state) {
  const b = new RangeSetBuilder();
  for (const h of hunks) {
    for (const line of h.lines) {
      if (line.kind === 'context') continue;
      if (line.kind === 'del') continue;            // deletions shown via gutter only (we can't decorate non-existent lines)
      const ln = line.newLineNo;
      if (!ln || ln > state.doc.lines) continue;
      const lineObj = state.doc.line(ln);
      const dec = line.kind === 'add' ? addLine
                : line.kind === 'mod' ? modLine : addLine;
      b.add(lineObj.from, lineObj.from, dec);
    }
  }
  return b.finish();
}

class DiffMarker extends GutterMarker {
  constructor(sym, cls) { super(); this.sym = sym; this.cls = cls; }
  toDOM() {
    const el = document.createElement('span');
    el.className = `cg-diff-gutter ${this.cls}`;
    el.textContent = this.sym;
    return el;
  }
}
const ADD_MARK = new DiffMarker('+', 'cg-diff-gutter-add');
const DEL_MARK = new DiffMarker('−', 'cg-diff-gutter-del');
const MOD_MARK = new DiffMarker('~', 'cg-diff-gutter-mod');

const diffGutter = gutter({
  class: 'cg-diff-gutter-col',
  lineMarker(view, line) {
    const f = view.state.field(diffField, false);
    if (!f) return null;
    const lineNo = view.state.doc.lineAt(line.from).number;
    for (const h of f.hunks) {
      for (const l of h.lines) {
        if (l.newLineNo === lineNo) {
          if (l.kind === 'add') return ADD_MARK;
          if (l.kind === 'mod') return MOD_MARK;
          if (l.kind === 'del-marker') return DEL_MARK;
        }
      }
    }
    return null;
  },
  initialSpacer: () => ADD_MARK,
});

const diffTheme = EditorView.baseTheme({
  '.cg-diff-add':         { backgroundColor: 'rgba(46, 160, 67, 0.18)' },
  '.cg-diff-mod':         { backgroundColor: 'rgba(187, 128, 9, 0.18)' },
  '.cg-diff-del':         { backgroundColor: 'rgba(248, 81, 73, 0.20)', textDecoration: 'line-through', opacity: 0.55 },
  '.cg-diff-gutter-col':  { width: '12px', textAlign: 'center', color: '#666', fontFamily: 'Consolas, monospace' },
  '.cg-diff-gutter-add':  { color: '#2ea043', fontWeight: 'bold' },
  '.cg-diff-gutter-del':  { color: '#f85149', fontWeight: 'bold' },
  '.cg-diff-gutter-mod':  { color: '#bb8009', fontWeight: 'bold' },
});

/** Public extension list — drop this into your CodeMirror extensions array. */
export function gitDiffExtension() {
  return [diffField, diffGutter, diffTheme];
}

/**
 * Parse a unified-diff text blob into [{ lines: [{ kind, newLineNo }] }, ...].
 * kinds: 'context' | 'add' | 'del' | 'mod' | 'del-marker'
 *   - 'mod' marks lines that have BOTH a paired add+del (changed line)
 *   - 'del-marker' marks the new-side line below a deletion (so the gutter
 *     can show a − next to it)
 */
export function parseUnifiedDiff(text) {
  if (!text) return [];
  const hunks = [];
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const hdr = lines[i].match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (!hdr) { i++; continue; }
    const newStart = parseInt(hdr[3], 10);
    let newLine = newStart;
    i++;
    const collected = [];
    while (i < lines.length && !lines[i].startsWith('@@') && !lines[i].startsWith('diff ')) {
      const l = lines[i];
      if (l.startsWith('+') && !l.startsWith('+++')) {
        collected.push({ kind: 'add', newLineNo: newLine });
        newLine++;
      } else if (l.startsWith('-') && !l.startsWith('---')) {
        // Deletion lives on the OLD side — no new-side line number. Mark the
        // NEXT new-side line with del-marker so we can render a − in its gutter.
        collected.push({ kind: 'del', newLineNo: null, markAt: newLine });
      } else if (l.startsWith(' ') || l === '') {
        collected.push({ kind: 'context', newLineNo: newLine });
        newLine++;
      }
      i++;
    }
    // Promote add-after-del pairs into 'mod' so they show as yellow (changed)
    // instead of red+green. Operates on the collected list in order.
    for (let k = 0; k < collected.length - 1; k++) {
      if (collected[k].kind === 'del' && collected[k + 1].kind === 'add') {
        collected[k + 1].kind = 'mod';
        collected[k].kind = 'del-paired';
      }
    }
    // Inject del-marker entries so the gutter can show "−" beside the line
    // BELOW each deletion (since deletions have no row of their own).
    const withMarkers = [];
    for (const item of collected) {
      if (item.kind === 'del' && item.markAt) {
        withMarkers.push({ kind: 'del-marker', newLineNo: item.markAt });
      } else if (item.kind !== 'del' && item.kind !== 'del-paired') {
        withMarkers.push(item);
      }
    }
    hunks.push({ lines: withMarkers });
  }
  return hunks;
}

/** Convenience: poll for diff text + push the parsed hunks into the editor. */
export function createDiffUpdater(view) {
  let lastFilePath = null;
  let inFlight = false;
  async function refresh(filePath) {
    if (!filePath || !window.claudigotchi?.gitDiffFile) return;
    if (inFlight) return;
    inFlight = true;
    lastFilePath = filePath;
    try {
      const r = await window.claudigotchi.gitDiffFile(filePath);
      if (lastFilePath !== filePath) return;             // a newer refresh started
      const hunks = parseUnifiedDiff(r?.diff || '');
      view.dispatch({ effects: setDiffEffect.of(hunks) });
    } finally {
      inFlight = false;
    }
  }
  return { refresh };
}
