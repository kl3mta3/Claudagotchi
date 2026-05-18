import { useEffect, useRef } from 'react';
import { EditorState }      from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput,
  foldGutter, foldKeymap,
} from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import {
  autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap,
} from '@codemirror/autocomplete';
import { lintKeymap, lintGutter, linter } from '@codemirror/lint';
import { javascript } from '@codemirror/lang-javascript';
import { html }       from '@codemirror/lang-html';
import { css }        from '@codemirror/lang-css';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { markdown }   from '@codemirror/lang-markdown';
import { python }     from '@codemirror/lang-python';
import { dracula }    from '@uiw/codemirror-theme-dracula';
import { gitDiffExtension, createDiffUpdater } from './gitDiffExt.js';
import { formatBufferIfPossible } from './formatOnSave.js';

/** Pick a CodeMirror language extension by file extension. Falls through to
 *  no language pack (still gets gutter / theme / line numbers) for anything
 *  we haven't wired. Add packs as the user requests more coverage. */
function langExtensionFor(ext) {
  switch ((ext || '').toLowerCase()) {
    case 'js': case 'jsx': case 'mjs': case 'cjs':            return [javascript({ jsx: true })];
    case 'ts': case 'tsx':                                     return [javascript({ jsx: true, typescript: true })];
    case 'html': case 'htm':                                   return [html()];
    case 'css': case 'scss': case 'less':                      return [css()];
    // JSON also gets the parse linter — surfaces syntax errors in the gutter.
    case 'json': case 'jsonc':                                 return [json(), linter(jsonParseLinter())];
    case 'md': case 'markdown':                                return [markdown()];
    case 'py':                                                 return [python()];
    default: return null;
  }
}

/**
 * Thin React wrapper around CodeMirror 6. Replaces the old plain <textarea>
 * editor in ArtifactFileView with line numbers, syntax highlighting,
 * bracket matching, undo/redo, find/replace (Ctrl+F), and a dark theme.
 *
 * Props:
 *   value      — current text
 *   onChange   — (newText) => void
 *   language   — file extension string, used to pick a language pack
 *   readOnly   — boolean, default false
 */
export function CodeMirrorEditor({ value = '', onChange, language, readOnly = false, filePath = null, refreshDiffKey = 0 }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const diffUpdaterRef = useRef(null);
  // Keep latest onChange in a ref so the EditorView update listener (set up
  // once) can call the current callback without recreating the editor.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Create the editor once.
  useEffect(() => {
    if (!hostRef.current) return;
    const langExt = langExtensionFor(language);
    const state = EditorState.create({
      doc: value,
      extensions: [
        // Gutters + visuals
        lineNumbers(),
        foldGutter(),
        lintGutter(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        highlightSelectionMatches(),
        // Selection / cursor
        drawSelection(),
        dropCursor(),
        // Alt+drag → rectangular select; Alt-hover → crosshair cue.
        rectangularSelection(),
        crosshairCursor(),
        // Editing
        history(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        // Autocomplete (Ctrl+Space; brackets/tags via close-brackets)
        autocompletion(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        // Keymaps — order matters; later wins. Tab indents (vs default focus-shift).
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,        // Ctrl+F find, Ctrl+H replace, F3 next
          ...historyKeymap,       // Ctrl+Z / Ctrl+Y
          ...foldKeymap,          // Ctrl+Shift+[ fold, Ctrl+Shift+] unfold
          ...completionKeymap,    // Ctrl+Space, Tab to accept
          ...lintKeymap,          // F8 next diagnostic
          indentWithTab,
        ]),
        EditorView.lineWrapping,
        // Force the editor to fill its host AND own its own scroller, so
        // mouse-wheel + scrollbars work inside the artifact panel.
        EditorView.theme({
          '&':           { height: '100%' },
          '.cm-scroller':{ overflow: 'auto' },
        }),
        dracula,
        EditorState.readOnly.of(readOnly),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
        }),
        // Git diff line decorations (green = add, red = remove, yellow = mod).
        // The decorations are populated by createDiffUpdater(view).refresh().
        ...gitDiffExtension(),
        ...(langExt ? langExt : []),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    diffUpdaterRef.current = createDiffUpdater(view);
    // Initial diff load
    if (filePath) diffUpdaterRef.current.refresh(filePath);
    return () => { view.destroy(); viewRef.current = null; diffUpdaterRef.current = null; };
    // Recreate the editor when language or readOnly changes — extensions are
    // baked into the state at construction time and reconfiguring them via
    // StateEffect would be more code than just remounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly]);

  // When the EXTERNAL value changes (different file loaded, programmatic
  // reset), swap the editor doc. Skip if the new value already matches the
  // editor's current doc to avoid clobbering the user's caret mid-typing.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value ?? '' },
    });
  }, [value]);

  // Parent bumps `refreshDiffKey` whenever the file is saved (or git state
  // could have changed externally) — re-pull the diff and repaint decorations.
  useEffect(() => {
    if (!filePath) return;
    diffUpdaterRef.current?.refresh(filePath);
  }, [filePath, refreshDiffKey]);

  return <div ref={hostRef} style={S.host} />;
}

/** Imperative format-on-save helper exposed for the Save button. Wraps the
 *  format module so callers don't need to import both. Returns the (possibly
 *  formatted) text — or the original text if formatting failed / no formatter. */
CodeMirrorEditor.formatForSave = async (text, ext) => formatBufferIfPossible(text, ext);

const S = {
  host: { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
};
